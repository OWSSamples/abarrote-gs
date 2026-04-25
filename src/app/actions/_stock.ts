// Shared stock adjustment helper used across server action modules.
// Requires DB — separated from _helpers.ts to keep pure helpers testable.
//
// Now also writes an immutable kardex entry to `stock_movements` so every
// change in inventory is auditable.

import crypto from 'crypto';
import { db } from '@/db';
import { products, stockMovements } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export type StockMovementType =
  | 'restock'
  | 'sale'
  | 'merma'
  | 'adjustment'
  | 'audit'
  | 'return';

export type StockMovementSource =
  | 'pedido'
  | 'venta'
  | 'merma'
  | 'audit'
  | 'manual'
  | 'devolucion'
  | 'import';

export interface StockMovementMeta {
  type: StockMovementType;
  source?: StockMovementSource;
  sourceId?: string | null;
  sourceLabel?: string | null;
  unitCost?: number | null;
  notes?: string;
  userId?: string | null;
  userName?: string | null;
  storeId?: string;
}

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

/**
 * Adjust product stock atomically. Positive delta = add, negative = subtract.
 * Ensures stock never goes below 0.
 * Returns the updated product row (name, currentStock, minStock).
 *
 * Accepts an optional Drizzle transaction so it can participate in
 * a broader transactional workflow.
 *
 * When `meta` is provided, also records a row in `stock_movements`.
 */
export async function adjustStock(
  productId: string,
  delta: number,
  opts?: { tx?: DbExecutor; now?: Date; meta?: StockMovementMeta },
) {
  const executor = opts?.tx ?? db;
  const now = opts?.now ?? new Date();

  const [updated] = await executor
    .update(products)
    .set({
      currentStock: delta >= 0 ? sql`current_stock + ${delta}` : sql`greatest(0, current_stock + ${delta})`,
      updatedAt: now,
    })
    .where(eq(products.id, productId))
    .returning({
      name: products.name,
      currentStock: products.currentStock,
      minStock: products.minStock,
    });

  if (updated && opts?.meta) {
    await recordStockMovement(productId, updated.name, delta, updated.currentStock, opts.meta, {
      tx: executor,
      now,
    });
  }

  return updated ?? null;
}

/**
 * Insert an immutable kardex row. Quantity is stored as absolute value;
 * `direction` (in/out) is derived from the delta sign.
 */
export async function recordStockMovement(
  productId: string,
  productName: string,
  delta: number,
  balanceAfter: number,
  meta: StockMovementMeta,
  opts?: { tx?: DbExecutor; now?: Date },
): Promise<void> {
  const executor = opts?.tx ?? db;
  const now = opts?.now ?? new Date();
  const quantity = Math.abs(delta);
  const direction = delta >= 0 ? 'in' : 'out';
  const unitCost = meta.unitCost ?? null;
  const totalValue = unitCost != null ? (unitCost * quantity).toFixed(2) : null;

  await executor.insert(stockMovements).values({
    id: `mov-${crypto.randomUUID()}`,
    productId,
    productName,
    type: meta.type,
    quantity,
    direction,
    balanceAfter,
    unitCost: unitCost != null ? unitCost.toFixed(2) : null,
    totalValue,
    source: meta.source ?? null,
    sourceId: meta.sourceId ?? null,
    sourceLabel: meta.sourceLabel ?? null,
    notes: meta.notes ?? '',
    userId: meta.userId ?? null,
    userName: meta.userName ?? null,
    storeId: meta.storeId ?? 'main',
    createdAt: now,
  });
}
