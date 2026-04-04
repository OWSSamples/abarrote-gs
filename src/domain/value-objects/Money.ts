/**
 * Money Value Object
 * 
 * Immutable representation of monetary values with safe arithmetic operations.
 * Prevents floating-point precision issues by using integer cents internally.
 * 
 * @example
 * const price = Money.fromPesos(99.99);
 * const tax = price.multiply(0.16);
 * const total = price.add(tax);
 * console.log(total.toPesos()); // 115.99
 */
export class Money {
  private readonly cents: number;

  private constructor(cents: number) {
    if (!Number.isFinite(cents) || Number.isNaN(cents)) {
      throw new Error('Money: Invalid amount - must be a finite number');
    }
    this.cents = Math.round(cents);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────

  static fromPesos(pesos: number): Money {
    return new Money(pesos * 100);
  }

  static fromCents(cents: number): Money {
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Arithmetic Operations (Immutable)
  // ─────────────────────────────────────────────────────────────────────

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  multiply(factor: number): Money {
    return new Money(this.cents * factor);
  }

  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new Error('Money: Cannot divide by zero');
    }
    return new Money(this.cents / divisor);
  }

  percentage(percent: number): Money {
    return this.multiply(percent / 100);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Comparison Operations
  // ─────────────────────────────────────────────────────────────────────

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  isGreaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    return this.cents >= other.cents;
  }

  isLessThan(other: Money): boolean {
    return this.cents < other.cents;
  }

  isLessThanOrEqual(other: Money): boolean {
    return this.cents <= other.cents;
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  isPositive(): boolean {
    return this.cents > 0;
  }

  isNegative(): boolean {
    return this.cents < 0;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Conversion Methods
  // ─────────────────────────────────────────────────────────────────────

  toPesos(): number {
    return this.cents / 100;
  }

  toCents(): number {
    return this.cents;
  }

  /**
   * Format as Mexican peso string
   */
  format(): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.toPesos());
  }

  /**
   * Format without currency symbol (for display in tables)
   */
  formatPlain(): string {
    return this.toPesos().toFixed(2);
  }

  toString(): string {
    return this.format();
  }

  toJSON(): number {
    return this.toPesos();
  }
}
