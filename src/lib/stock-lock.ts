'use server';

import { db } from '@/db';
import { products } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function reserveStock(productId: string, quantity: number): Promise<boolean> {
  try {
    const result = await db
      .update(products)
      .set({
        currentStock: sql`${products.currentStock} - ${quantity}`,
        updatedAt: new Date(),
      })
      .where(
        sql`${products.id} = ${productId} AND ${products.currentStock} >= ${quantity}`
      )
      .returning({ id: products.id });

    return result.length > 0;
  } catch (error) {
    console.error('Error reserving stock:', error);
    return false;
  }
}

export async function releaseStock(productId: string, quantity: number) {
  try {
    await db
      .update(products)
      .set({
        currentStock: sql`${products.currentStock} + ${quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));
  } catch (error) {
    console.error('Error releasing stock:', error);
  }
}

export async function validateStockAvailability(
  items: Array<{ productId: string; quantity: number }>
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const item of items) {
    const [product] = await db
      .select({ currentStock: products.currentStock, name: products.name })
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);

    if (!product) {
      errors.push(`Producto no encontrado: ${item.productId}`);
      continue;
    }

    if (product.currentStock < item.quantity) {
      errors.push(
        `Stock insuficiente para ${product.name}. Disponible: ${product.currentStock}, Solicitado: ${item.quantity}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
