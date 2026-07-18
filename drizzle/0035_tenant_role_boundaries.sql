-- Enforce tenant role boundaries at the database layer. Application guards
-- remain the first authorization layer; these constraints prevent a future
-- unscoped write from linking a tenant to another tenant's custom role.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "role_definitions"
    WHERE ("is_system" = true AND "store_id" IS NOT NULL)
       OR ("is_system" = false AND "store_id" IS NULL)
  ) THEN
    RAISE EXCEPTION 'Role definitions with an invalid tenant scope must be reconciled before migration 0035';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_roles" membership
    JOIN "role_definitions" role ON role."id" = membership."role_id"
    WHERE role."is_system" = false
      AND role."store_id" IS DISTINCT FROM membership."store_id"
  ) THEN
    RAISE EXCEPTION 'Cross-tenant user role assignments must be reconciled before migration 0035';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "tenant_invitations" invitation
    JOIN "role_definitions" role ON role."id" = invitation."role_id"
    WHERE role."is_system" = false
      AND role."store_id" IS DISTINCT FROM invitation."store_id"
  ) THEN
    RAISE EXCEPTION 'Cross-tenant invitation roles must be reconciled before migration 0035';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'role_definitions_scope_check'
  ) THEN
    ALTER TABLE "role_definitions"
      ADD CONSTRAINT "role_definitions_scope_check"
      CHECK (
        ("is_system" = true AND "store_id" IS NULL)
        OR ("is_system" = false AND "store_id" IS NOT NULL)
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION app_role_is_available_in_tenant(target_role_id text, target_store_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "role_definitions" role
    WHERE role."id" = target_role_id
      AND (role."is_system" = true OR role."store_id" = target_store_id)
  )
$$;

CREATE OR REPLACE FUNCTION enforce_tenant_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT app_role_is_available_in_tenant(NEW."role_id", NEW."store_id") THEN
    RAISE EXCEPTION 'Role % is not available in tenant %', NEW."role_id", NEW."store_id"
      USING ERRCODE = '23514', CONSTRAINT = TG_ARGV[0];
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION enforce_role_definition_scope_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."is_system" = false AND EXISTS (
    SELECT 1
    FROM "user_roles" membership
    WHERE membership."role_id" = NEW."id"
      AND membership."store_id" IS DISTINCT FROM NEW."store_id"
  ) THEN
    RAISE EXCEPTION 'Role % is assigned to a different tenant', NEW."id"
      USING ERRCODE = '23514', CONSTRAINT = 'user_roles_role_tenant_scope';
  END IF;

  IF NEW."is_system" = false AND EXISTS (
    SELECT 1
    FROM "tenant_invitations" invitation
    WHERE invitation."role_id" = NEW."id"
      AND invitation."store_id" IS DISTINCT FROM NEW."store_id"
  ) THEN
    RAISE EXCEPTION 'Role % is used by an invitation from a different tenant', NEW."id"
      USING ERRCODE = '23514', CONSTRAINT = 'tenant_invitations_role_tenant_scope';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION enforce_single_active_tenant_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  new_role_name text;
BEGIN
  IF NEW."status" <> 'activo' THEN
    RETURN NEW;
  END IF;

  SELECT "name" INTO new_role_name
  FROM "role_definitions"
  WHERE "id" = NEW."role_id";

  IF new_role_name <> 'Propietario' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('tenant-owner:' || NEW."store_id"));
  IF EXISTS (
    SELECT 1
    FROM "user_roles" membership
    JOIN "role_definitions" role ON role."id" = membership."role_id"
    WHERE membership."store_id" = NEW."store_id"
      AND membership."status" = 'activo'
      AND role."name" = 'Propietario'
      AND membership."id" <> NEW."id"
  ) THEN
    RAISE EXCEPTION 'A tenant can only have one active owner'
      USING ERRCODE = '23505', CONSTRAINT = 'user_roles_single_active_owner';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "user_roles_role_tenant_scope" ON "user_roles";
CREATE TRIGGER "user_roles_role_tenant_scope"
BEFORE INSERT OR UPDATE OF "role_id", "store_id" ON "user_roles"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_role_assignment('user_roles_role_tenant_scope');

-- Supersedes the equivalent trigger introduced by migration 0032.
DROP TRIGGER IF EXISTS "tenant_membership_role_scope_trigger" ON "user_roles";
DROP FUNCTION IF EXISTS validate_tenant_membership_role_scope();

DROP TRIGGER IF EXISTS "tenant_invitations_role_tenant_scope" ON "tenant_invitations";
CREATE TRIGGER "tenant_invitations_role_tenant_scope"
BEFORE INSERT OR UPDATE OF "role_id", "store_id" ON "tenant_invitations"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_role_assignment('tenant_invitations_role_tenant_scope');

DROP TRIGGER IF EXISTS "role_definitions_scope_change" ON "role_definitions";
CREATE TRIGGER "role_definitions_scope_change"
BEFORE UPDATE OF "is_system", "store_id" ON "role_definitions"
FOR EACH ROW EXECUTE FUNCTION enforce_role_definition_scope_change();

DROP TRIGGER IF EXISTS "user_roles_single_active_owner" ON "user_roles";
CREATE TRIGGER "user_roles_single_active_owner"
BEFORE INSERT OR UPDATE OF "role_id", "status", "store_id" ON "user_roles"
FOR EACH ROW EXECUTE FUNCTION enforce_single_active_tenant_owner();
