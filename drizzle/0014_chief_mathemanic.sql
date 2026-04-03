ALTER TABLE "store_config" ADD COLUMN "customer_display_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "customer_display_welcome" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "customer_display_farewell" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "customer_display_promo_text" text;