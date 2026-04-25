ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_provider" text NOT NULL DEFAULT 'none';
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_environment" text NOT NULL DEFAULT 'sandbox';
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_auth_type" text NOT NULL DEFAULT 'basic';
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_api_url" text;
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_api_key" text;
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_api_secret" text;
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_cancel_path" text NOT NULL DEFAULT '/cancel';
