CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"changes" text DEFAULT '{}' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"credit_limit" numeric(10, 2) DEFAULT '0' NOT NULL,
	"points" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_transaction" timestamp
);
--> statement-breakpoint
CREATE TABLE "cortes_caja" (
	"id" text PRIMARY KEY NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"cajero" text NOT NULL,
	"ventas_efectivo" numeric(10, 2) NOT NULL,
	"ventas_tarjeta" numeric(10, 2) NOT NULL,
	"ventas_transferencia" numeric(10, 2) NOT NULL,
	"ventas_fiado" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_ventas" numeric(10, 2) NOT NULL,
	"total_transacciones" integer NOT NULL,
	"efectivo_esperado" numeric(10, 2) NOT NULL,
	"efectivo_contado" numeric(10, 2) NOT NULL,
	"diferencia" numeric(10, 2) NOT NULL,
	"fondo_inicial" numeric(10, 2) NOT NULL,
	"gastos_del_dia" numeric(10, 2) NOT NULL,
	"notas" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'abierto' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiado_items" (
	"id" text PRIMARY KEY NOT NULL,
	"fiado_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"sku" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiado_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"cliente_id" text NOT NULL,
	"cliente_name" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sale_folio" text,
	"date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gastos" (
	"id" text PRIMARY KEY NOT NULL,
	"concepto" text NOT NULL,
	"categoria" text NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"notas" text DEFAULT '' NOT NULL,
	"comprobante" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_audit_items" (
	"id" text PRIMARY KEY NOT NULL,
	"audit_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"expected_stock" integer NOT NULL,
	"counted_stock" integer NOT NULL,
	"difference" integer NOT NULL,
	"adjustment_value" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_audits" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"auditor" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merma_records" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"value" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedido_items" (
	"id" text PRIMARY KEY NOT NULL,
	"pedido_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"cantidad" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" text PRIMARY KEY NOT NULL,
	"proveedor" text NOT NULL,
	"notas" text DEFAULT '' NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"barcode" text NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"expiration_date" date,
	"category" text NOT NULL,
	"cost_price" numeric(10, 2) NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"is_perishable" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "proveedores" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"contacto" text DEFAULT '' NOT NULL,
	"telefono" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"direccion" text DEFAULT '' NOT NULL,
	"categorias" text[] DEFAULT '{}' NOT NULL,
	"notas" text DEFAULT '' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"ultimo_pedido" timestamp
);
--> statement-breakpoint
CREATE TABLE "role_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"permissions" text DEFAULT '[]' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"sku" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_records" (
	"id" text PRIMARY KEY NOT NULL,
	"folio" text NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"iva" numeric(10, 2) NOT NULL,
	"card_surcharge" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"amount_paid" numeric(10, 2) NOT NULL,
	"change" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cajero" text DEFAULT 'Cajero 1' NOT NULL,
	"points_earned" numeric(10, 2) DEFAULT '0' NOT NULL,
	"points_used" numeric(10, 2) DEFAULT '0' NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sale_records_folio_unique" UNIQUE("folio")
);
--> statement-breakpoint
CREATE TABLE "servicios" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"categoria" text NOT NULL,
	"nombre" text NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"comision" numeric(10, 2) DEFAULT '0' NOT NULL,
	"numero_referencia" text NOT NULL,
	"folio" text NOT NULL,
	"estado" text DEFAULT 'completado' NOT NULL,
	"cajero" text NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "servicios_folio_unique" UNIQUE("folio")
);
--> statement-breakpoint
CREATE TABLE "store_config" (
	"id" text PRIMARY KEY DEFAULT 'main' NOT NULL,
	"store_name" text DEFAULT 'MI ABARROTES' NOT NULL,
	"legal_name" text DEFAULT 'MI ABARROTES S DE RL DE CV' NOT NULL,
	"address" text DEFAULT 'AV. PRINCIPAL #123, COL. CENTRO' NOT NULL,
	"city" text DEFAULT 'MEXICO' NOT NULL,
	"postal_code" text DEFAULT '00000' NOT NULL,
	"phone" text DEFAULT '(555) 123-4567' NOT NULL,
	"rfc" text DEFAULT 'XAXX010101000' NOT NULL,
	"regimen_fiscal" text DEFAULT '612' NOT NULL,
	"regimen_description" text DEFAULT 'REGIMEN SIMPLIFICADO DE CONFIANZA' NOT NULL,
	"iva_rate" text DEFAULT '16' NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"low_stock_threshold" text DEFAULT '25' NOT NULL,
	"expiration_warning_days" text DEFAULT '7' NOT NULL,
	"print_receipts" boolean DEFAULT true NOT NULL,
	"auto_backup" boolean DEFAULT false NOT NULL,
	"ticket_footer" text DEFAULT 'Espera algo especial
SU TICKET DE COMPRA SERA
REVISADO AL SALIR DE ACUERDO
AL REGLAMENTO' NOT NULL,
	"ticket_service_phone" text DEFAULT '800-000-0000' NOT NULL,
	"ticket_vigencia" text DEFAULT '12/2026' NOT NULL,
	"store_number" text DEFAULT '001' NOT NULL,
	"ticket_barcode_format" text DEFAULT 'CODE128' NOT NULL,
	"enable_notifications" boolean DEFAULT false NOT NULL,
	"telegram_token" text,
	"telegram_chat_id" text,
	"printer_ip" text,
	"cash_drawer_port" text,
	"scale_port" text,
	"loyalty_enabled" boolean DEFAULT false NOT NULL,
	"points_per_peso" integer DEFAULT 100 NOT NULL,
	"points_value" integer DEFAULT 1 NOT NULL,
	"logo_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"avatar_url" text DEFAULT '' NOT NULL,
	"employee_number" text DEFAULT '' NOT NULL,
	"global_id" text,
	"status" text DEFAULT 'activo' NOT NULL,
	"deactivated_at" timestamp,
	"pin_code" text,
	"role_id" text NOT NULL,
	"assigned_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_global_id_unique" UNIQUE("global_id")
);
--> statement-breakpoint
ALTER TABLE "fiado_items" ADD CONSTRAINT "fiado_items_fiado_id_fiado_transactions_id_fk" FOREIGN KEY ("fiado_id") REFERENCES "public"."fiado_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiado_items" ADD CONSTRAINT "fiado_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiado_transactions" ADD CONSTRAINT "fiado_transactions_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_items" ADD CONSTRAINT "inventory_audit_items_audit_id_inventory_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."inventory_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_items" ADD CONSTRAINT "inventory_audit_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merma_records" ADD CONSTRAINT "merma_records_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sale_records_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;