'use server';

import { requireAuth, requirePermission, sanitize, validateId } from '@/lib/auth/guard';
import { db } from '@/db';
import { productCategories } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { withLogging, AppError } from '@/lib/errors';
import { validateSchema, createCategorySchema, updateCategorySchema, idSchema } from '@/lib/validation/schemas';
import { isNotDeleted, softDelete } from '@/infrastructure/soft-delete';
import { withRateLimit, STRICT, cache } from '@/infrastructure/redis';

async function _fetchCategories() {
  await requireAuth();

  const cached = await cache.get<(typeof productCategories.$inferSelect)[]>('categories:all');
  if (cached) return cached;

  const result = await db.select().from(productCategories).where(isNotDeleted(productCategories)).orderBy(desc(productCategories.createdAt));

  await cache.set('categories:all', result, { ttlMs: 60_000 });

  return result;
}

async function _createCategory(data: { id?: string; name: string; description: string | null; icon: string | null }) {
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
    await cache.invalidatePattern('categories:');
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

async function _updateCategory(id: string, data: Partial<{ name: string; description: string | null; icon: string | null }>): Promise<typeof productCategories.$inferSelect> {
  await requirePermission('inventory.edit');
  validateSchema(idSchema, id, 'updateCategory:id');
  validateSchema(updateCategorySchema, { name: data.name, description: data.description ?? undefined, icon: data.icon ?? undefined }, 'updateCategory');

  const safeData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) safeData.name = sanitize(data.name);
  if (data.description !== undefined) safeData.description = data.description ? sanitize(data.description) : null;
  if (data.icon !== undefined) safeData.icon = data.icon ? sanitize(data.icon) : null;

  const [updated] = await db.update(productCategories)
    .set(safeData)
    .where(eq(productCategories.id, id))
    .returning();

  revalidatePath('/dashboard');
  await cache.invalidatePattern('categories:');
  return updated;
}

async function _deleteCategory(id: string): Promise<void> {
  await requirePermission('inventory.delete');
  validateSchema(idSchema, id, 'deleteCategory:id');
  await softDelete(productCategories, id);
  await cache.invalidatePattern('categories:');
  revalidatePath('/dashboard');
}

// ==================== WRAPPED EXPORTS ====================
export const fetchCategories = withLogging('category.fetchAll', _fetchCategories);
export const createCategory = withRateLimit('category.create', withLogging('category.create', _createCategory));
export const updateCategory = withLogging('category.update', _updateCategory);
export const deleteCategory = withRateLimit('category.delete', withLogging('category.delete', _deleteCategory));
