-- Migration 0009: Extend payment_provider_connections for multi-provider support
-- Adds generic columns for Conekta, Stripe, and future providers

-- Generic provider metadata (webhook secrets, account IDs, emails)
ALTER TABLE "payment_provider_connections" ADD COLUMN IF NOT EXISTS "webhook_secret_enc" text;
ALTER TABLE "payment_provider_connections" ADD COLUMN IF NOT EXISTS "provider_account_id" text;
ALTER TABLE "payment_provider_connections" ADD COLUMN IF NOT EXISTS "provider_email" text;
ALTER TABLE "payment_provider_connections" ADD COLUMN IF NOT EXISTS "provider_metadata" jsonb DEFAULT '{}';
ALTER TABLE "payment_provider_connections" ADD COLUMN IF NOT EXISTS "environment" text NOT NULL DEFAULT 'sandbox';

-- Conekta/Stripe store config fields
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "conekta_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "conekta_public_key" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "stripe_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "stripe_public_key" text;

-- Payment charges tracking (for automated SPEI/OXXO verification)
CREATE TABLE IF NOT EXISTS "payment_charges" (
  "id" text PRIMARY KEY,
  "provider" text NOT NULL,
  "provider_charge_id" text NOT NULL,
  "sale_id" text,
  "store_id" text NOT NULL DEFAULT 'main',
  "amount" numeric(10, 2) NOT NULL,
  "currency" text NOT NULL DEFAULT 'MXN',
  "payment_method" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "customer_name" text,
  "customer_email" text,
  "reference_number" text,
  "clabe_reference" text,
  "oxxo_barcode" text,
  "oxxo_reference" text,
  "expires_at" timestamp,
  "paid_at" timestamp,
  "provider_metadata" jsonb DEFAULT '{}',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pc_provider_charge_idx" ON "payment_charges" ("provider", "provider_charge_id");
CREATE INDEX IF NOT EXISTS "pc_sale_idx" ON "payment_charges" ("sale_id");
CREATE INDEX IF NOT EXISTS "pc_status_idx" ON "payment_charges" ("status");
CREATE INDEX IF NOT EXISTS "pc_reference_idx" ON "payment_charges" ("reference_number");
