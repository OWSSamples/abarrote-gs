-- Multi-tenant Phase 3 (ADR-001): add store_id to transactional tables.
-- Aditive with DEFAULT 'main' so existing rows are auto-tagged.
-- Reads keep working without changes; writes can start populating from scope.

-- Sale records and items
ALTER TABLE "sale_records"     ADD COLUMN IF NOT EXISTS "store_id" text NOT NULL DEFAULT 'main' REFERENCES "stores"("id");
ALTER TABLE "sale_items"       ADD COLUMN IF NOT EXISTS "store_id" text NOT NULL DEFAULT 'main' REFERENCES "stores"("id");

-- Inventory side-effects of sales/restocks
ALTER TABLE "stock_movements"  ADD COLUMN IF NOT EXISTS "store_id" text NOT NULL DEFAULT 'main' REFERENCES "stores"("id");
ALTER TABLE "merma_records"    ADD COLUMN IF NOT EXISTS "store_id" text NOT NULL DEFAULT 'main' REFERENCES "stores"("id");

-- Cash flow per register
ALTER TABLE "cortes_caja"      ADD COLUMN IF NOT EXISTS "store_id" text NOT NULL DEFAULT 'main' REFERENCES "stores"("id");

-- Customer relations (fiado/loyalty are per-store too)
ALTER TABLE "fiado_transactions" ADD COLUMN IF NOT EXISTS "store_id" text NOT NULL DEFAULT 'main' REFERENCES "stores"("id");
ALTER TABLE "loyalty_transactions" ADD COLUMN IF NOT EXISTS "store_id" text NOT NULL DEFAULT 'main' REFERENCES "stores"("id");

-- Expenses and audits
ALTER TABLE "gastos"           ADD COLUMN IF NOT EXISTS "store_id" text NOT NULL DEFAULT 'main' REFERENCES "stores"("id");
ALTER TABLE "inventory_audits" ADD COLUMN IF NOT EXISTS "store_id" text NOT NULL DEFAULT 'main' REFERENCES "stores"("id");

-- Indexes for filtering by store
CREATE INDEX IF NOT EXISTS "sale_records_store_idx"        ON "sale_records" ("store_id");
CREATE INDEX IF NOT EXISTS "sale_records_store_date_idx"   ON "sale_records" ("store_id", "date");
CREATE INDEX IF NOT EXISTS "sale_items_store_idx"          ON "sale_items" ("store_id");
CREATE INDEX IF NOT EXISTS "stock_movements_store_idx"     ON "stock_movements" ("store_id");
CREATE INDEX IF NOT EXISTS "merma_records_store_idx"       ON "merma_records" ("store_id");
CREATE INDEX IF NOT EXISTS "cortes_caja_store_idx"         ON "cortes_caja" ("store_id");
CREATE INDEX IF NOT EXISTS "fiado_transactions_store_idx"  ON "fiado_transactions" ("store_id");
CREATE INDEX IF NOT EXISTS "loyalty_transactions_store_idx" ON "loyalty_transactions" ("store_id");
CREATE INDEX IF NOT EXISTS "gastos_store_idx"              ON "gastos" ("store_id");
CREATE INDEX IF NOT EXISTS "inventory_audits_store_idx"    ON "inventory_audits" ("store_id");
