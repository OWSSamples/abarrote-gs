-- 0018: Extended customer display settings
-- Adds: custom logo, font scale, auto-return time, accent color, sound, orientation

ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_logo" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_font_scale" text NOT NULL DEFAULT '1';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_auto_return_sec" text NOT NULL DEFAULT '6';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_accent_color" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_sound_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_orientation" text NOT NULL DEFAULT 'landscape';
