CREATE TABLE "delivery_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"provider" text NOT NULL,
	"store_id" text DEFAULT 'main' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"customer_address" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"delivery_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"payment_method" text DEFAULT 'online' NOT NULL,
	"estimated_prep_minutes" integer,
	"notes" text,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cancellation_reason" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"cancelled_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_provider_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"store_id" text DEFAULT 'main' NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"access_token_enc" text,
	"webhook_secret_enc" text,
	"provider_store_id" text DEFAULT '' NOT NULL,
	"environment" text DEFAULT 'sandbox' NOT NULL,
	"connected_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_provider_connections" ADD CONSTRAINT "delivery_provider_connections_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "do_store_idx" ON "delivery_orders" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "do_provider_idx" ON "delivery_orders" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "do_status_idx" ON "delivery_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "do_received_at_idx" ON "delivery_orders" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "do_provider_external_idx" ON "delivery_orders" USING btree ("provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dpc_provider_store_idx" ON "delivery_provider_connections" USING btree ("provider","store_id");--> statement-breakpoint
CREATE INDEX "dpc_status_idx" ON "delivery_provider_connections" USING btree ("status");