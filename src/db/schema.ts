import {
  pgTable,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  date,
  index,
  jsonb,
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
  pricesIncludeIva: boolean('prices_include_iva').notNull().default(true),
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
  ticketTemplateVenta: text('ticket_template_venta'),
  ticketTemplateProveedor: text('ticket_template_proveedor'),
  inventoryGeneralColumns: text('inventory_general_columns').notNull().default('["title","sku","available","onHand"]'),
  defaultMargin: text('default_margin').notNull().default('30'),
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
  unit: text('unit').notNull().default('pieza'),
  unitMultiple: integer('unit_multiple').notNull().default(1),
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
  discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0'),
  discountType: text('discount_type').notNull().default('amount'), // 'amount' | 'percent'
  date: timestamp('date').notNull().defaultNow(),
}, (t) => [
  index('sale_records_date_idx').on(t.date),
  index('sale_records_payment_method_idx').on(t.paymentMethod),
]);

export const saleItems = pgTable('sale_items', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull().references(() => saleRecords.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  sku: text('sku').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
}, (t) => [
  index('sale_items_sale_id_idx').on(t.saleId),
  index('sale_items_product_id_idx').on(t.productId),
]);

// ==================== MERMAS ====================
export const mermaRecords = pgTable('merma_records', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull(),
  reason: text('reason').notNull(), // expiration, damage, spoilage, other
  date: timestamp('date').notNull().defaultNow(),
  value: numeric('value', { precision: 10, scale: 2 }).notNull(),
}, (t) => [
  index('merma_records_product_id_idx').on(t.productId),
  index('merma_records_date_idx').on(t.date),
]);

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
}, (t) => [
  index('pedido_items_pedido_id_idx').on(t.pedidoId),
  index('pedido_items_product_id_idx').on(t.productId),
]);

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
}, (t) => [
  index('fiado_transactions_cliente_id_idx').on(t.clienteId),
  index('fiado_transactions_date_idx').on(t.date),
]);

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
}, (t) => [
  index('fiado_items_fiado_id_idx').on(t.fiadoId),
]);

// ==================== GASTOS ====================
export const gastos = pgTable('gastos', {
  id: text('id').primaryKey(),
  concepto: text('concepto').notNull(),
  categoria: text('categoria').notNull(), // renta, servicios, proveedores, salarios, mantenimiento, impuestos, otro
  monto: numeric('monto', { precision: 10, scale: 2 }).notNull(),
  fecha: timestamp('fecha').notNull().defaultNow(),
  notas: text('notas').notNull().default(''),
  comprobante: boolean('comprobante').notNull().default(false),
}, (t) => [
  index('gastos_fecha_idx').on(t.fecha),
  index('gastos_categoria_idx').on(t.categoria),
]);

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
}, (t) => [
  index('cortes_caja_fecha_idx').on(t.fecha),
]);

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
}, (t) => [
  index('inventory_audit_items_audit_id_idx').on(t.auditId),
]);

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
  roleId: text('role_id').notNull().references(() => roleDefinitions.id), // FK to role_definitions
  assignedBy: text('assigned_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('user_roles_firebase_uid_idx').on(t.firebaseUid),
  index('user_roles_role_id_idx').on(t.roleId),
]);

// ==================== AUDIT LOGS ====================
export const auditLogs = pgTable('audit_logs', {
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
}, (t) => [
  index('audit_logs_user_id_idx').on(t.userId),
  index('audit_logs_entity_idx').on(t.entity, t.entityId),
  index('audit_logs_timestamp_idx').on(t.timestamp),
]);

// ==================== DEVOLUCIONES ====================
export const devoluciones = pgTable('devoluciones', {
  id: text('id').primaryKey(),
  // Venta original
  saleId: text('sale_id').notNull().references(() => saleRecords.id),
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
}, (t) => [
  index('devoluciones_sale_id_idx').on(t.saleId),
  index('devoluciones_fecha_idx').on(t.fecha),
]);

// Items devueltos (uno por producto dentro de la devolución)
export const devolucionItems = pgTable('devolucion_items', {
  id: text('id').primaryKey(),
  devolucionId: text('devolucion_id').notNull().references(() => devoluciones.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  sku: text('sku').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  // true = regresa al inventario, false = merma/destrucción
  regresoInventario: boolean('regreso_inventario').notNull().default(true),
}, (t) => [
  index('devolucion_items_devolucion_id_idx').on(t.devolucionId),
]);

// ==================== MOVIMIENTOS DE CAJA ====================
export const cashMovements = pgTable('cash_movements', {
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
});

// ==================== LOYALTY TRANSACTIONS ====================
export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').notNull().references(() => clientes.id),
  clienteName: text('cliente_name').notNull(),
  // 'acumulacion' | 'canje' | 'ajuste' | 'expiracion'
  tipo: text('tipo').notNull(),
  puntos: numeric('puntos', { precision: 10, scale: 2 }).notNull(), // positivo = ganó, negativo = canjeó
  saldoAnterior: numeric('saldo_anterior', { precision: 10, scale: 2 }).notNull(),
  saldoNuevo: numeric('saldo_nuevo', { precision: 10, scale: 2 }).notNull(),
  // Referencia a la venta que generó los puntos (opcional)
  saleId: text('sale_id').references(() => saleRecords.id),
  saleFolio: text('sale_folio'),
  notas: text('notas').notNull().default(''),
  cajero: text('cajero').notNull(),
  fecha: timestamp('fecha').notNull().defaultNow(),
}, (t) => [
  index('loyalty_transactions_cliente_id_idx').on(t.clienteId),
  index('loyalty_transactions_fecha_idx').on(t.fecha),
]);

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
