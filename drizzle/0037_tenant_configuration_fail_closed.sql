ALTER TABLE "store_config"
  ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "ai_provider_configs"
  ALTER COLUMN "store_id" DROP DEFAULT;

ALTER TABLE "payment_provider_connections"
  ALTER COLUMN "store_id" DROP DEFAULT;

ALTER TABLE "oauth_states"
  ALTER COLUMN "store_id" DROP DEFAULT;
