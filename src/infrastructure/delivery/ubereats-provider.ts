import 'server-only';

import crypto from 'crypto';
import { logger } from '@/lib/logger';
import type {
  IDeliveryProvider,
  DeliveryOrder,
  DeliveryOrderItem,
  DeliveryProviderConnection,
} from './delivery-types';

// Uber Eats Orders API v1
interface UberEatsOrderItem {
  id: string;
  title: string;
  quantity: number;
  price: { unit_price: { amount: number; currency_code: string }; total_price: { amount: number } };
  special_instructions?: string;
  customizations?: Array<{ title: string; price: { amount: number } }>;
}

interface UberEatsWebhookPayload {
  event_id: string;
  event_time: number;
  event_type: string;
  meta: { store_id: string; external_store_id?: string };
  order_id: string;
  order: {
    id: string;
    display_id: string;
    current_state: string;
    created_at: string;
    eater: { first_name: string; last_name?: string; phone?: string };
    delivery: {
      location: {
        street_address?: string;
        city?: string;
        postal_code?: string;
        latitude?: number;
        longitude?: number;
      };
    };
    cart: { items: UberEatsOrderItem[] };
    payment: {
      charges: {
        sub_total: { amount: number };
        delivery_fee: { amount: number };
        total: { amount: number };
      };
      accounting: { payment_method: string };
    };
    special_instructions?: string;
    estimated_ready_for_pickup_at?: string;
  };
}

export class UberEatsProvider implements IDeliveryProvider {
  readonly provider = 'ubereats' as const;
  private readonly BASE_URL = 'https://api.uber.com/v1/eats/orders';

  // Uber Eats usa HMAC-SHA256 con el header X-Uber-Signature
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  parseWebhookPayload(raw: Record<string, unknown>, storeId: string): DeliveryOrder | null {
    try {
      const p = raw as unknown as UberEatsWebhookPayload;
      if (!p.order_id || !p.order?.cart?.items?.length) {
        logger.warn('UberEats webhook payload invalido', { action: 'ubereats_parse_invalid' });
        return null;
      }
      const o = p.order;
      // Uber Eats amounts come in cents
      const toCurrency = (amount: number) => amount / 100;

      const items: DeliveryOrderItem[] = o.cart.items.map((item) => ({
        externalId: item.id,
        name: item.title,
        quantity: item.quantity,
        unitPrice: toCurrency(item.price.unit_price.amount),
        subtotal: toCurrency(item.price.total_price.amount),
        notes: item.special_instructions,
        modifiers: item.customizations?.map((c) => ({ name: c.title, price: toCurrency(c.price.amount) })),
      }));

      const subtotal = toCurrency(o.payment.charges.sub_total.amount);
      const deliveryFee = toCurrency(o.payment.charges.delivery_fee.amount);
      const total = toCurrency(o.payment.charges.total.amount);

      const paymentRaw = o.payment.accounting.payment_method?.toLowerCase() ?? 'online';
      const paymentMethod =
        paymentRaw === 'cash' ? 'cash' : paymentRaw === 'card_on_delivery' ? 'card_on_delivery' : 'online';

      return {
        id: crypto.randomUUID(),
        externalId: p.order_id,
        provider: 'ubereats',
        storeId,
        status: 'pending',
        customer: {
          name: [o.eater.first_name, o.eater.last_name].filter(Boolean).join(' '),
          phone: o.eater.phone,
          address: {
            street: o.delivery.location.street_address,
            city: o.delivery.location.city,
            postalCode: o.delivery.location.postal_code,
            lat: o.delivery.location.latitude,
            lng: o.delivery.location.longitude,
          },
        },
        items,
        subtotal,
        deliveryFee,
        discount: 0,
        total,
        paymentMethod,
        notes: o.special_instructions,
        rawPayload: raw,
        receivedAt: new Date(),
      };
    } catch (err) {
      logger.error('UberEats parse error', { action: 'ubereats_parse_error', error: err instanceof Error ? err.message : 'unknown' });
      return null;
    }
  }

  async acceptOrder(orderId: string, prepMinutes: number, connection: DeliveryProviderConnection): Promise<void> {
    const { decrypt } = await import('@/lib/crypto');
    const token = decrypt(connection.accessTokenEnc);
    const readyAt = new Date(Date.now() + prepMinutes * 60_000).toISOString();
    const res = await fetch(`${this.BASE_URL}/${orderId}/accept_pos_order`, {
      method: 'POST',
      headers: this._headers(token),
      body: JSON.stringify({ reason: 'ACCEPTED', ready_for_pickup_at: readyAt }),
    });
    if (!res.ok) throw new Error(`UberEats acceptOrder failed: ${res.status}`);
    logger.info('UberEats order accepted', { action: 'ubereats_order_accepted', orderId });
  }

  async rejectOrder(orderId: string, reason: string, connection: DeliveryProviderConnection): Promise<void> {
    const { decrypt } = await import('@/lib/crypto');
    const token = decrypt(connection.accessTokenEnc);
    const res = await fetch(`${this.BASE_URL}/${orderId}/deny_pos_order`, {
      method: 'POST',
      headers: this._headers(token),
      body: JSON.stringify({ reason: 'STORE_CLOSED', details: reason }),
    });
    if (!res.ok) throw new Error(`UberEats rejectOrder failed: ${res.status}`);
    logger.info('UberEats order rejected', { action: 'ubereats_order_rejected', orderId });
  }

  async markReady(orderId: string, connection: DeliveryProviderConnection): Promise<void> {
    const { decrypt } = await import('@/lib/crypto');
    const token = decrypt(connection.accessTokenEnc);
    const res = await fetch(`${this.BASE_URL}/${orderId}/cancel`, {
      method: 'POST',
      headers: this._headers(token),
      body: JSON.stringify({ reason: 'READY_FOR_PICKUP' }),
    });
    // Uber Eats uses a different endpoint for ready state - this is a status update
    if (!res.ok) throw new Error(`UberEats markReady failed: ${res.status}`);
    logger.info('UberEats order ready', { action: 'ubereats_order_ready', orderId });
  }

  async validateCredentials(accessToken: string, _providerStoreId: string): Promise<{ valid: boolean; storeName?: string }> {
    try {
      const res = await fetch('https://api.uber.com/v1/eats/stores', { headers: this._headers(accessToken) });
      if (!res.ok) return { valid: false };
      const data = (await res.json()) as { stores?: Array<{ name: string }> };
      return { valid: true, storeName: data.stores?.[0]?.name };
    } catch {
      return { valid: false };
    }
  }

  private _headers(token: string): Record<string, string> {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }
}

export const uberEatsProvider = new UberEatsProvider();
