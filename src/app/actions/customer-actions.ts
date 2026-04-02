'use server';

import { requirePermission, requireAuth, validateId } from '@/lib/auth/guard';
import { validateSchema, createClienteSchema, updateClienteSchema, createFiadoSchema, createAbonoSchema, idSchema } from '@/lib/validation/schemas';
import { db } from '@/db';
import { clientes, fiadoTransactions, fiadoItems } from '@/db/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import type { Cliente, FiadoTransaction, SaleItem } from '@/types';
import { numVal } from './_helpers';

// ==================== CLIENTES ====================

export async function fetchClientes(): Promise<Cliente[]> {
  await requirePermission('customers.view');
  const rows = await db.select().from(clientes).orderBy(clientes.name);
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

export async function createCliente(
  data: Omit<Cliente, 'id' | 'balance' | 'createdAt' | 'lastTransaction'>
): Promise<Cliente> {
  await requirePermission('customers.edit');
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

  return {
    ...data,
    id,
    balance: 0,
    createdAt: now.toISOString(),
    lastTransaction: null,
  };
}

export async function updateCliente(id: string, data: Partial<Cliente>): Promise<void> {
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

export async function deleteCliente(id: string): Promise<void> {
  await requirePermission('customers.edit');
  validateId(id, 'Cliente ID');
  await db.delete(fiadoTransactions).where(eq(fiadoTransactions.clienteId, id));
  await db.delete(clientes).where(eq(clientes.id, id));
}

// ==================== FIADO ====================

export async function fetchFiadoTransactions(): Promise<FiadoTransaction[]> {
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

export async function createFiado(
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
  if (!clienteRows.length) return;

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

export async function createAbono(
  clienteId: string,
  amount: number,
  description: string
): Promise<void> {
  await requirePermission('customers.edit');
  validateSchema(createAbonoSchema, { clienteId, amount, description }, 'createAbono');
  const now = new Date();
  const clienteRows = await db.select().from(clientes).where(eq(clientes.id, clienteId));
  if (!clienteRows.length) return;

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
