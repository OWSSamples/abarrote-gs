-- Migration: OAuth Provider Connections
-- Stores encrypted OAuth tokens for payment providers (MercadoPago, PayPal, etc.)

CREATE TABLE IF NOT EXISTS "payment_provider_connections" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "store_id" TEXT NOT NULL DEFAULT 'main',
  "status" TEXT NOT NULL DEFAULT 'disconnected',
  "access_token_enc" TEXT,
  "refresh_token_enc" TEXT,
  "public_key" TEXT,
  "token_expires_at" TIMESTAMP,
  "mp_user_id" TEXT,
  "mp_email" TEXT,
  "scopes" TEXT,
  "connected_at" TIMESTAMP,
  "disconnected_at" TIMESTAMP,
  "last_refreshed_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_ppc_store" FOREIGN KEY ("store_id") REFERENCES "store_config"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ppc_provider_store_idx" ON "payment_provider_connections" ("provider", "store_id");
CREATE INDEX IF NOT EXISTS "ppc_status_idx" ON "payment_provider_connections" ("status");

-- Temporal PKCE state storage (cleaned up by cron)
CREATE TABLE IF NOT EXISTS "oauth_states" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "code_verifier" TEXT NOT NULL,
  "state" TEXT NOT NULL UNIQUE,
  "redirect_uri" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "oauth_states_state_idx" ON "oauth_states" ("state");
CREATE INDEX IF NOT EXISTS "oauth_states_expires_idx" ON "oauth_states" ("expires_at");
