-- Migration: Configurable loyalty expiration, exchange rate, merma evidence
-- Adds fields introduced in the high-priority sprint

-- ═══ store_config: configurable loyalty expiration & currency exchange ═══
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS loyalty_expiration_days INTEGER NOT NULL DEFAULT 365;
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS exchange_rate_usd_mxn NUMERIC(10,4) NOT NULL DEFAULT '17.5';

-- ═══ merma_records: evidence tracking ═══
ALTER TABLE merma_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE merma_records ADD COLUMN IF NOT EXISTS evidence_url TEXT;
