/**
 * Domain Event Handlers — Wire Side Effects to Events
 *
 * This module registers all event handlers at startup.
 * Import once in the application bootstrap (e.g., layout.tsx or middleware).
 *
 * Handlers:
 * 1. Audit logging — records all mutations to audit_logs table
 * 2. Cache invalidation — clears stale cache on mutations
 */

import { onDomainEvent, onAnyDomainEvent, type DomainEvent } from '@/domain/events';
import { auditLog } from '@/infrastructure/audit';
import { cacheInvalidate } from '@/infrastructure/redis';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// 1. Audit Logging — records ALL domain events to audit trail
// ══════════════════════════════════════════════════════════════

onAnyDomainEvent(async (event: DomainEvent) => {
  const actionMap: Record<string, string> = {
    'sale.created': 'create',
    'sale.cancelled': 'delete',
    'product.created': 'create',
    'product.updated': 'update',
    'product.deleted': 'delete',
    'stock.critical': 'update',
    'customer.created': 'create',
    'customer.deleted': 'delete',
    'config.changed': 'config_change',
    'payment.received': 'create',
  };

  const entityMap: Record<string, string> = {
    'sale.created': 'sale',
    'sale.cancelled': 'sale',
    'product.created': 'product',
    'product.updated': 'product',
    'product.deleted': 'product',
    'stock.critical': 'product',
    'customer.created': 'customer',
    'customer.deleted': 'customer',
    'config.changed': 'store_config',
    'payment.received': 'payment_charge',
  };

  const entityIdMap: Record<string, string> = {
    'sale.created': (event.payload as Record<string, string>).saleId ?? '',
    'sale.cancelled': (event.payload as Record<string, string>).saleId ?? '',
    'product.created': (event.payload as Record<string, string>).productId ?? '',
    'product.updated': (event.payload as Record<string, string>).productId ?? '',
    'product.deleted': (event.payload as Record<string, string>).productId ?? '',
    'stock.critical': (event.payload as Record<string, string>).productId ?? '',
    'customer.created': (event.payload as Record<string, string>).customerId ?? '',
    'customer.deleted': (event.payload as Record<string, string>).customerId ?? '',
    'config.changed': event.metadata.storeId,
    'payment.received': (event.payload as Record<string, string>).chargeId ?? '',
  };

  auditLog({
    storeId: event.metadata.storeId,
    userId: event.metadata.userId,
    userEmail: event.metadata.userEmail,
    action: (actionMap[event.type] ?? 'unknown') as 'create' | 'update' | 'delete' | 'config_change',
    entity: (entityMap[event.type] ?? 'unknown') as 'product' | 'sale' | 'customer' | 'store_config' | 'payment_charge',
    entityId: entityIdMap[event.type] ?? '',
    changes: { after: event.payload as Record<string, unknown> },
  });
});

// ══════════════════════════════════════════════════════════════
// 2. Cache Invalidation — clear stale data on mutations
// ══════════════════════════════════════════════════════════════

onDomainEvent('product.created', async (event) => {
  await cacheInvalidate(`products:${event.metadata.storeId}:all`);
});

onDomainEvent('product.updated', async (event) => {
  await cacheInvalidate(`products:${event.metadata.storeId}:all`);
});

onDomainEvent('product.deleted', async (event) => {
  await cacheInvalidate(`products:${event.metadata.storeId}:all`);
});

onDomainEvent('config.changed', async (event) => {
  await cacheInvalidate(`config:${event.metadata.storeId}`);
});

logger.info('Domain event handlers registered', {
  action: 'domain_handlers_init',
});
