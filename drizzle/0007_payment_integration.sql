-- 0007: Payment integration — FK linkage, installments, refunds, MP config in DB
-- ============================================================================

-- 1. Extend saleRecords: installments tracking + MP payment reference
ALTER TABLE "sale_records"
  ADD COLUMN IF NOT EXISTS "installments" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "mp_payment_id" text;

CREATE INDEX IF NOT EXISTS "sale_records_mp_payment_id_idx" ON "sale_records" ("mp_payment_id");

-- 2. Create mercadopagoPayments if not exists, then extend
CREATE TABLE IF NOT EXISTS "mercadopago_payments" (
  "id" text PRIMARY KEY,
  "payment_id" text NOT NULL UNIQUE,
  "status" text NOT NULL,
  "external_reference" text,
  "amount" numeric(10, 2),
  "created_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "mercadopago_payments"
  ADD COLUMN IF NOT EXISTS "sale_id" text REFERENCES "sale_records"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "payment_method_id" text,
  ADD COLUMN IF NOT EXISTS "payment_type" text,
  ADD COLUMN IF NOT EXISTS "installments" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "fee_amount" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "net_amount" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "payer_email" text,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

CREATE INDEX IF NOT EXISTS "mp_payments_sale_id_idx" ON "mercadopago_payments" ("sale_id");
CREATE INDEX IF NOT EXISTS "mp_payments_status_idx" ON "mercadopago_payments" ("status");
CREATE INDEX IF NOT EXISTS "mp_payments_external_ref_idx" ON "mercadopago_payments" ("external_reference");

-- 3. MP Refunds table — tracks reembolsos originados desde la plataforma
CREATE TABLE IF NOT EXISTS "mercadopago_refunds" (
  "id" text PRIMARY KEY,
  "mp_payment_id" text NOT NULL,
  "mp_refund_id" text NOT NULL UNIQUE,
  "sale_id" text REFERENCES "sale_records"("id") ON DELETE SET NULL,
  "amount" numeric(10, 2) NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "reason" text NOT NULL DEFAULT '',
  "initiated_by" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "resolved_at" timestamp
);

CREATE INDEX IF NOT EXISTS "mp_refunds_sale_id_idx" ON "mercadopago_refunds" ("sale_id");
CREATE INDEX IF NOT EXISTS "mp_refunds_payment_id_idx" ON "mercadopago_refunds" ("mp_payment_id");

-- 4. Persist MP config in store_config (replaces localStorage)
ALTER TABLE "store_config"
  ADD COLUMN IF NOT EXISTS "mp_device_id" text,
  ADD COLUMN IF NOT EXISTS "mp_public_key" text,
  ADD COLUMN IF NOT EXISTS "mp_enabled" boolean NOT NULL DEFAULT false;
