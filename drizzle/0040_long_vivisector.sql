CREATE TABLE "uber_integrations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"uber_store_id" varchar NOT NULL,
	"uber_store_name" varchar,
	"status" varchar NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text,
	"expires_at" timestamp,
	"environment" varchar DEFAULT 'production' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uber_integrations_workspace_id_uber_store_id_environment_unique" UNIQUE("workspace_id","uber_store_id","environment")
);
--> statement-breakpoint
CREATE TABLE "uber_oauth_states" (
	"state_hash" varchar PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uber_webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_event_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"uber_store_id" varchar,
	"payload" jsonb NOT NULL,
	"status" varchar DEFAULT 'PENDING' NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	CONSTRAINT "uber_webhook_events_external_event_id_unique" UNIQUE("external_event_id")
);
