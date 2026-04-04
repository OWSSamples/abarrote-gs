'use server';

import { requirePermission, requireAuth, validateId } from '@/lib/auth/guard';
import { validateSchema, createClienteSchema, updateClienteSchema, createFiadoSchema, createAbonoSchema, idSchema } from '@/lib/validation/schemas';
import { db } from '@/db';
import { clientes, fiadoTransactions, fiadoItems } from '@/db/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import type { Cliente, FiadoTransaction, SaleItem } from '@/types';
import { numVal } from './_helpers';
import { withLogging, AppError } from '@/lib/errors';
import { isNotDeleted, softDelete } from '@/infrastructure/soft-delete';
import { withRateLimit, STRICT } from '@/infrastructure/redis';
import { emitDomainEvent } from '@/domain/events';

// ==================== CLIENTES ====================

async function _fetchClientes(): Promise<Cliente[]> {
  await requirePermission('customers.view');
  const rows = await db.select().from(clientes).where(isNotDeleted(clientes)).orderBy(clientes.name);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    address: r.address,
    balance: numVal(r.balance),
    creditLimit: numVal(r.creditLimit),
    points: numVal(r.points),
    createdAt: r.createdAt.toISOString(),
    lastTransaction: r.lastTransaction?.toISOString() ?? null,
  }));
}

async function _createCliente(
  data: Omit<Cliente, 'id' | 'balance' | 'createdAt' | 'lastTransaction'>
): Promise<Cliente> {
  const user = await requirePermission('customers.edit');
  validateSchema(createClienteSchema, data, 'createCliente');
  const id = `cli-${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(clientes).values({
    id,
    name: data.name,
    phone: data.phone,
    address: data.address,
    balance: '0',
    creditLimit: String(data.creditLimit),
    createdAt: now,
    lastTransaction: null,
  });

  emitDomainEvent({
    type: 'customer.created',
    payload: { customerId: id, name: data.name },
    metadata: { userId: user.uid, userEmail: user.email ?? '' },
  });

  return {
    ...data,
    id,
    balance: 0,
    createdAt: now.toISOString(),
    lastTransaction: null,
  };
}

async function _updateCliente(id: string, data: Partial<Cliente>): Promise<void> {
  await requirePermission('customers.edit');
  validateSchema(idSchema, id, 'updateCliente.id');
  validateSchema(updateClienteSchema, data, 'updateCliente');
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.creditLimit !== undefined) updateData.creditLimit = String(data.creditLimit);
  if (Object.keys(updateData).length > 0) {
    await db.update(clientes).set(updateData).where(eq(clientes.id, id));
  }
}

async function _deleteCliente(id: string): Promise<void> {
  const user = await requirePermission('customers.edit');
  validateId(id, 'Cliente ID');
  // Soft delete: preserve customer data and transaction history
  await softDelete(clientes, id);

  emitDomainEvent({
    type: 'customer.deleted',
    payload: { customerId: id, name: id },
    metadata: { userId: user.uid, userEmail: user.email ?? '' },
  });
}

// ==================== FIADO ====================

async function _fetchFiadoTransactions(): Promise<FiadoTransaction[]> {
  await requirePermission('customers.view');
  const rows = await db.select().from(fiadoTransactions).orderBy(desc(fiadoTransactions.date)).limit(100);
  if (rows.length === 0) return [];

  // Batch fetch all fiado items for 'fiado' type transactions
  const fiadoIds = rows.filter(r => r.type === 'fiado').map(r => r.id);
  const allFiadoItems = fiadoIds.length > 0
    ? await db.select().from(fiadoItems).where(inArray(fiadoItems.fiadoId, fiadoIds))
    : [];

  // Group items by fiadoId
  const itemsByFiadoId = new Map<string, SaleItem[]>();
  for (const item of allFiadoItems) {
    const list = itemsByFiadoId.get(item.fiadoId) || [];
    list.push({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: numVal(item.unitPrice),
      subtotal: numVal(item.subtotal),
    });
    itemsByFiadoId.set(item.fiadoId, list);
  }

  return rows.map(r => ({
    id: r.id,
    clienteId: r.clienteId,
    clienteName: r.clienteName,
    type: r.type as 'fiado' | 'abono',
    amount: numVal(r.amount),
    description: r.description,
    saleFolio: r.saleFolio ?? undefined,
    items: itemsByFiadoId.get(r.id),
    date: r.date.toISOString(),
  }));
}

async function _createFiado(
  clienteId: string,
  amount: number,
  description: string,
  saleFolio?: string,
  items?: SaleItem[]
): Promise<void> {
  await requirePermission('customers.edit');
  validateSchema(createFiadoSchema, { clienteId, amount, description, saleFolio, items }, 'createFiado');
  const now = new Date();
  const clienteRows = await db.select().from(clientes).where(eq(clientes.id, clienteId));
  if (!clienteRows.length) {
    throw new AppError('CLIENTE_NOT_FOUND', 'Cliente no encontrado', 404);
  }

  const cliente = clienteRows[0];
  const fiadoId = `fiado-${crypto.randomUUID()}`;

  await db.insert(fiadoTransactions).values({
    id: fiadoId,
    clienteId,
    clienteName: cliente.name,
    type: 'fiado',
    amount: String(amount),
    description,
    saleFolio: saleFolio ?? null,
    date: now,
  });

  if (items && items.length > 0) {
    for (const item of items) {
      await db.insert(fiadoItems).values({
        id: `fi-${crypto.randomUUID()}`,
        fiadoId,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        subtotal: String(item.subtotal),
      });
    }
  }

  await db
    .update(clientes)
    .set({
      balance: sql`balance::numeric + ${amount}`,
      lastTransaction: now,
    })
    .where(eq(clientes.id, clienteId));
}

async function _createAbono(
  clienteId: string,
  amount: number,
  description: string
): Promise<void> {
  await requirePermission('customers.edit');
  validateSchema(createAbonoSchema, { clienteId, amount, description }, 'createAbono');
  const now = new Date();
  const clienteRows = await db.select().from(clientes).where(eq(clientes.id, clienteId));
  if (!clienteRows.length) {
    throw new AppError('CLIENTE_NOT_FOUND', 'Cliente no encontrado', 404);
  }

  const cliente = clienteRows[0];

  await db.insert(fiadoTransactions).values({
    id: `abono-${crypto.randomUUID()}`,
    clienteId,
    clienteName: cliente.name,
    type: 'abono',
    amount: String(amount),
    description,
    date: now,
  });

  await db
    .update(clientes)
    .set({
      balance: sql`greatest(0, balance::numeric - ${amount})`,
      lastTransaction: now,
    })
    .where(eq(clientes.id, clienteId));
}

// ==================== WRAPPED EXPORTS ====================
export const fetchClientes = withLogging('customer.fetchAll', _fetchClientes);
export const createCliente = withRateLimit('customer.create', withLogging('customer.create', _createCliente));
export const updateCliente = withLogging('customer.update', _updateCliente);
export const deleteCliente = withRateLimit('customer.delete', withLogging('customer.delete', _deleteCliente));
export const fetchFiadoTransactions = withLogging('fiado.fetchAll', _fetchFiadoTransactions);
export const createFiado = withRateLimit('fiado.create', withLogging('fiado.create', _createFiado));
export const createAbono = withRateLimit('fiado.createAbono', withLogging('fiado.createAbono', _createAbono));
