-- Introduce a workspace tenant above operational stores without merging any
-- existing business data. Every current store receives an isolated tenant;
-- explicit consolidation can be performed later after ownership review.

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "suspended_at" timestamp,
  "archived_at" timestamp,
  "deleted_at" timestamp,
  CONSTRAINT "tenants_id_format_check" CHECK ("id" ~ '^[0-9a-f]{32}$'),
  CONSTRAINT "tenants_status_check" CHECK ("status" IN ('active', 'suspended', 'archived'))
);

CREATE INDEX IF NOT EXISTS "tenants_status_idx" ON "tenants" ("status");

INSERT INTO "tenants" (
  "id", "name", "status", "created_at", "updated_at",
  "suspended_at", "archived_at", "deleted_at"
)
SELECT
  md5('tenant:' || store."id"),
  store."name",
  store."status",
  store."created_at",
  now(),
  store."suspended_at",
  store."archived_at",
  store."deleted_at"
FROM "stores" store
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "tenant_id" text;

UPDATE "stores"
SET "tenant_id" = md5('tenant:' || "id")
WHERE "tenant_id" IS NULL;

ALTER TABLE "stores" ALTER COLUMN "tenant_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stores_tenant_id_tenants_id_fk'
  ) THEN
    ALTER TABLE "stores"
      ADD CONSTRAINT "stores_tenant_id_tenants_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "stores_tenant_idx" ON "stores" ("tenant_id");
CREATE INDEX IF NOT EXISTS "stores_tenant_status_idx" ON "stores" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "tenant_memberships" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "cognito_sub" text NOT NULL REFERENCES "user_identities"("cognito_sub"),
  "role" text NOT NULL DEFAULT 'member',
  "status" text NOT NULL DEFAULT 'active',
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_memberships_role_check" CHECK ("role" IN ('owner', 'admin', 'member')),
  CONSTRAINT "tenant_memberships_status_check" CHECK ("status" IN ('active', 'revoked'))
);

INSERT INTO "tenant_memberships" (
  "id", "tenant_id", "cognito_sub", "role", "status",
  "is_default", "created_at", "updated_at"
)
SELECT DISTINCT ON (store."tenant_id", membership."cognito_sub")
  md5(store."tenant_id" || ':' || membership."cognito_sub"),
  store."tenant_id",
  membership."cognito_sub",
  CASE
    WHEN role."name" = 'Propietario' THEN 'owner'
    WHEN role."name" = 'Administrador' THEN 'admin'
    ELSE 'member'
  END,
  CASE WHEN membership."status" = 'activo' THEN 'active' ELSE 'revoked' END,
  membership."is_default",
  membership."created_at",
  membership."updated_at"
FROM "user_roles" membership
JOIN "stores" store ON store."id" = membership."store_id"
JOIN "role_definitions" role ON role."id" = membership."role_id"
ORDER BY
  store."tenant_id",
  membership."cognito_sub",
  membership."is_default" DESC,
  membership."updated_at" DESC
ON CONFLICT ("id") DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_memberships_tenant_user_unique_idx"
  ON "tenant_memberships" ("tenant_id", "cognito_sub");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_memberships_single_default_idx"
  ON "tenant_memberships" ("cognito_sub") WHERE "is_default" = true;
CREATE INDEX IF NOT EXISTS "tenant_memberships_user_status_idx"
  ON "tenant_memberships" ("cognito_sub", "status");
CREATE INDEX IF NOT EXISTS "tenant_memberships_tenant_status_idx"
  ON "tenant_memberships" ("tenant_id", "status");
