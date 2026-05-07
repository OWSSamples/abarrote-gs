/**
 * ESC/POS Ticket Builder
 *
 * Converts structured ticket data into raw ESC/POS byte sequences
 * ready to send to a thermal printer via WebSerial or TCP/IP.
 */

import {
  INIT,
  SET_CP858,
  ALIGN_CENTER,
  ALIGN_LEFT,
  BOLD_ON,
  BOLD_OFF,
  DOUBLE_HEIGHT_ON,
  DOUBLE_HEIGHT_OFF,
  DOUBLE_SIZE_ON,
  DOUBLE_SIZE_OFF,
  FONT_B,
  FONT_A,
  LINE_FEED,
  CUT_PARTIAL,
  DRAWER_KICK_PIN2,
  DRAWER_KICK_PIN5,
  horizontalRule,
  doubleRule,
  feedLines,
  encodeText,
  concatBytes,
  formatRow,
  barcodeCode128,
} from './commands';

// ── Ticket Data Types ────────────────────────────────────────────

export interface TicketItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  sku?: string;
}

export interface SaleTicketData {
  storeName: string;
  address?: string;
  phone?: string;
  rfc?: string;
  folio: string;
  date: string;
  time: string;
  cashier: string;
  paymentMethod: string;
  items: TicketItem[];
  subtotal: number;
  iva: number;
  discount: number;
  total: number;
  amountPaid: number;
  change: number;
  clientName?: string;
  footer?: string;
  servicePhone?: string;
  vigencia?: string;
  isReprint?: boolean;
}

export interface CorteTicketData {
  storeName: string;
  date: string;
  time: string;
  cashier: string;
  startingFund: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalExpenses: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  transactionCount: number;
}

// ── Column width for 80mm paper ──────────────────────────────────
const COL = 48; // Font A: 48 chars per line on 80mm

// ── Money formatter ──────────────────────────────────────────────
function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

// ── Sale Ticket Builder ──────────────────────────────────────────

export function buildSaleTicket(data: SaleTicketData, openDrawer: boolean = false, drawerPin: 2 | 5 = 2): Uint8Array {
  const parts: Uint8Array[] = [INIT, SET_CP858];

  // ── Header ──
  parts.push(ALIGN_CENTER);
  parts.push(DOUBLE_HEIGHT_ON);
  parts.push(encodeText(data.storeName));
  parts.push(LINE_FEED);
  parts.push(DOUBLE_HEIGHT_OFF);

  if (data.address) {
    parts.push(FONT_B, encodeText(data.address), LINE_FEED, FONT_A);
  }
  if (data.phone) {
    parts.push(FONT_B, encodeText(`Tel: ${data.phone}`), LINE_FEED, FONT_A);
  }
  if (data.rfc) {
    parts.push(FONT_B, encodeText(`RFC: ${data.rfc}`), LINE_FEED, FONT_A);
  }

  parts.push(horizontalRule('-', COL), LINE_FEED);

  // ── Ticket info ──
  parts.push(ALIGN_LEFT);
  parts.push(formatRow('Folio:', data.folio, COL), LINE_FEED);
  parts.push(formatRow('Fecha:', `${data.date} ${data.time}`, COL), LINE_FEED);
  parts.push(formatRow('Cajero:', data.cashier, COL), LINE_FEED);
  parts.push(formatRow('Pago:', data.paymentMethod, COL), LINE_FEED);

  if (data.clientName) {
    parts.push(formatRow('Cliente:', data.clientName, COL), LINE_FEED);
  }

  parts.push(horizontalRule('-', COL), LINE_FEED);

  // ── Items ──
  for (const item of data.items) {
    // Item name (full width)
    const name = item.name.length > COL ? item.name.slice(0, COL) : item.name;
    parts.push(encodeText(name), LINE_FEED);

    // Qty x price = subtotal
    const detail = `  ${item.quantity} x ${money(item.unitPrice)}`;
    parts.push(formatRow(detail, money(item.subtotal), COL), LINE_FEED);
  }

  parts.push(doubleRule(COL), LINE_FEED);

  // ── Totals ──
  if (data.discount > 0) {
    parts.push(formatRow('Descuento:', `-${money(data.discount)}`, COL), LINE_FEED);
  }
  parts.push(formatRow('Subtotal:', money(data.subtotal), COL), LINE_FEED);
  if (data.iva > 0) {
    parts.push(formatRow('IVA:', money(data.iva), COL), LINE_FEED);
  }

  // TOTAL — big & bold
  parts.push(ALIGN_CENTER, DOUBLE_SIZE_ON, BOLD_ON);
  parts.push(encodeText(`TOTAL ${money(data.total)}`), LINE_FEED);
  parts.push(DOUBLE_SIZE_OFF, BOLD_OFF, ALIGN_LEFT);

  parts.push(horizontalRule('-', COL), LINE_FEED);
  parts.push(formatRow('Pagado:', money(data.amountPaid), COL), LINE_FEED);
  parts.push(formatRow('Cambio:', money(data.change), COL), LINE_FEED);

  // ── Reprint badge ──
  if (data.isReprint) {
    parts.push(LINE_FEED, ALIGN_CENTER, BOLD_ON);
    parts.push(encodeText('--- REIMPRESION ---'));
    parts.push(LINE_FEED, BOLD_OFF);
  }

  // ── Barcode (folio) ──
  parts.push(LINE_FEED, ALIGN_CENTER);
  if (data.folio.length <= 20) {
    parts.push(barcodeCode128(data.folio));
    parts.push(LINE_FEED);
  }

  // ── Footer ──
  if (data.footer) {
    parts.push(LINE_FEED, ALIGN_CENTER, FONT_B);
    parts.push(encodeText(data.footer), LINE_FEED);
    parts.push(FONT_A);
  }
  if (data.servicePhone) {
    parts.push(FONT_B, encodeText(`Atencion: ${data.servicePhone}`), LINE_FEED, FONT_A);
  }
  if (data.vigencia) {
    parts.push(FONT_B, encodeText(`Vigencia: ${data.vigencia}`), LINE_FEED, FONT_A);
  }

  parts.push(LINE_FEED, ALIGN_CENTER, FONT_B);
  parts.push(encodeText('OPENDEX POS'), LINE_FEED);
  parts.push(FONT_A);

  // ── Feed & cut ──
  parts.push(feedLines(4));
  parts.push(CUT_PARTIAL);

  // ── Cash drawer kick ──
  if (openDrawer) {
    parts.push(drawerPin === 5 ? DRAWER_KICK_PIN5 : DRAWER_KICK_PIN2);
  }

  return concatBytes(parts);
}

// ── Corte de Caja Ticket Builder ─────────────────────────────────

export function buildCorteTicket(data: CorteTicketData): Uint8Array {
  const parts: Uint8Array[] = [INIT, SET_CP858];

  // ── Header ──
  parts.push(ALIGN_CENTER, DOUBLE_HEIGHT_ON);
  parts.push(encodeText(data.storeName), LINE_FEED);
  parts.push(DOUBLE_HEIGHT_OFF);
  parts.push(BOLD_ON, encodeText('CORTE DE CAJA'), LINE_FEED, BOLD_OFF);
  parts.push(horizontalRule('=', COL), LINE_FEED);

  // ── Info ──
  parts.push(ALIGN_LEFT);
  parts.push(formatRow('Fecha:', data.date, COL), LINE_FEED);
  parts.push(formatRow('Hora:', data.time, COL), LINE_FEED);
  parts.push(formatRow('Cajero:', data.cashier, COL), LINE_FEED);
  parts.push(formatRow('Transacciones:', String(data.transactionCount), COL), LINE_FEED);
  parts.push(horizontalRule('-', COL), LINE_FEED);

  // ── Sales breakdown ──
  parts.push(BOLD_ON, encodeText('VENTAS'), LINE_FEED, BOLD_OFF);
  parts.push(formatRow('  Total ventas:', money(data.totalSales), COL), LINE_FEED);
  parts.push(formatRow('  Efectivo:', money(data.totalCash), COL), LINE_FEED);
  parts.push(formatRow('  Tarjeta:', money(data.totalCard), COL), LINE_FEED);
  parts.push(formatRow('  Transferencia:', money(data.totalTransfer), COL), LINE_FEED);
  parts.push(horizontalRule('-', COL), LINE_FEED);

  // ── Cash reconciliation ──
  parts.push(BOLD_ON, encodeText('ARQUEO DE CAJA'), LINE_FEED, BOLD_OFF);
  parts.push(formatRow('  Fondo inicial:', money(data.startingFund), COL), LINE_FEED);
  parts.push(formatRow('  Gastos:', money(data.totalExpenses), COL), LINE_FEED);
  parts.push(formatRow('  Esperado:', money(data.expectedCash), COL), LINE_FEED);
  parts.push(formatRow('  Contado:', money(data.actualCash), COL), LINE_FEED);

  parts.push(doubleRule(COL), LINE_FEED);

  // ── Difference ──
  parts.push(ALIGN_CENTER, DOUBLE_SIZE_ON, BOLD_ON);
  const diffLabel = data.difference >= 0 ? 'SOBRANTE' : 'FALTANTE';
  parts.push(encodeText(`${diffLabel} ${money(Math.abs(data.difference))}`), LINE_FEED);
  parts.push(DOUBLE_SIZE_OFF, BOLD_OFF);

  // ── Footer ──
  parts.push(LINE_FEED, ALIGN_CENTER, FONT_B);
  parts.push(encodeText('OPENDEX POS'), LINE_FEED);
  parts.push(FONT_A);

  parts.push(feedLines(4));
  parts.push(CUT_PARTIAL);

  return concatBytes(parts);
}

// ── Cash Drawer Only ─────────────────────────────────────────────

/**
 * Build the bytes that pulse the cash drawer.
 *
 * @param pin Solenoid pin used by the drawer. Most drawers (Epson, Star,
 * Xprinter, Nextep standard) use pin 2. A subset of Nextep/Bematech models
 * wire the solenoid to pin 5 — if pin 2 doesn't open your drawer, try 5.
 */
export function buildDrawerKick(pin: 2 | 5 = 2): Uint8Array {
  return concatBytes([INIT, pin === 5 ? DRAWER_KICK_PIN5 : DRAWER_KICK_PIN2]);
}
