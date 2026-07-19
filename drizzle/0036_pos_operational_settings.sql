ALTER TABLE "store_config"
  ADD COLUMN IF NOT EXISTS "open_cash_drawer_on_cash_sale" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "sales_schedule_enabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "sales_open_time" text DEFAULT '06:00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "close_system_time" text DEFAULT '23:00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "auto_corte_enabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "auto_corte_time" text DEFAULT '00:00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "business_timezone" text DEFAULT 'America/Mexico_City' NOT NULL;

ALTER TABLE "cortes_caja"
  ADD COLUMN IF NOT EXISTS "business_date" date;

UPDATE "cortes_caja"
SET "business_date" = ("fecha" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::date
WHERE "business_date" IS NULL;

ALTER TABLE "cortes_caja"
  ALTER COLUMN "business_date" SET DEFAULT CURRENT_DATE,
  ALTER COLUMN "business_date" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "cortes_caja_store_business_date_idx"
  ON "cortes_caja" ("store_id", "business_date");

ALTER TABLE "store_config"
  DROP CONSTRAINT IF EXISTS "store_config_sales_open_time_check",
  ADD CONSTRAINT "store_config_sales_open_time_check"
    CHECK ("sales_open_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  DROP CONSTRAINT IF EXISTS "store_config_close_system_time_check",
  ADD CONSTRAINT "store_config_close_system_time_check"
    CHECK ("close_system_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  DROP CONSTRAINT IF EXISTS "store_config_auto_corte_time_check",
  ADD CONSTRAINT "store_config_auto_corte_time_check"
    CHECK ("auto_corte_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  DROP CONSTRAINT IF EXISTS "store_config_business_timezone_check",
  ADD CONSTRAINT "store_config_business_timezone_check"
    CHECK ("business_timezone" IN (
      'America/Mexico_City', 'America/Cancun', 'America/Monterrey',
      'America/Chihuahua', 'America/Hermosillo', 'America/Tijuana',
      'America/Bogota', 'America/Lima', 'America/Santiago',
      'America/Argentina/Buenos_Aires', 'America/New_York', 'America/Los_Angeles'
    )),
  DROP CONSTRAINT IF EXISTS "store_config_default_starting_fund_check",
  ADD CONSTRAINT "store_config_default_starting_fund_check"
    CHECK ("default_starting_fund" >= 0 AND "default_starting_fund" <= 1000000);
