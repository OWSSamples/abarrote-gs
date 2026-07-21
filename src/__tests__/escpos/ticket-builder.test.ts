import { describe, it, expect } from 'vitest';
import {
  buildSaleTicket,
  buildCorteTicket,
  buildDrawerKick,
  type SaleTicketData,
  type CorteTicketData,
} from '@/lib/escpos/ticket-builder';
import {
  INIT,
  SET_CP858,
  CUT_PARTIAL,
  DRAWER_KICK_PIN2,
  DRAWER_KICK_PIN5,
  concatBytes,
} from '@/lib/escpos/commands';

const decode = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

function baseSale(overrides: Partial<SaleTicketData> = {}): SaleTicketData {
  return {
    storeName: 'Abarrotes Don Pepe',
    folio: 'A-1001',
    date: '2026-07-21',
    time: '12:30',
    cashier: 'Maria',
    paymentMethod: 'Efectivo',
    items: [
      { name: 'Leche 1L', quantity: 2, unitPrice: 25.5, subtotal: 51 },
      { name: 'Pan', quantity: 1, unitPrice: 18, subtotal: 18 },
    ],
    subtotal: 69,
    iva: 0,
    discount: 0,
    total: 69,
    amountPaid: 100,
    change: 31,
    ...overrides,
  };
}

function baseCorte(overrides: Partial<CorteTicketData> = {}): CorteTicketData {
  return {
    storeName: 'Abarrotes Don Pepe',
    date: '2026-07-21',
    time: '20:00',
    cashier: 'Maria',
    startingFund: 500,
    totalSales: 3200,
    totalCash: 2000,
    totalCard: 800,
    totalTransfer: 400,
    totalExpenses: 150,
    expectedCash: 2350,
    actualCash: 2350,
    difference: 0,
    transactionCount: 42,
    ...overrides,
  };
}

describe('escpos/ticket-builder', () => {
  describe('buildSaleTicket', () => {
    it('starts with printer init + code page and ends with a partial cut', () => {
      const bytes = buildSaleTicket(baseSale());
      const prefix = concatBytes([INIT, SET_CP858]);
      expect(Array.from(bytes.subarray(0, prefix.length))).toEqual(Array.from(prefix));
      const tail = Array.from(bytes.subarray(bytes.length - CUT_PARTIAL.length));
      expect(tail).toEqual(Array.from(CUT_PARTIAL));
    });

    it('includes store name, folio, cashier and item names', () => {
      const text = decode(buildSaleTicket(baseSale()));
      expect(text).toContain('Abarrotes Don Pepe');
      expect(text).toContain('A-1001');
      expect(text).toContain('Maria');
      expect(text).toContain('Leche 1L');
      expect(text).toContain('Pan');
    });

    it('renders the total with two decimals', () => {
      const text = decode(buildSaleTicket(baseSale()));
      expect(text).toContain('TOTAL $69.00');
      expect(text).toContain('Pagado:');
      expect(text).toContain('Cambio:');
    });

    it('renders optional header fields only when provided', () => {
      const withOptional = decode(
        buildSaleTicket(baseSale({ address: 'Calle 5', phone: '555-1234', rfc: 'XAXX010101000', clientName: 'Juan' })),
      );
      expect(withOptional).toContain('Calle 5');
      expect(withOptional).toContain('Tel: 555-1234');
      expect(withOptional).toContain('RFC: XAXX010101000');
      expect(withOptional).toContain('Cliente:');
      expect(withOptional).toContain('Juan');

      const withoutOptional = decode(buildSaleTicket(baseSale()));
      expect(withoutOptional).not.toContain('Tel:');
      expect(withoutOptional).not.toContain('RFC:');
      expect(withoutOptional).not.toContain('Cliente:');
    });

    it('shows discount and IVA lines only when greater than zero', () => {
      const withExtras = decode(buildSaleTicket(baseSale({ discount: 5, iva: 11.04 })));
      expect(withExtras).toContain('Descuento:');
      expect(withExtras).toContain('-$5.00');
      expect(withExtras).toContain('IVA:');

      const withoutExtras = decode(buildSaleTicket(baseSale()));
      expect(withoutExtras).not.toContain('Descuento:');
      expect(withoutExtras).not.toContain('IVA:');
    });

    it('adds a reprint badge when isReprint is set', () => {
      expect(decode(buildSaleTicket(baseSale({ isReprint: true })))).toContain('--- REIMPRESION ---');
      expect(decode(buildSaleTicket(baseSale()))).not.toContain('REIMPRESION');
    });

    it('renders the footer, service phone and vigencia when provided', () => {
      const text = decode(
        buildSaleTicket(baseSale({ footer: 'Gracias por su compra', servicePhone: '800-000', vigencia: '30 dias' })),
      );
      expect(text).toContain('Gracias por su compra');
      expect(text).toContain('Atencion: 800-000');
      expect(text).toContain('Vigencia: 30 dias');
    });

    it('truncates item names longer than the column width', () => {
      const longName = 'X'.repeat(60);
      const text = decode(buildSaleTicket(baseSale({ items: [{ name: longName, quantity: 1, unitPrice: 1, subtotal: 1 }] })));
      expect(text).toContain('X'.repeat(48));
      expect(text).not.toContain('X'.repeat(49));
    });

    it('does not append a drawer kick by default', () => {
      const bytes = buildSaleTicket(baseSale());
      const tail = Array.from(bytes.subarray(bytes.length - CUT_PARTIAL.length));
      expect(tail).toEqual(Array.from(CUT_PARTIAL));
    });

    it('appends the pin-2 drawer kick when openDrawer is true', () => {
      const bytes = buildSaleTicket(baseSale(), true);
      const tail = Array.from(bytes.subarray(bytes.length - DRAWER_KICK_PIN2.length));
      expect(tail).toEqual(Array.from(DRAWER_KICK_PIN2));
    });

    it('appends the pin-5 drawer kick when requested', () => {
      const bytes = buildSaleTicket(baseSale(), true, 5);
      const tail = Array.from(bytes.subarray(bytes.length - DRAWER_KICK_PIN5.length));
      expect(tail).toEqual(Array.from(DRAWER_KICK_PIN5));
    });

    it('omits the folio barcode when the folio is too long', () => {
      const shortFolio = buildSaleTicket(baseSale({ folio: 'A-1' }));
      const longFolio = buildSaleTicket(baseSale({ folio: 'F'.repeat(25) }));
      // The barcode adds bytes; a >20 char folio should produce a shorter ticket here.
      expect(longFolio.length).toBeLessThan(shortFolio.length);
    });
  });

  describe('buildCorteTicket', () => {
    it('starts with init/code page and ends with a partial cut', () => {
      const bytes = buildCorteTicket(baseCorte());
      const prefix = concatBytes([INIT, SET_CP858]);
      expect(Array.from(bytes.subarray(0, prefix.length))).toEqual(Array.from(prefix));
      const tail = Array.from(bytes.subarray(bytes.length - CUT_PARTIAL.length));
      expect(tail).toEqual(Array.from(CUT_PARTIAL));
    });

    it('includes the corte heading and totals breakdown', () => {
      const text = decode(buildCorteTicket(baseCorte()));
      expect(text).toContain('CORTE DE CAJA');
      expect(text).toContain('VENTAS');
      expect(text).toContain('ARQUEO DE CAJA');
      expect(text).toContain('Transacciones:');
      expect(text).toContain('42');
    });

    it('labels a positive difference as SOBRANTE', () => {
      const text = decode(buildCorteTicket(baseCorte({ difference: 25 })));
      expect(text).toContain('SOBRANTE $25.00');
      expect(text).not.toContain('FALTANTE');
    });

    it('labels a negative difference as FALTANTE with absolute value', () => {
      const text = decode(buildCorteTicket(baseCorte({ difference: -25 })));
      expect(text).toContain('FALTANTE $25.00');
      expect(text).not.toContain('SOBRANTE');
    });

    it('treats a zero difference as SOBRANTE $0.00', () => {
      const text = decode(buildCorteTicket(baseCorte({ difference: 0 })));
      expect(text).toContain('SOBRANTE $0.00');
    });
  });

  describe('buildDrawerKick', () => {
    it('emits init followed by the pin-2 kick by default', () => {
      expect(Array.from(buildDrawerKick())).toEqual(Array.from(concatBytes([INIT, DRAWER_KICK_PIN2])));
    });

    it('emits the pin-5 kick when pin 5 is requested', () => {
      expect(Array.from(buildDrawerKick(5))).toEqual(Array.from(concatBytes([INIT, DRAWER_KICK_PIN5])));
    });
  });
});
