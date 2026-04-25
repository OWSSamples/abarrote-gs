-- ════════════════════════════════════════════════════════════════════
-- 0019_consolidate_drift
-- ════════════════════════════════════════════════════════════════════
-- Consolida 16 migraciones huérfanas (0016..0027) que nunca fueron
-- registradas en `_journal.json` por colisiones de numeración.
--
-- 100% idempotente (IF NOT EXISTS / DO blocks). Seguro de re-aplicar.
-- Las huérfanas originales se preservan en `drizzle/_archived/`.
--
-- Cubre drift detectado en:
--   • merma_records.notes / evidence_url
--   • gastos.comprobante_url
--   • store_config.* (email, ai, servicios, customer_display, cfdi_pac,
--     ticket_design, payment providers, loyalty, exchange_rate, etc.)
--   • servicios.provider_*
--   • Tabla ai_provider_configs
--   • Índices de performance + FK products.category
--   • Seed feature_flags 'telegram-notifications'
-- ════════════════════════════════════════════════════════════════════

-- ───────────────────── merma_records ─────────────────────
ALTER TABLE "merma_records" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "merma_records" ADD COLUMN IF NOT EXISTS "evidence_url" text;

-- ───────────────────── gastos ────────────────────────────
ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "comprobante_url" text;

-- ───────────────────── servicios ─────────────────────────
ALTER TABLE "servicios" ADD COLUMN IF NOT EXISTS "provider_id" text NOT NULL DEFAULT 'local';
ALTER TABLE "servicios" ADD COLUMN IF NOT EXISTS "provider_transaction_id" text;
ALTER TABLE "servicios" ADD COLUMN IF NOT EXISTS "provider_auth_code" text;
ALTER TABLE "servicios" ADD COLUMN IF NOT EXISTS "provider_error" text;
ALTER TABLE "servicios" ADD COLUMN IF NOT EXISTS "provider_responded_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_servicios_provider_txn"
  ON "servicios" ("provider_id", "provider_transaction_id")
  WHERE "provider_transaction_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_servicios_pending"
  ON "servicios" ("estado", "fecha")
  WHERE "estado" IN ('pendiente', 'procesando');

-- ───────────────────── store_config: customer display ─────────────────
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_idle_animation" text NOT NULL DEFAULT 'fade';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_transition_speed" text NOT NULL DEFAULT 'normal';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_promo_animation" text NOT NULL DEFAULT 'slideUp';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_show_clock" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_theme" text NOT NULL DEFAULT 'light';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_idle_carousel" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_carousel_interval" text NOT NULL DEFAULT '5';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_logo" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_font_scale" text NOT NULL DEFAULT '1';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_auto_return_sec" text NOT NULL DEFAULT '6';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_accent_color" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_sound_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_orientation" text NOT NULL DEFAULT 'landscape';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_message_style" text;

-- ───────────────────── store_config: ticket design ───────────────────
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ticket_template_venta" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ticket_template_proveedor" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ticket_design_venta" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ticket_design_corte" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ticket_design_proveedor" text;

-- ───────────────────── store_config: CFDI PAC ────────────────────────
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "cfdi_pac_provider" text NOT NULL DEFAULT 'none';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "cfdi_pac_environment" text NOT NULL DEFAULT 'sandbox';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "cfdi_pac_auth_type" text NOT NULL DEFAULT 'basic';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "cfdi_pac_api_url" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "cfdi_pac_api_key" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "cfdi_pac_api_secret" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "cfdi_pac_cancel_path" text NOT NULL DEFAULT '/cancel';

-- ───────────────────── store_config: email (SES) ─────────────────────
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_from" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_from_name" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_reply_to" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_recipients" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_accent_color" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_ticket_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_daily_report_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_weekly_report_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_stock_alert_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_refund_alert_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_expense_alert_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_security_alert_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_daily_report_time" text DEFAULT '08:00';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_weekly_report_day" text DEFAULT 'monday';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_weekly_report_time" text DEFAULT '07:00';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_footer_text" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_signature" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_cc_recipients" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_bcc_recipients" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_subject_prefix" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_digest_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_digest_interval_minutes" integer NOT NULL DEFAULT 60;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_max_alerts_per_hour" integer NOT NULL DEFAULT 20;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_auto_retry" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_max_retries" integer NOT NULL DEFAULT 3;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_attach_pdf_ticket" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_attach_excel_report" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_monthly_report_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_monthly_report_day" integer NOT NULL DEFAULT 1;

-- ───────────────────── store_config: payment providers ───────────────
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "clabe_number" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "paypal_username" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "paypal_qr_url" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "cobrar_qr_url" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "mp_device_id" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "mp_public_key" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "mp_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "conekta_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "conekta_public_key" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "stripe_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "stripe_public_key" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "clip_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "clip_api_key" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "clip_serial_number" text;

-- ───────────────────── store_config: servicios provider ──────────────
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "servicios_provider" text NOT NULL DEFAULT 'local';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "servicios_api_key" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "servicios_api_secret" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "servicios_sandbox" boolean NOT NULL DEFAULT true;

-- ───────────────────── store_config: AI ──────────────────────────────
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ai_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ai_provider" text NOT NULL DEFAULT 'openrouter';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ai_api_key_enc" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ai_model" text NOT NULL DEFAULT 'nvidia/nemotron-3-super:free';

-- ───────────────────── store_config: inventory & finance ─────────────
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "inventory_general_columns" text NOT NULL DEFAULT '["title","sku","available","onHand"]';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "default_margin" text NOT NULL DEFAULT '30';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "default_starting_fund" numeric(10, 2) NOT NULL DEFAULT '500';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "loyalty_expiration_days" integer NOT NULL DEFAULT 365;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "exchange_rate_usd_mxn" numeric(10, 4) NOT NULL DEFAULT '17.5';

-- ───────────────────── ai_provider_configs (table) ───────────────────
CREATE TABLE IF NOT EXISTS "ai_provider_configs" (
  "id" text PRIMARY KEY,
  "api_key_enc" text,
  "enabled" boolean NOT NULL DEFAULT false,
  "selected_model" text NOT NULL DEFAULT '',
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

-- Migrate existing single-provider config (OpenRouter) — only if source columns exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_config' AND column_name = 'ai_api_key_enc'
  ) THEN
    INSERT INTO "ai_provider_configs" ("id", "api_key_enc", "enabled", "selected_model", "updated_at")
    SELECT
      'openrouter',
      sc."ai_api_key_enc",
      sc."ai_enabled",
      COALESCE(sc."ai_model", 'nvidia/nemotron-3-super:free'),
      NOW()
    FROM "store_config" sc
    WHERE sc."id" = 'main' AND sc."ai_api_key_enc" IS NOT NULL
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- ───────────────────── Performance indexes ───────────────────────────
CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("category");
CREATE INDEX IF NOT EXISTS "products_current_stock_idx" ON "products" ("current_stock");
CREATE INDEX IF NOT EXISTS "fiado_transactions_cliente_date_idx" ON "fiado_transactions" ("cliente_id", "date");
CREATE INDEX IF NOT EXISTS "cash_movements_corte_id_idx" ON "cash_movements" ("corte_id");
CREATE INDEX IF NOT EXISTS "cash_movements_tipo_idx" ON "cash_movements" ("tipo");

-- ───────────────────── FK products.category → product_categories.id ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'products_category_product_categories_id_fk'
      AND table_name = 'products'
  ) THEN
    -- Backfill orphaned categories to 'general' so the FK can be added safely.
    UPDATE "products" p
       SET "category" = 'general'
     WHERE "category" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "product_categories" pc WHERE pc."id" = p."category");

    -- Ensure 'general' exists as a fallback category.
    INSERT INTO "product_categories" ("id", "name")
      SELECT 'general', 'General'
       WHERE NOT EXISTS (SELECT 1 FROM "product_categories" WHERE "id" = 'general');

    ALTER TABLE "products"
      ADD CONSTRAINT "products_category_product_categories_id_fk"
      FOREIGN KEY ("category") REFERENCES "product_categories"("id");
  END IF;
EXCEPTION
  -- If product_categories table doesn't exist yet (very old DB), skip silently.
  WHEN undefined_table THEN NULL;
END $$;

-- ───────────────────── Seed: telegram-notifications feature flag ─────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'feature_flags'
  ) THEN
    INSERT INTO "feature_flags"
      ("id", "description", "enabled", "rollout_percentage",
       "target_user_ids", "target_role_ids", "created_by", "created_at", "updated_at")
    VALUES (
      'telegram-notifications',
      'Habilita el envío de notificaciones por Telegram para todos los eventos del sistema',
      true,
      100,
      '{}',
      '{}',
      'system',
      NOW(),
      NOW()
    )
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;
