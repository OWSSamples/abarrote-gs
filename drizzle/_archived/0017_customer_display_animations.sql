-- Customer Display Animation Settings
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_idle_animation" text NOT NULL DEFAULT 'fade';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_transition_speed" text NOT NULL DEFAULT 'normal';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_promo_animation" text NOT NULL DEFAULT 'slideUp';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_show_clock" boolean NOT NULL DEFAULT true;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_theme" text NOT NULL DEFAULT 'light';
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_idle_carousel" boolean NOT NULL DEFAULT false;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "customer_display_carousel_interval" text NOT NULL DEFAULT '5';
