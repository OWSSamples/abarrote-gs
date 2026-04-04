import { describe, it, expect } from 'vitest';
import { Money } from '@/domain/value-objects/Money';

describe('Money Value Object', () => {
  describe('factory methods', () => {
    it('creates from pesos', () => {
      const money = Money.fromPesos(99.99);
      expect(money.toPesos()).toBe(99.99);
    });

    it('creates from cents', () => {
      const money = Money.fromCents(9999);
      expect(money.toPesos()).toBe(99.99);
    });

    it('creates zero', () => {
      const money = Money.zero();
      expect(money.toPesos()).toBe(0);
      expect(money.isZero()).toBe(true);
    });

    it('throws on NaN', () => {
      expect(() => Money.fromPesos(NaN)).toThrow('Invalid amount');
    });

    it('throws on Infinity', () => {
      expect(() => Money.fromPesos(Infinity)).toThrow('Invalid amount');
    });
  });

  describe('arithmetic operations', () => {
    it('adds two amounts', () => {
      const a = Money.fromPesos(10);
      const b = Money.fromPesos(5.50);
      expect(a.add(b).toPesos()).toBe(15.50);
    });

    it('subtracts two amounts', () => {
      const a = Money.fromPesos(10);
      const b = Money.fromPesos(3.25);
      expect(a.subtract(b).toPesos()).toBe(6.75);
    });

    it('multiplies by factor', () => {
      const money = Money.fromPesos(10);
      expect(money.multiply(3).toPesos()).toBe(30);
    });

    it('divides by factor', () => {
      const money = Money.fromPesos(30);
      expect(money.divide(3).toPesos()).toBe(10);
    });

    it('throws on divide by zero', () => {
      const money = Money.fromPesos(10);
      expect(() => money.divide(0)).toThrow('Cannot divide by zero');
    });

    it('calculates percentage', () => {
      const money = Money.fromPesos(100);
      expect(money.percentage(16).toPesos()).toBe(16);
    });
  });

  describe('comparison operations', () => {
    it('equals same amount', () => {
      const a = Money.fromPesos(10);
      const b = Money.fromPesos(10);
      expect(a.equals(b)).toBe(true);
    });

    it('not equals different amount', () => {
      const a = Money.fromPesos(10);
      const b = Money.fromPesos(11);
      expect(a.equals(b)).toBe(false);
    });

    it('greater than comparison', () => {
      const a = Money.fromPesos(10);
      const b = Money.fromPesos(5);
      expect(a.isGreaterThan(b)).toBe(true);
      expect(b.isGreaterThan(a)).toBe(false);
    });

    it('less than comparison', () => {
      const a = Money.fromPesos(5);
      const b = Money.fromPesos(10);
      expect(a.isLessThan(b)).toBe(true);
    });

    it('detects positive', () => {
      expect(Money.fromPesos(10).isPositive()).toBe(true);
      expect(Money.fromPesos(0).isPositive()).toBe(false);
      expect(Money.fromPesos(-5).isPositive()).toBe(false);
    });

    it('detects negative', () => {
      expect(Money.fromPesos(-5).isNegative()).toBe(true);
      expect(Money.fromPesos(0).isNegative()).toBe(false);
      expect(Money.fromPesos(10).isNegative()).toBe(false);
    });
  });

  describe('formatting', () => {
    it('formats as MXN currency', () => {
      const money = Money.fromPesos(1234.56);
      expect(money.format()).toContain('1,234.56');
    });

    it('formats plain number', () => {
      const money = Money.fromPesos(99.90);
      expect(money.formatPlain()).toBe('99.90');
    });

    it('serializes to JSON as number', () => {
      const money = Money.fromPesos(50);
      expect(JSON.stringify({ amount: money })).toBe('{"amount":50}');
    });
  });
});
