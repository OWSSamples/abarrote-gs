CREATE TABLE "ai_provider_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"api_key_enc" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"selected_model" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_config" ALTER COLUMN "store_name" SET DEFAULT 'MI TIENDA';--> statement-breakpoint
ALTER TABLE "store_config" ALTER COLUMN "legal_name" SET DEFAULT 'MI TIENDA S DE RL DE CV';--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_provider" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_environment" text DEFAULT 'sandbox' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_auth_type" text DEFAULT 'basic' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_api_url" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_api_key" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_api_secret" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "cfdi_pac_cancel_path" text DEFAULT '/cancel' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_from" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_from_name" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_reply_to" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_recipients" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_accent_color" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_ticket_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_daily_report_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_weekly_report_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_stock_alert_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_refund_alert_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_expense_alert_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_security_alert_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_daily_report_time" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_weekly_report_day" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_weekly_report_time" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_footer_text" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_signature" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_cc_recipients" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_bcc_recipients" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_subject_prefix" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_digest_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_digest_interval_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_max_alerts_per_hour" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_auto_retry" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_max_retries" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_attach_pdf_ticket" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_attach_excel_report" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_monthly_report_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "email_monthly_report_day" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "ai_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "ai_provider" text DEFAULT 'openrouter' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "ai_api_key_enc" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "ai_model" text DEFAULT 'nvidia/nemotron-3-super:free' NOT NULL;