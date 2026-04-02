'use server';

import { requirePermission, validateId, sanitize } from '@/lib/auth/guard';
import { db } from '@/db';
import { promotions } from '@/db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { numVal } from './_helpers';
import type { Promotion, PromotionType, ApplicableTo } from '@/types';
import { validateSchema, createPromotionSchema, updatePromotionSchema, idSchema } from '@/lib/validation/schemas';

// ==================== FETCH ====================

export async function fetchPromotions(): Promise<Promotion[]> {
  await requirePermission('inventory.view');
  const rows = await db.select().from(promotions).orderBy(desc(promotions.createdAt));
  return rows.map(mapRow);
}

export async function fetchActivePromotions(): Promise<Promotion[]> {
  await requirePermission('sales.create');
  const now = new Date();
  const rows = await db
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.active, true),
        lte(promotions.startDate, now),
        gte(promotions.endDate, now),
      ),
    )
    .orderBy(desc(promotions.createdAt));

  return rows
    .filter((r) => r.usageLimit === null || r.usageCount < r.usageLimit!)
    .map(mapRow);
}

// ==================== CRUD ====================

export async function createPromotion(
  data: Omit<Promotion, 'id' | 'usageCount' | 'createdAt' | 'updatedAt' | 'createdBy'>,
): Promise<Promotion> {
  const user = await requirePermission('inventory.edit');
  validateSchema(createPromotionSchema, data, 'createPromotion');
  const id = `promo-${crypto.randomUUID()}`;

  validate(data);
  validateApplicability(data);

  await db.insert(promotions).values({
    id,
    name: sanitize(data.name),
    description: sanitize(data.description),
    type: data.type,
    value: String(data.value),
    minPurchase: String(data.minPurchase),
    maxDiscount: data.maxDiscount != null ? String(data.maxDiscount) : null,
    applicableTo: data.applicableTo,
    applicableIds: data.applicableIds,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
    active: data.active,
    usageLimit: data.usageLimit,
    usageCount: 0,
    createdBy: user.uid,
  });

  return {
    ...data,
    id,
    usageCount: 0,
    createdBy: user.uid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function updatePromotion(id: string, data: Partial<Promotion>): Promise<void> {
  await requirePermission('inventory.edit');
  validateSchema(idSchema, id, 'updatePromotion:id');
  validateSchema(updatePromotionSchema, data, 'updatePromotion');

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = sanitize(data.name);
  if (data.description !== undefined) updateData.description = sanitize(data.description);
  if (data.type !== undefined) updateData.type = data.type;
  if (data.value !== undefined) updateData.value = String(data.value);
  if (data.minPurchase !== undefined) updateData.minPurchase = String(data.minPurchase);
  if (data.maxDiscount !== undefined) updateData.maxDiscount = data.maxDiscount != null ? String(data.maxDiscount) : null;
  if (data.applicableTo !== undefined) updateData.applicableTo = data.applicableTo;
  if (data.applicableIds !== undefined) updateData.applicableIds = data.applicableIds;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.active !== undefined) updateData.active = data.active;
  if (data.usageLimit !== undefined) updateData.usageLimit = data.usageLimit;

  await db.update(promotions).set(updateData).where(eq(promotions.id, id));
}

export async function deletePromotion(id: string): Promise<void> {
  await requirePermission('inventory.edit');
  validateSchema(idSchema, id, 'deletePromotion:id');
  await db.delete(promotions).where(eq(promotions.id, id));
}

export async function togglePromotionActive(id: string, active: boolean): Promise<void> {
  await requirePermission('inventory.edit');
  validateSchema(idSchema, id, 'togglePromotionActive:id');
  await db.update(promotions).set({ active, updatedAt: new Date() }).where(eq(promotions.id, id));
}

export async function incrementPromotionUsage(id: string): Promise<void> {
  await requirePermission('sales.create');
  validateSchema(idSchema, id, 'incrementPromotionUsage:id');
  await db.update(promotions).set({
    usageCount: sql`${promotions.usageCount} + 1`,
  }).where(eq(promotions.id, id));
}

// ==================== HELPERS ====================

function mapRow(r: typeof promotions.$inferSelect): Promotion {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type as PromotionType,
    value: numVal(r.value),
    minPurchase: numVal(r.minPurchase),
    maxDiscount: r.maxDiscount ? numVal(r.maxDiscount) : null,
    applicableTo: r.applicableTo as ApplicableTo,
    applicableIds: (r.applicableIds ?? []) as string[],
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    active: r.active,
    usageLimit: r.usageLimit,
    usageCount: r.usageCount,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function validate(data: Pick<Promotion, 'name' | 'type' | 'value' | 'startDate' | 'endDate'>) {
  if (!data.name || data.name.trim().length < 2) {
    throw new Error('El nombre de la promoción es obligatorio');
  }
  if (!['percentage', 'fixed', 'bogo', 'bundle'].includes(data.type)) {
    throw new Error('Tipo de promoción inválido');
  }
  if (data.value <= 0) {
    throw new Error('El valor del descuento debe ser mayor a 0');
  }
  if (data.type === 'percentage' && data.value > 100) {
    throw new Error('El porcentaje no puede ser mayor a 100%');
  }
  if (new Date(data.endDate) <= new Date(data.startDate)) {
    throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
  }
}

function validateApplicability(data: Pick<Promotion, 'applicableTo' | 'applicableIds'>) {
  if (data.applicableTo !== 'all' && (!data.applicableIds || data.applicableIds.length === 0)) {
    throw new Error(
      data.applicableTo === 'product'
        ? 'Debes seleccionar al menos un producto para la promoción'
        : 'Debes seleccionar al menos una categoría para la promoción',
    );
  }
}
