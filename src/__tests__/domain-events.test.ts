import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  emitDomainEvent,
  onDomainEvent,
  onAnyDomainEvent,
  clearDomainEventHandlers,
  getDomainEventStats,
  type DomainEvent,
} from '@/domain/events';

describe('Domain Events', () => {
  beforeEach(() => {
    clearDomainEventHandlers();
  });

  it('should register and invoke event-specific handler', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    onDomainEvent('sale.created', handler);

    emitDomainEvent({
      type: 'sale.created',
      payload: { saleId: 's1', folio: '001', total: 100, paymentMethod: 'efectivo', cajero: 'Admin', itemCount: 2 },
      metadata: { userId: 'u1', userEmail: 'test@test.com', storeId: 'tenant-a' },
    });

    // Handlers are fire-and-forget — wait for microtasks
    await new Promise((r) => setTimeout(r, 50));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should invoke global handlers for all events', async () => {
    const globalHandler = vi.fn().mockResolvedValue(undefined);
    onAnyDomainEvent(globalHandler);

    emitDomainEvent({
      type: 'product.created',
      payload: { productId: 'p1', name: 'Test', sku: 'TST' },
      metadata: { userId: 'u1', userEmail: 'test@test.com', storeId: 'tenant-a' },
    });

    emitDomainEvent({
      type: 'customer.created',
      payload: { customerId: 'c1', name: 'Client' },
      metadata: { userId: 'u1', userEmail: 'test@test.com', storeId: 'tenant-a' },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(globalHandler).toHaveBeenCalledTimes(2);
  });

  it('should not call handler for different event type', async () => {
    const saleHandler = vi.fn().mockResolvedValue(undefined);
    onDomainEvent('sale.created', saleHandler);

    emitDomainEvent({
      type: 'product.created',
      payload: { productId: 'p1', name: 'Test', sku: 'TST' },
      metadata: { userId: 'u1', userEmail: 'test@test.com', storeId: 'tenant-a' },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(saleHandler).not.toHaveBeenCalled();
  });

  it('should not propagate handler errors to caller', async () => {
    const failingHandler = vi.fn().mockRejectedValue(new Error('handler boom'));
    onDomainEvent('sale.created', failingHandler);

    // Should not throw even though handler rejects
    expect(() => {
      emitDomainEvent({
        type: 'sale.created',
        payload: { saleId: 's1', folio: '001', total: 100, paymentMethod: 'efectivo', cajero: 'Admin', itemCount: 2 },
        metadata: { userId: 'u1', userEmail: 'test@test.com', storeId: 'tenant-a' },
      });
    }).not.toThrow();

    await new Promise((r) => setTimeout(r, 50));
    expect(failingHandler).toHaveBeenCalledOnce();
  });

  it('should enrich events with timestamp', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    onDomainEvent('sale.created', handler);

    emitDomainEvent({
      type: 'sale.created',
      payload: { saleId: 's1', folio: '001', total: 100, paymentMethod: 'efectivo', cajero: 'Admin', itemCount: 2 },
      metadata: { userId: 'u1', userEmail: 'test@test.com', storeId: 'tenant-a' },
    });

    await new Promise((r) => setTimeout(r, 50));
    const eventArg = handler.mock.calls[0][0] as DomainEvent;
    expect(eventArg.metadata.timestamp).toBeInstanceOf(Date);
  });

  it('should report handler stats', () => {
    onDomainEvent('sale.created', vi.fn().mockResolvedValue(undefined));
    onDomainEvent('sale.created', vi.fn().mockResolvedValue(undefined));
    onDomainEvent('product.created', vi.fn().mockResolvedValue(undefined));
    onAnyDomainEvent(vi.fn().mockResolvedValue(undefined));

    const stats = getDomainEventStats();
    expect(stats['sale.created']).toBe(2);
    expect(stats['product.created']).toBe(1);
    expect(stats['*']).toBe(1);
  });

  it('should clear all handlers', () => {
    onDomainEvent('sale.created', vi.fn().mockResolvedValue(undefined));
    onAnyDomainEvent(vi.fn().mockResolvedValue(undefined));

    clearDomainEventHandlers();
    const stats = getDomainEventStats();
    expect(Object.keys(stats)).toEqual(['*']);
    expect(stats['*']).toBe(0);
  });
});
