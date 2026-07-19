const MAX_DISPLAY_ITEMS = 250;
const MAX_PRODUCT_NAME_LENGTH = 180;
const MAX_PAYMENT_METHOD_LENGTH = 60;
const MAX_FOLIO_LENGTH = 80;
const MAX_MONEY_VALUE = 1_000_000_000;

export interface CustomerDisplayItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type CustomerDisplaySaleStatus = 'idle' | 'active' | 'paying' | 'finished';

export interface CustomerDisplaySale {
  items: CustomerDisplayItem[];
  total: number;
  subtotal: number;
  iva: number;
  cardSurcharge: number;
  discountAmount: number;
  amountPaid: number;
  change: number;
  paymentMethod: string;
  status: CustomerDisplaySaleStatus;
  folio?: string;
}

export const EMPTY_CUSTOMER_DISPLAY_SALE: CustomerDisplaySale = {
  items: [],
  total: 0,
  subtotal: 0,
  iva: 0,
  cardSurcharge: 0,
  discountAmount: 0,
  amountPaid: 0,
  change: 0,
  paymentMethod: 'efectivo',
  status: 'idle',
};

export const CUSTOMER_DISPLAY_PAYMENT_LABELS: Readonly<Record<string, string>> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  tarjeta_web: 'Pago en línea',
  tarjeta_manual: 'Tarjeta',
  transferencia: 'Transferencia',
  spei: 'Transferencia SPEI',
  spei_conekta: 'Transferencia SPEI',
  spei_stripe: 'Transferencia SPEI',
  oxxo_conekta: 'Pago en efectivo',
  oxxo_stripe: 'Pago en efectivo',
  tarjeta_clip: 'Tarjeta',
  clip_terminal: 'Tarjeta',
  paypal: 'PayPal',
  qr_cobro: 'Pago con QR',
  fiado: 'Crédito de la tienda',
  puntos: 'Puntos de lealtad',
};

interface DisplayChannelMessage {
  type: 'UPDATE_SALE' | 'TEST_SALE' | 'UPDATE_CONFIG' | 'PING';
  payload?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toBoundedMoney(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_MONEY_VALUE) {
    return null;
  }

  return value;
}

function toDisplayItem(value: unknown): CustomerDisplayItem | null {
  if (!isRecord(value)) return null;

  const productName = typeof value.productName === 'string' ? value.productName.trim() : '';
  const quantity = typeof value.quantity === 'number' ? value.quantity : Number.NaN;
  const unitPrice = toBoundedMoney(value.unitPrice);
  const subtotal = toBoundedMoney(value.subtotal);

  if (
    !productName ||
    productName.length > MAX_PRODUCT_NAME_LENGTH ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 100_000 ||
    unitPrice === null ||
    subtotal === null
  ) {
    return null;
  }

  return { productName, quantity, unitPrice, subtotal };
}

function isSaleStatus(value: unknown): value is CustomerDisplaySaleStatus {
  return value === 'idle' || value === 'active' || value === 'paying' || value === 'finished';
}

export function parseCustomerDisplayMessage(value: unknown): DisplayChannelMessage | null {
  if (!isRecord(value)) return null;
  if (
    value.type !== 'UPDATE_SALE' &&
    value.type !== 'TEST_SALE' &&
    value.type !== 'UPDATE_CONFIG' &&
    value.type !== 'PING'
  ) {
    return null;
  }

  return { type: value.type, payload: value.payload };
}

export function parseCustomerDisplaySale(value: unknown): CustomerDisplaySale | null {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > MAX_DISPLAY_ITEMS) return null;
  if (!isSaleStatus(value.status)) return null;

  const items = value.items.map(toDisplayItem);
  if (items.some((item) => item === null)) return null;

  const total = toBoundedMoney(value.total);
  const subtotal = toBoundedMoney(value.subtotal);
  const iva = toBoundedMoney(value.iva);
  const cardSurcharge = toBoundedMoney(value.cardSurcharge);
  const discountAmount = toBoundedMoney(value.discountAmount);
  const amountPaid = value.amountPaid === undefined ? 0 : toBoundedMoney(value.amountPaid);
  const change = value.change === undefined ? 0 : toBoundedMoney(value.change);
  const paymentMethod = typeof value.paymentMethod === 'string' ? value.paymentMethod.trim() : '';
  const folio = typeof value.folio === 'string' ? value.folio.trim() : undefined;

  if (
    total === null ||
    subtotal === null ||
    iva === null ||
    cardSurcharge === null ||
    discountAmount === null ||
    amountPaid === null ||
    change === null ||
    !paymentMethod ||
    paymentMethod.length > MAX_PAYMENT_METHOD_LENGTH ||
    (folio !== undefined && folio.length > MAX_FOLIO_LENGTH)
  ) {
    return null;
  }

  return {
    items: items as CustomerDisplayItem[],
    total,
    subtotal,
    iva,
    cardSurcharge,
    discountAmount,
    amountPaid,
    change,
    paymentMethod,
    status: value.status,
    folio: folio || undefined,
  };
}
