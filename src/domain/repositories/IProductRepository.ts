import { Product } from '../entities/Product';

/**
 * Product Repository Interface
 * 
 * Defines the contract for product persistence.
 * Implementation lives in infrastructure layer (server actions).
 * 
 * Benefits:
 * - Domain layer has no knowledge of Drizzle/SQL
 * - Easily mockable for unit tests
 * - Can switch persistence layer without changing business logic
 */
export interface IProductRepository {
  /**
   * Find product by ID
   */
  findById(id: string): Promise<Product | null>;

  /**
   * Find product by barcode
   */
  findByBarcode(barcode: string): Promise<Product | null>;

  /**
   * Find product by SKU
   */
  findBySku(sku: string): Promise<Product | null>;

  /**
   * Find all products
   */
  findAll(): Promise<Product[]>;

  /**
   * Find products by category
   */
  findByCategory(categoryId: string): Promise<Product[]>;

  /**
   * Find products with low stock
   */
  findLowStock(): Promise<Product[]>;

  /**
   * Find products expiring soon (within N days)
   */
  findExpiringSoon(days: number): Promise<Product[]>;

  /**
   * Save a product (insert or update)
   */
  save(product: Product): Promise<Product>;

  /**
   * Delete a product
   */
  delete(id: string): Promise<void>;

  /**
   * Check if SKU exists (for validation)
   */
  existsBySku(sku: string, excludeId?: string): Promise<boolean>;

  /**
   * Check if barcode exists (for validation)
   */
  existsByBarcode(barcode: string, excludeId?: string): Promise<boolean>;

  /**
   * Adjust product stock atomically
   */
  adjustStock(id: string, delta: number): Promise<Product | null>;
}
