/**
 * Delivery Schema
 *
 * Tablas separadas del schema principal para facilitar
 * la extraccion a microservicio en el futuro.
 * Al extraer: este archivo se mueve al nuevo servicio sin cambios.
 */

import { pgTable, text, numeric, integer, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { stores } from './schema';

// ── Conexiones de providers de delivery ──────────────────────
export const deliveryProviderConnections = pgTable(
  'delivery_provider_connections',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(), // 'rappi' | 'ubereats'
    storeId: text('store_id').notNull().default('main').references(() => stores.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('disconnected'), // 'connected' | 'disconnected' | 'suspended'
    accessTokenEnc: text('access_token_enc'),
    webhookSecretEnc: text('webhook_secret_enc'),
    providerStoreId: text('provider_store_id').notNull().default(''),
    environment: text('environment').notNull().default('sandbox'),
    connectedAt: timestamp('connected_at'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('dpc_provider_store_idx').on(t.provider, t.storeId),
    index('dpc_status_idx').on(t.status),
  ],
);

// ── Pedidos de delivery ───────────────────────────────────────
export const deliveryOrders = pgTable(
  'delivery_orders',
  {
    id: text('id').primaryKey(),
    externalId: text('external_id').notNull(),       // ID en Rappi / Uber Eats
    provider: text('provider').notNull(),             // 'rappi' | 'ubereats'
    storeId: text('store_id').notNull().default('main').references(() => stores.id),
    status: text('status').notNull().default('pending'),
    // Customer
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone'),
    customerAddress: jsonb('customer_address').notNull().default({}),
    // Items y totales
    items: jsonb('items').notNull().default([]),
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
    deliveryFee: numeric('delivery_fee', { precision: 10, scale: 2 }).notNull().default('0'),
    discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 10, scale: 2 }).notNull(),
    paymentMethod: text('payment_method').notNull().default('online'),
    estimatedPrepMinutes: integer('estimated_prep_minutes'),
    notes: text('notes'),
    // Auditoria
    rawPayload: jsonb('raw_payload').notNull().default({}),
    cancellationReason: text('cancellation_reason'),
    // Timestamps de ciclo de vida
    receivedAt: timestamp('received_at').notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at'),
    cancelledAt: timestamp('cancelled_at'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('do_store_idx').on(t.storeId),
    index('do_provider_idx').on(t.provider),
    index('do_status_idx').on(t.status),
    index('do_received_at_idx').on(t.receivedAt),
    uniqueIndex('do_provider_external_idx').on(t.provider, t.externalId),
  ],
);
