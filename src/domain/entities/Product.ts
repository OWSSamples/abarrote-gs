import { Money, Quantity, StockLevel } from '../value-objects';

/**
 * Product Entity
 * 
 * Represents a product in the inventory with business rules:
 * - Price must be greater than cost (enforced margin)
 * - Stock cannot go negative
 * - Perishable products require expiration date
 * 
 * @example
 * const product = Product.create({
 *   id: 'p-123',
 *   name: 'Coca-Cola 600ml',
 *   sku: 'CC600',
 *   barcode: '7501234567890',
 *   category: 'bebidas',
 *   costPrice: Money.fromPesos(15),
 *   unitPrice: Money.fromPesos(22),
 *   stockLevel: StockLevel.of(100, 20),
 * });
 */
export interface ProductProps {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly barcode: string;
  readonly category: string;
  readonly costPrice: Money;
  readonly unitPrice: Money;
  readonly unit: string;
  readonly unitMultiple: number;
  readonly stockLevel: StockLevel;
  readonly isPerishable: boolean;
  readonly expirationDate: string | null;
  readonly imageUrl?: string;
}

export class Product {
  private constructor(private readonly props: ProductProps) {}

  // ─────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────

  static create(props: ProductProps): Product {
    Product.validateInvariants(props);
    return new Product(props);
  }

  /**
   * Reconstruct from database row (no validation - trusted source)
   */
  static fromPersistence(props: ProductProps): Product {
    return new Product(props);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Invariant Validation
  // ─────────────────────────────────────────────────────────────────────

  private static validateInvariants(props: ProductProps): void {
    if (!props.id || props.id.trim() === '') {
      throw new Error('Product: ID is required');
    }
    if (!props.name || props.name.trim() === '') {
      throw new Error('Product: Name is required');
    }
    if (!props.sku || props.sku.trim() === '') {
      throw new Error('Product: SKU is required');
    }
    if (!props.barcode || props.barcode.trim() === '') {
      throw new Error('Product: Barcode is required');
    }
    if (props.costPrice.isLessThanOrEqual(Money.zero())) {
      throw new Error('Product: Cost price must be positive');
    }
    if (props.unitPrice.isLessThanOrEqual(Money.zero())) {
      throw new Error('Product: Unit price must be positive');
    }
    if (props.unitPrice.isLessThanOrEqual(props.costPrice)) {
      throw new Error('Product: Unit price must be greater than cost price');
    }
    if (props.isPerishable && !props.expirationDate) {
      throw new Error('Product: Perishable products require expiration date');
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Accessors
  // ─────────────────────────────────────────────────────────────────────

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get sku(): string { return this.props.sku; }
  get barcode(): string { return this.props.barcode; }
  get category(): string { return this.props.category; }
  get costPrice(): Money { return this.props.costPrice; }
  get unitPrice(): Money { return this.props.unitPrice; }
  get unit(): string { return this.props.unit; }
  get unitMultiple(): number { return this.props.unitMultiple; }
  get stockLevel(): StockLevel { return this.props.stockLevel; }
  get isPerishable(): boolean { return this.props.isPerishable; }
  get expirationDate(): string | null { return this.props.expirationDate; }
  get imageUrl(): string | undefined { return this.props.imageUrl; }

  // ─────────────────────────────────────────────────────────────────────
  // Derived Properties (Business Logic)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Calculate profit margin as percentage
   */
  get margin(): number {
    const cost = this.costPrice.toPesos();
    const price = this.unitPrice.toPesos();
    return ((price - cost) / cost) * 100;
  }

  /**
   * Calculate profit per unit
   */
  get profitPerUnit(): Money {
    return this.unitPrice.subtract(this.costPrice);
  }

  /**
   * Check if product is available for sale
   */
  isAvailable(): boolean {
    return this.stockLevel.isAvailable();
  }

  /**
   * Check if product needs reorder
   */
  needsReorder(): boolean {
    return this.stockLevel.needsReorder();
  }

  /**
   * Check if product is expired (for perishables)
   */
  isExpired(): boolean {
    if (!this.isPerishable || !this.expirationDate) return false;
    const expDate = new Date(this.expirationDate);
    return expDate < new Date();
  }

  /**
   * Check if product expires within N days
   */
  expiresWithin(days: number): boolean {
    if (!this.isPerishable || !this.expirationDate) return false;
    const expDate = new Date(this.expirationDate);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);
    return expDate <= threshold;
  }

  /**
   * Check if a given quantity can be fulfilled
   */
  canFulfill(quantity: Quantity): boolean {
    return this.stockLevel.canFulfill(quantity);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Operations (Return new Product - Immutable)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Adjust stock level (positive = add, negative = subtract)
   */
  adjustStock(delta: number): Product {
    return new Product({
      ...this.props,
      stockLevel: this.stockLevel.adjust(delta),
    });
  }

  /**
   * Update price with margin validation
   */
  updatePrice(newPrice: Money): Product {
    if (newPrice.isLessThanOrEqual(this.costPrice)) {
      throw new Error('Product: New price must be greater than cost');
    }
    return new Product({
      ...this.props,
      unitPrice: newPrice,
    });
  }

  /**
   * Update cost (validates against current price)
   */
  updateCost(newCost: Money): Product {
    if (newCost.isGreaterThanOrEqual(this.unitPrice)) {
      throw new Error('Product: New cost must be less than current price');
    }
    return new Product({
      ...this.props,
      costPrice: newCost,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────

  toPlainObject(): {
    id: string;
    name: string;
    sku: string;
    barcode: string;
    category: string;
    costPrice: number;
    unitPrice: number;
    unit: string;
    unitMultiple: number;
    currentStock: number;
    minStock: number;
    isPerishable: boolean;
    expirationDate: string | null;
    imageUrl?: string;
  } {
    return {
      id: this.id,
      name: this.name,
      sku: this.sku,
      barcode: this.barcode,
      category: this.category,
      costPrice: this.costPrice.toPesos(),
      unitPrice: this.unitPrice.toPesos(),
      unit: this.unit,
      unitMultiple: this.unitMultiple,
      currentStock: this.stockLevel.currentStock,
      minStock: this.stockLevel.minStock,
      isPerishable: this.isPerishable,
      expirationDate: this.expirationDate,
      imageUrl: this.imageUrl,
    };
  }
}
