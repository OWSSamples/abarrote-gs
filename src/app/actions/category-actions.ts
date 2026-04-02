'use server';

import { requireAuth, requirePermission, sanitize, validateId } from '@/lib/auth/guard';
import { db } from '@/db';
import { productCategories } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { validateSchema, createCategorySchema, updateCategorySchema, idSchema } from '@/lib/validation/schemas';

export async function fetchCategories() {
  await requireAuth();
  try {
    return await db.select().from(productCategories).orderBy(desc(productCategories.createdAt));
  } catch (error) {
    logger.error('Error fetching categories', {
      error: error instanceof Error ? error.message : String(error),
      action: 'fetchCategories',
    });
    return [];
  }
}

export async function createCategory(data: { id?: string; name: string; description: string | null; icon: string | null }) {
  await requirePermission('inventory.edit');
  validateSchema(createCategorySchema, { name: data.name, description: data.description ?? undefined, icon: data.icon ?? undefined }, 'createCategory');
  const id = data.id || `cat-${crypto.randomUUID()}`;
  const safeName = sanitize(data.name);
  try {
    const [newCategory] = await db.insert(productCategories).values({
      id,
      name: safeName,
      description: data.description ? sanitize(data.description) : null,
      icon: data.icon ? sanitize(data.icon) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    revalidatePath('/dashboard');
    return newCategory;
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    const pgCode = err?.code as string | undefined;
    const pgDetail = err?.detail as string | undefined;
    const msg = err?.message || String(error);
    logger.error('Category create failed', { pgCode, detail: pgDetail });

    if (pgCode === '23505' || String(msg).includes('duplicate') || String(msg).includes('unique')) {
      throw new Error('Ya existe una categoría con ese identificador');
    }
    throw new Error('Error al crear categoría');
  }
}

export async function updateCategory(id: string, data: Partial<{ name: string; description: string | null; icon: string | null }>) {
  await requirePermission('inventory.edit');
  validateSchema(idSchema, id, 'updateCategory:id');
  validateSchema(updateCategorySchema, { name: data.name, description: data.description ?? undefined, icon: data.icon ?? undefined }, 'updateCategory');
  try {
    const safeData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) safeData.name = sanitize(data.name);
    if (data.description !== undefined) safeData.description = data.description ? sanitize(data.description) : null;
    if (data.icon !== undefined) safeData.icon = data.icon ? sanitize(data.icon) : null;

    const [updated] = await db.update(productCategories)
      .set(safeData)
      .where(eq(productCategories.id, id))
      .returning();

    revalidatePath('/dashboard');
    return updated;
  } catch (error) {
    logger.error('Error updating category', {
      error: error instanceof Error ? error.message : String(error),
      action: 'updateCategory',
      entityId: id,
    });
    throw new Error('Error al actualizar categoría');
  }
}

export async function deleteCategory(id: string) {
  await requirePermission('inventory.delete');
  validateSchema(idSchema, id, 'deleteCategory:id');
  try {
    await db.delete(productCategories).where(eq(productCategories.id, id));
    revalidatePath('/dashboard');
  } catch (error) {
    logger.error('Error deleting category', {
      error: error instanceof Error ? error.message : String(error),
      action: 'deleteCategory',
      entityId: id,
    });
    throw new Error('Error al eliminar categoría');
  }
}
