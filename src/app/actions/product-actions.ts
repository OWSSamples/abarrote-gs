'use server';

import { cache } from '@/infrastructure/redis';
import { requirePermission, requireAuth, sanitize, validateNumber, validateId } from '@/lib/auth/guard';
import { validateSchema, createProductSchema, updateProductSchema, idSchema } from '@/lib/validation/schemas';
import { db } from '@/db';
import { products, saleItems, mermaRecords, pedidoItems, fiadoItems } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';
import type { Product } from '@/types';
import { numVal } from './_helpers';
import { AppError, withLogging } from '@/lib/errors';
import { isNotDeleted, softDelete } from '@/infrastructure/soft-delete';
import { withRateLimit, STRICT } from '@/infrastructure/redis';
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
      throw new AppError(
        'DUPLICATE_SKU',
        `Ya existe un producto con el SKU "${sanitizedSku}": ${match.name}`,
        409
      );
    }
    if (match.barcode === sanitizedBarcode) {
      throw new AppError(
        'DUPLICATE_BARCODE',
        `Ya existe un producto con el código de barras "${sanitizedBarcode}": ${match.name}`,
        409
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
    currentStock: validateNumber(data.currentStock, { label: 'Stock' }),
    minStock: validateNumber(data.minStock, { label: 'Stock mínimo' }),
    expirationDate: data.expirationDate,
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
export const deleteProduct = withRateLimit('product.delete', withLogging('product.delete', _deleteProduct));
export const updateProduct = withLogging('product.update', _updateProduct);
