-- Multi-tenant Phase 1 (ADR-001): foundation tables only.
-- Aditive and reversible. No existing tables touched.

CREATE TABLE IF NOT EXISTS "stores" (
  "id"         text PRIMARY KEY,
  "name"       text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

INSERT INTO "stores" ("id", "name")
VALUES ('main', 'Tienda Principal')
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "user_store_access" (
  "user_id"    text NOT NULL,
  "store_id"   text NOT NULL REFERENCES "stores"("id"),
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_store_access_pk" PRIMARY KEY ("user_id", "store_id")
);

CREATE INDEX IF NOT EXISTS "user_store_access_user_idx" ON "user_store_access" ("user_id");
CREATE INDEX IF NOT EXISTS "user_store_access_store_idx" ON "user_store_access" ("store_id");
