import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module before any imports that use it
vi.mock('@/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { auditLog, flushAuditBuffer, getAuditBufferSize } from '@/infrastructure/audit';

describe('Audit Logging', () => {
  beforeEach(() => {
    // Flush any buffered entries from previous tests
    void flushAuditBuffer();
  });

  it('should buffer audit entries (non-blocking)', () => {
    const sizeBefore = getAuditBufferSize();

    auditLog({
      storeId: 'tenant-a',
      userId: 'user-1',
      userEmail: 'test@example.com',
      action: 'create',
      entity: 'product',
      entityId: 'prod-123',
      changes: { after: { name: 'Test Product' } },
    });

    expect(getAuditBufferSize()).toBeGreaterThan(sizeBefore);
  });

  it('should accept audit entries with all optional fields', () => {
    auditLog({
      storeId: 'tenant-a',
      userId: 'user-2',
      userEmail: 'admin@example.com',
      action: 'delete',
      entity: 'customer',
      entityId: 'cust-456',
      changes: { before: { name: 'Old Name' } },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    });

    expect(getAuditBufferSize()).toBeGreaterThan(0);
  });

  it('should flush buffer', async () => {
    auditLog({
      storeId: 'tenant-a',
      userId: 'user-3',
      userEmail: 'test@example.com',
      action: 'update',
      entity: 'sale',
      entityId: 'sale-789',
    });

    await flushAuditBuffer();
    expect(getAuditBufferSize()).toBe(0);
  });

  it('should accept all valid action types', () => {
    const actions = [
      'create',
      'update',
      'delete',
      'restore',
      'login',
      'logout',
      'export',
      'bulk_delete',
      'config_change',
    ] as const;

    for (const action of actions) {
      auditLog({
        storeId: 'tenant-a',
        userId: 'user-1',
        userEmail: 'test@example.com',
        action,
        entity: 'product',
        entityId: 'prod-1',
      });
    }

    expect(getAuditBufferSize()).toBeGreaterThan(0);
  });

  it('should accept all valid entity types', () => {
    const entities = ['product', 'category', 'sale', 'customer', 'supplier', 'promotion', 'store_config'] as const;

    for (const entity of entities) {
      auditLog({
        storeId: 'tenant-a',
        userId: 'user-1',
        userEmail: 'test@example.com',
        action: 'create',
        entity,
        entityId: `${entity}-1`,
      });
    }

    expect(getAuditBufferSize()).toBeGreaterThan(0);
  });
});
