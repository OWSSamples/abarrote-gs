CREATE TABLE IF NOT EXISTS "store_plugins" (
  "id" text PRIMARY KEY NOT NULL,
  "store_id" text NOT NULL,
  "plugin_id" text NOT NULL,
  "category" text NOT NULL,
  "status" text DEFAULT 'installed' NOT NULL,
  "provider_id" text,
  "installed_by" text,
  "installed_at" timestamp DEFAULT now() NOT NULL,
  "configured_at" timestamp,
  "disabled_at" timestamp,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "store_plugins_store_id_stores_id_fk"
    FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "store_plugins_store_plugin_unique_idx"
  ON "store_plugins" USING btree ("store_id","plugin_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_plugins_store_idx"
  ON "store_plugins" USING btree ("store_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_plugins_category_idx"
  ON "store_plugins" USING btree ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_plugins_status_idx"
  ON "store_plugins" USING btree ("status");
