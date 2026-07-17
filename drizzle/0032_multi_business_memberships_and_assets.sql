-- Expand the tenant model without removing legacy data or access tables.
-- This migration is intentionally fail-closed when existing cross-tenant
-- relationships are detected. Correct those rows before retrying it.

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_status_check') THEN
    ALTER TABLE "stores" ADD CONSTRAINT "stores_status_check"
      CHECK ("status" IN ('active', 'suspended', 'archived'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "user_identities" (
  "cognito_sub" text PRIMARY KEY,
  "email" text NOT NULL,
  "display_name" text NOT NULL DEFAULT '',
  "avatar_url" text NOT NULL DEFAULT '',
  "global_id" text UNIQUE,
  "status" text NOT NULL DEFAULT 'active',
  "mfa_notice_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "user_identities_status_check" CHECK ("status" IN ('active', 'disabled'))
);

INSERT INTO "user_identities" (
  "cognito_sub", "email", "display_name", "avatar_url", "global_id",
  "mfa_notice_at", "created_at", "updated_at"
)
SELECT DISTINCT ON ("cognito_sub")
  "cognito_sub", "email", "display_name", "avatar_url", "global_id",
  "mfa_notice_at", "created_at", "updated_at"
FROM "user_roles"
ORDER BY "cognito_sub", "updated_at" DESC
ON CONFLICT ("cognito_sub") DO UPDATE SET
  "email" = EXCLUDED."email",
  "display_name" = EXCLUDED."display_name",
  "avatar_url" = EXCLUDED."avatar_url",
  "global_id" = COALESCE("user_identities"."global_id", EXCLUDED."global_id"),
  "mfa_notice_at" = EXCLUDED."mfa_notice_at",
  "updated_at" = GREATEST("user_identities"."updated_at", EXCLUDED."updated_at");

CREATE INDEX IF NOT EXISTS "user_identities_email_idx" ON "user_identities" (lower("email"));
CREATE INDEX IF NOT EXISTS "user_identities_status_idx" ON "user_identities" ("status");

ALTER TABLE "user_roles" ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_status_check') THEN
    ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_status_check"
      CHECK ("status" IN ('activo', 'baja'));
  END IF;
END $$;

UPDATE "user_roles" AS membership
SET "is_default" = access."is_default"
FROM "user_store_access" AS access
WHERE access."user_id" = membership."cognito_sub"
  AND access."store_id" = membership."store_id";

-- Preserve exactly one deterministic default membership per identity.
WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "cognito_sub"
    ORDER BY "is_default" DESC, "created_at" ASC, "id" ASC
  ) AS position
  FROM "user_roles"
)
UPDATE "user_roles" AS membership
SET "is_default" = (ranked.position = 1)
FROM ranked
WHERE ranked."id" = membership."id";

DROP INDEX IF EXISTS "user_roles_cognito_sub_unique_idx";
ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "user_roles_global_id_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_cognito_store_unique_idx"
  ON "user_roles" ("cognito_sub", "store_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_single_default_idx"
  ON "user_roles" ("cognito_sub") WHERE "is_default" = true;
CREATE INDEX IF NOT EXISTS "user_roles_cognito_sub_idx" ON "user_roles" ("cognito_sub");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "user_store_access" access
    LEFT JOIN "user_identities" identity ON identity."cognito_sub" = access."user_id"
    WHERE identity."cognito_sub" IS NULL
  ) THEN
    RAISE EXCEPTION 'Orphan user_store_access identities must be reconciled before migration 0032';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_cognito_sub_user_identities_fk') THEN
    ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_cognito_sub_user_identities_fk"
      FOREIGN KEY ("cognito_sub") REFERENCES "user_identities"("cognito_sub");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_store_access_store_id_stores_id_fk') THEN
    ALTER TABLE "user_store_access" ADD CONSTRAINT "user_store_access_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_store_access_user_id_user_identities_fk') THEN
    ALTER TABLE "user_store_access" ADD CONSTRAINT "user_store_access_user_id_user_identities_fk"
      FOREIGN KEY ("user_id") REFERENCES "user_identities"("cognito_sub");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_config_id_stores_id_fk') THEN
    ALTER TABLE "store_config" ADD CONSTRAINT "store_config_id_stores_id_fk"
      FOREIGN KEY ("id") REFERENCES "stores"("id");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tenant_invitations" (
  "id" text PRIMARY KEY,
  "store_id" text NOT NULL REFERENCES "stores"("id"),
  "email" text NOT NULL,
  "role_id" text NOT NULL REFERENCES "role_definitions"("id"),
  "token_hash" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pending',
  "invited_by" text NOT NULL,
  "accepted_by" text,
  "accepted_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_invitations_status_check"
    CHECK ("status" IN ('pending', 'accepted', 'revoked', 'expired')),
  CONSTRAINT "tenant_invitations_acceptance_check"
    CHECK ("status" <> 'accepted' OR ("accepted_by" IS NOT NULL AND "accepted_at" IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invitations_pending_email_unique_idx"
  ON "tenant_invitations" ("store_id", lower("email")) WHERE "status" = 'pending';
CREATE INDEX IF NOT EXISTS "tenant_invitations_store_status_idx"
  ON "tenant_invitations" ("store_id", "status");
CREATE INDEX IF NOT EXISTS "tenant_invitations_expiry_idx"
  ON "tenant_invitations" ("expires_at");

CREATE TABLE IF NOT EXISTS "tenant_assets" (
  "id" text PRIMARY KEY,
  "store_id" text NOT NULL REFERENCES "stores"("id"),
  "kind" text NOT NULL,
  "resource_id" text,
  "object_key" text NOT NULL UNIQUE,
  "public_url" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "checksum_sha256" text NOT NULL,
  "uploaded_by" text NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_assets_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 5242880),
  CONSTRAINT "tenant_assets_kind_check"
    CHECK ("kind" IN ('products', 'avatars', 'logos', 'receipts', 'evidence', 'promo', 'display'))
);

CREATE INDEX IF NOT EXISTS "tenant_assets_store_kind_idx" ON "tenant_assets" ("store_id", "kind");
CREATE INDEX IF NOT EXISTS "tenant_assets_store_resource_idx" ON "tenant_assets" ("store_id", "resource_id");

CREATE TABLE IF NOT EXISTS "tenant_sequences" (
  "store_id" text NOT NULL REFERENCES "stores"("id"),
  "key" text NOT NULL,
  "value" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_sequences_pk" PRIMARY KEY ("store_id", "key"),
  CONSTRAINT "tenant_sequences_value_check" CHECK ("value" >= 0)
);
CREATE INDEX IF NOT EXISTS "tenant_sequences_store_idx" ON "tenant_sequences" ("store_id");

INSERT INTO "tenant_sequences" ("store_id", "key", "value")
SELECT "store_id", 'sale_folio', GREATEST(MAX("folio"::integer), 309000)
FROM "sale_records"
WHERE "folio" ~ '^[0-9]+$'
GROUP BY "store_id"
ON CONFLICT ("store_id", "key") DO UPDATE
SET "value" = GREATEST("tenant_sequences"."value", EXCLUDED."value"), "updated_at" = now();

INSERT INTO "tenant_sequences" ("store_id", "key", "value")
SELECT "store_id", 'service_folio', MAX(SUBSTRING("folio" FROM '^SRV-([0-9]+)$')::integer)
FROM "servicios"
WHERE "folio" ~ '^SRV-[0-9]+$'
GROUP BY "store_id"
ON CONFLICT ("store_id", "key") DO UPDATE
SET "value" = GREATEST("tenant_sequences"."value", EXCLUDED."value"), "updated_at" = now();

-- Stop before adding composite constraints when historical data crosses a tenant boundary.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "products" p
    JOIN "product_categories" c ON c."id" = p."category"
    WHERE p."store_id" <> c."store_id"
  ) THEN
    RAISE EXCEPTION 'Cross-tenant product/category rows must be corrected before migration 0032';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "sale_items" i
    JOIN "sale_records" s ON s."id" = i."sale_id"
    WHERE i."store_id" <> s."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "sale_items" i
    JOIN "products" p ON p."id" = i."product_id"
    WHERE i."store_id" <> p."store_id"
  ) THEN
    RAISE EXCEPTION 'Cross-tenant sale item rows must be corrected before migration 0032';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_store_id_unique_idx"
  ON "product_categories" ("store_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "products_store_id_unique_idx"
  ON "products" ("store_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "sale_records_store_id_unique_idx"
  ON "sale_records" ("store_id", "id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_store_category_fk') THEN
    ALTER TABLE "products" ADD CONSTRAINT "products_store_category_fk"
      FOREIGN KEY ("store_id", "category")
      REFERENCES "product_categories"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_store_sale_fk') THEN
    ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_store_sale_fk"
      FOREIGN KEY ("store_id", "sale_id")
      REFERENCES "sale_records"("store_id", "id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_store_product_fk') THEN
    ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_store_product_fk"
      FOREIGN KEY ("store_id", "product_id")
      REFERENCES "products"("store_id", "id");
  END IF;
END $$;

ALTER TABLE "sale_records" DROP CONSTRAINT IF EXISTS "sale_records_folio_unique";
ALTER TABLE "servicios" DROP CONSTRAINT IF EXISTS "servicios_folio_unique";
ALTER TABLE "mercadopago_payments" DROP CONSTRAINT IF EXISTS "mercadopago_payments_payment_id_unique";
ALTER TABLE "mercadopago_refunds" DROP CONSTRAINT IF EXISTS "mercadopago_refunds_mp_refund_id_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "sale_records_store_folio_unique_idx"
  ON "sale_records" ("store_id", "folio");
CREATE UNIQUE INDEX IF NOT EXISTS "servicios_store_folio_unique_idx"
  ON "servicios" ("store_id", "folio");
CREATE UNIQUE INDEX IF NOT EXISTS "mp_payments_store_payment_id_unique_idx"
  ON "mercadopago_payments" ("store_id", "payment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "mp_refunds_store_refund_id_unique_idx"
  ON "mercadopago_refunds" ("store_id", "mp_refund_id");

DO $$
DECLARE
  table_name text;
  constraint_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'stock_movements', 'sale_records', 'sale_items', 'merma_records',
    'fiado_transactions', 'gastos', 'cortes_caja', 'inventory_audits',
    'loyalty_transactions', 'payment_provider_connections'
  ] LOOP
    constraint_name := table_name || '_store_id_stores_id_fk';
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_name) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (store_id) REFERENCES stores(id)',
        table_name,
        constraint_name
      );
    END IF;
  END LOOP;
END $$;

-- Tenant keys for child rows that historically inherited scope only through
-- their parent. Backfill first, then make the tenant boundary mandatory.
ALTER TABLE "pedido_items" ADD COLUMN IF NOT EXISTS "store_id" text;
UPDATE "pedido_items" child
SET "store_id" = parent."store_id"
FROM "pedidos" parent
WHERE parent."id" = child."pedido_id" AND child."store_id" IS NULL;
ALTER TABLE "pedido_items" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "pedido_items" ALTER COLUMN "store_id" SET NOT NULL;

ALTER TABLE "fiado_items" ADD COLUMN IF NOT EXISTS "store_id" text;
UPDATE "fiado_items" child
SET "store_id" = parent."store_id"
FROM "fiado_transactions" parent
WHERE parent."id" = child."fiado_id" AND child."store_id" IS NULL;
ALTER TABLE "fiado_items" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "fiado_items" ALTER COLUMN "store_id" SET NOT NULL;

ALTER TABLE "inventory_audit_items" ADD COLUMN IF NOT EXISTS "store_id" text;
UPDATE "inventory_audit_items" child
SET "store_id" = parent."store_id"
FROM "inventory_audits" parent
WHERE parent."id" = child."audit_id" AND child."store_id" IS NULL;
ALTER TABLE "inventory_audit_items" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "inventory_audit_items" ALTER COLUMN "store_id" SET NOT NULL;

ALTER TABLE "devolucion_items" ADD COLUMN IF NOT EXISTS "store_id" text;
UPDATE "devolucion_items" child
SET "store_id" = parent."store_id"
FROM "devoluciones" parent
WHERE parent."id" = child."devolucion_id" AND child."store_id" IS NULL;
ALTER TABLE "devolucion_items" ALTER COLUMN "store_id" SET DEFAULT 'main';
ALTER TABLE "devolucion_items" ALTER COLUMN "store_id" SET NOT NULL;

-- Abort instead of silently legitimizing cross-tenant references that already
-- exist. These rows must be investigated before the migration is retried.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "stock_movements" child JOIN "products" product ON product."id" = child."product_id"
    WHERE child."store_id" <> product."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "merma_records" child JOIN "products" product ON product."id" = child."product_id"
    WHERE child."store_id" <> product."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "pedido_items" child JOIN "products" product ON product."id" = child."product_id"
    WHERE child."store_id" <> product."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "fiado_transactions" child JOIN "clientes" customer ON customer."id" = child."cliente_id"
    WHERE child."store_id" <> customer."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "fiado_items" child JOIN "products" product ON product."id" = child."product_id"
    WHERE child."store_id" <> product."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "inventory_audit_items" child JOIN "products" product ON product."id" = child."product_id"
    WHERE child."store_id" <> product."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "devoluciones" child JOIN "sale_records" sale ON sale."id" = child."sale_id"
    WHERE child."store_id" <> sale."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "devolucion_items" child JOIN "products" product ON product."id" = child."product_id"
    WHERE child."store_id" <> product."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "cash_movements" child JOIN "cortes_caja" shift ON shift."id" = child."corte_id"
    WHERE child."corte_id" IS NOT NULL AND child."store_id" <> shift."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "loyalty_transactions" child JOIN "clientes" customer ON customer."id" = child."cliente_id"
    WHERE child."store_id" <> customer."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "loyalty_transactions" child JOIN "sale_records" sale ON sale."id" = child."sale_id"
    WHERE child."sale_id" IS NOT NULL AND child."store_id" <> sale."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "mercadopago_payments" child JOIN "sale_records" sale ON sale."id" = child."sale_id"
    WHERE child."sale_id" IS NOT NULL AND child."store_id" <> sale."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "mercadopago_refunds" child JOIN "sale_records" sale ON sale."id" = child."sale_id"
    WHERE child."sale_id" IS NOT NULL AND child."store_id" <> sale."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "cfdi_records" child JOIN "sale_records" sale ON sale."id" = child."sale_id"
    WHERE child."store_id" <> sale."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "payment_charges" child JOIN "sale_records" sale ON sale."id" = child."sale_id"
    WHERE child."sale_id" IS NOT NULL AND child."store_id" <> sale."store_id"
  ) OR EXISTS (
    SELECT 1 FROM "mercadopago_refunds" child
    JOIN "mercadopago_payments" payment ON payment."payment_id" = child."mp_payment_id"
    WHERE child."store_id" <> payment."store_id"
  ) THEN
    RAISE EXCEPTION 'Cross-tenant parent/child references must be repaired before migration 0032';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "pedidos_store_id_unique_idx" ON "pedidos" ("store_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "clientes_store_id_unique_idx" ON "clientes" ("store_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "fiado_transactions_store_id_unique_idx" ON "fiado_transactions" ("store_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_audits_store_id_unique_idx" ON "inventory_audits" ("store_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "devoluciones_store_id_unique_idx" ON "devoluciones" ("store_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "cortes_caja_store_id_unique_idx" ON "cortes_caja" ("store_id", "id");
CREATE INDEX IF NOT EXISTS "pedido_items_store_idx" ON "pedido_items" ("store_id");
CREATE INDEX IF NOT EXISTS "fiado_items_store_idx" ON "fiado_items" ("store_id");
CREATE INDEX IF NOT EXISTS "inventory_audit_items_store_idx" ON "inventory_audit_items" ("store_id");
CREATE INDEX IF NOT EXISTS "devolucion_items_store_idx" ON "devolucion_items" ("store_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedido_items_store_id_stores_id_fk') THEN
    ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiado_items_store_id_stores_id_fk') THEN
    ALTER TABLE "fiado_items" ADD CONSTRAINT "fiado_items_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_audit_items_store_id_stores_id_fk') THEN
    ALTER TABLE "inventory_audit_items" ADD CONSTRAINT "inventory_audit_items_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devolucion_items_store_id_stores_id_fk') THEN
    ALTER TABLE "devolucion_items" ADD CONSTRAINT "devolucion_items_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "stores"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_store_product_fk') THEN
    ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_product_fk"
      FOREIGN KEY ("store_id", "product_id") REFERENCES "products"("store_id", "id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merma_records_store_product_fk') THEN
    ALTER TABLE "merma_records" ADD CONSTRAINT "merma_records_store_product_fk"
      FOREIGN KEY ("store_id", "product_id") REFERENCES "products"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedido_items_store_pedido_fk') THEN
    ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_store_pedido_fk"
      FOREIGN KEY ("store_id", "pedido_id") REFERENCES "pedidos"("store_id", "id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedido_items_store_product_fk') THEN
    ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_store_product_fk"
      FOREIGN KEY ("store_id", "product_id") REFERENCES "products"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiado_transactions_store_cliente_fk') THEN
    ALTER TABLE "fiado_transactions" ADD CONSTRAINT "fiado_transactions_store_cliente_fk"
      FOREIGN KEY ("store_id", "cliente_id") REFERENCES "clientes"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiado_transactions_store_sale_folio_fk') THEN
    ALTER TABLE "fiado_transactions" ADD CONSTRAINT "fiado_transactions_store_sale_folio_fk"
      FOREIGN KEY ("store_id", "sale_folio") REFERENCES "sale_records"("store_id", "folio");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiado_items_store_fiado_fk') THEN
    ALTER TABLE "fiado_items" ADD CONSTRAINT "fiado_items_store_fiado_fk"
      FOREIGN KEY ("store_id", "fiado_id") REFERENCES "fiado_transactions"("store_id", "id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiado_items_store_product_fk') THEN
    ALTER TABLE "fiado_items" ADD CONSTRAINT "fiado_items_store_product_fk"
      FOREIGN KEY ("store_id", "product_id") REFERENCES "products"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_audit_items_store_audit_fk') THEN
    ALTER TABLE "inventory_audit_items" ADD CONSTRAINT "inventory_audit_items_store_audit_fk"
      FOREIGN KEY ("store_id", "audit_id") REFERENCES "inventory_audits"("store_id", "id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_audit_items_store_product_fk') THEN
    ALTER TABLE "inventory_audit_items" ADD CONSTRAINT "inventory_audit_items_store_product_fk"
      FOREIGN KEY ("store_id", "product_id") REFERENCES "products"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devoluciones_store_sale_fk') THEN
    ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_store_sale_fk"
      FOREIGN KEY ("store_id", "sale_id") REFERENCES "sale_records"("store_id", "id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devoluciones_store_cliente_fk') THEN
    ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_store_cliente_fk"
      FOREIGN KEY ("store_id", "cliente_id") REFERENCES "clientes"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devolucion_items_store_devolucion_fk') THEN
    ALTER TABLE "devolucion_items" ADD CONSTRAINT "devolucion_items_store_devolucion_fk"
      FOREIGN KEY ("store_id", "devolucion_id") REFERENCES "devoluciones"("store_id", "id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devolucion_items_store_product_fk') THEN
    ALTER TABLE "devolucion_items" ADD CONSTRAINT "devolucion_items_store_product_fk"
      FOREIGN KEY ("store_id", "product_id") REFERENCES "products"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_movements_store_corte_fk') THEN
    ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_store_corte_fk"
      FOREIGN KEY ("store_id", "corte_id") REFERENCES "cortes_caja"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_transactions_store_cliente_fk') THEN
    ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_store_cliente_fk"
      FOREIGN KEY ("store_id", "cliente_id") REFERENCES "clientes"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_transactions_store_sale_fk') THEN
    ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_store_sale_fk"
      FOREIGN KEY ("store_id", "sale_id") REFERENCES "sale_records"("store_id", "id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mp_payments_store_sale_fk') THEN
    ALTER TABLE "mercadopago_payments" ADD CONSTRAINT "mp_payments_store_sale_fk"
      FOREIGN KEY ("store_id", "sale_id") REFERENCES "sale_records"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mp_refunds_store_sale_fk') THEN
    ALTER TABLE "mercadopago_refunds" ADD CONSTRAINT "mp_refunds_store_sale_fk"
      FOREIGN KEY ("store_id", "sale_id") REFERENCES "sale_records"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mp_refunds_store_payment_fk') THEN
    ALTER TABLE "mercadopago_refunds" ADD CONSTRAINT "mp_refunds_store_payment_fk"
      FOREIGN KEY ("store_id", "mp_payment_id") REFERENCES "mercadopago_payments"("store_id", "payment_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_charges_store_sale_fk') THEN
    ALTER TABLE "payment_charges" ADD CONSTRAINT "payment_charges_store_sale_fk"
      FOREIGN KEY ("store_id", "sale_id") REFERENCES "sale_records"("store_id", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cfdi_records_store_sale_fk') THEN
    ALTER TABLE "cfdi_records" ADD CONSTRAINT "cfdi_records_store_sale_fk"
      FOREIGN KEY ("store_id", "sale_id") REFERENCES "sale_records"("store_id", "id");
  END IF;
END $$;

-- A custom role can only be assigned inside its tenant. System roles remain shared.
CREATE OR REPLACE FUNCTION validate_tenant_membership_role_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  role_store_id text;
  role_is_system boolean;
BEGIN
  SELECT "store_id", "is_system" INTO role_store_id, role_is_system
  FROM "role_definitions" WHERE "id" = NEW."role_id";

  IF NOT FOUND OR (role_is_system = false AND role_store_id IS DISTINCT FROM NEW."store_id") THEN
    RAISE EXCEPTION 'Role does not belong to the membership tenant';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "tenant_membership_role_scope_trigger" ON "user_roles";
CREATE TRIGGER "tenant_membership_role_scope_trigger"
BEFORE INSERT OR UPDATE OF "role_id", "store_id" ON "user_roles"
FOR EACH ROW EXECUTE FUNCTION validate_tenant_membership_role_scope();

-- Tenant operations may never remove or deactivate the final active owner.
CREATE OR REPLACE FUNCTION protect_last_tenant_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_role_name text;
  replacement_is_owner boolean;
  remaining_owners integer;
BEGIN
  SELECT "name" INTO old_role_name FROM "role_definitions" WHERE "id" = OLD."role_id";
  IF old_role_name <> 'Propietario' OR OLD."status" <> 'activo' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  replacement_is_owner := false;
  IF TG_OP = 'UPDATE' THEN
    SELECT ("name" = 'Propietario') INTO replacement_is_owner
    FROM "role_definitions" WHERE "id" = NEW."role_id";
    IF NEW."status" = 'activo' AND NEW."store_id" = OLD."store_id" AND replacement_is_owner THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT count(*) INTO remaining_owners
  FROM "user_roles" membership
  JOIN "role_definitions" role ON role."id" = membership."role_id"
  WHERE membership."store_id" = OLD."store_id"
    AND membership."status" = 'activo'
    AND role."name" = 'Propietario'
    AND membership."id" <> OLD."id";

  IF remaining_owners = 0 THEN
    RAISE EXCEPTION 'A tenant must retain at least one active owner';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "protect_last_tenant_owner_trigger" ON "user_roles";
CREATE TRIGGER "protect_last_tenant_owner_trigger"
BEFORE DELETE OR UPDATE OF "role_id", "status", "store_id" ON "user_roles"
FOR EACH ROW EXECUTE FUNCTION protect_last_tenant_owner();
