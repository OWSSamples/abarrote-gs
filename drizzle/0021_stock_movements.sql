-- Migration: stock_movements (kardex de inventario)
-- Registra cada cambio de stock por producto de forma inmutable.

CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id"            text PRIMARY KEY NOT NULL,
  "product_id"    text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "product_name"  text NOT NULL,
  "type"          text NOT NULL,
  "quantity"      integer NOT NULL,
  "direction"     text NOT NULL,
  "balance_after" integer NOT NULL,
  "unit_cost"     numeric(10, 2),
  "total_value"   numeric(10, 2),
  "source"        text,
  "source_id"     text,
  "source_label"  text,
  "notes"         text NOT NULL DEFAULT '',
  "user_id"       text,
  "user_name"     text,
  "created_at"    timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "stock_movements_product_id_idx"      ON "stock_movements" ("product_id");
CREATE INDEX IF NOT EXISTS "stock_movements_created_at_idx"      ON "stock_movements" ("created_at");
CREATE INDEX IF NOT EXISTS "stock_movements_product_created_idx" ON "stock_movements" ("product_id", "created_at");
CREATE INDEX IF NOT EXISTS "stock_movements_type_idx"            ON "stock_movements" ("type");
