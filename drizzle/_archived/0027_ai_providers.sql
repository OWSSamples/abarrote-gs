-- Table per-provider AI configs (API keys encrypted, one row per provider)
CREATE TABLE IF NOT EXISTS "ai_provider_configs" (
  "id" text PRIMARY KEY,
  "api_key_enc" text,
  "enabled" boolean NOT NULL DEFAULT false,
  "selected_model" text NOT NULL DEFAULT '',
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

-- Migrate existing single-provider config (OpenRouter) from store_config
INSERT INTO "ai_provider_configs" ("id", "api_key_enc", "enabled", "selected_model", "updated_at")
SELECT
  'openrouter',
  sc."ai_api_key_enc",
  sc."ai_enabled",
  COALESCE(sc."ai_model", 'nvidia/nemotron-3-super:free'),
  NOW()
FROM "store_config" sc
WHERE sc."id" = 'main'
  AND sc."ai_api_key_enc" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
