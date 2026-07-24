-- Delivery Module Migration
-- Generado para el modulo de integraciones Rappi / Uber Eats

CREATE TABLE IF NOT EXISTS "delivery_provider_connections" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "store_id" text NOT NULL DEFAULT 'main' REFERENCES "stores"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'disconnected',
  "access_token_enc" text,
  "webhook_secret_enc" text,
  "provider_store_id" text NOT NULL DEFAULT '',
  "environment" text NOT NULL DEFAULT 'sandbox',
  "connected_at" timestamp,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "dpc_provider_store_idx" ON "delivery_provider_connections" ("provider", "store_id");
CREATE INDEX IF NOT EXISTS "dpc_status_idx" ON "delivery_provider_connections" ("status");

CREATE TABLE IF NOT EXISTS "delivery_orders" (
  "id" text PRIMARY KEY NOT NULL,
  "external_id" text NOT NULL,
  "provider" text NOT NULL,
  "store_id" text NOT NULL DEFAULT 'main' REFERENCES "stores"("id"),
  "status" text NOT NULL DEFAULT 'pending',
  "customer_name" text NOT NULL,
  "customer_phone" text,
  "customer_address" jsonb NOT NULL DEFAULT '{}',
  "items" jsonb NOT NULL DEFAULT '[]',
  "subtotal" numeric(10,2) NOT NULL,
  "delivery_fee" numeric(10,2) NOT NULL DEFAULT '0',
  "discount" numeric(10,2) NOT NULL DEFAULT '0',
  "total" numeric(10,2) NOT NULL,
  "payment_method" text NOT NULL DEFAULT 'online',
  "estimated_prep_minutes" integer,
  "notes" text,
  "raw_payload" jsonb NOT NULL DEFAULT '{}',
  "cancellation_reason" text,
  "received_at" timestamp NOT NULL DEFAULT now(),
  "accepted_at" timestamp,
  "cancelled_at" timestamp,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "do_store_idx" ON "delivery_orders" ("store_id");
CREATE INDEX IF NOT EXISTS "do_provider_idx" ON "delivery_orders" ("provider");
CREATE INDEX IF NOT EXISTS "do_status_idx" ON "delivery_orders" ("status");
CREATE INDEX IF NOT EXISTS "do_received_at_idx" ON "delivery_orders" ("received_at");
CREATE UNIQUE INDEX IF NOT EXISTS "do_provider_external_idx" ON "delivery_orders" ("provider", "external_id");
