CREATE TABLE "mfa_recovery_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"cognito_sub" text NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp,
	"used_ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_administrators" (
	"cognito_sub" text PRIMARY KEY NOT NULL,
	"role" text DEFAULT 'platform_admin' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_administrators_role_check" CHECK ("platform_administrators"."role" = 'platform_admin'),
	CONSTRAINT "platform_administrators_status_check" CHECK ("platform_administrators"."status" IN ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"direction" text NOT NULL,
	"balance_after" integer NOT NULL,
	"unit_cost" numeric(10, 2),
	"total_value" numeric(10, 2),
	"source" text,
	"source_id" text,
	"source_label" text,
	"notes" text DEFAULT '' NOT NULL,
	"user_id" text,
	"user_name" text,
	"store_id" text DEFAULT 'main' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"suspended_at" timestamp,
	"archived_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "stores_status_check" CHECK ("stores"."status" IN ('active', 'suspended', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "tenant_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"kind" text NOT NULL,
	"resource_id" text,
	"object_key" text NOT NULL,
	"public_url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum_sha256" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_assets_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "tenant_assets_kind_check" CHECK ("tenant_assets"."kind" IN ('products', 'avatars', 'logos', 'receipts', 'evidence', 'promo', 'display')),
	CONSTRAINT "tenant_assets_size_check" CHECK ("tenant_assets"."size_bytes" > 0 AND "tenant_assets"."size_bytes" <= 5242880)
);
--> statement-breakpoint
CREATE TABLE "tenant_billing_entitlements" (
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"value" integer NOT NULL,
	"expires_at" timestamp,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_billing_entitlements_pk" PRIMARY KEY("tenant_id","code"),
	CONSTRAINT "tenant_billing_entitlements_code_check" CHECK ("tenant_billing_entitlements"."code" ~ '^[a-z][a-z0-9_]{0,63}$'),
	CONSTRAINT "tenant_billing_entitlements_value_check" CHECK ("tenant_billing_entitlements"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tenant_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"email" text NOT NULL,
	"role_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" text NOT NULL,
	"accepted_by" text,
	"accepted_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "tenant_invitations_status_check" CHECK ("tenant_invitations"."status" IN ('pending', 'accepted', 'revoked', 'expired')),
	CONSTRAINT "tenant_invitations_acceptance_check" CHECK ("tenant_invitations"."status" <> 'accepted' OR ("tenant_invitations"."accepted_by" IS NOT NULL AND "tenant_invitations"."accepted_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "tenant_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"cognito_sub" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_memberships_role_check" CHECK ("tenant_memberships"."role" IN ('owner', 'admin', 'member')),
	CONSTRAINT "tenant_memberships_status_check" CHECK ("tenant_memberships"."status" IN ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "tenant_sequences" (
	"store_id" text NOT NULL,
	"key" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_sequences_pk" PRIMARY KEY("store_id","key"),
	CONSTRAINT "tenant_sequences_value_check" CHECK ("tenant_sequences"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"suspended_at" timestamp,
	"archived_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "tenants_id_format_check" CHECK ("tenants"."id" ~ '^[0-9a-f]{32}$'),
	CONSTRAINT "tenants_status_check" CHECK ("tenants"."status" IN ('active', 'suspended', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"cognito_sub" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"avatar_url" text DEFAULT '' NOT NULL,
	"global_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"mfa_notice_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_identities_global_id_unique" UNIQUE("global_id"),
	CONSTRAINT "user_identities_status_check" CHECK ("user_identities"."status" IN ('active', 'disabled'))
);
--> statement-breakpoint
CREATE TABLE "user_store_access" (
	"user_id" text NOT NULL,
	"store_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_store_access_pk" PRIMARY KEY("user_id","store_id")
);
--> statement-breakpoint
ALTER TABLE "user_roles" RENAME COLUMN "firebase_uid" TO "mfa_notice_at";--> statement-breakpoint
ALTER TABLE "mercadopago_payments" DROP CONSTRAINT "mercadopago_payments_payment_id_unique";--> statement-breakpoint
ALTER TABLE "mercadopago_refunds" DROP CONSTRAINT "mercadopago_refunds_mp_refund_id_unique";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_sku_unique";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_barcode_unique";--> statement-breakpoint
ALTER TABLE "sale_records" DROP CONSTRAINT "sale_records_folio_unique";--> statement-breakpoint
ALTER TABLE "servicios" DROP CONSTRAINT "servicios_folio_unique";--> statement-breakpoint
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_global_id_unique";--> statement-breakpoint
DROP INDEX "audit_logs_user_id_idx";--> statement-breakpoint
DROP INDEX "audit_logs_entity_idx";--> statement-breakpoint
DROP INDEX "audit_logs_timestamp_idx";--> statement-breakpoint
DROP INDEX "cfdi_sale_id_idx";--> statement-breakpoint
DROP INDEX "cfdi_receptor_rfc_idx";--> statement-breakpoint
DROP INDEX "cfdi_status_idx";--> statement-breakpoint
DROP INDEX "mp_payments_sale_id_idx";--> statement-breakpoint
DROP INDEX "mp_payments_status_idx";--> statement-breakpoint
DROP INDEX "mp_payments_external_ref_idx";--> statement-breakpoint
DROP INDEX "mp_refunds_sale_id_idx";--> statement-breakpoint
DROP INDEX "mp_refunds_payment_id_idx";--> statement-breakpoint
DROP INDEX "pc_provider_charge_idx";--> statement-breakpoint
DROP INDEX "pc_sale_idx";--> statement-breakpoint
DROP INDEX "pc_status_idx";--> statement-breakpoint
DROP INDEX "pc_reference_idx";--> statement-breakpoint
DROP INDEX "user_roles_firebase_uid_idx";--> statement-breakpoint
DROP INDEX "ppc_provider_store_idx";--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'ai_provider_configs'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "ai_provider_configs" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_store_provider_pk" PRIMARY KEY("store_id","id");--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "cfdi_records" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "cortes_caja" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "devolucion_items" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "fiado_items" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "fiado_transactions" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "gastos" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_audit_items" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_audits" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "mercadopago_payments" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "mercadopago_refunds" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "merma_records" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_categories" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "proveedores" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "role_definitions" ADD COLUMN "store_id" text;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_records" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "servicios" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "country" text DEFAULT 'MX' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "business_type" text DEFAULT 'abarrotes' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "business_type_other" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "estimated_users" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_config" ADD COLUMN "telegram_webhook_secret" text;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "cognito_sub" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "store_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_administrators" ADD CONSTRAINT "platform_administrators_cognito_sub_user_identities_cognito_sub_fk" FOREIGN KEY ("cognito_sub") REFERENCES "public"."user_identities"("cognito_sub") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_product_fk" FOREIGN KEY ("store_id","product_id") REFERENCES "public"."products"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_assets" ADD CONSTRAINT "tenant_assets_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_billing_entitlements" ADD CONSTRAINT "tenant_billing_entitlements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_role_id_role_definitions_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_cognito_sub_user_identities_cognito_sub_fk" FOREIGN KEY ("cognito_sub") REFERENCES "public"."user_identities"("cognito_sub") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_sequences" ADD CONSTRAINT "tenant_sequences_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_store_access" ADD CONSTRAINT "user_store_access_user_id_user_identities_cognito_sub_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_identities"("cognito_sub") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_store_access" ADD CONSTRAINT "user_store_access_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mfa_recovery_codes_sub_idx" ON "mfa_recovery_codes" USING btree ("cognito_sub");--> statement-breakpoint
CREATE INDEX "mfa_recovery_codes_email_idx" ON "mfa_recovery_codes" USING btree ("email");--> statement-breakpoint
CREATE INDEX "mfa_recovery_codes_hash_idx" ON "mfa_recovery_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "platform_administrators_status_idx" ON "platform_administrators" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stock_movements_product_id_idx" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_product_created_idx" ON "stock_movements" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_store_product_created_idx" ON "stock_movements" USING btree ("store_id","product_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_type_idx" ON "stock_movements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "stock_movements_store_idx" ON "stock_movements" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "stores_tenant_idx" ON "stores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "stores_tenant_status_idx" ON "stores" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_active_name_unique_idx" ON "stores" USING btree (lower("name")) WHERE "stores"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tenant_assets_store_kind_idx" ON "tenant_assets" USING btree ("store_id","kind");--> statement-breakpoint
CREATE INDEX "tenant_assets_store_resource_idx" ON "tenant_assets" USING btree ("store_id","resource_id");--> statement-breakpoint
CREATE INDEX "tenant_billing_entitlements_expiry_idx" ON "tenant_billing_entitlements" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_invitations_pending_email_unique_idx" ON "tenant_invitations" USING btree ("store_id",lower("email")) WHERE "tenant_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "tenant_invitations_store_status_idx" ON "tenant_invitations" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "tenant_invitations_expiry_idx" ON "tenant_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_memberships_tenant_user_unique_idx" ON "tenant_memberships" USING btree ("tenant_id","cognito_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_memberships_single_default_idx" ON "tenant_memberships" USING btree ("cognito_sub") WHERE "tenant_memberships"."is_default" = true;--> statement-breakpoint
CREATE INDEX "tenant_memberships_user_status_idx" ON "tenant_memberships" USING btree ("cognito_sub","status");--> statement-breakpoint
CREATE INDEX "tenant_memberships_tenant_status_idx" ON "tenant_memberships" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "tenant_sequences_store_idx" ON "tenant_sequences" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "tenants_status_idx" ON "tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_identities_email_idx" ON "user_identities" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "user_identities_status_idx" ON "user_identities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_store_access_user_idx" ON "user_store_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_store_access_store_idx" ON "user_store_access" USING btree ("store_id");--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_store_id_store_config_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_store_corte_fk" FOREIGN KEY ("store_id","corte_id") REFERENCES "public"."cortes_caja"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfdi_records" ADD CONSTRAINT "cfdi_records_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfdi_records" ADD CONSTRAINT "cfdi_records_store_sale_fk" FOREIGN KEY ("store_id","sale_id") REFERENCES "public"."sale_records"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cortes_caja" ADD CONSTRAINT "cortes_caja_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devolucion_items" ADD CONSTRAINT "devolucion_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devolucion_items" ADD CONSTRAINT "devolucion_items_store_devolucion_fk" FOREIGN KEY ("store_id","devolucion_id") REFERENCES "public"."devoluciones"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devolucion_items" ADD CONSTRAINT "devolucion_items_store_product_fk" FOREIGN KEY ("store_id","product_id") REFERENCES "public"."products"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_store_sale_fk" FOREIGN KEY ("store_id","sale_id") REFERENCES "public"."sale_records"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_store_cliente_fk" FOREIGN KEY ("store_id","cliente_id") REFERENCES "public"."clientes"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiado_items" ADD CONSTRAINT "fiado_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiado_items" ADD CONSTRAINT "fiado_items_store_fiado_fk" FOREIGN KEY ("store_id","fiado_id") REFERENCES "public"."fiado_transactions"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiado_items" ADD CONSTRAINT "fiado_items_store_product_fk" FOREIGN KEY ("store_id","product_id") REFERENCES "public"."products"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiado_transactions" ADD CONSTRAINT "fiado_transactions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiado_transactions" ADD CONSTRAINT "fiado_transactions_store_cliente_fk" FOREIGN KEY ("store_id","cliente_id") REFERENCES "public"."clientes"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiado_transactions" ADD CONSTRAINT "fiado_transactions_store_sale_folio_fk" FOREIGN KEY ("store_id","sale_folio") REFERENCES "public"."sale_records"("store_id","folio") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_items" ADD CONSTRAINT "inventory_audit_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_items" ADD CONSTRAINT "inventory_audit_items_store_audit_fk" FOREIGN KEY ("store_id","audit_id") REFERENCES "public"."inventory_audits"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_items" ADD CONSTRAINT "inventory_audit_items_store_product_fk" FOREIGN KEY ("store_id","product_id") REFERENCES "public"."products"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_store_cliente_fk" FOREIGN KEY ("store_id","cliente_id") REFERENCES "public"."clientes"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_store_sale_fk" FOREIGN KEY ("store_id","sale_id") REFERENCES "public"."sale_records"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mercadopago_payments" ADD CONSTRAINT "mercadopago_payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mercadopago_payments" ADD CONSTRAINT "mp_payments_store_sale_fk" FOREIGN KEY ("store_id","sale_id") REFERENCES "public"."sale_records"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mercadopago_refunds" ADD CONSTRAINT "mercadopago_refunds_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mercadopago_refunds" ADD CONSTRAINT "mp_refunds_store_sale_fk" FOREIGN KEY ("store_id","sale_id") REFERENCES "public"."sale_records"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mercadopago_refunds" ADD CONSTRAINT "mp_refunds_store_payment_fk" FOREIGN KEY ("store_id","mp_payment_id") REFERENCES "public"."mercadopago_payments"("store_id","payment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merma_records" ADD CONSTRAINT "merma_records_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merma_records" ADD CONSTRAINT "merma_records_store_product_fk" FOREIGN KEY ("store_id","product_id") REFERENCES "public"."products"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_store_id_store_config_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_charges" ADD CONSTRAINT "payment_charges_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_charges" ADD CONSTRAINT "payment_charges_store_sale_fk" FOREIGN KEY ("store_id","sale_id") REFERENCES "public"."sale_records"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_store_pedido_fk" FOREIGN KEY ("store_id","pedido_id") REFERENCES "public"."pedidos"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_store_product_fk" FOREIGN KEY ("store_id","product_id") REFERENCES "public"."products"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_category_fk" FOREIGN KEY ("store_id","category") REFERENCES "public"."product_categories"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_definitions" ADD CONSTRAINT "role_definitions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_store_sale_fk" FOREIGN KEY ("store_id","sale_id") REFERENCES "public"."sale_records"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_store_product_fk" FOREIGN KEY ("store_id","product_id") REFERENCES "public"."products"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_records" ADD CONSTRAINT "sale_records_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_config" ADD CONSTRAINT "store_config_id_stores_id_fk" FOREIGN KEY ("id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_cognito_sub_user_identities_cognito_sub_fk" FOREIGN KEY ("cognito_sub") REFERENCES "public"."user_identities"("cognito_sub") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_provider_configs_store_idx" ON "ai_provider_configs" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "audit_logs_store_user_idx" ON "audit_logs" USING btree ("store_id","user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_store_entity_idx" ON "audit_logs" USING btree ("store_id","entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_store_timestamp_idx" ON "audit_logs" USING btree ("store_id","timestamp");--> statement-breakpoint
CREATE INDEX "cash_movements_store_idx" ON "cash_movements" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "cash_movements_store_fecha_idx" ON "cash_movements" USING btree ("store_id","fecha");--> statement-breakpoint
CREATE INDEX "cash_movements_store_corte_idx" ON "cash_movements" USING btree ("store_id","corte_id");--> statement-breakpoint
CREATE INDEX "cfdi_store_idx" ON "cfdi_records" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "cfdi_store_sale_idx" ON "cfdi_records" USING btree ("store_id","sale_id");--> statement-breakpoint
CREATE INDEX "cfdi_store_receptor_rfc_idx" ON "cfdi_records" USING btree ("store_id","receptor_rfc");--> statement-breakpoint
CREATE INDEX "cfdi_store_status_idx" ON "cfdi_records" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "clientes_store_idx" ON "clientes" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "clientes_store_name_idx" ON "clientes" USING btree ("store_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_store_id_unique_idx" ON "clientes" USING btree ("store_id","id");--> statement-breakpoint
CREATE INDEX "cortes_caja_store_idx" ON "cortes_caja" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cortes_caja_store_id_unique_idx" ON "cortes_caja" USING btree ("store_id","id");--> statement-breakpoint
CREATE INDEX "devolucion_items_store_idx" ON "devolucion_items" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "devolucion_items_store_devolucion_idx" ON "devolucion_items" USING btree ("store_id","devolucion_id");--> statement-breakpoint
CREATE INDEX "devolucion_items_store_product_idx" ON "devolucion_items" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "devoluciones_store_idx" ON "devoluciones" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devoluciones_store_id_unique_idx" ON "devoluciones" USING btree ("store_id","id");--> statement-breakpoint
CREATE INDEX "fiado_items_store_idx" ON "fiado_items" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "fiado_items_store_fiado_idx" ON "fiado_items" USING btree ("store_id","fiado_id");--> statement-breakpoint
CREATE INDEX "fiado_items_store_product_idx" ON "fiado_items" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "fiado_transactions_store_idx" ON "fiado_transactions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "fiado_transactions_store_date_idx" ON "fiado_transactions" USING btree ("store_id","date");--> statement-breakpoint
CREATE INDEX "fiado_transactions_store_cliente_date_idx" ON "fiado_transactions" USING btree ("store_id","cliente_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "fiado_transactions_store_id_unique_idx" ON "fiado_transactions" USING btree ("store_id","id");--> statement-breakpoint
CREATE INDEX "gastos_store_idx" ON "gastos" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "inventory_audit_items_store_idx" ON "inventory_audit_items" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "inventory_audit_items_store_audit_idx" ON "inventory_audit_items" USING btree ("store_id","audit_id");--> statement-breakpoint
CREATE INDEX "inventory_audit_items_store_product_idx" ON "inventory_audit_items" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "inventory_audits_store_idx" ON "inventory_audits" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_audits_store_id_unique_idx" ON "inventory_audits" USING btree ("store_id","id");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_store_idx" ON "loyalty_transactions" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mp_payments_store_payment_id_unique_idx" ON "mercadopago_payments" USING btree ("store_id","payment_id");--> statement-breakpoint
CREATE INDEX "mp_payments_store_sale_idx" ON "mercadopago_payments" USING btree ("store_id","sale_id");--> statement-breakpoint
CREATE INDEX "mp_payments_store_status_idx" ON "mercadopago_payments" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "mp_payments_store_external_ref_idx" ON "mercadopago_payments" USING btree ("store_id","external_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "mp_refunds_store_refund_id_unique_idx" ON "mercadopago_refunds" USING btree ("store_id","mp_refund_id");--> statement-breakpoint
CREATE INDEX "mp_refunds_store_sale_idx" ON "mercadopago_refunds" USING btree ("store_id","sale_id");--> statement-breakpoint
CREATE INDEX "mp_refunds_store_payment_idx" ON "mercadopago_refunds" USING btree ("store_id","mp_payment_id");--> statement-breakpoint
CREATE INDEX "merma_records_store_idx" ON "merma_records" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "oauth_states_store_idx" ON "oauth_states" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pc_store_provider_charge_unique_idx" ON "payment_charges" USING btree ("store_id","provider","provider_charge_id");--> statement-breakpoint
CREATE INDEX "pc_store_sale_idx" ON "payment_charges" USING btree ("store_id","sale_id");--> statement-breakpoint
CREATE INDEX "pc_store_status_idx" ON "payment_charges" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "pc_store_reference_idx" ON "payment_charges" USING btree ("store_id","reference_number");--> statement-breakpoint
CREATE INDEX "pedido_items_store_idx" ON "pedido_items" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "pedido_items_store_pedido_idx" ON "pedido_items" USING btree ("store_id","pedido_id");--> statement-breakpoint
CREATE INDEX "pedido_items_store_product_idx" ON "pedido_items" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "pedidos_store_idx" ON "pedidos" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "pedidos_store_fecha_idx" ON "pedidos" USING btree ("store_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_store_id_unique_idx" ON "pedidos" USING btree ("store_id","id");--> statement-breakpoint
CREATE INDEX "product_categories_store_idx" ON "product_categories" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_store_id_unique_idx" ON "product_categories" USING btree ("store_id","id");--> statement-breakpoint
CREATE INDEX "products_store_idx" ON "products" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "products_store_category_idx" ON "products" USING btree ("store_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_sku_unique_idx" ON "products" USING btree ("store_id","sku") WHERE "products"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_barcode_unique_idx" ON "products" USING btree ("store_id","barcode") WHERE "products"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_id_unique_idx" ON "products" USING btree ("store_id","id");--> statement-breakpoint
CREATE INDEX "promotions_store_idx" ON "promotions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "proveedores_store_idx" ON "proveedores" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "role_definitions_store_idx" ON "role_definitions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "sale_items_store_idx" ON "sale_items" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "sale_items_store_sale_idx" ON "sale_items" USING btree ("store_id","sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_store_product_idx" ON "sale_items" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "sale_records_store_idx" ON "sale_records" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "sale_records_store_date_idx" ON "sale_records" USING btree ("store_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_records_store_folio_unique_idx" ON "sale_records" USING btree ("store_id","folio");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_records_store_id_unique_idx" ON "sale_records" USING btree ("store_id","id");--> statement-breakpoint
CREATE INDEX "servicios_store_idx" ON "servicios" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "servicios_store_fecha_idx" ON "servicios" USING btree ("store_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "servicios_store_folio_unique_idx" ON "servicios" USING btree ("store_id","folio");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_cognito_store_unique_idx" ON "user_roles" USING btree ("cognito_sub","store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_single_default_idx" ON "user_roles" USING btree ("cognito_sub") WHERE "user_roles"."is_default" = true;--> statement-breakpoint
CREATE INDEX "user_roles_cognito_sub_idx" ON "user_roles" USING btree ("cognito_sub");--> statement-breakpoint
CREATE INDEX "user_roles_store_idx" ON "user_roles" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "user_roles_store_status_idx" ON "user_roles" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "user_roles_active_cognito_idx" ON "user_roles" USING btree ("cognito_sub") WHERE "user_roles"."status" = 'activo';--> statement-breakpoint
CREATE UNIQUE INDEX "ppc_provider_store_idx" ON "payment_provider_connections" USING btree ("provider","store_id");--> statement-breakpoint
ALTER TABLE "role_definitions" ADD CONSTRAINT "role_definitions_scope_check" CHECK (("role_definitions"."is_system" = true AND "role_definitions"."store_id" IS NULL) OR ("role_definitions"."is_system" = false AND "role_definitions"."store_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_status_check" CHECK ("user_roles"."status" IN ('activo', 'baja'));