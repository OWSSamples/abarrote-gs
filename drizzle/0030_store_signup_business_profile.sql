ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "country" text NOT NULL DEFAULT 'MX';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "business_type" text NOT NULL DEFAULT 'abarrotes';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "business_type_other" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "contact_email" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "estimated_users" integer NOT NULL DEFAULT 1;
