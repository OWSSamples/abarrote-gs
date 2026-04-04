/**
 * Domain Events — Event-Driven Decoupling
 *
 * Implements the Observer pattern for domain-level events.
 * Server actions emit events; handlers react asynchronously.
 *
 * Benefits:
 * - Decouples business logic from side effects (audit, notifications, cache)
 * - Handlers run in-process (no external broker needed yet)
 * - Typed events prevent payload mismatches
 * - Handlers are fire-and-forget (never block the main flow)
 * - Easily extensible: add handlers without modifying emitters
 *
 * Architecture:
 * - Emitters (server actions) call `emitDomainEvent(event)`
 * - Handlers registered via `onDomainEvent(type, handler)`
 * - All handlers execute concurrently via `Promise.allSettled`
 * - Failures are logged but never propagate to the caller
 *
 * @example
 * ```ts
 * // Register handler (once at startup)
 * onDomainEvent('sale.created', async (event) => {
 *   auditLog({ ... });
 * });
 *
 * // Emit from server action
 * emitDomainEvent({
 *   type: 'sale.created',
 *   payload: { saleId, folio, total, cajero },
 *   metadata: { userId, userEmail },
 * });
 * ```
 */

import { logger, getRequestContext } from '@/lib/logger';
import { isFeatureEnabled } from '@/infrastructure/feature-flags';

// ══════════════════════════════════════════════════════════════
// Event Types (Discriminated Union)
// ══════════════════════════════════════════════════════════════

interface BaseEvent {
  metadata: {
    userId: string;
    userEmail: string;
    timestamp?: Date;
    requestId?: string;
  };
}

export interface SaleCreatedEvent extends BaseEvent {
  type: 'sale.created';
  payload: {
    saleId: string;
    folio: string;
    total: number;
    paymentMethod: string;
    cajero: string;
    itemCount: number;
  };
}

export interface SaleCancelledEvent extends BaseEvent {
  type: 'sale.cancelled';
  payload: {
    saleId: string;
    folio: string;
    reason?: string;
  };
}

export interface ProductCreatedEvent extends BaseEvent {
  type: 'product.created';
  payload: {
    productId: string;
    name: string;
    sku: string;
  };
}

export interface ProductUpdatedEvent extends BaseEvent {
  type: 'product.updated';
  payload: {
    productId: string;
    changes: Record<string, unknown>;
  };
}

export interface ProductDeletedEvent extends BaseEvent {
  type: 'product.deleted';
  payload: {
    productId: string;
    name: string;
  };
}

export interface StockCriticalEvent extends BaseEvent {
  type: 'stock.critical';
  payload: {
    productId: string;
    productName: string;
    currentStock: number;
    minStock: number;
  };
}

export interface CustomerCreatedEvent extends BaseEvent {
  type: 'customer.created';
  payload: {
    customerId: string;
    name: string;
  };
}

export interface CustomerDeletedEvent extends BaseEvent {
  type: 'customer.deleted';
  payload: {
    customerId: string;
    name: string;
  };
}

export interface ConfigChangedEvent extends BaseEvent {
  type: 'config.changed';
  payload: {
    field: string;
    before: unknown;
    after: unknown;
  };
}

export interface PaymentReceivedEvent extends BaseEvent {
  type: 'payment.received';
  payload: {
    chargeId: string;
    provider: string;
    amount: number;
    status: string;
  };
}

export type DomainEvent =
  | SaleCreatedEvent
  | SaleCancelledEvent
  | ProductCreatedEvent
  | ProductUpdatedEvent
  | ProductDeletedEvent
  | StockCriticalEvent
  | CustomerCreatedEvent
  | CustomerDeletedEvent
  | ConfigChangedEvent
  | PaymentReceivedEvent;

export type DomainEventType = DomainEvent['type'];

// ══════════════════════════════════════════════════════════════
// Event Bus (In-Process)
// ══════════════════════════════════════════════════════════════

type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

// Registry: event type → array of handlers
const handlers = new Map<DomainEventType, EventHandler[]>();

// Global catch-all handlers (run for every event)
const globalHandlers: EventHandler[] = [];

/**
 * Register a handler for a specific event type.
 * Handlers are fire-and-forget — failures are logged, never propagated.
 */
export function onDomainEvent<T extends DomainEventType>(
  eventType: T,
  handler: EventHandler<Extract<DomainEvent, { type: T }>>,
): void {
  const existing = handlers.get(eventType) ?? [];
  existing.push(handler as EventHandler);
  handlers.set(eventType, existing);
}

/**
 * Register a handler that runs for ALL events (e.g., audit logging).
 */
export function onAnyDomainEvent(handler: EventHandler): void {
  globalHandlers.push(handler);
}

/**
 * Emit a domain event. All registered handlers execute concurrently.
 * Failures in handlers are logged but NEVER propagate to the caller.
 *
 * This function is intentionally synchronous (returns void, not Promise)
 * to ensure emitters never await side effects.
 */
export function emitDomainEvent(event: DomainEvent): void {
  // Feature flag gate — allows kill-switch in production
  void isFeatureEnabled('domain-events').then((enabled) => {
    if (!enabled) {
      logger.debug(`Domain events disabled by feature flag, skipping '${event.type}'`, {
        action: 'domain_event_flag_disabled',
        eventType: event.type,
      });
      return;
    }

    _dispatchEvent(event);
  });
}

/** Internal dispatch — separated from flag check for testability */
function _dispatchEvent(event: DomainEvent): void {
  // Enrich with timestamp and correlation ID
  const enriched = {
    ...event,
    metadata: {
      ...event.metadata,
      timestamp: event.metadata.timestamp ?? new Date(),
      requestId: event.metadata.requestId ?? getRequestContext()?.requestId,
    },
  };

  const typeHandlers = handlers.get(event.type) ?? [];
  const allHandlers = [...typeHandlers, ...globalHandlers];

  if (allHandlers.length === 0) {
    logger.debug(`No handlers for domain event '${event.type}'`, {
      action: 'domain_event_no_handler',
      eventType: event.type,
    });
    return;
  }

  // Fire-and-forget: execute all handlers concurrently
  void Promise.allSettled(
    allHandlers.map(async (handler) => {
      try {
        await handler(enriched);
      } catch (err) {
        logger.error(`Domain event handler failed for '${event.type}'`, {
          action: 'domain_event_handler_error',
          eventType: event.type,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    }),
  );

  logger.debug(`Domain event emitted: '${event.type}' → ${allHandlers.length} handler(s)`, {
    action: 'domain_event_emitted',
    eventType: event.type,
    handlerCount: allHandlers.length,
  });
}

/**
 * Get count of registered handlers per event type (for diagnostics).
 */
export function getDomainEventStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const [type, h] of handlers.entries()) {
    stats[type] = h.length;
  }
  stats['*'] = globalHandlers.length;
  return stats;
}

/**
 * Clear all handlers (for testing only).
 */
export function clearDomainEventHandlers(): void {
  handlers.clear();
  globalHandlers.length = 0;
}
