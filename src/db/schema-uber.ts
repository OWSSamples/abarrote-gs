import { pgTable, uuid, varchar, timestamp, text, unique, jsonb } from 'drizzle-orm/pg-core';

export const uberIntegrations = pgTable(
  'uber_integrations',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    uberStoreId: varchar('uber_store_id').notNull(),
    uberStoreName: varchar('uber_store_name'),
    status: varchar('status').notNull(), // ACTIVE, PROVISIONING, ERROR, DISCONNECTED
    accessTokenEnc: text('access_token_enc').notNull(),
    refreshTokenEnc: text('refresh_token_enc'),
    expiresAt: timestamp('expires_at'),
    environment: varchar('environment').notNull().default('production'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    unq: unique().on(t.workspaceId, t.uberStoreId, t.environment),
  }),
);

export const uberOauthStates = pgTable('uber_oauth_states', {
  stateHash: varchar('state_hash').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  storeId: text('store_id').notNull(),
  userId: text('user_id').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const uberWebhookEvents = pgTable(
  'uber_webhook_events',
  {
    id: uuid('id').primaryKey(),
    externalEventId: varchar('external_event_id').notNull(),
    eventType: varchar('event_type').notNull(),
    uberStoreId: varchar('uber_store_id'),
    payload: jsonb('payload').notNull(),
    status: varchar('status').notNull().default('PENDING'),
    receivedAt: timestamp('received_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
  },
  (t) => ({
    unq: unique().on(t.externalEventId),
  }),
);
