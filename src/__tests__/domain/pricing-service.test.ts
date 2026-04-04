import { describe, it, expect } from 'vitest';
import { PricingService } from '@/domain/services/PricingService';
import { Money } from '@/domain/value-objects';

describe('PricingService', () => {
  describe('IVA calculations', () => {
    it('calculates IVA at 16%', () => {
      const base = Money.fromPesos(100);
      const iva = PricingService.calculateIva(base);
      expect(iva.toPesos()).toBe(16);
    });

    it('adds IVA to base', () => {
      const base = Money.fromPesos(100);
      const total = PricingService.addIva(base);
      expect(total.toPesos()).toBe(116);
    });

    it('extracts IVA from inclusive amount', () => {
      const total = Money.fromPesos(116);
      const { base, iva } = PricingService.extractIva(total);
      expect(base.toPesos()).toBeCloseTo(100, 2);
      expect(iva.toPesos()).toBeCloseTo(16, 2);
    });
  });

  describe('discount calculations', () => {
    it('calculates percentage discount', () => {
      const subtotal = Money.fromPesos(100);
      const discount = PricingService.calculateDiscount(subtotal, 10, 'percent');
      expect(discount.toPesos()).toBe(10);
    });

    it('calculates fixed discount', () => {
      const subtotal = Money.fromPesos(100);
      const discount = PricingService.calculateDiscount(subtotal, 15, 'amount');
      expect(discount.toPesos()).toBe(15);
    });

    it('throws on percentage > 100', () => {
      const subtotal = Money.fromPesos(100);
      expect(() => 
        PricingService.calculateDiscount(subtotal, 150, 'percent'),
      ).toThrow('between 0 and 100');
    });

    it('throws on discount > subtotal', () => {
      const subtotal = Money.fromPesos(50);
      expect(() => 
        PricingService.calculateDiscount(subtotal, 100, 'amount'),
      ).toThrow('cannot exceed subtotal');
    });
  });

  describe('margin calculations', () => {
    it('calculates price from margin', () => {
      const cost = Money.fromPesos(100);
      const price = PricingService.calculatePriceFromMargin(cost, 30);
      expect(price.toPesos()).toBe(130);
    });

    it('calculates margin from cost and price', () => {
      const cost = Money.fromPesos(100);
      const price = Money.fromPesos(150);
      expect(PricingService.calculateMargin(cost, price)).toBe(50);
    });

    it('validates minimum margin', () => {
      const cost = Money.fromPesos(100);
      expect(PricingService.validateMargin(cost, Money.fromPesos(120), 10)).toBe(true);
      expect(PricingService.validateMargin(cost, Money.fromPesos(105), 10)).toBe(false);
    });
  });

  describe('loyalty points', () => {
    it('calculates points earned (1 per $10)', () => {
      const total = Money.fromPesos(150);
      expect(PricingService.calculatePointsEarned(total)).toBe(15);
    });

    it('calculates points with custom rate', () => {
      const total = Money.fromPesos(100);
      expect(PricingService.calculatePointsEarned(total, 5)).toBe(20);
    });

    it('calculates points value', () => {
      const value = PricingService.calculatePointsValue(100, 0.1);
      expect(value.toPesos()).toBe(10);
    });
  });

  describe('card surcharges', () => {
    it('calculates surcharge percentage', () => {
      const total = Money.fromPesos(100);
      const surcharge = PricingService.calculateCardSurcharge(total, 3);
      expect(surcharge.toPesos()).toBe(3);
    });

    it('returns zero for non-positive rate', () => {
      const total = Money.fromPesos(100);
      expect(PricingService.calculateCardSurcharge(total, 0).toPesos()).toBe(0);
      expect(PricingService.calculateCardSurcharge(total, -1).toPesos()).toBe(0);
    });
  });
});
