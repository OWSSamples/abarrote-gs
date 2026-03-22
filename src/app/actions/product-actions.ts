'use server';

import { cache } from '@/lib/cache';
import { requirePermission, requireAuth, sanitize, validateNumber, validateId } from '@/lib/auth/guard';
import { db } from '@/db';
import { products, saleItems, mermaRecords, pedidoItems, fiadoItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Product } from '@/types';
import { numVal } from './_helpers';

// ==================== PRODUCTS ====================

export async function fetchAllProducts(): Promise<Product[]> {
  await requireAuth();
  const rows = await db.select().from(products).orderBy(products.name);
  return rows.map((r) => ({
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
}

export async function createProduct(data: Omit<Product, 'id'>): Promise<Product> {
  await requirePermission('inventory.edit');
  const id = `p${Date.now()}`;

  cache.invalidatePattern('products:');

  await db.insert(products).values({
    id,
    name: sanitize(data.name),
    sku: sanitize(data.sku),
    barcode: sanitize(data.barcode),
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
  return { ...data, id };
}

export async function updateProductStock(productId: string, newStock: number): Promise<void> {
  await requirePermission('inventory.edit');
  validateId(productId, 'Product ID');
  validateNumber(newStock, { label: 'Nuevo stock' });
  await db.update(products).set({ currentStock: newStock, updatedAt: new Date() }).where(eq(products.id, productId));
}

export async function deleteProduct(productId: string): Promise<void> {
  await requirePermission('inventory.delete');
  validateId(productId, 'Product ID');
  cache.invalidatePattern('products:');

  await db.delete(saleItems).where(eq(saleItems.productId, productId));
  await db.delete(mermaRecords).where(eq(mermaRecords.productId, productId));
  await db.delete(pedidoItems).where(eq(pedidoItems.productId, productId));
  await db.delete(fiadoItems).where(eq(fiadoItems.productId, productId));
  await db.delete(products).where(eq(products.id, productId));
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  await requirePermission('inventory.edit');
  validateId(id, 'Product ID');
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
}
