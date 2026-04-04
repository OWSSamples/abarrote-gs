import { Quantity, StockLevel, StockStatus } from '../value-objects';
import { Product, SaleItem } from '../entities';

/**
 * Stock Alert
 */
export interface StockAlert {
  readonly productId: string;
  readonly productName: string;
  readonly currentStock: number;
  readonly minStock: number;
  readonly status: StockStatus;
  readonly unitsNeeded: number;
}

/**
 * Stock Adjustment Result
 */
export interface StockAdjustmentResult {
  readonly productId: string;
  readonly previousStock: number;
  readonly newStock: number;
  readonly delta: number;
  readonly alertTriggered: boolean;
}

/**
 * Stock Service
 * 
 * Domain service for stock management.
 * Encapsulates business rules for inventory operations.
 *
 * Responsibilities:
 * - Validate stock availability
 * - Calculate stock adjustments
 * - Generate stock alerts
 * - Check fulfillment feasibility
 */
export class StockService {
  // ─────────────────────────────────────────────────────────────────────
  // Availability Checks
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Check if all items in a sale can be fulfilled from stock
   */
  static checkAvailability(
    items: readonly SaleItem[],
    products: Map<string, Product>,
  ): { canFulfill: boolean; unavailable: string[] } {
    const unavailable: string[] = [];

    for (const item of items) {
      const product = products.get(item.productId);
      if (!product) {
        unavailable.push(`${item.productName} (no encontrado)`);
        continue;
      }
      if (!product.canFulfill(item.quantity)) {
        unavailable.push(
          `${item.productName} (stock: ${product.stockLevel.currentStock}, pedido: ${item.quantity.value})`,
        );
      }
    }

    return {
      canFulfill: unavailable.length === 0,
      unavailable,
    };
  }

  /**
   * Check if a single product can fulfill a quantity
   */
  static canFulfill(product: Product, quantity: Quantity): boolean {
    return product.canFulfill(quantity);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Stock Adjustments
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Calculate stock adjustments for a sale
   * Returns list of product IDs and deltas to apply
   */
  static calculateSaleAdjustments(
    items: readonly SaleItem[],
  ): Map<string, number> {
    const adjustments = new Map<string, number>();

    for (const item of items) {
      const existing = adjustments.get(item.productId) ?? 0;
      // Negative delta for sales (subtract from stock)
      adjustments.set(item.productId, existing - item.quantity.value);
    }

    return adjustments;
  }

  /**
   * Calculate stock adjustments for a return/cancellation
   * Returns list of product IDs and deltas to apply (positive = add back)
   */
  static calculateReturnAdjustments(
    items: readonly SaleItem[],
  ): Map<string, number> {
    const adjustments = new Map<string, number>();

    for (const item of items) {
      const existing = adjustments.get(item.productId) ?? 0;
      // Positive delta for returns (add back to stock)
      adjustments.set(item.productId, existing + item.quantity.value);
    }

    return adjustments;
  }

  /**
   * Apply adjustment to a product and check if alert should trigger
   */
  static applyAdjustment(
    product: Product,
    delta: number,
  ): StockAdjustmentResult {
    const previousStock = product.stockLevel.currentStock;
    const previousStatus = product.stockLevel.status;
    
    const adjusted = product.adjustStock(delta);
    const newStatus = adjusted.stockLevel.status;
    
    // Alert triggered if status worsened
    const alertTriggered = 
      (previousStatus === 'ok' && newStatus !== 'ok') ||
      (previousStatus === 'low' && newStatus === 'critical') ||
      (previousStatus !== 'out_of_stock' && newStatus === 'out_of_stock');

    return {
      productId: product.id,
      previousStock,
      newStock: adjusted.stockLevel.currentStock,
      delta,
      alertTriggered,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Alert Generation
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Generate stock alerts for products needing attention
   */
  static generateAlerts(products: Product[]): StockAlert[] {
    return products
      .filter(p => p.needsReorder())
      .map(p => ({
        productId: p.id,
        productName: p.name,
        currentStock: p.stockLevel.currentStock,
        minStock: p.stockLevel.minStock,
        status: p.stockLevel.status,
        unitsNeeded: p.stockLevel.unitsToReorder(),
      }))
      .sort((a, b) => {
        // Sort by urgency: out_of_stock > critical > low
        const priority: Record<StockStatus, number> = {
          out_of_stock: 0,
          critical: 1,
          low: 2,
          ok: 3,
        };
        return priority[a.status] - priority[b.status];
      });
  }

  /**
   * Count products by stock status
   */
  static countByStatus(products: Product[]): Record<StockStatus, number> {
    const counts: Record<StockStatus, number> = {
      ok: 0,
      low: 0,
      critical: 0,
      out_of_stock: 0,
    };

    for (const product of products) {
      counts[product.stockLevel.status]++;
    }

    return counts;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Expiration Checks
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Find products expiring within N days
   */
  static findExpiring(products: Product[], days: number): Product[] {
    return products.filter(p => p.expiresWithin(days));
  }

  /**
   * Find expired products
   */
  static findExpired(products: Product[]): Product[] {
    return products.filter(p => p.isExpired());
  }

  // ─────────────────────────────────────────────────────────────────────
  // Reorder Suggestions
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Generate reorder suggestions
   */
  static generateReorderSuggestions(
    products: Product[],
  ): Array<{ productId: string; name: string; suggestedQuantity: number; estimatedCost: number }> {
    return products
      .filter(p => p.needsReorder())
      .map(p => ({
        productId: p.id,
        name: p.name,
        suggestedQuantity: p.stockLevel.unitsToReorder(),
        estimatedCost: p.costPrice.toPesos() * p.stockLevel.unitsToReorder(),
      }))
      .filter(s => s.suggestedQuantity > 0);
  }
}
