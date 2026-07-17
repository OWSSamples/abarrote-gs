import 'server-only';

import { db } from '@/db';
import { paymentCharges } from '@/db/schema';
import { getClipCheckoutStatus, getClipTerminalStatus } from '@/lib/clip-provider';
import { getConektaChargeStatus } from '@/lib/conekta-provider';
import { getStripeChargeStatus } from '@/lib/stripe-provider';
import { and, eq, ne } from 'drizzle-orm';
import { isTenantActive } from '@/server/tenant-status-service';

export type PaymentChargeProvider = 'conekta' | 'stripe' | 'clip' | 'cobrar';
export type PaymentChargeStatus = 'pending' | 'paid' | 'expired' | 'failed';

const TERMINAL_STATUSES = new Set<PaymentChargeStatus>(['paid', 'expired', 'failed']);

function serializeChargeStatus(charge: { status: string; paidAt: Date | null }): {
  status: PaymentChargeStatus;
  paidAt: string | null;
} {
  const status = charge.status as PaymentChargeStatus;
  return {
    status: status === 'pending' || TERMINAL_STATUSES.has(status) ? status : 'failed',
    paidAt: charge.paidAt?.toISOString() ?? null,
  };
}

export async function checkPaymentChargeStatus(
  chargeId: string,
  provider: PaymentChargeProvider,
  storeId: string,
): Promise<{ status: PaymentChargeStatus; paidAt: string | null }> {
  if (!(await isTenantActive(storeId))) {
    return { status: 'failed', paidAt: null };
  }
  const conditions = [
    eq(paymentCharges.id, chargeId),
    eq(paymentCharges.provider, provider),
    eq(paymentCharges.storeId, storeId),
  ];

  const [charge] = await db
    .select()
    .from(paymentCharges)
    .where(and(...conditions))
    .limit(1);

  if (!charge) return { status: 'failed', paidAt: null };

  const currentStatus = charge.status as PaymentChargeStatus;
  if (currentStatus === 'paid') {
    return serializeChargeStatus(charge);
  }

  if (provider === 'cobrar') {
    if (charge.status === 'pending' && charge.expiresAt && new Date() > charge.expiresAt) {
      const [expiredCharge] = await db
        .update(paymentCharges)
        .set({ status: 'expired', paidAt: null, updatedAt: new Date() })
        .where(and(...conditions, eq(paymentCharges.status, 'pending')))
        .returning({ status: paymentCharges.status, paidAt: paymentCharges.paidAt });

      if (expiredCharge) return serializeChargeStatus(expiredCharge);

      const [latestCharge] = await db
        .select({ status: paymentCharges.status, paidAt: paymentCharges.paidAt })
        .from(paymentCharges)
        .where(and(...conditions))
        .limit(1);
      return latestCharge ? serializeChargeStatus(latestCharge) : { status: 'failed', paidAt: null };
    }

    return serializeChargeStatus(charge);
  }

  let result: { status: PaymentChargeStatus; paidAt: Date | null };
  if (provider === 'conekta') {
    const orderId = (charge.providerMetadata as Record<string, string>)?.orderId ?? charge.providerChargeId;
    const conektaResult = await getConektaChargeStatus(orderId, charge.providerChargeId, storeId);
    if (conektaResult.id !== charge.providerChargeId) {
      throw new Error('Conekta returned a mismatched charge identifier');
    }
    if (
      conektaResult.status === 'paid' &&
      (conektaResult.amount === null ||
        conektaResult.currency === null ||
        Math.round(conektaResult.amount * 100) !== Math.round(Number(charge.amount) * 100) ||
        conektaResult.currency !== charge.currency.toUpperCase())
    ) {
      throw new Error('Conekta charge reconciliation failed');
    }
    result = conektaResult;
  } else if (provider === 'clip') {
    const metadata = charge.providerMetadata as Record<string, string>;
    const clipResult = metadata?.pinpadRequestId
      ? await getClipTerminalStatus(charge.providerChargeId, storeId)
      : await getClipCheckoutStatus(charge.providerChargeId, storeId);
    if (clipResult.id !== charge.providerChargeId) {
      throw new Error('Clip returned a mismatched charge identifier');
    }
    result = clipResult;
  } else {
    result = await getStripeChargeStatus(charge.providerChargeId, storeId);
  }

  const canTransition =
    (currentStatus === 'pending' && TERMINAL_STATUSES.has(result.status)) ||
    ((currentStatus === 'expired' || currentStatus === 'failed') && result.status === 'paid');

  if (canTransition) {
    const paidAt = result.status === 'paid' ? (result.paidAt ?? new Date()) : null;
    const [updatedCharge] = await db
      .update(paymentCharges)
      .set({ status: result.status, paidAt, updatedAt: new Date() })
      .where(
        and(
          ...conditions,
          result.status === 'paid'
            ? ne(paymentCharges.status, 'paid')
            : eq(paymentCharges.status, 'pending'),
        ),
      )
      .returning({ status: paymentCharges.status, paidAt: paymentCharges.paidAt });

    if (updatedCharge) return serializeChargeStatus(updatedCharge);

    const [latestCharge] = await db
      .select({ status: paymentCharges.status, paidAt: paymentCharges.paidAt })
      .from(paymentCharges)
      .where(and(...conditions))
      .limit(1);
    return latestCharge ? serializeChargeStatus(latestCharge) : { status: 'failed', paidAt: null };
  }

  return serializeChargeStatus(charge);
}
