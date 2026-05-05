-- Rename Firebase legacy column/index to Cognito-aligned names.
-- The values stored were already Cognito `sub` claims; this is purely a
-- naming change. ALTER TABLE ... RENAME COLUMN is atomic in PostgreSQL
-- and does not rewrite the table or take exclusive locks beyond the
-- catalog update.

ALTER TABLE "user_roles" RENAME COLUMN "firebase_uid" TO "cognito_sub";--> statement-breakpoint
ALTER INDEX "user_roles_firebase_uid_idx" RENAME TO "user_roles_cognito_sub_idx";
