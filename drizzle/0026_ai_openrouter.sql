-- AI / OpenRouter configuration columns on store_config
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ai_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ai_provider" text NOT NULL DEFAULT 'openrouter';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ai_api_key_enc" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ai_model" text NOT NULL DEFAULT 'google/gemini-2.0-flash-001';
