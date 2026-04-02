-- Migration: Add Clip payment provider columns to store_config
-- Clip supports: Checkout Redireccionado (payment links) and PinPad API (physical terminal)

ALTER TABLE store_config ADD COLUMN IF NOT EXISTS clip_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS clip_api_key TEXT;
ALTER TABLE store_config ADD COLUMN IF NOT EXISTS clip_serial_number TEXT;
