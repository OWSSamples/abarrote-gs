import { Money, Quantity } from '../value-objects';
import { SaleItem, Sale, DiscountType } from '../entities';

/**
 * Promotion Rule Interface
 * Can be extended for different promotion types
 */
export interface PromotionRule {
  readonly id: string;
  readonly name: string;
  readonly type: 'percentage' | 'fixed' | 'buy_x_get_y' | 'bundle';
  readonly value: number;
  readonly minPurchase?: number;
  readonly maxDiscount?: number;
  readonly categoryId?: string;
  readonly productIds?: string[];
  readonly startDate?: Date;
  readonly endDate?: Date;
}

/**
 * Pricing Service
 * 
 * Domain service for pricing calculations.
 * Stateless - pure functions that encapsulate pricing business rules.
 * 
 * Responsibilities:
 * - Calculate discounts
 * - Apply promotions
 * - Calculate IVA
 * - Calculate margins
 */
export class PricingService {
  /** IVA rate in Mexico */
  private static readonly IVA_RATE = 0.16;

  /** Default loyalty points rate (1 point per N pesos) */
  private static readonly POINTS_RATE = 10;

  // ─────────────────────────────────────────────────────────────────────
  // IVA Calculations
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Calculate IVA for an amount
   */
  static calculateIva(amount: Money): Money {
    return amount.multiply(PricingService.IVA_RATE);
  }

  /**
   * Extract IVA from a tax-inclusive amount
   */
  static extractIva(totalInclusive: Money): { base: Money; iva: Money } {
    const base = totalInclusive.divide(1 + PricingService.IVA_RATE);
    const iva = totalInclusive.subtract(base);
    return { base, iva };
  }

  /**
   * Add IVA to a base amount
   */
  static addIva(base: Money): Money {
    return base.add(base.multiply(PricingService.IVA_RATE));
  }

  // ─────────────────────────────────────────────────────────────────────
  // Discount Calculations
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Calculate discount amount from percentage or fixed
   */
  static calculateDiscount(
    subtotal: Money,
    discountValue: number,
    type: DiscountType,
  ): Money {
    if (type === 'percent') {
      if (discountValue < 0 || discountValue > 100) {
        throw new Error('PricingService: Percentage must be between 0 and 100');
      }
      return subtotal.percentage(discountValue);
    }
    
    // Fixed amount
    const discount = Money.fromPesos(discountValue);
    if (discount.isGreaterThan(subtotal)) {
      throw new Error('PricingService: Discount cannot exceed subtotal');
    }
    return discount;
  }

  /**
   * Apply promotion rules to a sale
   */
  static applyPromotion(
    sale: Sale,
    promotion: PromotionRule,
  ): { discount: Money; appliedPromotion: PromotionRule | null } {
    // Check date validity
    if (promotion.startDate && new Date() < promotion.startDate) {
      return { discount: Money.zero(), appliedPromotion: null };
    }
    if (promotion.endDate && new Date() > promotion.endDate) {
      return { discount: Money.zero(), appliedPromotion: null };
    }

    // Check minimum purchase
    if (promotion.minPurchase && sale.subtotal.toPesos() < promotion.minPurchase) {
      return { discount: Money.zero(), appliedPromotion: null };
    }

    // Check product/category restrictions
    if (promotion.productIds && promotion.productIds.length > 0) {
      const hasProduct = sale.items.some(i => 
        promotion.productIds!.includes(i.productId),
      );
      if (!hasProduct) {
        return { discount: Money.zero(), appliedPromotion: null };
      }
    }

    // Calculate discount based on type
    let discount: Money;
    switch (promotion.type) {
      case 'percentage':
        discount = sale.subtotal.percentage(promotion.value);
        break;
      case 'fixed':
        discount = Money.fromPesos(promotion.value);
        break;
      case 'buy_x_get_y':
        // Simplified: value = X, get Y-th free
        // Would need more complex logic for real implementation
        discount = Money.zero();
        break;
      case 'bundle':
        discount = Money.fromPesos(promotion.value);
        break;
      default:
        discount = Money.zero();
    }

    // Apply max discount cap
    if (promotion.maxDiscount) {
      const cap = Money.fromPesos(promotion.maxDiscount);
      if (discount.isGreaterThan(cap)) {
        discount = cap;
      }
    }

    return { discount, appliedPromotion: promotion };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Margin Calculations
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Calculate suggested price from cost and margin
   */
  static calculatePriceFromMargin(cost: Money, marginPercent: number): Money {
    return cost.add(cost.percentage(marginPercent));
  }

  /**
   * Calculate margin percentage from cost and price
   */
  static calculateMargin(cost: Money, price: Money): number {
    if (cost.isZero()) return 100;
    return ((price.toPesos() - cost.toPesos()) / cost.toPesos()) * 100;
  }

  /**
   * Validate margin meets minimum threshold
   */
  static validateMargin(cost: Money, price: Money, minMargin = 10): boolean {
    const margin = PricingService.calculateMargin(cost, price);
    return margin >= minMargin;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Loyalty Points
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Calculate loyalty points earned from a purchase
   */
  static calculatePointsEarned(total: Money, rate?: number): number {
    const pointsRate = rate ?? PricingService.POINTS_RATE;
    return Math.floor(total.toPesos() / pointsRate);
  }

  /**
   * Calculate monetary value of loyalty points
   */
  static calculatePointsValue(points: number, valuePerPoint = 0.1): Money {
    return Money.fromPesos(points * valuePerPoint);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Card Surcharges
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Calculate card surcharge (if applicable)
   */
  static calculateCardSurcharge(
    total: Money,
    surchargePercent: number,
    applyToTotal = true,
  ): Money {
    if (surchargePercent <= 0) return Money.zero();
    return applyToTotal ? total.percentage(surchargePercent) : Money.zero();
  }
}
