'use server';

import { requirePermission } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { withLogging } from '@/lib/errors';
import { db } from '@/db';
import { cashMovements } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import type { CashMovement } from '@/types';
import { numVal } from './_helpers';
import { validateSchema, createCashMovementSchema } from '@/lib/validation/schemas';

function mapMovement(row: typeof cashMovements.$inferSelect): CashMovement {
  return {
    id: row.id,
    corteId: row.corteId ?? undefined,
    tipo: row.tipo as CashMovement['tipo'],
    concepto: row.concepto as CashMovement['concepto'],
    monto: numVal(row.monto),
    notas: row.notas,
    cajero: row.cajero,
    fecha: row.fecha.toISOString(),
  };
}

async function _fetchCashMovements(corteId?: string): Promise<CashMovement[]> {
  await requirePermission('corte.view');
  const { storeId } = await requireStoreScope();
  const rows = corteId
    ? await db
        .select()
        .from(cashMovements)
        .where(and(eq(cashMovements.corteId, corteId), eq(cashMovements.storeId, storeId)))
        .orderBy(desc(cashMovements.fecha))
        .limit(200)
    : await db
        .select()
        .from(cashMovements)
        .where(eq(cashMovements.storeId, storeId))
        .orderBy(desc(cashMovements.fecha))
        .limit(200);
  return rows.map(mapMovement);
}

async function _createCashMovement(data: {
  corteId?: string;
  tipo: CashMovement['tipo'];
  concepto: CashMovement['concepto'];
  monto: number;
  notas: string;
  cajero: string;
}): Promise<CashMovement> {
  await requirePermission('corte.create');
  const { storeId } = await requireStoreScope();
  const _validated = validateSchema(createCashMovementSchema, data, 'createCashMovement');

  const id = `cm-${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(cashMovements).values({
    id,
    corteId: data.corteId ?? null,
    tipo: data.tipo,
    concepto: data.concepto,
    monto: String(data.monto),
    notas: data.notas,
    cajero: data.cajero,
    fecha: now,
    storeId,
  });

  const [row] = await db
    .select()
    .from(cashMovements)
    .where(and(eq(cashMovements.id, id), eq(cashMovements.storeId, storeId)))
    .limit(1);
  return mapMovement(row);
}

export const fetchCashMovements = withLogging('cashMovement.fetchCashMovements', _fetchCashMovements);
export const createCashMovement = withLogging('cashMovement.createCashMovement', _createCashMovement);
