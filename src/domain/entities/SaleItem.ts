import { Money, Quantity } from '../value-objects';

/**
 * SaleItem Entity
 * 
 * Represents a single line item in a sale.
 * Immutable once created - modifications create new instances.
 *
 * @example
 * const item = SaleItem.create({
 *   productId: 'p-123',
 *   productName: 'Coca-Cola 600ml',
 *   quantity: Quantity.of(3),
 *   unitPrice: Money.fromPesos(22),
 *   costPrice: Money.fromPesos(15),
 * });
 * console.log(item.subtotal.format()); // $66.00
 */
export interface SaleItemProps {
  readonly productId: string;
  readonly productName: string;
  readonly quantity: Quantity;
  readonly unitPrice: Money;
  readonly costPrice: Money;
  readonly discount?: Money;
}

export class SaleItem {
  private constructor(private readonly props: SaleItemProps) {}

  // ─────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────

  static create(props: SaleItemProps): SaleItem {
    SaleItem.validateInvariants(props);
    return new SaleItem({
      ...props,
      discount: props.discount ?? Money.zero(),
    });
  }

  static fromPersistence(
    productId: string,
    productName: string,
    quantity: number,
    unitPrice: number,
    costPrice: number,
    discount = 0,
  ): SaleItem {
    return new SaleItem({
      productId,
      productName,
      quantity: Quantity.of(quantity),
      unitPrice: Money.fromPesos(unitPrice),
      costPrice: Money.fromPesos(costPrice),
      discount: Money.fromPesos(discount),
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────

  private static validateInvariants(props: SaleItemProps): void {
    if (!props.productId || props.productId.trim() === '') {
      throw new Error('SaleItem: Product ID is required');
    }
    if (!props.productName || props.productName.trim() === '') {
      throw new Error('SaleItem: Product name is required');
    }
    if (props.quantity.isZero()) {
      throw new Error('SaleItem: Quantity must be greater than zero');
    }
    if (props.unitPrice.isLessThanOrEqual(Money.zero())) {
      throw new Error('SaleItem: Unit price must be positive');
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Accessors
  // ─────────────────────────────────────────────────────────────────────

  get productId(): string { return this.props.productId; }
  get productName(): string { return this.props.productName; }
  get quantity(): Quantity { return this.props.quantity; }
  get unitPrice(): Money { return this.props.unitPrice; }
  get costPrice(): Money { return this.props.costPrice; }
  get discount(): Money { return this.props.discount ?? Money.zero(); }

  // ─────────────────────────────────────────────────────────────────────
  // Derived Properties (Business Logic)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Calculate gross subtotal (price × quantity) before discount
   */
  get grossSubtotal(): Money {
    return this.unitPrice.multiply(this.quantity.value);
  }

  /**
   * Calculate net subtotal after item discount
   */
  get subtotal(): Money {
    return this.grossSubtotal.subtract(this.discount);
  }

  /**
   * Calculate total cost for this item
   */
  get totalCost(): Money {
    return this.costPrice.multiply(this.quantity.value);
  }

  /**
   * Calculate profit for this item
   */
  get profit(): Money {
    return this.subtotal.subtract(this.totalCost);
  }

  /**
   * Calculate margin percentage
   */
  get marginPercent(): number {
    if (this.totalCost.isZero()) return 100;
    return (this.profit.toPesos() / this.totalCost.toPesos()) * 100;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Operations (Immutable)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Add quantity to this item (returns new SaleItem)
   */
  addQuantity(qty: Quantity): SaleItem {
    return new SaleItem({
      ...this.props,
      quantity: this.quantity.add(qty),
    });
  }

  /**
   * Apply discount to this item (returns new SaleItem)
   */
  applyDiscount(discount: Money): SaleItem {
    if (discount.isGreaterThan(this.grossSubtotal)) {
      throw new Error('SaleItem: Discount cannot exceed subtotal');
    }
    return new SaleItem({
      ...this.props,
      discount,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────

  toPlainObject(): {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    costPrice: number;
    discount: number;
    subtotal: number;
  } {
    return {
      productId: this.productId,
      productName: this.productName,
      quantity: this.quantity.value,
      unitPrice: this.unitPrice.toPesos(),
      costPrice: this.costPrice.toPesos(),
      discount: this.discount.toPesos(),
      subtotal: this.subtotal.toPesos(),
    };
  }
}
