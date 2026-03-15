import {
  pgTable,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  date,
} from 'drizzle-orm/pg-core';

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
  currency: text('currency').notNull().default('MXN'),
  lowStockThreshold: text('low_stock_threshold').notNull().default('25'),
  expirationWarningDays: text('expiration_warning_days').notNull().default('7'),
  printReceipts: boolean('print_receipts').notNull().default(true),
  autoBackup: boolean('auto_backup').notNull().default(false),
  ticketFooter: text('ticket_footer').notNull().default('Espera algo especial\nSU TICKET DE COMPRA SERA\nREVISADO AL SALIR DE ACUERDO\nAL REGLAMENTO'),
  ticketServicePhone: text('ticket_service_phone').notNull().default('800-000-0000'),
  ticketVigencia: text('ticket_vigencia').notNull().default('12/2026'),
  storeNumber: text('store_number').notNull().default('001'),
  ticketBarcodeFormat: text('ticket_barcode_format').notNull().default('CODE128'),
  enableNotifications: boolean('enable_notifications').notNull().default(false),
  telegramToken: text('telegram_token'),
  telegramChatId: text('telegram_chat_id'),
  printerIp: text('printer_ip'),
  cashDrawerPort: text('cash_drawer_port'),
  scalePort: text('scale_port'),
  loyaltyEnabled: boolean('loyalty_enabled').notNull().default(false),
  pointsPerPeso: integer('points_per_peso').notNull().default(100),
  pointsValue: integer('points_value').notNull().default(1),
  logoUrl: text('logo_url'),
  slogan: text('slogan'),
  whatsapp: text('whatsapp'),
  instagram: text('instagram'),
  facebook: text('facebook'),
  website: text('website'),
  primaryColor: text('primary_color'),
  secondaryColor: text('secondary_color'),
  autoCorteEnabled: boolean('auto_corte_enabled').notNull().default(false),
  autoCorteTime: text('auto_corte_time').notNull().default('23:59'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== PRODUCTOS ====================
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku').notNull().unique(),
  barcode: text('barcode').notNull().unique(),
  currentStock: integer('current_stock').notNull().default(0),
  minStock: integer('min_stock').notNull().default(0),
  expirationDate: date('expiration_date'),
  category: text('category').notNull(),
  costPrice: numeric('cost_price', { precision: 10, scale: 2 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  isPerishable: boolean('is_perishable').notNull().default(false),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== VENTAS ====================
export const saleRecords = pgTable('sale_records', {
  id: text('id').primaryKey(),
  folio: text('folio').notNull().unique(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  iva: numeric('iva', { precision: 10, scale: 2 }).notNull(),
  cardSurcharge: numeric('card_surcharge', { precision: 10, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull(), // efectivo, tarjeta, transferencia
  amountPaid: numeric('amount_paid', { precision: 10, scale: 2 }).notNull(),
  change: numeric('change', { precision: 10, scale: 2 }).notNull().default('0'),
  cajero: text('cajero').notNull().default('Cajero 1'),
  pointsEarned: numeric('points_earned', { precision: 10, scale: 2 }).notNull().default('0'),
  pointsUsed: numeric('points_used', { precision: 10, scale: 2 }).notNull().default('0'),
  date: timestamp('date').notNull().defaultNow(),
});

export const saleItems = pgTable('sale_items', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull().references(() => saleRecords.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  sku: text('sku').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
});

// ==================== MERMAS ====================
export const mermaRecords = pgTable('merma_records', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull(),
  reason: text('reason').notNull(), // expiration, damage, spoilage, other
  date: timestamp('date').notNull().defaultNow(),
  value: numeric('value', { precision: 10, scale: 2 }).notNull(),
});

// ==================== PEDIDOS ====================
export const pedidos = pgTable('pedidos', {
  id: text('id').primaryKey(),
  proveedor: text('proveedor').notNull(),
  notas: text('notas').notNull().default(''),
  fecha: timestamp('fecha').notNull().defaultNow(),
  estado: text('estado').notNull().default('pendiente'), // pendiente, enviado, recibido
});

export const pedidoItems = pgTable('pedido_items', {
  id: text('id').primaryKey(),
  pedidoId: text('pedido_id').notNull().references(() => pedidos.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  cantidad: integer('cantidad').notNull(),
});

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
});

// ==================== FIADO TRANSACTIONS ====================
export const fiadoTransactions = pgTable('fiado_transactions', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').notNull().references(() => clientes.id),
  clienteName: text('cliente_name').notNull(),
  type: text('type').notNull(), // fiado, abono
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description').notNull().default(''),
  saleFolio: text('sale_folio'),
  date: timestamp('date').notNull().defaultNow(),
});

// ==================== FIADO ITEMS (productos fiados) ====================
export const fiadoItems = pgTable('fiado_items', {
  id: text('id').primaryKey(),
  fiadoId: text('fiado_id').notNull().references(() => fiadoTransactions.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  sku: text('sku').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
});

// ==================== GASTOS ====================
export const gastos = pgTable('gastos', {
  id: text('id').primaryKey(),
  concepto: text('concepto').notNull(),
  categoria: text('categoria').notNull(), // renta, servicios, proveedores, salarios, mantenimiento, impuestos, otro
  monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
  fecha: timestamp('fecha').notNull().defaultNow(),
  notas: text('notas').notNull().default(''),
  comprobante: boolean('comprobante').notNull().default(false),
});

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
});

// ==================== CORTES DE CAJA ====================
export const cortesCaja = pgTable('cortes_caja', {
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
});

// ==================== AUDITORÍAS DE INVENTARIO ====================
export const inventoryAudits = pgTable('inventory_audits', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  date: timestamp('date').notNull().defaultNow(),
  auditor: text('auditor').notNull(),
  status: text('status').notNull().default('draft'), // draft, completed
  notes: text('notes').notNull().default(''),
});

export const inventoryAuditItems = pgTable('inventory_audit_items', {
  id: text('id').primaryKey(),
  auditId: text('audit_id').notNull().references(() => inventoryAudits.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  expectedStock: integer('expected_stock').notNull(),
  countedStock: integer('counted_stock').notNull(),
  difference: integer('difference').notNull(),
  adjustmentValue: numeric('adjustment_value', { precision: 10, scale: 2 }).notNull(),
});

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

export const userRoles = pgTable('user_roles', {
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
  roleId: text('role_id').notNull(), // references role_definitions.id
  assignedBy: text('assigned_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== AUDIT LOGS ====================
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userEmail: text('user_email').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  changes: text('changes').notNull().default('{}'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

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
  estado: text('estado').notNull().default('completado'), // 'completado', 'pendiente', 'cancelado'
  cajero: text('cajero').notNull(),
  fecha: timestamp('fecha').notNull().defaultNow(),
});
