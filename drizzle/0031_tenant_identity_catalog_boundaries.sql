-- Tenant boundary hardening for identity, RBAC and the core catalog.
-- Additive backfill: legacy rows remain attached to the `main` tenant.

ALTER TABLE "role_definitions" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "user_roles" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "proveedores" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "pedidos" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "devoluciones" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "cash_movements" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "servicios" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "cfdi_records" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "ai_provider_configs" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "oauth_states" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "mercadopago_payments" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "mercadopago_refunds" ADD COLUMN IF NOT EXISTS "store_id" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "store_id" text;

-- Prefer an explicit user-store assignment when one already exists.
UPDATE "user_roles" AS ur
SET "store_id" = access."store_id"
FROM (
  SELECT DISTINCT ON ("user_id") "user_id", "store_id"
  FROM "user_store_access"
  ORDER BY "user_id", "is_default" DESC, "created_at" ASC
) AS access
WHERE ur."cognito_sub" = access."user_id"
  AND ur."store_id" IS NULL;

UPDATE "user_roles" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "product_categories" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "products" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "clientes" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "proveedores" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "pedidos" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "devoluciones" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "cash_movements" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "servicios" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "promotions" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "cfdi_records" AS cfdi
SET "store_id" = COALESCE(sale."store_id", 'main')
FROM "sale_records" AS sale
WHERE cfdi."sale_id" = sale."id" AND cfdi."store_id" IS NULL;
UPDATE "cfdi_records" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "ai_provider_configs" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "oauth_states" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "mercadopago_payments" AS payment
SET "store_id" = COALESCE(sale."store_id", 'main')
FROM "sale_records" AS sale
WHERE payment."sale_id" = sale."id" AND payment."store_id" IS NULL;
UPDATE "mercadopago_payments" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "mercadopago_refunds" AS refund
SET "store_id" = COALESCE(sale."store_id", 'main')
FROM "sale_records" AS sale
WHERE refund."sale_id" = sale."id" AND refund."store_id" IS NULL;
UPDATE "mercadopago_refunds" SET "store_id" = 'main' WHERE "store_id" IS NULL;
UPDATE "audit_logs" AS log
SET "store_id" = role."store_id"
FROM "user_roles" AS role
WHERE log."user_id" = role."cognito_sub" AND log."store_id" IS NULL;
UPDATE "audit_logs" SET "store_id" = 'main' WHERE "store_id" IS NULL;

-- Custom roles inherit the tenant of their creator. Unresolved legacy roles
-- stay in `main`; system roles remain shared with a NULL tenant.
UPDATE "role_definitions" AS rd
SET "store_id" = COALESCE(owner_role."store_id", 'main')
FROM "user_roles" AS owner_role
WHERE rd."is_system" = false
  AND rd."created_by" = owner_role."cognito_sub"
  AND rd."store_id" IS NULL;

UPDATE "role_definitions"
SET "store_id" = 'main'
WHERE "is_system" = false AND "store_id" IS NULL;

UPDATE "role_definitions" SET "store_id" = NULL WHERE "is_system" = true;

ALTER TABLE "user_roles" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "user_roles" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "product_categories" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "product_categories" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "products" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "clientes" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "clientes" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "proveedores" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "proveedores" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "pedidos" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "pedidos" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "devoluciones" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "devoluciones" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "cash_movements" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "cash_movements" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "servicios" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "servicios" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "promotions" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "promotions" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "cfdi_records" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "cfdi_records" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "ai_provider_configs" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "ai_provider_configs" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "oauth_states" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "oauth_states" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "mercadopago_payments" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "mercadopago_payments" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "mercadopago_refunds" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "mercadopago_refunds" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "audit_logs" ALTER COLUMN "store_id" SET NOT NULL;

-- Tenant access is always explicit at runtime. Preserve access for legacy
-- identities before removing the former implicit `main` fallback.
INSERT INTO "user_store_access" ("user_id", "store_id", "is_default", "created_at")
SELECT "cognito_sub", "store_id", true, "created_at"
FROM "user_roles"
ON CONFLICT ("user_id", "store_id") DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_definitions_store_id_stores_id_fk') THEN
    ALTER TABLE "role_definitions"
      ADD CONSTRAINT "role_definitions_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_store_id_stores_id_fk') THEN
    ALTER TABLE "user_roles"
      ADD CONSTRAINT "user_roles_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_categories_store_id_stores_id_fk') THEN
    ALTER TABLE "product_categories"
      ADD CONSTRAINT "product_categories_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_store_id_stores_id_fk') THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clientes_store_id_stores_id_fk') THEN
    ALTER TABLE "clientes" ADD CONSTRAINT "clientes_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proveedores_store_id_stores_id_fk') THEN
    ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_store_id_stores_id_fk') THEN
    ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devoluciones_store_id_stores_id_fk') THEN
    ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_movements_store_id_stores_id_fk') THEN
    ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servicios_store_id_stores_id_fk') THEN
    ALTER TABLE "servicios" ADD CONSTRAINT "servicios_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotions_store_id_stores_id_fk') THEN
    ALTER TABLE "promotions" ADD CONSTRAINT "promotions_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cfdi_records_store_id_stores_id_fk') THEN
    ALTER TABLE "cfdi_records" ADD CONSTRAINT "cfdi_records_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_provider_configs_store_id_store_config_id_fk') THEN
    ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_store_id_store_config_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "store_config"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_states_store_id_store_config_id_fk') THEN
    ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_store_id_store_config_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "store_config"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mercadopago_payments_store_id_stores_id_fk') THEN
    ALTER TABLE "mercadopago_payments" ADD CONSTRAINT "mercadopago_payments_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mercadopago_refunds_store_id_stores_id_fk') THEN
    ALTER TABLE "mercadopago_refunds" ADD CONSTRAINT "mercadopago_refunds_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_charges_store_id_stores_id_fk') THEN
    ALTER TABLE "payment_charges" ADD CONSTRAINT "payment_charges_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_store_id_stores_id_fk') THEN
    ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;
END $$;

ALTER TABLE "ai_provider_configs" DROP CONSTRAINT IF EXISTS "ai_provider_configs_pkey";
ALTER TABLE "ai_provider_configs" DROP CONSTRAINT IF EXISTS "ai_provider_configs_store_provider_pk";
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_store_provider_pk"
  PRIMARY KEY ("store_id", "id");

-- Replace global catalog uniqueness with tenant-scoped active-row uniqueness.
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_sku_unique";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_barcode_unique";

CREATE INDEX IF NOT EXISTS "role_definitions_store_idx" ON "role_definitions" ("store_id");
CREATE UNIQUE INDEX IF NOT EXISTS "role_definitions_system_name_unique_idx"
  ON "role_definitions" (lower("name")) WHERE "is_system" = true;
CREATE UNIQUE INDEX IF NOT EXISTS "role_definitions_store_name_unique_idx"
  ON "role_definitions" ("store_id", lower("name")) WHERE "is_system" = false;

DROP INDEX IF EXISTS "user_roles_cognito_sub_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_cognito_sub_unique_idx" ON "user_roles" ("cognito_sub");
CREATE INDEX IF NOT EXISTS "user_roles_store_idx" ON "user_roles" ("store_id");
CREATE INDEX IF NOT EXISTS "user_roles_store_status_idx" ON "user_roles" ("store_id", "status");

CREATE INDEX IF NOT EXISTS "product_categories_store_idx" ON "product_categories" ("store_id");
CREATE INDEX IF NOT EXISTS "products_store_idx" ON "products" ("store_id");
CREATE INDEX IF NOT EXISTS "products_store_category_idx" ON "products" ("store_id", "category");
CREATE UNIQUE INDEX IF NOT EXISTS "products_store_sku_unique_idx"
  ON "products" ("store_id", "sku") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "products_store_barcode_unique_idx"
  ON "products" ("store_id", "barcode") WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "clientes_store_idx" ON "clientes" ("store_id");
CREATE INDEX IF NOT EXISTS "clientes_store_name_idx" ON "clientes" ("store_id", "name");
CREATE INDEX IF NOT EXISTS "proveedores_store_idx" ON "proveedores" ("store_id");
CREATE INDEX IF NOT EXISTS "pedidos_store_idx" ON "pedidos" ("store_id");
CREATE INDEX IF NOT EXISTS "pedidos_store_fecha_idx" ON "pedidos" ("store_id", "fecha");
CREATE INDEX IF NOT EXISTS "devoluciones_store_idx" ON "devoluciones" ("store_id");
CREATE INDEX IF NOT EXISTS "cash_movements_store_idx" ON "cash_movements" ("store_id");
CREATE INDEX IF NOT EXISTS "servicios_store_idx" ON "servicios" ("store_id");
CREATE INDEX IF NOT EXISTS "servicios_store_fecha_idx" ON "servicios" ("store_id", "fecha");
CREATE INDEX IF NOT EXISTS "promotions_store_idx" ON "promotions" ("store_id");
CREATE INDEX IF NOT EXISTS "cfdi_store_idx" ON "cfdi_records" ("store_id");
CREATE INDEX IF NOT EXISTS "cfdi_store_sale_idx" ON "cfdi_records" ("store_id", "sale_id");
CREATE INDEX IF NOT EXISTS "cfdi_store_receptor_rfc_idx" ON "cfdi_records" ("store_id", "receptor_rfc");
CREATE INDEX IF NOT EXISTS "cfdi_store_status_idx" ON "cfdi_records" ("store_id", "status");
CREATE INDEX IF NOT EXISTS "ai_provider_configs_store_idx" ON "ai_provider_configs" ("store_id");
CREATE INDEX IF NOT EXISTS "oauth_states_store_idx" ON "oauth_states" ("store_id");
CREATE INDEX IF NOT EXISTS "mp_payments_store_sale_idx" ON "mercadopago_payments" ("store_id", "sale_id");
CREATE INDEX IF NOT EXISTS "mp_payments_store_status_idx" ON "mercadopago_payments" ("store_id", "status");
CREATE INDEX IF NOT EXISTS "mp_payments_store_external_ref_idx" ON "mercadopago_payments" ("store_id", "external_reference");
CREATE INDEX IF NOT EXISTS "mp_refunds_store_sale_idx" ON "mercadopago_refunds" ("store_id", "sale_id");
CREATE INDEX IF NOT EXISTS "mp_refunds_store_payment_idx" ON "mercadopago_refunds" ("store_id", "mp_payment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ppc_provider_store_idx"
  ON "payment_provider_connections" ("provider", "store_id");
CREATE UNIQUE INDEX IF NOT EXISTS "pc_store_provider_charge_unique_idx"
  ON "payment_charges" ("store_id", "provider", "provider_charge_id");
CREATE INDEX IF NOT EXISTS "pc_store_sale_idx" ON "payment_charges" ("store_id", "sale_id");
CREATE INDEX IF NOT EXISTS "pc_store_status_idx" ON "payment_charges" ("store_id", "status");
CREATE INDEX IF NOT EXISTS "pc_store_reference_idx" ON "payment_charges" ("store_id", "reference_number");
CREATE INDEX IF NOT EXISTS "audit_logs_store_user_idx" ON "audit_logs" ("store_id", "user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_store_entity_idx" ON "audit_logs" ("store_id", "entity", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_store_timestamp_idx" ON "audit_logs" ("store_id", "timestamp");
