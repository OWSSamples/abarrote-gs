-- Migration: Add provider tracking to servicios + servicios provider config
-- Enables plug-and-play integration with external topup/bill payment providers

-- Add provider tracking columns to servicios table
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS provider_id TEXT NOT NULL DEFAULT 'local';
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS provider_auth_code TEXT;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS provider_error TEXT;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS provider_responded_at TIMESTAMP;

-- Update estado to support full state machine
-- Valid states: 'completado', 'pendiente', 'procesando', 'fallido', 'cancelado'

-- Add servicios provider config to store_config
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS servicios_provider TEXT NOT NULL DEFAULT 'local';
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS servicios_api_key TEXT;
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS servicios_api_secret TEXT;
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS servicios_sandbox BOOLEAN NOT NULL DEFAULT true;

-- Index for provider transaction lookups (webhook reconciliation)
CREATE INDEX IF NOT EXISTS idx_servicios_provider_txn ON servicios (provider_id, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- Index for pending/processing transactions (polling)
CREATE INDEX IF NOT EXISTS idx_servicios_pending ON servicios (estado, fecha)
  WHERE estado IN ('pendiente', 'procesando');
