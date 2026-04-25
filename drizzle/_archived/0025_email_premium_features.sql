-- Email premium features: CC/BCC, subject prefix, digest, throttle, attachments, retry

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
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_weekly_report_time" text DEFAULT '07:00';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_monthly_report_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_monthly_report_day" integer NOT NULL DEFAULT 1;
