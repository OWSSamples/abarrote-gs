import { Quantity } from './Quantity';

/**
 * Stock Level Status
 */
export type StockStatus = 'ok' | 'low' | 'critical' | 'out_of_stock';

/**
 * StockLevel Value Object
 * 
 * Represents the stock state of a product with business rules for alerts.
 * Encapsulates current stock, minimum threshold, and derived status.
 *
 * @example
 * const stock = StockLevel.of(5, 10);
 * console.log(stock.status); // 'low'
 * console.log(stock.needsReorder()); // true
 */
export class StockLevel {
  private constructor(
    private readonly current: Quantity,
    private readonly minimum: Quantity,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────

  static of(currentStock: number, minStock: number): StockLevel {
    return new StockLevel(
      Quantity.of(currentStock),
      Quantity.of(minStock),
    );
  }

  static fromQuantities(current: Quantity, minimum: Quantity): StockLevel {
    return new StockLevel(current, minimum);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Derived State (Business Rules)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Calculate stock status based on business rules:
   * - out_of_stock: current = 0
   * - critical: current < minimum * 0.5
   * - low: current <= minimum
   * - ok: current > minimum
   */
  get status(): StockStatus {
    if (this.current.isZero()) {
      return 'out_of_stock';
    }
    
    const halfMin = this.minimum.value * 0.5;
    if (this.current.value < halfMin) {
      return 'critical';
    }
    
    if (this.current.isLessThanOrEqual(this.minimum)) {
      return 'low';
    }
    
    return 'ok';
  }

  /**
   * Percentage of minimum stock covered (for UI progress bars)
   * Capped at 100% to avoid overflow display
   */
  get percentage(): number {
    if (this.minimum.isZero()) return 100;
    const pct = (this.current.value / this.minimum.value) * 100;
    return Math.min(100, Math.round(pct));
  }

  /**
   * Check if product needs to be reordered
   */
  needsReorder(): boolean {
    return this.status !== 'ok';
  }

  /**
   * Check if product is available for sale
   */
  isAvailable(): boolean {
    return this.current.value > 0;
  }

  /**
   * Check if a given quantity can be fulfilled
   */
  canFulfill(quantity: Quantity): boolean {
    return this.current.isGreaterThanOrEqual(quantity);
  }

  /**
   * Calculate how many units are needed to reach optimal stock (2x minimum)
   */
  unitsToReorder(): number {
    const optimal = this.minimum.value * 2;
    const needed = optimal - this.current.value;
    return Math.max(0, Math.ceil(needed));
  }

  // ─────────────────────────────────────────────────────────────────────
  // Operations (Immutable)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Create new StockLevel after adjustment
   */
  adjust(delta: number): StockLevel {
    const newCurrent = delta >= 0
      ? this.current.add(Quantity.of(delta))
      : this.current.subtractSafe(Quantity.of(Math.abs(delta)));
    return new StockLevel(newCurrent, this.minimum);
  }

  /**
   * Create new StockLevel with updated minimum
   */
  withMinimum(newMin: number): StockLevel {
    return new StockLevel(this.current, Quantity.of(newMin));
  }

  // ─────────────────────────────────────────────────────────────────────
  // Accessors
  // ─────────────────────────────────────────────────────────────────────

  get currentStock(): number {
    return this.current.value;
  }

  get minStock(): number {
    return this.minimum.value;
  }

  toJSON(): { current: number; minimum: number; status: StockStatus } {
    return {
      current: this.current.value,
      minimum: this.minimum.value,
      status: this.status,
    };
  }
}
