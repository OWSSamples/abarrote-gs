'use server';

import { requirePermission } from '@/lib/auth/guard';
import { db } from '@/db';
import { cashMovements } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
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

export async function fetchCashMovements(corteId?: string): Promise<CashMovement[]> {
  await requirePermission('corte.view');
  const rows = corteId
    ? await db.select().from(cashMovements).where(eq(cashMovements.corteId, corteId)).orderBy(desc(cashMovements.fecha))
    : await db.select().from(cashMovements).orderBy(desc(cashMovements.fecha));
  return rows.map(mapMovement);
}

export async function createCashMovement(data: {
  corteId?: string;
  tipo: CashMovement['tipo'];
  concepto: CashMovement['concepto'];
  monto: number;
  notas: string;
  cajero: string;
}): Promise<CashMovement> {
  await requirePermission('corte.create');
  const validated = validateSchema(createCashMovementSchema, data, 'createCashMovement');

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
  });

  const [row] = await db.select().from(cashMovements).where(eq(cashMovements.id, id)).limit(1);
  return mapMovement(row);
}
