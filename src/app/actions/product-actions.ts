'use server';

import { cache } from '@/infrastructure/redis';
import { requirePermission, requireAuth, sanitize, validateNumber, validateId } from '@/lib/auth/guard';
import { validateSchema, createProductSchema, updateProductSchema, idSchema } from '@/lib/validation/schemas';
import { db } from '@/db';
import { products, stockMovements } from '@/db/schema';
import { eq, or, and, desc } from 'drizzle-orm';
import type { Product } from '@/types';
import { numVal } from './_helpers';
import { adjustStock } from './_stock';
import { AppError, withLogging } from '@/lib/errors';
import { isNotDeleted, softDelete } from '@/infrastructure/soft-delete';
import { withRateLimit } from '@/infrastructure/redis';
import { emitDomainEvent } from '@/domain/events';

// ==================== PRODUCTS ====================

async function _fetchAllProducts(): Promise<Product[]> {
  await requireAuth();

  // Check cache first — products are fetched on every dashboard load
  const cached = await cache.get<Product[]>('products:all');
  if (cached) return cached;

  const rows = await db.select().from(products).where(isNotDeleted(products)).orderBy(products.name);
  const result = rows.map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    barcode: r.barcode,
    description: r.description ?? null,
    currentStock: r.currentStock,
    minStock: r.minStock,
    expirationDate: r.expirationDate,
    category: r.category,
    costPrice: numVal(r.costPrice),
    unitPrice: numVal(r.unitPrice),
    unit: r.unit,
    unitMultiple: r.unitMultiple,
    isPerishable: r.isPerishable,
    imageUrl: r.imageUrl ?? undefined,
  }));

  // Cache for 30 seconds — invalidated on product mutations
  await cache.set('products:all', result, { ttlMs: 30_000 });

  return result;
}

async function _createProduct(data: Omit<Product, 'id'>): Promise<Product> {
  await requirePermission('inventory.edit');
  validateSchema(createProductSchema, data, 'createProduct');

  const sanitizedSku = sanitize(data.sku);
  const sanitizedBarcode = sanitize(data.barcode);

  // Check for existing products with same SKU or barcode (exclude soft-deleted)
  const existing = await db
    .select({ sku: products.sku, barcode: products.barcode, name: products.name })
    .from(products)
    .where(and(isNotDeleted(products), or(eq(products.sku, sanitizedSku), eq(products.barcode, sanitizedBarcode))))
    .limit(1);

  if (existing.length > 0) {
    const match = existing[0];
    if (match.sku === sanitizedSku) {
      throw new AppError('DUPLICATE_SKU', `Ya existe un producto con el SKU "${sanitizedSku}": ${match.name}`, 409);
    }
    if (match.barcode === sanitizedBarcode) {
      throw new AppError(
        'DUPLICATE_BARCODE',
        `Ya existe un producto con el código de barras "${sanitizedBarcode}": ${match.name}`,
        409,
      );
    }
  }

  const id = `p-${crypto.randomUUID()}`;

  await cache.invalidatePattern('products:');

  const user = await requirePermission('inventory.edit');
  await db.insert(products).values({
    id,
    name: sanitize(data.name),
    sku: sanitizedSku,
    barcode: sanitizedBarcode,
    description: data.description ? sanitize(data.description) : null,
    currentStock: validateNumber(data.currentStock, { label: 'Stock' }),
    minStock: validateNumber(data.minStock, { label: 'Stock mínimo' }),
    expirationDate: data.expirationDate || undefined,
    category: sanitize(data.category),
    costPrice: String(validateNumber(data.costPrice, { label: 'Precio de costo' })),
    unitPrice: String(validateNumber(data.unitPrice, { label: 'Precio de venta' })),
    unit: data.unit ? sanitize(data.unit) : 'pieza',
    unitMultiple: data.unitMultiple ? validateNumber(data.unitMultiple, { label: 'Piezas por unidad' }) : 1,
    isPerishable: data.isPerishable,
    imageUrl: data.imageUrl,
  });

  emitDomainEvent({
    type: 'product.created',
    payload: { productId: id, name: data.name, sku: sanitizedSku },
    metadata: { userId: user.uid, userEmail: user.email ?? '' },
  });

  return { ...data, id };
}

async function _updateProductStock(productId: string, newStock: number): Promise<void> {
  await requirePermission('inventory.edit');
  validateId(productId, 'Product ID');
  validateNumber(newStock, { label: 'Nuevo stock' });
  await db.update(products).set({ currentStock: newStock, updatedAt: new Date() }).where(eq(products.id, productId));
}

/**
 * Manual restock — adds inventory and records a kardex entry.
 * Used by the "Surtir mercancía" flow in the product modal.
 */
async function _restockProduct(
  productId: string,
  quantity: number,
  reason: string,
  notes?: string,
): Promise<{ newStock: number }> {
  const user = await requirePermission('inventory.edit');
  validateId(productId, 'Product ID');
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError('INVALID_QUANTITY', 'La cantidad a surtir debe ser mayor a 0', 400);
  }
  const [productRow] = await db
    .select({ name: products.name, costPrice: products.costPrice })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!productRow) {
    throw new AppError('PRODUCT_NOT_FOUND', 'Producto no encontrado', 404);
  }
  const updated = await adjustStock(productId, quantity, {
    meta: {
      type: 'restock',
      source: 'manual',
      sourceId: null,
      sourceLabel: reason || 'Surtido manual',
      unitCost: Number(productRow.costPrice),
      notes: notes ?? '',
      userId: user.uid,
      userName: user.email ?? null,
    },
  });
  return { newStock: updated?.currentStock ?? 0 };
}

/**
 * Fetch the kardex (stock movement history) for a single product.
 */
async function _fetchStockMovements(productId: string, limit = 100): Promise<import('@/types').StockMovement[]> {
  await requirePermission('inventory.view');
  validateId(productId, 'Product ID');
  const rows = await db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.productId, productId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));

  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    type: r.type as import('@/types').StockMovementType,
    quantity: r.quantity,
    direction: r.direction as import('@/types').StockMovementDirection,
    balanceAfter: r.balanceAfter,
    unitCost: r.unitCost != null ? Number(r.unitCost) : null,
    totalValue: r.totalValue != null ? Number(r.totalValue) : null,
    source: r.source,
    sourceId: r.sourceId,
    sourceLabel: r.sourceLabel,
    notes: r.notes,
    userId: r.userId,
    userName: r.userName,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function _deleteProduct(productId: string): Promise<void> {
  const user = await requirePermission('inventory.delete');
  validateId(productId, 'Product ID');
  await cache.invalidatePattern('products:');

  // Soft delete: mark as deleted instead of physically removing
  await softDelete(products, productId);

  emitDomainEvent({
    type: 'product.deleted',
    payload: { productId, name: productId },
    metadata: { userId: user.uid, userEmail: user.email ?? '' },
  });
}

async function _updateProduct(id: string, data: Partial<Product>): Promise<void> {
  const user = await requirePermission('inventory.edit');
  validateSchema(idSchema, id, 'updateProduct.id');
  validateSchema(updateProductSchema, data, 'updateProduct');
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (data.barcode !== undefined) updateData.barcode = data.barcode;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.costPrice !== undefined) updateData.costPrice = String(data.costPrice);
  if (data.unitPrice !== undefined) updateData.unitPrice = String(data.unitPrice);
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.unitMultiple !== undefined) updateData.unitMultiple = data.unitMultiple;
  if (data.minStock !== undefined) updateData.minStock = data.minStock;
  if (data.currentStock !== undefined) updateData.currentStock = data.currentStock;
  if (data.isPerishable !== undefined) updateData.isPerishable = data.isPerishable;
  if (data.expirationDate !== undefined) updateData.expirationDate = data.expirationDate;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.description !== undefined) updateData.description = data.description;
  await db.update(products).set(updateData).where(eq(products.id, id));

  emitDomainEvent({
    type: 'product.updated',
    payload: { productId: id, changes: data as Record<string, unknown> },
    metadata: { userId: user.uid, userEmail: user.email ?? '' },
  });
}

// ==================== WRAPPED EXPORTS ====================
// All actions wrapped with logging for observability

export const fetchAllProducts = withLogging('product.fetchAll', _fetchAllProducts);
export const createProduct = withRateLimit('product.create', withLogging('product.create', _createProduct));
export const updateProductStock = withLogging('product.updateStock', _updateProductStock);
export const restockProduct = withRateLimit('product.restock', withLogging('product.restock', _restockProduct));
export const fetchStockMovements = withLogging('product.fetchStockMovements', _fetchStockMovements);
export const deleteProduct = withRateLimit('product.delete', withLogging('product.delete', _deleteProduct));
export const updateProduct = withLogging('product.update', _updateProduct);
