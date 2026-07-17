-- Platform administrators are global identities and are never inferred from a
-- tenant role or email address.
CREATE TABLE IF NOT EXISTS "platform_administrators" (
  "cognito_sub" text PRIMARY KEY REFERENCES "user_identities"("cognito_sub"),
  "role" text NOT NULL DEFAULT 'platform_admin',
  "status" text NOT NULL DEFAULT 'active',
  "created_by" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "platform_administrators_role_check" CHECK ("role" = 'platform_admin'),
  CONSTRAINT "platform_administrators_status_check" CHECK ("status" IN ('active', 'revoked'))
);
CREATE INDEX IF NOT EXISTS "platform_administrators_status_idx"
  ON "platform_administrators" ("status");

-- Transaction-local context functions used by tenant policies. The application
-- sets both values through src/db/tenant-context.ts inside each transaction.
CREATE OR REPLACE FUNCTION app_current_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')
$$;

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')
$$;

-- Policies are installed in advance but RLS is deliberately not enabled by
-- this migration. Production activation requires a non-owner runtime DB role
-- and all tenant transactions must set their local context first. Enabling RLS
-- prematurely would lock out store resolution and background workers.
DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ai_provider_configs', 'tenant_sequences', 'user_store_access', 'payment_provider_connections',
    'oauth_states', 'payment_charges', 'product_categories', 'products',
    'stock_movements', 'sale_records', 'sale_items', 'merma_records',
    'pedidos', 'pedido_items', 'clientes', 'fiado_transactions', 'fiado_items',
    'gastos', 'proveedores', 'cortes_caja', 'inventory_audits',
    'inventory_audit_items', 'user_roles', 'tenant_invitations', 'tenant_assets',
    'audit_logs', 'devoluciones', 'devolucion_items', 'cash_movements',
    'loyalty_transactions', 'servicios', 'promotions', 'mercadopago_payments',
    'mercadopago_refunds', 'cfdi_records'
  ] LOOP
    policy_name := table_name || '_tenant_isolation';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = current_schema() AND tablename = table_name AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (store_id = app_current_tenant_id()) WITH CHECK (store_id = app_current_tenant_id())',
        policy_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema() AND tablename = 'stores' AND policyname = 'stores_tenant_isolation'
  ) THEN
    CREATE POLICY "stores_tenant_isolation" ON "stores"
      USING ("id" = app_current_tenant_id())
      WITH CHECK ("id" = app_current_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema() AND tablename = 'store_config' AND policyname = 'store_config_tenant_isolation'
  ) THEN
    CREATE POLICY "store_config_tenant_isolation" ON "store_config"
      USING ("id" = app_current_tenant_id())
      WITH CHECK ("id" = app_current_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema() AND tablename = 'role_definitions' AND policyname = 'role_definitions_tenant_isolation'
  ) THEN
    CREATE POLICY "role_definitions_tenant_isolation" ON "role_definitions"
      USING ("is_system" = true OR "store_id" = app_current_tenant_id())
      WITH CHECK ("is_system" = false AND "store_id" = app_current_tenant_id());
  END IF;
END $$;
