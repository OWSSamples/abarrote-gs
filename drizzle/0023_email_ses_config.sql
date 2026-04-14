-- Add email (AWS SES) configuration columns to store_config
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_from" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_from_name" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_reply_to" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_recipients" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "email_accent_color" text;
