-- Rename Firebase legacy column/index to Cognito-aligned names.
-- The values stored were already Cognito `sub` claims; this is purely a
-- naming change. ALTER TABLE ... RENAME COLUMN is atomic in PostgreSQL
-- and does not rewrite the table or take exclusive locks beyond the
-- catalog update.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
      AND column_name = 'firebase_uid'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
      AND column_name = 'cognito_sub'
  ) THEN
    ALTER TABLE "user_roles" RENAME COLUMN "firebase_uid" TO "cognito_sub";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'user_roles_firebase_uid_idx')
    AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'user_roles_cognito_sub_idx')
  THEN
    ALTER INDEX "user_roles_firebase_uid_idx" RENAME TO "user_roles_cognito_sub_idx";
  END IF;
END $$;
