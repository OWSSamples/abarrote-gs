import { Money, Folio, Quantity } from '../value-objects';
import { SaleItem } from './SaleItem';

/**
 * Payment Method Types
 */
export type PaymentMethod =
  | 'efectivo'
  | 'tarjeta'
  | 'tarjeta_web'
  | 'tarjeta_manual'
  | 'tarjeta_clip'
  | 'clip_terminal'
  | 'transferencia'
  | 'fiado'
  | 'puntos'
  | 'spei_conekta'
  | 'spei_stripe'
  | 'oxxo_conekta'
  | 'oxxo_stripe';

/**
 * Sale Status
 */
export type SaleStatus = 'pendiente' | 'completada' | 'cancelada';

/**
 * Discount Type
 */
export type DiscountType = 'amount' | 'percent';

/**
 * Sale Entity
 * 
 * Aggregate root for the sales bounded context.
 * Encapsulates all business rules for creating and managing sales.
 *
 * @example
 * const sale = Sale.create({
 *   items: [item1, item2],
 *   paymentMethod: 'efectivo',
 *   amountPaid: Money.fromPesos(500),
 *   cajero: 'Juan',
 * });
 */
export interface SaleProps {
  readonly id?: string;
  readonly folio?: Folio;
  readonly items: readonly SaleItem[];
  readonly paymentMethod: PaymentMethod;
  readonly amountPaid: Money;
  readonly cajero: string;
  readonly customerId?: string;
  readonly installments?: number;
  readonly discount?: Money;
  readonly discountType?: DiscountType;
  readonly pointsUsed?: number;
  readonly pointsEarned?: number;
  readonly cardSurcharge?: Money;
  readonly status?: SaleStatus;
  readonly date?: Date;
}

/**
 * IVA rate in Mexico (16%)
 */
const IVA_RATE = 0.16;

/**
 * Payment methods that require internet
 */
const ONLINE_ONLY_METHODS = new Set<PaymentMethod>([
  'spei_conekta', 'spei_stripe', 'oxxo_conekta', 'oxxo_stripe',
  'tarjeta_web', 'tarjeta_clip', 'clip_terminal',
]);

export class Sale {
  private constructor(
    private readonly props: Required<Omit<SaleProps, 'customerId'>> & { customerId?: string },
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────

  static create(props: SaleProps): Sale {
    Sale.validateInvariants(props);

    const items = props.items;
    const subtotal = Sale.calculateSubtotal(items);
    const discount = props.discount ?? Money.zero();
    const cardSurcharge = props.cardSurcharge ?? Money.zero();
    const iva = subtotal.subtract(discount).multiply(IVA_RATE);
    const total = subtotal.subtract(discount).add(iva).add(cardSurcharge);

    // Calculate points earned (1 point per 10 pesos, standard rule)
    const pointsEarned = props.pointsEarned ?? Math.floor(total.toPesos() / 10);

    return new Sale({
      id: props.id ?? `s-${crypto.randomUUID()}`,
      folio: props.folio ?? Folio.generateOffline(),
      items,
      paymentMethod: props.paymentMethod,
      amountPaid: props.amountPaid,
      cajero: props.cajero,
      customerId: props.customerId,
      installments: props.installments ?? 1,
      discount,
      discountType: props.discountType ?? 'amount',
      pointsUsed: props.pointsUsed ?? 0,
      pointsEarned,
      cardSurcharge,
      status: props.status ?? 'completada',
      date: props.date ?? new Date(),
    });
  }

  /**
   * Reconstruct from database (no validation)
   */
  static fromPersistence(props: Required<Omit<SaleProps, 'customerId'>> & { customerId?: string }): Sale {
    return new Sale(props);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────

  private static validateInvariants(props: SaleProps): void {
    if (props.items.length === 0) {
      throw new Error('Sale: Cannot create sale without items');
    }
    if (!props.cajero || props.cajero.trim() === '') {
      throw new Error('Sale: Cashier name is required');
    }
    if (props.amountPaid.isNegative()) {
      throw new Error('Sale: Amount paid cannot be negative');
    }
  }

  private static calculateSubtotal(items: readonly SaleItem[]): Money {
    return items.reduce(
      (acc, item) => acc.add(item.subtotal),
      Money.zero(),
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Accessors
  // ─────────────────────────────────────────────────────────────────────

  get id(): string { return this.props.id; }
  get folio(): Folio { return this.props.folio; }
  get items(): readonly SaleItem[] { return this.props.items; }
  get paymentMethod(): PaymentMethod { return this.props.paymentMethod; }
  get amountPaid(): Money { return this.props.amountPaid; }
  get cajero(): string { return this.props.cajero; }
  get customerId(): string | undefined { return this.props.customerId; }
  get installments(): number { return this.props.installments; }
  get discount(): Money { return this.props.discount; }
  get discountType(): DiscountType { return this.props.discountType; }
  get pointsUsed(): number { return this.props.pointsUsed; }
  get pointsEarned(): number { return this.props.pointsEarned; }
  get cardSurcharge(): Money { return this.props.cardSurcharge; }
  get status(): SaleStatus { return this.props.status; }
  get date(): Date { return this.props.date; }

  // ─────────────────────────────────────────────────────────────────────
  // Derived Properties (Business Logic)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Sum of all item subtotals (before discount)
   */
  get subtotal(): Money {
    return Sale.calculateSubtotal(this.items);
  }

  /**
   * IVA amount (16% of discounted subtotal)
   */
  get iva(): Money {
    return this.subtotal.subtract(this.discount).multiply(IVA_RATE);
  }

  /**
   * Final total
   */
  get total(): Money {
    return this.subtotal
      .subtract(this.discount)
      .add(this.iva)
      .add(this.cardSurcharge);
  }

  /**
   * Change to return to customer
   */
  get change(): Money {
    if (this.amountPaid.isLessThan(this.total)) {
      return Money.zero();
    }
    return this.amountPaid.subtract(this.total);
  }

  /**
   * Total cost of all items
   */
  get totalCost(): Money {
    return this.items.reduce(
      (acc, item) => acc.add(item.totalCost),
      Money.zero(),
    );
  }

  /**
   * Gross profit from this sale
   */
  get profit(): Money {
    return this.total.subtract(this.totalCost);
  }

  /**
   * Total quantity of items
   */
  get itemCount(): number {
    return this.items.reduce(
      (acc, item) => acc + item.quantity.value,
      0,
    );
  }

  /**
   * Check if this is an offline sale that needs syncing
   */
  isOffline(): boolean {
    return this.folio.isTemporary();
  }

  /**
   * Check if payment method requires internet
   */
  requiresInternet(): boolean {
    return ONLINE_ONLY_METHODS.has(this.paymentMethod);
  }

  /**
   * Check if sale is cancelled
   */
  isCancelled(): boolean {
    return this.status === 'cancelada';
  }

  /**
   * Check if sale is complete
   */
  isComplete(): boolean {
    return this.status === 'completada';
  }

  // ─────────────────────────────────────────────────────────────────────
  // Operations (Immutable)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Add an item to the sale
   */
  addItem(item: SaleItem): Sale {
    // Check if product already exists, merge quantities
    const existingIndex = this.items.findIndex(i => i.productId === item.productId);
    
    let newItems: SaleItem[];
    if (existingIndex >= 0) {
      newItems = [...this.items];
      newItems[existingIndex] = this.items[existingIndex].addQuantity(item.quantity);
    } else {
      newItems = [...this.items, item];
    }

    return Sale.create({
      ...this.props,
      items: newItems,
    });
  }

  /**
   * Remove an item from the sale
   */
  removeItem(productId: string): Sale {
    const newItems = this.items.filter(i => i.productId !== productId);
    if (newItems.length === 0) {
      throw new Error('Sale: Cannot remove last item');
    }
    return Sale.create({
      ...this.props,
      items: newItems,
    });
  }

  /**
   * Apply a discount to the sale
   */
  applyDiscount(discount: Money, type: DiscountType = 'amount'): Sale {
    if (discount.isGreaterThan(this.subtotal)) {
      throw new Error('Sale: Discount cannot exceed subtotal');
    }
    return Sale.create({
      ...this.props,
      discount,
      discountType: type,
    });
  }

  /**
   * Cancel the sale
   */
  cancel(): Sale {
    if (this.status === 'cancelada') {
      throw new Error('Sale: Already cancelled');
    }
    return new Sale({
      ...this.props,
      status: 'cancelada',
    });
  }

  /**
   * Update with server-assigned folio (after offline sync)
   */
  withFolio(folio: Folio): Sale {
    return new Sale({
      ...this.props,
      folio,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────

  toPlainObject(): {
    id: string;
    folio: string;
    items: ReturnType<SaleItem['toPlainObject']>[];
    subtotal: number;
    iva: number;
    cardSurcharge: number;
    total: number;
    paymentMethod: PaymentMethod;
    installments: number;
    amountPaid: number;
    change: number;
    cajero: string;
    pointsEarned: number;
    pointsUsed: number;
    discount: number;
    discountType: DiscountType;
    date: string;
    status: SaleStatus;
    customerId?: string;
  } {
    return {
      id: this.id,
      folio: this.folio.toString(),
      items: this.items.map(i => i.toPlainObject()),
      subtotal: this.subtotal.toPesos(),
      iva: this.iva.toPesos(),
      cardSurcharge: this.cardSurcharge.toPesos(),
      total: this.total.toPesos(),
      paymentMethod: this.paymentMethod,
      installments: this.installments,
      amountPaid: this.amountPaid.toPesos(),
      change: this.change.toPesos(),
      cajero: this.cajero,
      pointsEarned: this.pointsEarned,
      pointsUsed: this.pointsUsed,
      discount: this.discount.toPesos(),
      discountType: this.discountType,
      date: this.date.toISOString(),
      status: this.status,
      customerId: this.customerId,
    };
  }
}
