'use server';

import { requirePermission } from '@/lib/auth/guard';
import { db } from '@/db';
import { loyaltyTransactions, clientes } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { LoyaltyTransaction } from '@/types';
import { numVal } from './_helpers';
import { validateSchema, createLoyaltyTransactionSchema } from '@/lib/validation/schemas';

function mapTransaction(row: typeof loyaltyTransactions.$inferSelect): LoyaltyTransaction {
  return {
    id: row.id,
    clienteId: row.clienteId,
    clienteName: row.clienteName,
    tipo: row.tipo as LoyaltyTransaction['tipo'],
    puntos: numVal(row.puntos),
    saldoAnterior: numVal(row.saldoAnterior),
    saldoNuevo: numVal(row.saldoNuevo),
    saleId: row.saleId ?? undefined,
    saleFolio: row.saleFolio ?? undefined,
    notas: row.notas,
    cajero: row.cajero,
    fecha: row.fecha.toISOString(),
  };
}

export async function fetchLoyaltyTransactions(clienteId?: string): Promise<LoyaltyTransaction[]> {
  await requirePermission('customers.view');
  const rows = clienteId
    ? await db.select().from(loyaltyTransactions).where(eq(loyaltyTransactions.clienteId, clienteId)).orderBy(desc(loyaltyTransactions.fecha))
    : await db.select().from(loyaltyTransactions).orderBy(desc(loyaltyTransactions.fecha));
  return rows.map(mapTransaction);
}

export async function createLoyaltyTransaction(data: {
  clienteId: string;
  clienteName: string;
  tipo: LoyaltyTransaction['tipo'];
  puntos: number;
  saldoAnterior: number;
  saldoNuevo: number;
  saleId?: string;
  saleFolio?: string;
  notas: string;
  cajero: string;
}): Promise<LoyaltyTransaction> {
  await requirePermission('sales.create');
  const validated = validateSchema(createLoyaltyTransactionSchema, data, 'createLoyaltyTransaction');

  const id = `lt-${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(loyaltyTransactions).values({
    id,
    clienteId: data.clienteId,
    clienteName: data.clienteName,
    tipo: data.tipo,
    puntos: String(data.puntos),
    saldoAnterior: String(data.saldoAnterior),
    saldoNuevo: String(data.saldoNuevo),
    saleId: data.saleId ?? null,
    saleFolio: data.saleFolio ?? null,
    notas: data.notas,
    cajero: data.cajero,
    fecha: now,
  });

  const [row] = await db.select().from(loyaltyTransactions).where(eq(loyaltyTransactions.id, id)).limit(1);
  return mapTransaction(row);
}
