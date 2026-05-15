import { Money } from '../value-objects';
import { Sale, DiscountType } from '../entities';

/**
 * Promotion Rule Interface
 * Can be extended for different promotion types
 */
export interface PromotionRule {
  readonly id: string;
  readonly name: string;
  readonly type: 'percentage' | 'fixed' | 'buy_x_get_y' | 'bundle';
  readonly value: number;
  /** For buy_x_get_y: the quantity X that triggers the free item */
  readonly triggerQty?: number;
  readonly minPurchase?: number;
  readonly maxDiscount?: number;
  readonly categoryId?: string;
  readonly productIds?: string[];
  /** For bundle: product IDs that must ALL be present for the bundle discount */
  readonly bundleProductIds?: string[];
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
  static calculateDiscount(subtotal: Money, discountValue: number, type: DiscountType): Money {
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
      const hasProduct = sale.items.some((i) => promotion.productIds!.includes(i.productId));
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
      case 'buy_x_get_y': {
        // Buy X items, get the cheapest one free.
        // value = how many free items; triggerQty = how many to buy (default X=2, get 1 free)
        const triggerQty = promotion.triggerQty ?? 2;
        const freeQty = promotion.value; // number of free items

        // Filter eligible items (by productIds if specified, otherwise all)
        const eligible = promotion.productIds?.length
          ? sale.items.filter((i) => promotion.productIds!.includes(i.productId))
          : sale.items;

        // Calculate total eligible units without materializing per-unit array
        const totalEligibleUnits = eligible.reduce((sum, i) => sum + i.quantity.value, 0);

        if (totalEligibleUnits >= triggerQty + freeQty) {
          // Build sorted unit prices only for the count we need (freeQty cheapest)
          // Sort items by unit price ascending — pick cheapest units first
          const sortedItems = [...eligible].sort(
            (a, b) => a.unitPrice.toPesos() - b.unitPrice.toPesos(),
          );

          let remainingFree = freeQty;
          let totalDiscount = Money.zero();
          for (const item of sortedItems) {
            if (remainingFree <= 0) break;
            const freeFromThis = Math.min(remainingFree, item.quantity.value);
            totalDiscount = totalDiscount.add(item.unitPrice.multiply(freeFromThis));
            remainingFree -= freeFromThis;
          }
          discount = totalDiscount;
        } else {
          discount = Money.zero();
        }
        break;
      }
      case 'bundle': {
        // All bundleProductIds must be in the sale for the fixed discount to apply.
        const bundleIds = promotion.bundleProductIds ?? promotion.productIds ?? [];
        if (bundleIds.length === 0) {
          discount = Money.zero();
          break;
        }
        const saleProductIds = new Set(sale.items.map((i) => i.productId));
        const allPresent = bundleIds.every((pid) => saleProductIds.has(pid));
        discount = allPresent ? Money.fromPesos(promotion.value) : Money.zero();
        break;
      }
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

  /**
   * Apply the best promotion from a list (conflict resolution).
   * Evaluates all eligible promotions and picks the one that gives the customer
   * the highest discount (greedy best-for-customer strategy).
   */
  static applyBestPromotion(
    sale: Sale,
    promotions: PromotionRule[],
  ): { discount: Money; appliedPromotion: PromotionRule | null } {
    let bestDiscount = Money.zero();
    let bestPromotion: PromotionRule | null = null;

    for (const promo of promotions) {
      const result = PricingService.applyPromotion(sale, promo);
      if (result.appliedPromotion && result.discount.isGreaterThan(bestDiscount)) {
        bestDiscount = result.discount;
        bestPromotion = result.appliedPromotion;
      }
    }

    return { discount: bestDiscount, appliedPromotion: bestPromotion };
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

  /**
   * Validate and calculate a point redemption at checkout.
   * Enforces business rules:
   *  - Customer must have enough points
   *  - Minimum redemption threshold (default 100 points)
   *  - Cannot redeem more than sale total
   *  - Maximum redemption cap (default 50% of sale total)
   */
  static validateRedemption(
    requestedPoints: number,
    availablePoints: number,
    saleTotal: Money,
    opts: {
      valuePerPoint?: number;
      minRedeemPoints?: number;
      maxRedeemPercent?: number;
    } = {},
  ): { valid: boolean; pointsToRedeem: number; discount: Money; reason?: string } {
    const valuePerPoint = opts.valuePerPoint ?? 0.1;
    const minRedeemPoints = opts.minRedeemPoints ?? 100;
    const maxRedeemPercent = opts.maxRedeemPercent ?? 50;

    if (requestedPoints <= 0) {
      return {
        valid: false,
        pointsToRedeem: 0,
        discount: Money.zero(),
        reason: 'La cantidad de puntos debe ser mayor a 0',
      };
    }
    if (requestedPoints < minRedeemPoints) {
      return {
        valid: false,
        pointsToRedeem: 0,
        discount: Money.zero(),
        reason: `Mínimo ${minRedeemPoints} puntos para canjear`,
      };
    }
    if (requestedPoints > availablePoints) {
      return { valid: false, pointsToRedeem: 0, discount: Money.zero(), reason: 'Puntos insuficientes' };
    }

    const maxDiscount = saleTotal.percentage(maxRedeemPercent);
    let discount = PricingService.calculatePointsValue(requestedPoints, valuePerPoint);

    // Cap discount to max allowed percentage of sale total
    let pointsToRedeem = requestedPoints;
    if (discount.isGreaterThan(maxDiscount)) {
      discount = maxDiscount;
      pointsToRedeem = Math.ceil(maxDiscount.toPesos() / valuePerPoint);
    }

    // Cap discount to sale total
    if (discount.isGreaterThan(saleTotal)) {
      discount = saleTotal;
      pointsToRedeem = Math.ceil(saleTotal.toPesos() / valuePerPoint);
    }

    return { valid: true, pointsToRedeem, discount };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Card Surcharges
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Calculate card surcharge (if applicable)
   */
  static calculateCardSurcharge(total: Money, surchargePercent: number, applyToTotal = true): Money {
    if (surchargePercent <= 0) return Money.zero();
    return applyToTotal ? total.percentage(surchargePercent) : Money.zero();
  }
}
