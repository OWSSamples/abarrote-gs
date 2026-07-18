-- Tenant-scoped indexes for the highest-frequency authorization, sales,
-- inventory and child-record lookups. All statements are additive and
-- idempotent so schema recovery can safely replay this migration.

CREATE INDEX IF NOT EXISTS "user_roles_active_cognito_idx"
  ON "user_roles" ("cognito_sub") WHERE "status" = 'activo';

CREATE INDEX IF NOT EXISTS "sale_items_sale_id_idx"
  ON "sale_items" ("sale_id");
CREATE INDEX IF NOT EXISTS "sale_items_product_id_idx"
  ON "sale_items" ("product_id");
CREATE INDEX IF NOT EXISTS "sale_items_store_sale_idx"
  ON "sale_items" ("store_id", "sale_id");
CREATE INDEX IF NOT EXISTS "sale_items_store_product_idx"
  ON "sale_items" ("store_id", "product_id");

CREATE INDEX IF NOT EXISTS "stock_movements_store_product_created_idx"
  ON "stock_movements" ("store_id", "product_id", "created_at");

CREATE INDEX IF NOT EXISTS "pedido_items_pedido_id_idx"
  ON "pedido_items" ("pedido_id");
CREATE INDEX IF NOT EXISTS "pedido_items_product_id_idx"
  ON "pedido_items" ("product_id");
CREATE INDEX IF NOT EXISTS "pedido_items_store_pedido_idx"
  ON "pedido_items" ("store_id", "pedido_id");
CREATE INDEX IF NOT EXISTS "pedido_items_store_product_idx"
  ON "pedido_items" ("store_id", "product_id");

CREATE INDEX IF NOT EXISTS "fiado_transactions_cliente_id_idx"
  ON "fiado_transactions" ("cliente_id");
CREATE INDEX IF NOT EXISTS "fiado_transactions_date_idx"
  ON "fiado_transactions" ("date");
CREATE INDEX IF NOT EXISTS "fiado_transactions_store_date_idx"
  ON "fiado_transactions" ("store_id", "date");
CREATE INDEX IF NOT EXISTS "fiado_transactions_store_cliente_date_idx"
  ON "fiado_transactions" ("store_id", "cliente_id", "date");

CREATE INDEX IF NOT EXISTS "fiado_items_fiado_id_idx"
  ON "fiado_items" ("fiado_id");
CREATE INDEX IF NOT EXISTS "fiado_items_store_fiado_idx"
  ON "fiado_items" ("store_id", "fiado_id");
CREATE INDEX IF NOT EXISTS "fiado_items_store_product_idx"
  ON "fiado_items" ("store_id", "product_id");

CREATE INDEX IF NOT EXISTS "inventory_audit_items_audit_id_idx"
  ON "inventory_audit_items" ("audit_id");
CREATE INDEX IF NOT EXISTS "inventory_audit_items_store_audit_idx"
  ON "inventory_audit_items" ("store_id", "audit_id");
CREATE INDEX IF NOT EXISTS "inventory_audit_items_store_product_idx"
  ON "inventory_audit_items" ("store_id", "product_id");

CREATE INDEX IF NOT EXISTS "devolucion_items_devolucion_id_idx"
  ON "devolucion_items" ("devolucion_id");
CREATE INDEX IF NOT EXISTS "devolucion_items_store_devolucion_idx"
  ON "devolucion_items" ("store_id", "devolucion_id");
CREATE INDEX IF NOT EXISTS "devolucion_items_store_product_idx"
  ON "devolucion_items" ("store_id", "product_id");

CREATE INDEX IF NOT EXISTS "cash_movements_store_fecha_idx"
  ON "cash_movements" ("store_id", "fecha");
CREATE INDEX IF NOT EXISTS "cash_movements_store_corte_idx"
  ON "cash_movements" ("store_id", "corte_id");
