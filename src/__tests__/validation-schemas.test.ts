import { describe, it, expect } from 'vitest';
import {
  idSchema,
  createProductSchema,
  createClienteSchema,
  createSaleSchema,
  createCategorySchema,
  createGastoSchema,
  createAbonoSchema,
  validateSchema,
} from '@/lib/validation/schemas';

describe('Validation Schemas', () => {
  describe('idSchema', () => {
    it('accepts valid IDs', () => {
      expect(() => idSchema.parse('abc-123')).not.toThrow();
      expect(() => idSchema.parse('p-1234567890')).not.toThrow();
    });

    it('rejects empty strings', () => {
      expect(() => idSchema.parse('')).toThrow();
    });

    it('rejects very long strings', () => {
      const longId = 'a'.repeat(201);
      expect(() => idSchema.parse(longId)).toThrow();
    });
  });

  describe('createProductSchema', () => {
    const validProduct = {
      name: 'Coca-Cola 600ml',
      sku: 'CC600',
      barcode: '7501234567890',
      currentStock: 100,
      minStock: 20,
      category: 'bebidas',
      costPrice: 15,
      unitPrice: 22,
    };

    it('accepts valid product data', () => {
      expect(() => createProductSchema.parse(validProduct)).not.toThrow();
    });

    it('applies defaults', () => {
      const result = createProductSchema.parse(validProduct);
      expect(result.unit).toBe('pieza');
      expect(result.unitMultiple).toBe(1);
      expect(result.isPerishable).toBe(false);
    });

    it('rejects missing required fields', () => {
      expect(() => createProductSchema.parse({})).toThrow();
      expect(() => createProductSchema.parse({ name: 'Test' })).toThrow();
    });

    it('rejects negative prices', () => {
      expect(() =>
        createProductSchema.parse({
          ...validProduct,
          costPrice: -10,
        }),
      ).toThrow();
    });

    it('rejects negative stock', () => {
      expect(() =>
        createProductSchema.parse({
          ...validProduct,
          currentStock: -5,
        }),
      ).toThrow();
    });

    it('accepts optional imageUrl', () => {
      const result = createProductSchema.parse({
        ...validProduct,
        imageUrl: 'https://example.com/image.jpg',
      });
      expect(result.imageUrl).toBe('https://example.com/image.jpg');
    });

    it('rejects invalid imageUrl', () => {
      expect(() =>
        createProductSchema.parse({
          ...validProduct,
          imageUrl: 'not-a-url',
        }),
      ).toThrow();
    });
  });

  describe('createClienteSchema', () => {
    const validCliente = {
      name: 'Juan Pérez',
    };

    it('accepts minimal valid data', () => {
      const result = createClienteSchema.parse(validCliente);
      expect(result.name).toBe('Juan Pérez');
      expect(result.phone).toBe('');
      expect(result.creditLimit).toBe(0);
    });

    it('accepts full data', () => {
      const fullCliente = {
        name: 'María García',
        phone: '+52 555 1234567',
        email: 'maria@example.com',
        address: 'Calle Principal 123',
        notes: 'Cliente frecuente',
        creditLimit: 5000,
        points: 100,
      };
      expect(() => createClienteSchema.parse(fullCliente)).not.toThrow();
    });

    it('rejects empty name', () => {
      expect(() => createClienteSchema.parse({ name: '' })).toThrow();
    });

    it('rejects invalid email', () => {
      expect(() =>
        createClienteSchema.parse({
          name: 'Test',
          email: 'invalid-email',
        }),
      ).toThrow();
    });

    it('accepts empty string as email', () => {
      const result = createClienteSchema.parse({
        name: 'Test',
        email: '',
      });
      expect(result.email).toBe('');
    });
  });

  describe('createSaleSchema', () => {
    const validSale = {
      items: [
        {
          productId: 'p-123',
          productName: 'Product 1',
          sku: 'SKU001',
          quantity: 2,
          unitPrice: 50,
          subtotal: 100,
        },
      ],
      subtotal: 100,
      iva: 16,
      total: 116,
      paymentMethod: 'efectivo' as const,
      amountPaid: 200,
    };

    it('accepts valid sale data', () => {
      expect(() => createSaleSchema.parse(validSale)).not.toThrow();
    });

    it('applies defaults', () => {
      const result = createSaleSchema.parse(validSale);
      expect(result.installments).toBe(1);
      expect(result.change).toBe(0);
      expect(result.cardSurcharge).toBe(0);
      expect(result.discount).toBe(0);
      expect(result.discountType).toBe('amount');
    });

    it('rejects empty items array', () => {
      expect(() =>
        createSaleSchema.parse({
          ...validSale,
          items: [],
        }),
      ).toThrow();
    });

    it('rejects invalid payment method', () => {
      expect(() =>
        createSaleSchema.parse({
          ...validSale,
          paymentMethod: 'bitcoin',
        }),
      ).toThrow();
    });

    it('accepts all valid payment methods', () => {
      const methods = ['efectivo', 'tarjeta', 'tarjeta_web', 'transferencia', 'fiado', 'spei', 'tarjeta_clip'];
      for (const method of methods) {
        expect(() =>
          createSaleSchema.parse({
            ...validSale,
            paymentMethod: method,
            clienteId: method === 'fiado' ? 'cliente-1' : undefined,
          }),
        ).not.toThrow();
      }
    });

    it('rejects negative total', () => {
      expect(() =>
        createSaleSchema.parse({
          ...validSale,
          total: -100,
        }),
      ).toThrow();
    });
  });

  describe('createCategorySchema', () => {
    it('accepts valid category', () => {
      const result = createCategorySchema.parse({ name: 'Bebidas' });
      expect(result.name).toBe('Bebidas');
    });

    it('accepts optional fields', () => {
      const result = createCategorySchema.parse({
        name: 'Bebidas',
        description: 'Refrescos y aguas',
        icon: 'beverage',
      });
      expect(result.description).toBe('Refrescos y aguas');
    });

    it('rejects empty name', () => {
      expect(() => createCategorySchema.parse({ name: '' })).toThrow();
    });
  });

  describe('createGastoSchema', () => {
    const validGasto = {
      concepto: 'Pago de luz',
      categoria: 'servicios' as const,
      monto: 500,
      fecha: new Date(),
    };

    it('accepts valid expense', () => {
      expect(() => createGastoSchema.parse(validGasto)).not.toThrow();
    });

    it('coerces date strings', () => {
      const result = createGastoSchema.parse({
        ...validGasto,
        fecha: '2024-01-15',
      });
      expect(result.fecha).toBeInstanceOf(Date);
    });

    it('rejects invalid category', () => {
      expect(() =>
        createGastoSchema.parse({
          ...validGasto,
          categoria: 'invalid',
        }),
      ).toThrow();
    });

    it('rejects zero amount', () => {
      expect(() =>
        createGastoSchema.parse({
          ...validGasto,
          monto: 0,
        }),
      ).toThrow();
    });
  });

  describe('createAbonoSchema', () => {
    it('accepts valid payment', () => {
      const result = createAbonoSchema.parse({
        clienteId: 'cli-123',
        amount: 500,
      });
      expect(result.description).toBe('Abono');
    });

    it('accepts custom description', () => {
      const result = createAbonoSchema.parse({
        clienteId: 'cli-123',
        amount: 500,
        description: 'Pago parcial',
      });
      expect(result.description).toBe('Pago parcial');
    });

    it('rejects zero amount', () => {
      expect(() =>
        createAbonoSchema.parse({
          clienteId: 'cli-123',
          amount: 0,
        }),
      ).toThrow();
    });
  });
});

describe('validateSchema helper', () => {
  it('returns parsed data on success', () => {
    const result = validateSchema(idSchema, 'test-123', 'testContext');
    expect(result).toBe('test-123');
  });

  it('throws ValidationError on failure', () => {
    expect(() => validateSchema(idSchema, '', 'testContext')).toThrow();
  });
});
