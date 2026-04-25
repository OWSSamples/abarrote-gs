-- Email settings: per-type toggles, schedule, footer, signature

ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_ticket_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_daily_report_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_weekly_report_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_stock_alert_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_refund_alert_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_expense_alert_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_security_alert_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_daily_report_time" text DEFAULT '08:00';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_weekly_report_day" text DEFAULT 'monday';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_footer_text" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_signature" text;
