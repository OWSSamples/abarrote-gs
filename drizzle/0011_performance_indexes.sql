-- Migration 0011: Performance indexes for high-volume queries
-- Adds indexes on frequently filtered columns that lacked them

-- payment_charges: filter by creation date for dashboard/reports
CREATE INDEX IF NOT EXISTS pc_created_at_idx ON payment_charges(created_at DESC);

-- sale_items: fast lookup by sale (used in cancelSale, ticket printing)
CREATE INDEX IF NOT EXISTS si_sale_id_idx ON sale_items(sale_id);

-- sale_items: fast lookup by product (used in analytics)
CREATE INDEX IF NOT EXISTS si_product_id_idx ON sale_items(product_id);

-- products: category filtering for inventory views
CREATE INDEX IF NOT EXISTS prod_category_idx ON products(category);

-- cortes_caja: date-range queries for report history
CREATE INDEX IF NOT EXISTS cortes_fecha_idx ON cortes_caja(fecha DESC);
