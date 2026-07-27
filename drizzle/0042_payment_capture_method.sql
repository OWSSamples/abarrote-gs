ALTER TABLE "store_config"
  ADD COLUMN IF NOT EXISTS "payment_capture_method" text NOT NULL DEFAULT 'payment_screen';

ALTER TABLE "store_config"
  DROP CONSTRAINT IF EXISTS "store_config_payment_capture_method_check";

ALTER TABLE "store_config"
  ADD CONSTRAINT "store_config_payment_capture_method_check"
  CHECK ("payment_capture_method" IN ('payment_screen', 'order_prepared', 'manual'));
