import { pgTable, text, integer, boolean, numeric, timestamp, date, index, jsonb } from 'drizzle-orm/pg-core';

// ==================== CONFIGURACION DE TIENDA ====================
export const storeConfig = pgTable('store_config', {
  id: text('id').primaryKey().default('main'),
  storeName: text('store_name').notNull().default('MI ABARROTES'),
  legalName: text('legal_name').notNull().default('MI ABARROTES S DE RL DE CV'),
  address: text('address').notNull().default('AV. PRINCIPAL #123, COL. CENTRO'),
  city: text('city').notNull().default('MEXICO'),
  postalCode: text('postal_code').notNull().default('00000'),
  phone: text('phone').notNull().default('(555) 123-4567'),
  rfc: text('rfc').notNull().default('XAXX010101000'),
  regimenFiscal: text('regimen_fiscal').notNull().default('612'),
  regimenDescription: text('regimen_description').notNull().default('REGIMEN SIMPLIFICADO DE CONFIANZA'),
  ivaRate: text('iva_rate').notNull().default('16'),
  pricesIncludeIva: boolean('prices_include_iva').notNull().default(true),
  currency: text('currency').notNull().default('MXN'),
  lowStockThreshold: text('low_stock_threshold').notNull().default('25'),
  expirationWarningDays: text('expiration_warning_days').notNull().default('7'),
  printReceipts: boolean('print_receipts').notNull().default(true),
  autoBackup: boolean('auto_backup').notNull().default(false),
  ticketFooter: text('ticket_footer')
    .notNull()
    .default('Espera algo especial\nSU TICKET DE COMPRA SERA\nREVISADO AL SALIR DE ACUERDO\nAL REGLAMENTO'),
  ticketServicePhone: text('ticket_service_phone').notNull().default('800-000-0000'),
  ticketVigencia: text('ticket_vigencia').notNull().default('12/2026'),
  storeNumber: text('store_number').notNull().default('001'),
  ticketBarcodeFormat: text('ticket_barcode_format').notNull().default('CODE128'),
  enableNotifications: boolean('enable_notifications').notNull().default(false),
  telegramToken: text('telegram_token'),
  telegramChatId: text('telegram_chat_id'),
  // Email (AWS SES)
  emailEnabled: boolean('email_enabled').notNull().default(false),
  emailFrom: text('email_from'),
  emailFromName: text('email_from_name'),
  emailReplyTo: text('email_reply_to'),
  emailRecipients: text('email_recipients'),
  emailAccentColor: text('email_accent_color'),
  printerIp: text('printer_ip'),
  cashDrawerPort: text('cash_drawer_port'),
  scalePort: text('scale_port'),
  loyaltyEnabled: boolean('loyalty_enabled').notNull().default(false),
  pointsPerPeso: integer('points_per_peso').notNull().default(100),
  pointsValue: integer('points_value').notNull().default(1),
  logoUrl: text('logo_url'),
  ticketTemplateVenta: text('ticket_template_venta'),
  ticketTemplateProveedor: text('ticket_template_proveedor'),
  // Ticket designer JSON (per-ticket-type design config)
  ticketDesignVenta: text('ticket_design_venta'),
  ticketDesignCorte: text('ticket_design_corte'),
  ticketDesignProveedor: text('ticket_design_proveedor'),
  // Métodos de pago adicionales
  clabeNumber: text('clabe_number'),
  paypalUsername: text('paypal_username'),
  paypalQrUrl: text('paypal_qr_url'),
  cobrarQrUrl: text('cobrar_qr_url'),
  // MercadoPago terminal config (persisted; replaces localStorage)
  mpDeviceId: text('mp_device_id'),
  mpPublicKey: text('mp_public_key'),
  mpEnabled: boolean('mp_enabled').notNull().default(false),
  // Conekta
  conektaEnabled: boolean('conekta_enabled').notNull().default(false),
  conektaPublicKey: text('conekta_public_key'),
  // Stripe
  stripeEnabled: boolean('stripe_enabled').notNull().default(false),
  stripePublicKey: text('stripe_public_key'),
  // Clip
  clipEnabled: boolean('clip_enabled').notNull().default(false),
  clipApiKey: text('clip_api_key'),
  clipSerialNumber: text('clip_serial_number'),
  // Servicios (Recargas y Pagos de Servicios)
  serviciosProvider: text('servicios_provider').notNull().default('local'), // 'local', 'turecarga', 'infopago', 'billpocket'
  serviciosApiKey: text('servicios_api_key'),
  serviciosApiSecret: text('servicios_api_secret'),
  serviciosSandbox: boolean('servicios_sandbox').notNull().default(true),
  // Customer Display
  customerDisplayEnabled: boolean('customer_display_enabled').notNull().default(false),
  customerDisplayWelcome: text('customer_display_welcome'),
  customerDisplayFarewell: text('customer_display_farewell'),
  customerDisplayPromoText: text('customer_display_promo_text'),
  customerDisplayPromoImage: text('customer_display_promo_image'),
  // Customer Display - Animations
  customerDisplayIdleAnimation: text('customer_display_idle_animation').notNull().default('fade'),
  customerDisplayTransitionSpeed: text('customer_display_transition_speed').notNull().default('normal'),
  customerDisplayPromoAnimation: text('customer_display_promo_animation').notNull().default('slideUp'),
  customerDisplayShowClock: boolean('customer_display_show_clock').notNull().default(true),
  customerDisplayTheme: text('customer_display_theme').notNull().default('light'),
  customerDisplayIdleCarousel: boolean('customer_display_idle_carousel').notNull().default(false),
  customerDisplayCarouselInterval: text('customer_display_carousel_interval').notNull().default('5'),
  // Customer Display - Extended settings
  customerDisplayLogo: text('customer_display_logo'),
  customerDisplayFontScale: text('customer_display_font_scale').notNull().default('1'),
  customerDisplayAutoReturnSec: text('customer_display_auto_return_sec').notNull().default('6'),
  customerDisplayAccentColor: text('customer_display_accent_color'),
  customerDisplaySoundEnabled: boolean('customer_display_sound_enabled').notNull().default(false),
  customerDisplayOrientation: text('customer_display_orientation').notNull().default('landscape'),
  customerDisplayMessageStyle: text('customer_display_message_style'),
  inventoryGeneralColumns: text('inventory_general_columns').notNull().default('["title","sku","available","onHand"]'),
  defaultMargin: text('default_margin').notNull().default('30'),
  defaultStartingFund: numeric('default_starting_fund', { precision: 10, scale: 2 }).notNull().default('500'),
  loyaltyExpirationDays: integer('loyalty_expiration_days').notNull().default(365),
  exchangeRateUsdMxn: numeric('exchange_rate_usd_mxn', { precision: 10, scale: 4 }).notNull().default('17.5'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== OAUTH PROVIDER CONNECTIONS ====================
export const paymentProviderConnections = pgTable(
  'payment_provider_connections',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(), // 'mercadopago' | 'conekta' | 'stripe' | 'clip'
    storeId: text('store_id')
      .notNull()
      .default('main')
      .references(() => storeConfig.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('disconnected'), // 'connected' | 'disconnected' | 'expired'
    accessTokenEnc: text('access_token_enc'),
    refreshTokenEnc: text('refresh_token_enc'),
    publicKey: text('public_key'),
    tokenExpiresAt: timestamp('token_expires_at'),
    mpUserId: text('mp_user_id'),
    mpEmail: text('mp_email'),
    // Multi-provider generic columns
    webhookSecretEnc: text('webhook_secret_enc'),
    providerAccountId: text('provider_account_id'),
    providerEmail: text('provider_email'),
    providerMetadata: jsonb('provider_metadata').default({}),
    environment: text('environment').notNull().default('sandbox'),
    scopes: text('scopes'),
    connectedAt: timestamp('connected_at'),
    disconnectedAt: timestamp('disconnected_at'),
    lastRefreshedAt: timestamp('last_refreshed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('ppc_provider_store_idx').on(t.provider, t.storeId), index('ppc_status_idx').on(t.status)],
);

export const oauthStates = pgTable('oauth_states', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  codeVerifier: text('code_verifier').notNull(),
  state: text('state').notNull().unique(),
  redirectUri: text('redirect_uri').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

// ==================== PAYMENT CHARGES (automated SPEI/OXXO tracking) ====================
export const paymentCharges = pgTable(
  'payment_charges',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(), // 'conekta' | 'stripe' | 'mercadopago' | 'clip'
    providerChargeId: text('provider_charge_id').notNull(),
    saleId: text('sale_id'),
    storeId: text('store_id').notNull().default('main'),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('MXN'),
    paymentMethod: text('payment_method').notNull(), // 'spei' | 'oxxo' | 'card'
    status: text('status').notNull().default('pending'), // 'pending' | 'paid' | 'expired' | 'failed'
    customerName: text('customer_name'),
    customerEmail: text('customer_email'),
    referenceNumber: text('reference_number'),
    clabeReference: text('clabe_reference'),
    oxxoBarcode: text('oxxo_barcode'),
    oxxoReference: text('oxxo_reference'),
    expiresAt: timestamp('expires_at'),
    paidAt: timestamp('paid_at'),
    providerMetadata: jsonb('provider_metadata').default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('pc_provider_charge_idx').on(t.provider, t.providerChargeId),
    index('pc_sale_idx').on(t.saleId),
    index('pc_status_idx').on(t.status),
    index('pc_reference_idx').on(t.referenceNumber),
  ],
);

// ==================== CATEGORIAS ==
export const productCategories = pgTable('product_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'), // Nombre del icono de Polaris
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// ==================== PRODUCTOS ====================
export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    sku: text('sku').notNull().unique(),
    barcode: text('barcode').notNull().unique(),
    currentStock: integer('current_stock').notNull().default(0),
    minStock: integer('min_stock').notNull().default(0),
    expirationDate: date('expiration_date'),
    category: text('category')
      .notNull()
      .references(() => productCategories.id),
    costPrice: numeric('cost_price', { precision: 10, scale: 2 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    unit: text('unit').notNull().default('pieza'),
    unitMultiple: integer('unit_multiple').notNull().default(1),
    isPerishable: boolean('is_perishable').notNull().default(false),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [index('products_category_idx').on(t.category), index('products_current_stock_idx').on(t.currentStock)],
);

// ==================== VENTAS ====================
export const saleRecords = pgTable(
  'sale_records',
  {
    id: text('id').primaryKey(),
    folio: text('folio').notNull().unique(),
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
    iva: numeric('iva', { precision: 10, scale: 2 }).notNull(),
    cardSurcharge: numeric('card_surcharge', { precision: 10, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 10, scale: 2 }).notNull(),
    paymentMethod: text('payment_method').notNull(), // efectivo, tarjeta, transferencia
    installments: integer('installments').notNull().default(1),
    mpPaymentId: text('mp_payment_id'),
    amountPaid: numeric('amount_paid', { precision: 10, scale: 2 }).notNull(),
    change: numeric('change', { precision: 10, scale: 2 }).notNull().default('0'),
    cajero: text('cajero').notNull().default('Cajero 1'),
    pointsEarned: numeric('points_earned', { precision: 10, scale: 2 }).notNull().default('0'),
    pointsUsed: numeric('points_used', { precision: 10, scale: 2 }).notNull().default('0'),
    discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0'),
    discountType: text('discount_type').notNull().default('amount'), // 'amount' | 'percent'
    date: timestamp('date').notNull().defaultNow(),
    status: text('status').notNull().default('completada'),
  },
  (t) => [
    index('sale_records_date_idx').on(t.date),
    index('sale_records_payment_method_idx').on(t.paymentMethod),
    index('sale_records_mp_payment_id_idx').on(t.mpPaymentId),
    index('sale_records_status_idx').on(t.status),
  ],
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: text('id').primaryKey(),
    saleId: text('sale_id')
      .notNull()
      .references(() => saleRecords.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    sku: text('sku').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  },
  (t) => [index('sale_items_sale_id_idx').on(t.saleId), index('sale_items_product_id_idx').on(t.productId)],
);

// ==================== MERMAS ====================
export const mermaRecords = pgTable(
  'merma_records',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    quantity: integer('quantity').notNull(),
    reason: text('reason').notNull(), // expiration, damage, spoilage, other
    notes: text('notes'),
    evidenceUrl: text('evidence_url'),
    date: timestamp('date').notNull().defaultNow(),
    value: numeric('value', { precision: 10, scale: 2 }).notNull(),
  },
  (t) => [index('merma_records_product_id_idx').on(t.productId), index('merma_records_date_idx').on(t.date)],
);

// ==================== PEDIDOS ====================
export const pedidos = pgTable('pedidos', {
  id: text('id').primaryKey(),
  proveedor: text('proveedor').notNull(),
  notas: text('notas').notNull().default(''),
  fecha: timestamp('fecha').notNull().defaultNow(),
  estado: text('estado').notNull().default('pendiente'), // pendiente, enviado, recibido
});

export const pedidoItems = pgTable(
  'pedido_items',
  {
    id: text('id').primaryKey(),
    pedidoId: text('pedido_id')
      .notNull()
      .references(() => pedidos.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    cantidad: integer('cantidad').notNull(),
  },
  (t) => [index('pedido_items_pedido_id_idx').on(t.pedidoId), index('pedido_items_product_id_idx').on(t.productId)],
);

// ==================== CLIENTES ====================
export const clientes = pgTable('clientes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  address: text('address').notNull().default(''),
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0'),
  creditLimit: numeric('credit_limit', { precision: 10, scale: 2 }).notNull().default('0'),
  points: numeric('points', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastTransaction: timestamp('last_transaction'),
  deletedAt: timestamp('deleted_at'),
});

// ==================== FIADO TRANSACTIONS ====================
export const fiadoTransactions = pgTable(
  'fiado_transactions',
  {
    id: text('id').primaryKey(),
    clienteId: text('cliente_id')
      .notNull()
      .references(() => clientes.id),
    clienteName: text('cliente_name').notNull(),
    type: text('type').notNull(), // fiado, abono
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    description: text('description').notNull().default(''),
    saleFolio: text('sale_folio'),
    date: timestamp('date').notNull().defaultNow(),
  },
  (t) => [
    index('fiado_transactions_cliente_id_idx').on(t.clienteId),
    index('fiado_transactions_date_idx').on(t.date),
    index('fiado_transactions_cliente_date_idx').on(t.clienteId, t.date),
  ],
);

// ==================== FIADO ITEMS (productos fiados) ====================
export const fiadoItems = pgTable(
  'fiado_items',
  {
    id: text('id').primaryKey(),
    fiadoId: text('fiado_id')
      .notNull()
      .references(() => fiadoTransactions.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    sku: text('sku').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  },
  (t) => [index('fiado_items_fiado_id_idx').on(t.fiadoId)],
);

// ==================== GASTOS ====================
export const gastos = pgTable(
  'gastos',
  {
    id: text('id').primaryKey(),
    concepto: text('concepto').notNull(),
    categoria: text('categoria').notNull(), // renta, servicios, proveedores, salarios, mantenimiento, impuestos, otro
    monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
    fecha: timestamp('fecha').notNull().defaultNow(),
    notas: text('notas').notNull().default(''),
    comprobante: boolean('comprobante').notNull().default(false),
    comprobanteUrl: text('comprobante_url'),
  },
  (t) => [index('gastos_fecha_idx').on(t.fecha), index('gastos_categoria_idx').on(t.categoria)],
);

// ==================== PROVEEDORES ====================
export const proveedores = pgTable('proveedores', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  contacto: text('contacto').notNull().default(''),
  telefono: text('telefono').notNull().default(''),
  email: text('email').notNull().default(''),
  direccion: text('direccion').notNull().default(''),
  categorias: text('categorias').array().notNull().default([]),
  notas: text('notas').notNull().default(''),
  activo: boolean('activo').notNull().default(true),
  ultimoPedido: timestamp('ultimo_pedido'),
  deletedAt: timestamp('deleted_at'),
});

// ==================== CORTES DE CAJA ====================
export const cortesCaja = pgTable(
  'cortes_caja',
  {
    id: text('id').primaryKey(),
    fecha: timestamp('fecha').notNull().defaultNow(),
    cajero: text('cajero').notNull(),
    ventasEfectivo: numeric('ventas_efectivo', { precision: 10, scale: 2 }).notNull(),
    ventasTarjeta: numeric('ventas_tarjeta', { precision: 10, scale: 2 }).notNull(),
    ventasTransferencia: numeric('ventas_transferencia', { precision: 10, scale: 2 }).notNull(),
    ventasFiado: numeric('ventas_fiado', { precision: 10, scale: 2 }).notNull().default('0'),
    totalVentas: numeric('total_ventas', { precision: 10, scale: 2 }).notNull(),
    totalTransacciones: integer('total_transacciones').notNull(),
    efectivoEsperado: numeric('efectivo_esperado', { precision: 10, scale: 2 }).notNull(),
    efectivoContado: numeric('efectivo_contado', { precision: 10, scale: 2 }).notNull(),
    diferencia: numeric('diferencia', { precision: 10, scale: 2 }).notNull(),
    fondoInicial: numeric('fondo_inicial', { precision: 10, scale: 2 }).notNull(),
    gastosDelDia: numeric('gastos_del_dia', { precision: 10, scale: 2 }).notNull(),
    notas: text('notas').notNull().default(''),
    status: text('status').notNull().default('abierto'), // abierto, cerrado
  },
  (t) => [index('cortes_caja_fecha_idx').on(t.fecha)],
);

// ==================== AUDITORÍAS DE INVENTARIO ====================
export const inventoryAudits = pgTable('inventory_audits', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  date: timestamp('date').notNull().defaultNow(),
  auditor: text('auditor').notNull(),
  status: text('status').notNull().default('draft'), // draft, completed
  notes: text('notes').notNull().default(''),
});

export const inventoryAuditItems = pgTable(
  'inventory_audit_items',
  {
    id: text('id').primaryKey(),
    auditId: text('audit_id')
      .notNull()
      .references(() => inventoryAudits.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    expectedStock: integer('expected_stock').notNull(),
    countedStock: integer('counted_stock').notNull(),
    difference: integer('difference').notNull(),
    adjustmentValue: numeric('adjustment_value', { precision: 10, scale: 2 }).notNull(),
  },
  (t) => [index('inventory_audit_items_audit_id_idx').on(t.auditId)],
);

// ==================== ROLES Y PERMISOS ====================
export const roleDefinitions = pgTable('role_definitions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  permissions: text('permissions').notNull().default('[]'), // JSON array of PermissionKey[]
  isSystem: boolean('is_system').notNull().default(false),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const userRoles = pgTable(
  'user_roles',
  {
    id: text('id').primaryKey(),
    firebaseUid: text('firebase_uid').notNull(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull().default(''),
    avatarUrl: text('avatar_url').notNull().default(''),
    employeeNumber: text('employee_number').notNull().default(''),
    globalId: text('global_id').unique(), // Permanent unique ID, generated once, never reusable
    status: text('status').notNull().default('activo'), // 'activo' | 'baja'
    deactivatedAt: timestamp('deactivated_at'), // When the user was deactivated
    pinCode: text('pin_code'), // <-- Nuevo para PIN approvals
    roleId: text('role_id')
      .notNull()
      .references(() => roleDefinitions.id), // FK to role_definitions
    assignedBy: text('assigned_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('user_roles_firebase_uid_idx').on(t.firebaseUid), index('user_roles_role_id_idx').on(t.roleId)],
);

// ==================== AUDIT LOGS ====================
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    userEmail: text('user_email').notNull(),
    action: text('action').notNull(), // create, update, delete, login, logout
    entity: text('entity').notNull(), // product, sale, cliente, etc
    entityId: text('entity_id').notNull(),
    changes: jsonb('changes'), // { before: {}, after: {} }
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_user_id_idx').on(t.userId),
    index('audit_logs_entity_idx').on(t.entity, t.entityId),
    index('audit_logs_timestamp_idx').on(t.timestamp),
  ],
);

// ==================== DEVOLUCIONES ====================
export const devoluciones = pgTable(
  'devoluciones',
  {
    id: text('id').primaryKey(),
    // Venta original
    saleId: text('sale_id')
      .notNull()
      .references(() => saleRecords.id, { onDelete: 'cascade' }),
    saleFolio: text('sale_folio').notNull(),
    // Tipo: 'total' | 'parcial'
    tipo: text('tipo').notNull().default('parcial'),
    // Motivo: 'producto_danado' | 'producto_incorrecto' | 'insatisfaccion' | 'otro'
    motivo: text('motivo').notNull(),
    notas: text('notas').notNull().default(''),
    // Monto total devuelto
    montoDevuelto: numeric('monto_devuelto', { precision: 10, scale: 2 }).notNull(),
    // Método de devolución: 'efectivo' | 'credito_cliente' | 'transferencia'
    metodoDev: text('metodo_dev').notNull().default('efectivo'),
    cajero: text('cajero').notNull(),
    clienteId: text('cliente_id').references(() => clientes.id),
    fecha: timestamp('fecha').notNull().defaultNow(),
  },
  (t) => [index('devoluciones_sale_id_idx').on(t.saleId), index('devoluciones_fecha_idx').on(t.fecha)],
);

// Items devueltos (uno por producto dentro de la devolución)
export const devolucionItems = pgTable(
  'devolucion_items',
  {
    id: text('id').primaryKey(),
    devolucionId: text('devolucion_id')
      .notNull()
      .references(() => devoluciones.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    sku: text('sku').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
    // true = regresa al inventario, false = merma/destrucción
    regresoInventario: boolean('regreso_inventario').notNull().default(true),
  },
  (t) => [index('devolucion_items_devolucion_id_idx').on(t.devolucionId)],
);

// ==================== MOVIMIENTOS DE CAJA ====================
export const cashMovements = pgTable(
  'cash_movements',
  {
    id: text('id').primaryKey(),
    // Corte de caja al que pertenece (null si el turno aún está abierto)
    corteId: text('corte_id').references(() => cortesCaja.id),
    // 'entrada' | 'salida'
    tipo: text('tipo').notNull(),
    // 'fondo_inicial' | 'retiro_parcial' | 'deposito' | 'gasto' | 'ajuste' | 'otro'
    concepto: text('concepto').notNull(),
    monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
    notas: text('notas').notNull().default(''),
    cajero: text('cajero').notNull(),
    fecha: timestamp('fecha').notNull().defaultNow(),
  },
  (t) => [index('cash_movements_corte_id_idx').on(t.corteId), index('cash_movements_tipo_idx').on(t.tipo)],
);

// ==================== LOYALTY TRANSACTIONS ====================
export const loyaltyTransactions = pgTable(
  'loyalty_transactions',
  {
    id: text('id').primaryKey(),
    clienteId: text('cliente_id')
      .notNull()
      .references(() => clientes.id),
    clienteName: text('cliente_name').notNull(),
    // 'acumulacion' | 'canje' | 'ajuste' | 'expiracion'
    tipo: text('tipo').notNull(),
    puntos: numeric('puntos', { precision: 10, scale: 2 }).notNull(), // positivo = ganó, negativo = canjeó
    saldoAnterior: numeric('saldo_anterior', { precision: 10, scale: 2 }).notNull(),
    saldoNuevo: numeric('saldo_nuevo', { precision: 10, scale: 2 }).notNull(),
    // Referencia a la venta que generó los puntos (opcional)
    saleId: text('sale_id').references(() => saleRecords.id, { onDelete: 'cascade' }),
    saleFolio: text('sale_folio'),
    notas: text('notas').notNull().default(''),
    cajero: text('cajero').notNull(),
    fecha: timestamp('fecha').notNull().defaultNow(),
  },
  (t) => [
    index('loyalty_transactions_cliente_id_idx').on(t.clienteId),
    index('loyalty_transactions_fecha_idx').on(t.fecha),
  ],
);

// ==================== SERVICIOS (RECARGAS Y PAGOS) ====================
export const servicios = pgTable('servicios', {
  id: text('id').primaryKey(),
  tipo: text('tipo').notNull(), // 'recarga' | 'servicio'
  categoria: text('categoria').notNull(), // 'telcel', 'movistar', 'att', 'luz', 'agua', 'gas', 'internet'
  nombre: text('nombre').notNull(),
  monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
  comision: numeric('comision', { precision: 10, scale: 2 }).notNull().default('0'),
  numeroReferencia: text('numero_referencia').notNull(), // Número de teléfono o cuenta
  folio: text('folio').notNull().unique(),
  estado: text('estado').notNull().default('completado'), // 'completado', 'pendiente', 'procesando', 'fallido', 'cancelado'
  cajero: text('cajero').notNull(),
  fecha: timestamp('fecha').notNull().defaultNow(),
  // Provider tracking (added for external integrations)
  providerId: text('provider_id').notNull().default('local'), // 'local', 'turecarga', 'infopago', etc.
  providerTransactionId: text('provider_transaction_id'), // External ID from provider
  providerAuthCode: text('provider_auth_code'), // Authorization/confirmation code
  providerError: text('provider_error'), // Error message if failed
  providerRespondedAt: timestamp('provider_responded_at'), // When provider confirmed
});

// ==================== PROMOCIONES ====================
export const promotions = pgTable(
  'promotions',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    type: text('type').notNull(), // 'percentage' | 'fixed' | 'bogo' | 'bundle'
    value: numeric('value', { precision: 10, scale: 2 }).notNull(), // discount % or fixed amount
    minPurchase: numeric('min_purchase', { precision: 10, scale: 2 }).notNull().default('0'),
    maxDiscount: numeric('max_discount', { precision: 10, scale: 2 }), // cap for percentage discounts
    applicableTo: text('applicable_to').notNull().default('all'), // 'all' | 'category' | 'product'
    applicableIds: jsonb('applicable_ids').$type<string[]>().notNull().default([]), // product IDs or category IDs
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    active: boolean('active').notNull().default(true),
    usageLimit: integer('usage_limit'), // null = unlimited
    usageCount: integer('usage_count').notNull().default(0),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [index('promotions_active_idx').on(t.active), index('promotions_dates_idx').on(t.startDate, t.endDate)],
);

export const mercadopagoPayments = pgTable(
  'mercadopago_payments',
  {
    id: text('id').primaryKey(),
    paymentId: text('payment_id').notNull().unique(),
    status: text('status').notNull(),
    externalReference: text('external_reference'),
    saleId: text('sale_id').references(() => saleRecords.id, { onDelete: 'set null' }),
    amount: numeric('amount', { precision: 10, scale: 2 }),
    paymentMethodId: text('payment_method_id'),
    paymentType: text('payment_type'),
    installments: integer('installments').notNull().default(1),
    feeAmount: numeric('fee_amount', { precision: 10, scale: 2 }),
    netAmount: numeric('net_amount', { precision: 10, scale: 2 }),
    payerEmail: text('payer_email'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    index('mp_payments_sale_id_idx').on(t.saleId),
    index('mp_payments_status_idx').on(t.status),
    index('mp_payments_external_ref_idx').on(t.externalReference),
  ],
);

// ==================== REEMBOLSOS MERCADO PAGO ====================
export const mercadopagoRefunds = pgTable(
  'mercadopago_refunds',
  {
    id: text('id').primaryKey(),
    mpPaymentId: text('mp_payment_id').notNull(),
    mpRefundId: text('mp_refund_id').notNull().unique(),
    saleId: text('sale_id').references(() => saleRecords.id, { onDelete: 'set null' }),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    status: text('status').notNull().default('pending'),
    reason: text('reason').notNull().default(''),
    initiatedBy: text('initiated_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at'),
  },
  (t) => [index('mp_refunds_sale_id_idx').on(t.saleId), index('mp_refunds_payment_id_idx').on(t.mpPaymentId)],
);

// ==================== FEATURE FLAGS ====================
export const featureFlags = pgTable(
  'feature_flags',
  {
    id: text('id').primaryKey(),
    description: text('description').notNull().default(''),
    enabled: boolean('enabled').notNull().default(false),
    rolloutPercentage: integer('rollout_percentage').notNull().default(0),
    targetUserIds: text('target_user_ids').array().notNull().default([]),
    targetRoleIds: text('target_role_ids').array().notNull().default([]),
    activateAt: timestamp('activate_at'),
    deactivateAt: timestamp('deactivate_at'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('feature_flags_enabled_idx').on(t.enabled)],
);

// ==================== CFDI / FACTURACIÓN ELECTRÓNICA ====================
export const cfdiRecords = pgTable(
  'cfdi_records',
  {
    id: text('id').primaryKey(),
    saleId: text('sale_id').notNull(),
    folio: text('folio').notNull(),
    uuid: text('uuid').notNull().default(''),
    receptorRfc: text('receptor_rfc').notNull(),
    receptorNombre: text('receptor_nombre').notNull(),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    status: text('status').notNull().default('pending'), // pending | timbrada | cancelada | error
    xmlUrl: text('xml_url').notNull().default(''),
    pdfUrl: text('pdf_url').notNull().default(''),
    cancelAckUrl: text('cancel_ack_url').notNull().default(''),
    cancelReason: text('cancel_reason'),
    cancelRelatedUuid: text('cancel_related_uuid'),
    fechaTimbrado: text('fecha_timbrado'),
    cancelledAt: timestamp('cancelled_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('cfdi_sale_id_idx').on(t.saleId),
    index('cfdi_uuid_idx').on(t.uuid),
    index('cfdi_receptor_rfc_idx').on(t.receptorRfc),
    index('cfdi_status_idx').on(t.status),
  ],
);
