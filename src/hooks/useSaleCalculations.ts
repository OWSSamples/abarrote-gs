import { useMemo } from 'react';
import type { SaleItem, Cliente } from '@/types';

export const IVA_RATE = 0.16;
export const CARD_SURCHARGE_RATE = 0.025; // 2.5% comisión por tarjeta

export interface SaleCalculationsParams {
  items: SaleItem[];
  discount: string;
  discountType: 'amount' | 'percent';
  discountPending: boolean;
  paymentMethod: string;
  clienteId: string;
  clientes: Cliente[];
  amountPaid: string;
  storeConfig: import('@/types').StoreConfig;
}

export interface SaleCalculationsResult {
  subtotal: number;
  discountAmount: number;
  subtotalAfterDiscount: number;
  iva: number;
  cardSurcharge: number;
  pointsEarned: number;
  pointsAvailable: number;
  total: number;
  pointsUsed: number;
  change: number;
}

export function useSaleCalculations({
  items,
  discount,
  discountType,
  discountPending,
  paymentMethod,
  clienteId,
  clientes,
  amountPaid,
  storeConfig,
}: SaleCalculationsParams): SaleCalculationsResult {
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.subtotal, 0), [items]);

  const discountAmount = useMemo(() => {
    const d = parseFloat(discount) || 0;
    if (d <= 0) return 0;
    if (discountType === 'percent') return Math.min(subtotal, (subtotal * d) / 100);
    return Math.min(subtotal, d);
  }, [discount, discountType, subtotal]);

  const subtotalAfterDiscount = useMemo(
    () => Math.max(0, subtotal - discountAmount),
    [subtotal, discountAmount],
  );

  const ivaRateFloat = useMemo(() => parseFloat(storeConfig.ivaRate) / 100 || 0, [storeConfig.ivaRate]);
  const pricesIncludeIva = storeConfig.pricesIncludeIva ?? true;

  const iva = useMemo(() => {
    if (pricesIncludeIva) {
      // El total (antes de comisiones) ya incluye el IVA, por lo que desglosamos el IVA del total.
      return subtotalAfterDiscount - (subtotalAfterDiscount / (1 + ivaRateFloat));
    } else {
      // El subtotal NO incluye IVA, hay que sumarlo o cobrarlo extra
      return subtotalAfterDiscount * ivaRateFloat;
    }
  }, [subtotalAfterDiscount, ivaRateFloat, pricesIncludeIva]);

  const cardSurcharge = useMemo(() => {
    if (
      paymentMethod !== 'tarjeta' &&
      paymentMethod !== 'tarjeta_manual' &&
      paymentMethod !== 'tarjeta_web'
    )
      return 0;
    const surcharge = subtotalAfterDiscount * CARD_SURCHARGE_RATE;
    const surchargeIva = surcharge * ivaRateFloat;
    return surcharge + surchargeIva;
  }, [subtotalAfterDiscount, paymentMethod, ivaRateFloat]);

  const pointsEarned = useMemo(
    () => Math.floor(subtotalAfterDiscount / 20),
    [subtotalAfterDiscount],
  );

  const pointsAvailable = useMemo(() => {
    if (!clienteId) return 0;
    const c = clientes.find((cl) => cl.id === clienteId);
    return c ? parseFloat(String(c.points)) : 0;
  }, [clienteId, clientes]);

  const total = useMemo(() => {
    const base = pricesIncludeIva 
      ? subtotalAfterDiscount + cardSurcharge 
      : subtotalAfterDiscount + iva + cardSurcharge;
      
    if (paymentMethod === 'puntos') {
      return Math.max(0, base - pointsAvailable);
    }
    return base;
  }, [subtotalAfterDiscount, iva, cardSurcharge, paymentMethod, pointsAvailable, pricesIncludeIva]);

  const pointsUsed = useMemo(() => {
    if (paymentMethod !== 'puntos' || !clienteId) return 0;
    const base = pricesIncludeIva 
      ? subtotalAfterDiscount + cardSurcharge 
      : subtotalAfterDiscount + iva + cardSurcharge;
    return Math.min(pointsAvailable, base);
  }, [paymentMethod, clienteId, pointsAvailable, subtotalAfterDiscount, iva, cardSurcharge, pricesIncludeIva]);

  const change = useMemo(() => {
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, paid - total);
  }, [amountPaid, total]);

  return {
    subtotal,
    discountAmount,
    subtotalAfterDiscount,
    iva,
    cardSurcharge,
    pointsEarned,
    pointsAvailable,
    total,
    pointsUsed,
    change,
  };
}
