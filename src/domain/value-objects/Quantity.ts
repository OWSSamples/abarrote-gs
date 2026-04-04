/**
 * Quantity Value Object
 * 
 * Represents a non-negative quantity of items.
 * Used for stock counts, sale quantities, order quantities, etc.
 *
 * @example
 * const qty = Quantity.of(5);
 * const doubled = qty.add(qty);
 * console.log(doubled.value); // 10
 */
export class Quantity {
  private constructor(private readonly amount: number) {
    if (!Number.isFinite(amount) || Number.isNaN(amount)) {
      throw new Error('Quantity: Must be a finite number');
    }
    if (amount < 0) {
      throw new Error('Quantity: Cannot be negative');
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────

  static of(amount: number): Quantity {
    return new Quantity(amount);
  }

  static zero(): Quantity {
    return new Quantity(0);
  }

  static one(): Quantity {
    return new Quantity(1);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Arithmetic Operations (Immutable)
  // ─────────────────────────────────────────────────────────────────────

  add(other: Quantity): Quantity {
    return new Quantity(this.amount + other.amount);
  }

  subtract(other: Quantity): Quantity {
    const result = this.amount - other.amount;
    if (result < 0) {
      throw new Error('Quantity: Subtraction would result in negative quantity');
    }
    return new Quantity(result);
  }

  /**
   * Subtract with floor at zero (for stock adjustments that can go negative temporarily)
   */
  subtractSafe(other: Quantity): Quantity {
    return new Quantity(Math.max(0, this.amount - other.amount));
  }

  multiply(factor: number): Quantity {
    if (factor < 0) {
      throw new Error('Quantity: Cannot multiply by negative factor');
    }
    return new Quantity(this.amount * factor);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Comparison Operations
  // ─────────────────────────────────────────────────────────────────────

  equals(other: Quantity): boolean {
    return this.amount === other.amount;
  }

  isGreaterThan(other: Quantity): boolean {
    return this.amount > other.amount;
  }

  isGreaterThanOrEqual(other: Quantity): boolean {
    return this.amount >= other.amount;
  }

  isLessThan(other: Quantity): boolean {
    return this.amount < other.amount;
  }

  isLessThanOrEqual(other: Quantity): boolean {
    return this.amount <= other.amount;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Conversion
  // ─────────────────────────────────────────────────────────────────────

  get value(): number {
    return this.amount;
  }

  toInteger(): number {
    return Math.floor(this.amount);
  }

  toString(): string {
    return String(this.amount);
  }

  toJSON(): number {
    return this.amount;
  }
}
