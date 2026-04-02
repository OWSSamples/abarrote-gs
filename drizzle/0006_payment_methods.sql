-- Agrega campos de pago adicionales a store_config
-- SPEI (Número CLABE), PayPal (usuario) y QR de cobro (URL de imagen)
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "clabe_number" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "paypal_username" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "cobrar_qr_url" text;
