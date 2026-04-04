import { describe, it, expect } from 'vitest';
import { Quantity, StockLevel } from '@/domain/value-objects';

describe('Quantity Value Object', () => {
  describe('creation', () => {
    it('creates positive quantity', () => {
      const qty = Quantity.of(5);
      expect(qty.value).toBe(5);
    });

    it('creates zero quantity', () => {
      const qty = Quantity.zero();
      expect(qty.value).toBe(0);
      expect(qty.isZero()).toBe(true);
    });

    it('throws on negative', () => {
      expect(() => Quantity.of(-1)).toThrow('Cannot be negative');
    });

    it('throws on NaN', () => {
      expect(() => Quantity.of(NaN)).toThrow('Must be a finite number');
    });
  });

  describe('arithmetic', () => {
    it('adds quantities', () => {
      const a = Quantity.of(5);
      const b = Quantity.of(3);
      expect(a.add(b).value).toBe(8);
    });

    it('subtracts quantities', () => {
      const a = Quantity.of(10);
      const b = Quantity.of(3);
      expect(a.subtract(b).value).toBe(7);
    });

    it('throws on negative subtraction result', () => {
      const a = Quantity.of(3);
      const b = Quantity.of(10);
      expect(() => a.subtract(b)).toThrow('negative quantity');
    });

    it('subtractSafe floors at zero', () => {
      const a = Quantity.of(3);
      const b = Quantity.of(10);
      expect(a.subtractSafe(b).value).toBe(0);
    });

    it('multiplies by factor', () => {
      expect(Quantity.of(5).multiply(3).value).toBe(15);
    });

    it('throws on negative multiply factor', () => {
      expect(() => Quantity.of(5).multiply(-1)).toThrow('Cannot multiply by negative');
    });
  });
});

describe('StockLevel Value Object', () => {
  describe('status calculation', () => {
    it('returns ok when above minimum', () => {
      const stock = StockLevel.of(100, 20);
      expect(stock.status).toBe('ok');
      expect(stock.needsReorder()).toBe(false);
    });

    it('returns low when at or below minimum', () => {
      const stock = StockLevel.of(20, 20);
      expect(stock.status).toBe('low');
      expect(stock.needsReorder()).toBe(true);
    });

    it('returns critical when below half of minimum', () => {
      const stock = StockLevel.of(5, 20);
      expect(stock.status).toBe('critical');
    });

    it('returns out_of_stock when zero', () => {
      const stock = StockLevel.of(0, 20);
      expect(stock.status).toBe('out_of_stock');
      expect(stock.isAvailable()).toBe(false);
    });
  });

  describe('percentage', () => {
    it('calculates correct percentage', () => {
      const stock = StockLevel.of(50, 100);
      expect(stock.percentage).toBe(50);
    });

    it('caps at 100%', () => {
      const stock = StockLevel.of(200, 100);
      expect(stock.percentage).toBe(100);
    });

    it('returns 100 when minimum is zero', () => {
      const stock = StockLevel.of(50, 0);
      expect(stock.percentage).toBe(100);
    });
  });

  describe('fulfillment', () => {
    it('can fulfill available quantity', () => {
      const stock = StockLevel.of(50, 10);
      expect(stock.canFulfill(Quantity.of(30))).toBe(true);
    });

    it('cannot fulfill more than available', () => {
      const stock = StockLevel.of(10, 20);
      expect(stock.canFulfill(Quantity.of(15))).toBe(false);
    });
  });

  describe('reorder', () => {
    it('calculates units to reorder (target 2x min)', () => {
      const stock = StockLevel.of(10, 50);
      // Target = 100, current = 10, need 90
      expect(stock.unitsToReorder()).toBe(90);
    });

    it('returns 0 when above optimal', () => {
      const stock = StockLevel.of(150, 50);
      expect(stock.unitsToReorder()).toBe(0);
    });
  });

  describe('adjustment', () => {
    it('adds stock', () => {
      const stock = StockLevel.of(10, 5);
      const adjusted = stock.adjust(5);
      expect(adjusted.currentStock).toBe(15);
    });

    it('subtracts stock', () => {
      const stock = StockLevel.of(10, 5);
      const adjusted = stock.adjust(-3);
      expect(adjusted.currentStock).toBe(7);
    });

    it('floors at zero on large subtraction', () => {
      const stock = StockLevel.of(5, 3);
      const adjusted = stock.adjust(-10);
      expect(adjusted.currentStock).toBe(0);
    });
  });
});
