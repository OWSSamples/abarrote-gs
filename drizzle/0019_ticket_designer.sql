-- Ticket designer JSON config columns
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ticket_design_venta" text;
ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "ticket_design_corte" text;
