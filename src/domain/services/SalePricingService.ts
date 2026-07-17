import { Money } from '@/domain/value-objects/Money';
import { PricingService } from '@/domain/services/PricingService';
import type { PaymentMethod, SaleItem, StoreConfig } from '@/types';

const CARD_SURCHARGE_RATE = 0.025;
const CARD_METHODS = new Set<PaymentMethod>(['tarjeta', 'tarjeta_web', 'tarjeta_manual']);

export interface SaleCatalogProduct {
  id: string;
  name: string;
  sku: string;
  unitPrice: string | number;
}

export interface SalePricingInput {
  items: Array<{ productId: string; quantity: number }>;
  discountValue: number;
  discountType: 'amount' | 'percent';
  paymentMethod: PaymentMethod;
  amountPaid: number;
  customerPoints: number;
}

export interface CalculatedSalePricing {
  items: SaleItem[];
  subtotal: number;
  iva: number;
  cardSurcharge: number;
  total: number;
  amountPaid: number;
  change: number;
  pointsEarned: number;
  pointsUsed: number;
  discount: number;
  discountType: 'amount' | 'percent';
}

export function calculateSalePricing(
  input: SalePricingInput,
  catalog: SaleCatalogProduct[],
  config: StoreConfig,
): CalculatedSalePricing {
  const productById = new Map(catalog.map((product) => [product.id, product]));
  const quantities = new Map<string, number>();
  const order: string[] = [];

  for (const item of input.items) {
    if (!quantities.has(item.productId)) order.push(item.productId);
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  const items = order.map((productId) => {
    const product = productById.get(productId);
    if (!product) throw new Error(`Producto no disponible: ${productId}`);

    const quantity = quantities.get(productId) ?? 0;
    const unitPrice = Money.fromPesos(Number(product.unitPrice));
    return {
      productId,
      productName: product.name,
      sku: product.sku,
      quantity,
      unitPrice: unitPrice.toPesos(),
      subtotal: unitPrice.multiply(quantity).toPesos(),
    };
  });

  const rawSubtotal = items.reduce((sum, item) => sum.add(Money.fromPesos(item.subtotal)), Money.zero());
  if (input.discountType === 'percent' && input.discountValue > 100) {
    throw new Error('El descuento porcentual no puede superar 100');
  }
  const requestedDiscount =
    input.discountType === 'percent'
      ? rawSubtotal.multiply(input.discountValue / 100)
      : Money.fromPesos(input.discountValue);
  if (requestedDiscount.isGreaterThan(rawSubtotal)) {
    throw new Error('El descuento no puede superar el subtotal de la venta');
  }

  const subtotal = rawSubtotal.subtract(requestedDiscount);
  const configuredIvaRate = Number.parseFloat(config.ivaRate) / 100;
  const ivaRate = Number.isFinite(configuredIvaRate) && configuredIvaRate >= 0 ? configuredIvaRate : 0;
  const iva = config.pricesIncludeIva
    ? subtotal.subtract(subtotal.divide(1 + ivaRate))
    : subtotal.multiply(ivaRate);

  const cardSurcharge = CARD_METHODS.has(input.paymentMethod)
    ? subtotal.multiply(CARD_SURCHARGE_RATE).multiply(1 + ivaRate)
    : Money.zero();
  let total = config.pricesIncludeIva ? subtotal.add(cardSurcharge) : subtotal.add(iva).add(cardSurcharge);

  let pointsUsed = 0;
  if (input.paymentMethod === 'puntos') {
    const redemption = PricingService.validateRedemption(input.customerPoints, input.customerPoints, total, {
      valuePerPoint: config.pointsValue || 1,
    });
    if (!redemption.valid) throw new Error(redemption.reason ?? 'No fue posible aplicar los puntos');
    pointsUsed = redemption.pointsToRedeem;
    total = total.subtract(redemption.discount);
  }

  const pointsEarned = config.loyaltyEnabled
    ? PricingService.calculatePointsEarned(subtotal, config.pointsPerPeso || 100)
    : 0;
  const amountPaid = input.paymentMethod === 'efectivo' ? Money.fromPesos(input.amountPaid) : total;
  if (input.paymentMethod === 'efectivo' && amountPaid.isLessThan(total)) {
    throw new Error('El monto recibido es menor al total de la venta');
  }

  return {
    items,
    subtotal: subtotal.toPesos(),
    iva: iva.toPesos(),
    cardSurcharge: cardSurcharge.toPesos(),
    total: total.toPesos(),
    amountPaid: amountPaid.toPesos(),
    change: amountPaid.subtract(total).toPesos(),
    pointsEarned,
    pointsUsed,
    discount: requestedDiscount.toPesos(),
    discountType: input.discountType,
  };
}
