CREATE UNIQUE INDEX IF NOT EXISTS "stores_active_name_unique_idx"
  ON "stores" (lower("name"))
  WHERE "deleted_at" IS NULL;
