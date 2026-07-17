import { describe, it, expect } from 'vitest';
import { Sale, SaleItem } from '@/domain/entities';
import { Folio, Money, Quantity } from '@/domain/value-objects';

function createTestSaleItem(
  overrides: Partial<{
    productId: string;
    quantity: number;
    unitPrice: number;
    costPrice: number;
    discount: number;
  }> = {},
): SaleItem {
  return SaleItem.create({
    productId: overrides.productId ?? 'p-test',
    productName: 'Test Product',
    quantity: Quantity.of(overrides.quantity ?? 2),
    unitPrice: Money.fromPesos(overrides.unitPrice ?? 50),
    costPrice: Money.fromPesos(overrides.costPrice ?? 30),
    discount: overrides.discount ? Money.fromPesos(overrides.discount) : undefined,
  });
}

describe('SaleItem Entity', () => {
  describe('creation', () => {
    it('creates valid sale item', () => {
      const item = createTestSaleItem();
      expect(item.productId).toBe('p-test');
      expect(item.quantity.value).toBe(2);
    });

    it('applies default discount of zero', () => {
      const item = createTestSaleItem();
      expect(item.discount.toPesos()).toBe(0);
    });

    it('throws on empty productId', () => {
      expect(() =>
        SaleItem.create({
          productId: '',
          productName: 'Test',
          quantity: Quantity.of(1),
          unitPrice: Money.fromPesos(10),
          costPrice: Money.fromPesos(5),
        }),
      ).toThrow('Product ID is required');
    });

    it('throws on zero quantity', () => {
      expect(() =>
        SaleItem.create({
          productId: 'p-1',
          productName: 'Test',
          quantity: Quantity.zero(),
          unitPrice: Money.fromPesos(10),
          costPrice: Money.fromPesos(5),
        }),
      ).toThrow('greater than zero');
    });
  });

  describe('calculations', () => {
    it('calculates gross subtotal', () => {
      const item = createTestSaleItem({ quantity: 3, unitPrice: 100 });
      expect(item.grossSubtotal.toPesos()).toBe(300);
    });

    it('calculates subtotal with discount', () => {
      const item = SaleItem.create({
        productId: 'p-1',
        productName: 'Test',
        quantity: Quantity.of(2),
        unitPrice: Money.fromPesos(100),
        costPrice: Money.fromPesos(50),
        discount: Money.fromPesos(20),
      });
      expect(item.subtotal.toPesos()).toBe(180); // 200 - 20
    });

    it('calculates profit', () => {
      const item = createTestSaleItem({
        quantity: 2,
        unitPrice: 50,
        costPrice: 30,
      });
      // Revenue: 100, Cost: 60, Profit: 40
      expect(item.profit.toPesos()).toBe(40);
    });
  });

  describe('operations', () => {
    it('adds quantity', () => {
      const item = createTestSaleItem({ quantity: 2 });
      const updated = item.addQuantity(Quantity.of(3));
      expect(updated.quantity.value).toBe(5);
    });

    it('applies discount', () => {
      const item = createTestSaleItem({ quantity: 2, unitPrice: 100 });
      const discounted = item.applyDiscount(Money.fromPesos(50));
      expect(discounted.discount.toPesos()).toBe(50);
    });

    it('throws if discount exceeds subtotal', () => {
      const item = createTestSaleItem({ quantity: 1, unitPrice: 50 });
      expect(() => item.applyDiscount(Money.fromPesos(100))).toThrow('exceed subtotal');
    });
  });
});

describe('Sale Entity', () => {
  const createTestSale = (items = [createTestSaleItem()]) => {
    return Sale.create({
      folio: Folio.generate('20260714', 1),
      items,
      paymentMethod: 'efectivo',
      amountPaid: Money.fromPesos(500),
      cajero: 'Test Cajero',
    });
  };

  describe('creation', () => {
    it('creates valid sale', () => {
      const sale = createTestSale();
      expect(sale.items).toHaveLength(1);
      expect(sale.cajero).toBe('Test Cajero');
      expect(sale.status).toBe('completada');
    });

    it('throws on empty items', () => {
      expect(() =>
        Sale.create({
          folio: Folio.generate('20260714', 2),
          items: [],
          paymentMethod: 'efectivo',
          amountPaid: Money.fromPesos(100),
          cajero: 'Test',
        }),
      ).toThrow('without items');
    });

    it('throws on empty cajero', () => {
      expect(() =>
        Sale.create({
          folio: Folio.generate('20260714', 3),
          items: [createTestSaleItem()],
          paymentMethod: 'efectivo',
          amountPaid: Money.fromPesos(100),
          cajero: '',
        }),
      ).toThrow('Cashier name is required');
    });
  });

  describe('calculations', () => {
    it('calculates subtotal from items', () => {
      const items = [
        createTestSaleItem({ quantity: 2, unitPrice: 50 }), // 100
        createTestSaleItem({ quantity: 1, unitPrice: 30 }), // 30
      ];
      const sale = createTestSale(items);
      expect(sale.subtotal.toPesos()).toBe(130);
    });

    it('calculates IVA at 16%', () => {
      const items = [createTestSaleItem({ quantity: 1, unitPrice: 100 })];
      const sale = createTestSale(items);
      expect(sale.iva.toPesos()).toBe(16);
    });

    it('calculates total with IVA', () => {
      const items = [createTestSaleItem({ quantity: 1, unitPrice: 100 })];
      const sale = createTestSale(items);
      expect(sale.total.toPesos()).toBe(116);
    });

    it('calculates change', () => {
      const items = [createTestSaleItem({ quantity: 1, unitPrice: 100 })];
      const sale = Sale.create({
        folio: Folio.generate('20260714', 4),
        items,
        paymentMethod: 'efectivo',
        amountPaid: Money.fromPesos(200),
        cajero: 'Test',
      });
      expect(sale.change.toPesos()).toBeCloseTo(84, 0); // 200 - 116
    });

    it('calculates profit', () => {
      const items = [createTestSaleItem({ quantity: 2, unitPrice: 50, costPrice: 30 })];
      const sale = createTestSale(items);
      // Total cost: 60, Subtotal: 100, IVA: 16, Total: 116
      // Profit ≈ 116 - 60 = 56
      expect(sale.profit.toPesos()).toBeCloseTo(56, 0);
    });

    it('counts total items', () => {
      const items = [createTestSaleItem({ quantity: 2 }), createTestSaleItem({ quantity: 3 })];
      const sale = createTestSale(items);
      expect(sale.itemCount).toBe(5);
    });
  });

  describe('operations', () => {
    it('adds item to sale', () => {
      const sale = createTestSale();
      const newItem = createTestSaleItem({ productId: 'p-new', quantity: 1 });
      const updated = sale.addItem(newItem);
      expect(updated.items).toHaveLength(2);
    });

    it('merges quantity for existing product', () => {
      const sale = createTestSale([createTestSaleItem({ productId: 'p-1', quantity: 2 })]);
      const addItem = createTestSaleItem({ productId: 'p-1', quantity: 3 });
      const updated = sale.addItem(addItem);

      expect(updated.items).toHaveLength(1);
      expect(updated.items[0].quantity.value).toBe(5);
    });

    it('removes item from sale', () => {
      const items = [createTestSaleItem({ productId: 'p-1' }), createTestSaleItem({ productId: 'p-2' })];
      const sale = createTestSale(items);
      const updated = sale.removeItem('p-1');

      expect(updated.items).toHaveLength(1);
      expect(updated.items[0].productId).toBe('p-2');
    });

    it('throws when removing last item', () => {
      const sale = createTestSale();
      expect(() => sale.removeItem('p-test')).toThrow('Cannot remove last item');
    });

    it('applies discount to sale', () => {
      const sale = createTestSale();
      const discounted = sale.applyDiscount(Money.fromPesos(10));
      expect(discounted.discount.toPesos()).toBe(10);
    });

    it('cancels sale', () => {
      const sale = createTestSale();
      const cancelled = sale.cancel();
      expect(cancelled.status).toBe('cancelada');
      expect(cancelled.isCancelled()).toBe(true);
    });

    it('throws when cancelling already cancelled', () => {
      const sale = createTestSale();
      const cancelled = sale.cancel();
      expect(() => cancelled.cancel()).toThrow('Already cancelled');
    });
  });

  describe('serialization', () => {
    it('converts to plain object', () => {
      const sale = createTestSale();
      const plain = sale.toPlainObject();

      expect(typeof plain.id).toBe('string');
      expect(typeof plain.folio).toBe('string');
      expect(typeof plain.subtotal).toBe('number');
      expect(typeof plain.iva).toBe('number');
      expect(typeof plain.total).toBe('number');
      expect(Array.isArray(plain.items)).toBe(true);
    });
  });
});
