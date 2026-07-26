ALTER TABLE "uber_oauth_states" ALTER COLUMN "workspace_id" TYPE text USING "workspace_id"::text;
--> statement-breakpoint
ALTER TABLE "uber_oauth_states" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
--> statement-breakpoint
ALTER TABLE "uber_oauth_states" ADD COLUMN "store_id" text NOT NULL DEFAULT 'main';
