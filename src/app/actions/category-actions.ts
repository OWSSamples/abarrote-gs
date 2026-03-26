'use server';

import { db } from '@/db';
import { productCategories } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function fetchCategories() {
  try {
    return await db.select().from(productCategories).orderBy(desc(productCategories.createdAt));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

export async function createCategory(data: { id: string; name: string; description: string | null; icon: string | null }) {
  try {
    const [newCategory] = await db.insert(productCategories).values({
      ...data,
      updatedAt: new Date(),
    }).returning();
    
    revalidatePath('/dashboard');
    return newCategory;
  } catch (error) {
    console.error('Error creating category:', error);
    throw error;
  }
}

export async function updateCategory(id: string, data: Partial<{ name: string; description: string | null; icon: string | null }>) {
  try {
    const [updated] = await db.update(productCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productCategories.id, id))
      .returning();
      
    revalidatePath('/dashboard');
    return updated;
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
}

export async function deleteCategory(id: string) {
  try {
    await db.delete(productCategories).where(eq(productCategories.id, id));
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
}
