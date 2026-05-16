-- 0027_mfa_recovery_codes.sql
-- One-time-use recovery codes for users with TOTP MFA enabled.

CREATE TABLE IF NOT EXISTS "mfa_recovery_codes" (
  "id" text PRIMARY KEY NOT NULL,
  "cognito_sub" text NOT NULL,
  "email" text NOT NULL,
  "code_hash" text NOT NULL,
  "used_at" timestamp,
  "used_ip" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "mfa_recovery_codes_sub_idx"
  ON "mfa_recovery_codes" ("cognito_sub");

CREATE INDEX IF NOT EXISTS "mfa_recovery_codes_email_idx"
  ON "mfa_recovery_codes" ("email");

CREATE INDEX IF NOT EXISTS "mfa_recovery_codes_hash_idx"
  ON "mfa_recovery_codes" ("code_hash");
