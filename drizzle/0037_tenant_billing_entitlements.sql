CREATE TABLE IF NOT EXISTS "tenant_billing_entitlements" (
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "value" integer NOT NULL,
  "expires_at" timestamp,
  "synced_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_billing_entitlements_pk" PRIMARY KEY ("tenant_id", "code"),
  CONSTRAINT "tenant_billing_entitlements_code_check"
    CHECK ("code" ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT "tenant_billing_entitlements_value_check" CHECK ("value" >= 0)
);

CREATE INDEX IF NOT EXISTS "tenant_billing_entitlements_expiry_idx"
  ON "tenant_billing_entitlements" ("expires_at");
