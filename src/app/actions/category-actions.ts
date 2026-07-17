'use server';

import { requirePermission, sanitize } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { db } from '@/db';
import { productCategories } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { withLogging, AppError } from '@/lib/errors';
import { validateSchema, createCategorySchema, updateCategorySchema, idSchema } from '@/lib/validation/schemas';
import { isNotDeleted } from '@/infrastructure/soft-delete';
import { withRateLimit, cache } from '@/infrastructure/redis';

async function _fetchCategories() {
  const { storeId } = await requireStoreScope();
  const cacheKey = `categories:${storeId}:all`;

  const cached = await cache.get<(typeof productCategories.$inferSelect)[]>(cacheKey);
  if (cached) return cached;

  const result = await db
    .select()
    .from(productCategories)
    .where(and(eq(productCategories.storeId, storeId), isNotDeleted(productCategories)))
    .orderBy(desc(productCategories.createdAt));

  await cache.set(cacheKey, result, { ttlMs: 60_000 });

  return result;
}

async function _createCategory(data: { id?: string; name: string; description: string | null; icon: string | null }) {
  await requirePermission('inventory.edit');
  const { storeId } = await requireStoreScope();
  validateSchema(
    createCategorySchema,
    { name: data.name, description: data.description ?? undefined, icon: data.icon ?? undefined },
    'createCategory',
  );
  const id = data.id || `cat-${crypto.randomUUID()}`;
  const safeName = sanitize(data.name);
  try {
    const [newCategory] = await db
      .insert(productCategories)
      .values({
        id,
        name: safeName,
        description: data.description ? sanitize(data.description) : null,
        icon: data.icon ? sanitize(data.icon) : null,
        storeId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    revalidatePath('/dashboard');
    await cache.invalidate(`categories:${storeId}:all`);
    return newCategory;
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    const pgCode = err?.code as string | undefined;
    const msg = err?.message || String(error);

    if (pgCode === '23505' || String(msg).includes('duplicate') || String(msg).includes('unique')) {
      throw new AppError('DUPLICATE_CATEGORY', 'Ya existe una categoría con ese identificador', 409);
    }
    throw new AppError('CATEGORY_CREATE_FAILED', 'Error al crear categoría', 500);
  }
}

async function _updateCategory(
  id: string,
  data: Partial<{ name: string; description: string | null; icon: string | null }>,
): Promise<typeof productCategories.$inferSelect> {
  await requirePermission('inventory.edit');
  const { storeId } = await requireStoreScope();
  validateSchema(idSchema, id, 'updateCategory:id');
  validateSchema(
    updateCategorySchema,
    { name: data.name, description: data.description ?? undefined, icon: data.icon ?? undefined },
    'updateCategory',
  );

  const safeData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) safeData.name = sanitize(data.name);
  if (data.description !== undefined) safeData.description = data.description ? sanitize(data.description) : null;
  if (data.icon !== undefined) safeData.icon = data.icon ? sanitize(data.icon) : null;

  const [updated] = await db
    .update(productCategories)
    .set(safeData)
    .where(and(eq(productCategories.id, id), eq(productCategories.storeId, storeId)))
    .returning();
  if (!updated) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Categoría no encontrada en tu negocio', 404);
  }

  revalidatePath('/dashboard');
  await cache.invalidate(`categories:${storeId}:all`);
  return updated;
}

async function _deleteCategory(id: string): Promise<void> {
  await requirePermission('inventory.delete');
  const { storeId } = await requireStoreScope();
  validateSchema(idSchema, id, 'deleteCategory:id');
  const deleted = await db
    .update(productCategories)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(productCategories.id, id),
        eq(productCategories.storeId, storeId),
        isNotDeleted(productCategories),
      ),
    )
    .returning({ id: productCategories.id });
  if (deleted.length === 0) {
    throw new AppError('CATEGORY_NOT_FOUND', 'Categoría no encontrada en tu negocio', 404);
  }
  await cache.invalidate(`categories:${storeId}:all`);
  revalidatePath('/dashboard');
}

// ==================== WRAPPED EXPORTS ====================
export const fetchCategories = withLogging('category.fetchAll', _fetchCategories);
export const createCategory = withRateLimit('category.create', withLogging('category.create', _createCategory));
export const updateCategory = withLogging('category.update', _updateCategory);
export const deleteCategory = withRateLimit('category.delete', withLogging('category.delete', _deleteCategory));
