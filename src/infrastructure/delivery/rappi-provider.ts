import 'server-only';

import crypto from 'crypto';
import { logger } from '@/lib/logger';
import type {
  IDeliveryProvider,
  DeliveryOrder,
  DeliveryOrderItem,
  DeliveryProviderConnection,
} from './delivery-types';

interface RappiOrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  comments?: string;
  toppings?: Array<{ name: string; price: number }>;
}

interface RappiWebhookPayload {
  order_id: string;
  store_id: string;
  status: string;
  created_at: string;
  customer: {
    name: string;
    phone?: string;
    address: {
      address?: string;
      neighborhood?: string;
      city?: string;
      postal_code?: string;
      instructions?: string;
      lat?: number;
      lng?: number;
    };
  };
  items: RappiOrderItem[];
  totals: {
    subtotal: number;
    delivery_fee: number;
    discount: number;
    total: number;
  };
  payment: { method: 'online' | 'cash' | 'card_on_delivery' };
  estimated_prep_time?: number;
  order_notes?: string;
}

export class RappiProvider implements IDeliveryProvider {
  readonly provider = 'rappi' as const;
  private readonly BASE_URL = 'https://microservices.dev.rappi.com/api/2/restaurants-integrations-public-api';

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
      const p = raw as unknown as RappiWebhookPayload;
      if (!p.order_id || !p.items?.length) {
        logger.warn('Rappi webhook payload invalido', { action: 'rappi_parse_invalid' });
        return null;
      }
      const items: DeliveryOrderItem[] = p.items.map((item) => ({
        externalId: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.total_price,
        notes: item.comments,
        modifiers: item.toppings?.map((t) => ({ name: t.name, price: t.price })),
      }));
      return {
        id: crypto.randomUUID(),
        externalId: p.order_id,
        provider: 'rappi',
        storeId,
        status: 'pending',
        customer: {
          name: p.customer.name,
          phone: p.customer.phone,
          address: {
            street: p.customer.address.address,
            neighborhood: p.customer.address.neighborhood,
            city: p.customer.address.city,
            postalCode: p.customer.address.postal_code,
            references: p.customer.address.instructions,
            lat: p.customer.address.lat,
            lng: p.customer.address.lng,
          },
        },
        items,
        subtotal: p.totals.subtotal,
        deliveryFee: p.totals.delivery_fee,
        discount: p.totals.discount,
        total: p.totals.total,
        paymentMethod: p.payment.method,
        estimatedPrepMinutes: p.estimated_prep_time,
        notes: p.order_notes,
        rawPayload: raw,
        receivedAt: new Date(),
      };
    } catch (err) {
      logger.error('Rappi parse error', { action: 'rappi_parse_error', error: err instanceof Error ? err.message : 'unknown' });
      return null;
    }
  }

  async acceptOrder(orderId: string, prepMinutes: number, connection: DeliveryProviderConnection): Promise<void> {
    const { decrypt } = await import('@/lib/crypto');
    const token = decrypt(connection.accessTokenEnc);
    const res = await fetch(`${this.BASE_URL}/stores/${connection.providerStoreId}/orders/${orderId}/accept`, {
      method: 'POST',
      headers: this._headers(token),
      body: JSON.stringify({ estimated_prep_time: prepMinutes }),
    });
    if (!res.ok) throw new Error(`Rappi acceptOrder failed: ${res.status}`);
    logger.info('Rappi order accepted', { action: 'rappi_order_accepted', orderId });
  }

  async rejectOrder(orderId: string, reason: string, connection: DeliveryProviderConnection): Promise<void> {
    const { decrypt } = await import('@/lib/crypto');
    const token = decrypt(connection.accessTokenEnc);
    const res = await fetch(`${this.BASE_URL}/stores/${connection.providerStoreId}/orders/${orderId}/reject`, {
      method: 'POST',
      headers: this._headers(token),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error(`Rappi rejectOrder failed: ${res.status}`);
    logger.info('Rappi order rejected', { action: 'rappi_order_rejected', orderId });
  }

  async markReady(orderId: string, connection: DeliveryProviderConnection): Promise<void> {
    const { decrypt } = await import('@/lib/crypto');
    const token = decrypt(connection.accessTokenEnc);
    const res = await fetch(`${this.BASE_URL}/stores/${connection.providerStoreId}/orders/${orderId}/ready`, {
      method: 'POST', headers: this._headers(token),
    });
    if (!res.ok) throw new Error(`Rappi markReady failed: ${res.status}`);
    logger.info('Rappi order ready', { action: 'rappi_order_ready', orderId });
  }

  async validateCredentials(accessToken: string, providerStoreId: string): Promise<{ valid: boolean; storeName?: string }> {
    try {
      const res = await fetch(`${this.BASE_URL}/stores/${providerStoreId}`, { headers: this._headers(accessToken) });
      if (!res.ok) return { valid: false };
      const data = (await res.json()) as { name?: string };
      return { valid: true, storeName: data.name };
    } catch {
      return { valid: false };
    }
  }

  private _headers(token: string): Record<string, string> {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }
}

export const rappiProvider = new RappiProvider();
