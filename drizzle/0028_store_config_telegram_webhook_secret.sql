ALTER TABLE store_config
  ADD COLUMN IF NOT EXISTS telegram_webhook_secret text;
