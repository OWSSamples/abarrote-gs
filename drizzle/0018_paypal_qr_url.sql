CREATE TABLE "cfdi_records" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"folio" text NOT NULL,
	"uuid" text DEFAULT '' NOT NULL,
	"receptor_rfc" text NOT NULL,
	"receptor_nombre" text NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"xml_url" text DEFAULT '' NOT NULL,
	"pdf_url" text DEFAULT '' NOT NULL,
	"cancel_ack_url" text DEFAULT '' NOT NULL,
	"cancel_reason" text,
	"cancel_related_uuid" text,
	"fecha_timbrado" text,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merma_records" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "merma_records" ADD COLUMN "evidence_url" text;--> statement-breakpoint
ALTER TABLE "servicios" ADD COLUMN "provider_id" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "servicios" ADD COLUMN "provider_transaction_id" text;--> statement-breakpoint
ALTER TABLE "servicios" ADD COLUMN "provider_auth_code" text;--> statement-breakpoint
ALTER TABLE "servicios" ADD COLUMN "provider_error" text;--> statement-breakpoint
ALTER TABLE "servicios" ADD COLUMN "provider_responded_at" timestamp;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "paypal_qr_url" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "servicios_provider" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "servicios_api_key" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "servicios_api_secret" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "servicios_sandbox" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "loyalty_expiration_days" integer DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "exchange_rate_usd_mxn" numeric(10, 4) DEFAULT '17.5' NOT NULL;--> statement-breakpoint
CREATE INDEX "cfdi_sale_id_idx" ON "cfdi_records" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "cfdi_uuid_idx" ON "cfdi_records" USING btree ("uuid");--> statement-breakpoint
CREATE INDEX "cfdi_receptor_rfc_idx" ON "cfdi_records" USING btree ("receptor_rfc");--> statement-breakpoint
CREATE INDEX "cfdi_status_idx" ON "cfdi_records" USING btree ("status");