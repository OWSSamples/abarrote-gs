import { z } from 'zod';
import { PAYMENT_METHODS, GASTO_CATEGORIAS, PEDIDO_ESTADOS, MERMA_REASONS } from '@/types';
import { isValidRFC } from './rfc';

// ══════════════════════════════════════════════════════
// Reusable primitives
// ══════════════════════════════════════════════════════

export const idSchema = z.string().min(1, 'ID requerido').max(200);
const safeString = (label: string, max = 500) => z.string().min(1, `${label} es requerido`).max(max);
const _optionalSafeString = (max = 500) => z.string().max(max).optional();
const money = z.number().nonnegative().max(99_999_999.99);
const positiveMoney = z.number().positive('Debe ser mayor a 0').max(99_999_999.99);
const positiveInt = z.number().int().positive().max(9_999_999);
const nonNegativeInt = z.number().int().nonnegative().max(9_999_999);

// ══════════════════════════════════════════════════════
// SALES
// ══════════════════════════════════════════════════════

const saleItemSchema = z.object({
  productId: idSchema,
  productName: safeString('Nombre del producto'),
  sku: safeString('SKU', 100),
  quantity: positiveInt,
  unitPrice: money,
  subtotal: money,
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'La venta debe tener al menos un producto').max(500),
  subtotal: money,
  iva: money,
  cardSurcharge: money.default(0),
  total: positiveMoney,
  paymentMethod: z.enum(PAYMENT_METHODS),
  installments: z.number().int().min(1).max(48).default(1),
  mpPaymentId: z.string().max(200).nullable().optional(),
  amountPaid: money,
  change: money.default(0),
  cajero: z.string().min(1).max(200).default('Cajero'),
  pointsEarned: nonNegativeInt.default(0),
  pointsUsed: nonNegativeInt.default(0),
  discount: money.default(0),
  discountType: z.enum(['amount', 'percent']).default('amount'),
  clienteId: z.string().max(200).optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const deleteSalesSchema = z.object({
  saleIds: z.array(idSchema).min(1).max(100),
});

// ══════════════════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════════════════

export const createProductSchema = z.object({
  name: safeString('Nombre del producto', 300),
  sku: safeString('SKU', 100),
  barcode: safeString('Código de barras', 100),
  currentStock: nonNegativeInt,
  minStock: nonNegativeInt,
  expirationDate: z.string().max(20).nullable().optional(),
  category: safeString('Categoría', 200),
  costPrice: money,
  unitPrice: money,
  unit: z.string().max(50).default('pieza'),
  unitMultiple: z.number().int().min(1).max(10000).default(1),
  isPerishable: z.boolean().default(false),
  imageUrl: z.string().url().max(2000).nullable().optional(),
});

export const updateProductSchema = createProductSchema.partial();

// ══════════════════════════════════════════════════════
// CUSTOMERS / FIADO
// ══════════════════════════════════════════════════════

export const createClienteSchema = z.object({
  name: safeString('Nombre', 300),
  phone: z.string().max(30).default(''),
  email: z.string().email().max(300).or(z.literal('')).default(''),
  address: z.string().max(500).default(''),
  notes: z.string().max(2000).default(''),
  creditLimit: money.default(0),
  points: nonNegativeInt.default(0),
});

export const updateClienteSchema = createClienteSchema.partial();

export const createFiadoSchema = z.object({
  clienteId: idSchema,
  amount: positiveMoney,
  description: safeString('Descripción', 500),
  saleFolio: z.string().max(100).optional(),
  items: z
    .array(
      z.object({
        productId: idSchema,
        productName: z.string().max(500),
        quantity: positiveInt,
        unitPrice: money,
        subtotal: money,
      }),
    )
    .max(500)
    .optional(),
});

export const createAbonoSchema = z.object({
  clienteId: idSchema,
  amount: positiveMoney,
  description: z.string().max(500).default('Abono'),
});

// ══════════════════════════════════════════════════════
// FINANCE: Gastos, Proveedores, Pedidos
// ══════════════════════════════════════════════════════

export const createGastoSchema = z.object({
  concepto: safeString('Concepto', 500),
  categoria: z.enum(GASTO_CATEGORIAS),
  monto: positiveMoney,
  fecha: z.coerce.date(),
  notas: z.string().max(2000).default(''),
  comprobante: z.boolean().default(false),
  comprobanteUrl: z.string().url().max(2000).nullable().optional(),
});

export const updateGastoSchema = createGastoSchema.partial();

export const createProveedorSchema = z.object({
  nombre: safeString('Nombre', 300),
  contacto: z.string().max(300).default(''),
  telefono: z.string().max(30).default(''),
  email: z.string().email().max(300).or(z.literal('')).default(''),
  direccion: z.string().max(500).default(''),
  categorias: z.array(z.string().max(100)).max(50).default([]),
  notas: z.string().max(2000).default(''),
  activo: z.boolean().default(true),
});

export const updateProveedorSchema = createProveedorSchema.partial();

const pedidoItemSchema = z.object({
  productId: idSchema,
  productName: z.string().max(500),
  quantity: positiveInt,
  unitCost: money,
  subtotal: money,
});

export const createPedidoSchema = z.object({
  proveedorId: idSchema,
  proveedorName: z.string().max(300),
  items: z.array(pedidoItemSchema).min(1).max(500),
  total: positiveMoney,
  notas: z.string().max(2000).default(''),
});

export const updatePedidoStatusSchema = z.object({
  id: idSchema,
  estado: z.enum(PEDIDO_ESTADOS),
});

// ══════════════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════════════

export const createCategorySchema = z.object({
  name: safeString('Nombre', 200),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

// ══════════════════════════════════════════════════════
// PROMOTIONS
// ══════════════════════════════════════════════════════

export const createPromotionSchema = z.object({
  name: safeString('Nombre', 200),
  description: z.string().max(1000).default(''),
  type: z.enum(['percentage', 'fixed', 'bogo', 'bundle']),
  value: z.number().nonnegative().max(999999),
  minPurchase: money.default(0),
  maxDiscount: money.optional(),
  applicableTo: z.enum(['all', 'product', 'category']),
  applicableIds: z.array(idSchema).max(1000).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  active: z.boolean().default(true),
  usageLimit: positiveInt.optional(),
});

export const updatePromotionSchema = createPromotionSchema.partial();

// ══════════════════════════════════════════════════════
// ROLES / USERS
// ══════════════════════════════════════════════════════

export const createRoleSchema = z.object({
  name: safeString('Nombre del rol', 100),
  description: z.string().max(500).default(''),
  permissions: z.array(z.string().max(100)).min(1, 'Al menos un permiso').max(200),
});

export const updateRoleSchema = createRoleSchema.partial();

export const assignUserRoleSchema = z.object({
  firebaseUid: safeString('Firebase UID', 200),
  email: z.string().email().max(300),
  displayName: z.string().max(200).default(''),
  roleId: idSchema,
});

export const createUserWithRoleSchema = z.object({
  email: z.string().email().max(300),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(128).optional(),
  displayName: safeString('Nombre', 200),
  roleId: idSchema,
  pinCode: z
    .string()
    .regex(/^\d{4,6}$/, 'PIN debe ser 4-6 dígitos')
    .optional(),
});

export const updateUserPinSchema = z.object({
  firebaseUid: safeString('Firebase UID', 200),
  pinCode: z.string().regex(/^\d{4,6}$/, 'PIN debe ser 4-6 dígitos'),
});

export const updateUserProfileSchema = z.object({
  firebaseUid: safeString('Firebase UID', 200),
  displayName: z.string().min(1).max(200).optional(),
  avatarUrl: z.string().url().max(2000).optional(),
});

// ══════════════════════════════════════════════════════
// CASH MOVEMENTS
// ══════════════════════════════════════════════════════

export const createCashMovementSchema = z.object({
  corteId: z.string().max(200).optional(),
  tipo: z.enum(['ingreso', 'retiro']),
  concepto: safeString('Concepto', 500),
  monto: positiveMoney,
  notas: z.string().max(2000).default(''),
  cajero: z.string().max(200).default('Cajero'),
});

// ══════════════════════════════════════════════════════
// DEVOLUCIONES
// ══════════════════════════════════════════════════════

const devolucionItemSchema = z.object({
  saleItemId: idSchema,
  productId: idSchema,
  productName: z.string().max(500),
  quantity: positiveInt,
  unitPrice: money,
  subtotal: money,
});

export const createDevolucionSchema = z.object({
  saleId: idSchema,
  saleFolio: z.string().max(100),
  tipo: z.enum(['total', 'parcial']),
  motivo: z.enum(['producto_danado', 'producto_incorrecto', 'insatisfaccion', 'otro']),
  notas: z.string().max(2000).default(''),
  montoDevuelto: positiveMoney,
  metodoDev: z.enum(['efectivo', 'credito_cliente', 'transferencia']).default('efectivo'),
  cajero: z.string().max(200),
  clienteId: z.string().max(200).nullable().optional(),
  items: z.array(devolucionItemSchema).min(1).max(500),
});

// ══════════════════════════════════════════════════════
// MERMAS
// ══════════════════════════════════════════════════════

export const createMermaSchema = z.object({
  productId: idSchema,
  productName: z.string().max(500),
  quantity: positiveInt,
  reason: z.enum(MERMA_REASONS),
  notes: z.string().max(2000).default(''),
  registeredBy: z.string().max(200).default('Sistema'),
});

// ══════════════════════════════════════════════════════
// PAYMENT PROVIDERS
// ══════════════════════════════════════════════════════

const environmentSchema = z.enum(['sandbox', 'production']);

export const connectConektaSchema = z.object({
  privateKey: z.string().min(1).max(500),
  publicKey: z.string().min(1).max(500),
  environment: environmentSchema,
});

export const connectStripeSchema = z.object({
  secretKey: z.string().min(1).max(500),
  publishableKey: z.string().min(1).max(500),
  webhookSecret: z.string().max(500).optional(),
  environment: environmentSchema,
});

export const connectClipSchema = z.object({
  apiKey: z.string().min(1).max(500),
  secretKey: z.string().min(1).max(500),
  serialNumber: z.string().max(100).optional(),
  environment: environmentSchema,
});

export const createChargeSchema = z.object({
  amount: positiveMoney,
  customerName: z.string().max(300).optional(),
  customerEmail: z.string().email().max(300).optional(),
  description: z.string().max(500).default('Venta POS'),
  saleReference: z.string().max(200),
});

export const createClipTerminalSchema = z.object({
  amount: positiveMoney,
  saleReference: z.string().max(200),
  serialNumber: z.string().max(100).optional(),
});

// ══════════════════════════════════════════════════════
// STORE CONFIG
// ══════════════════════════════════════════════════════

export const saveStoreConfigSchema = z
  .object({
    storeName: z.string().max(300).optional(),
    legalName: z.string().max(300).optional(),
    address: z.string().max(500).optional(),
    city: z.string().max(200).optional(),
    postalCode: z.string().max(10).optional(),
    phone: z.string().max(30).optional(),
    rfc: z
      .string()
      .max(20)
      .optional()
      .refine((v) => !v || isValidRFC(v), {
        message: 'RFC inválido. Formato: 3-4 letras + 6 dígitos (fecha) + 3 caracteres homoclave',
      }),
    regimenFiscal: z.string().max(10).optional(),
    regimenDescription: z.string().max(300).optional(),
    cfdiPacProvider: z.string().max(50).optional(),
    cfdiPacEnvironment: z.enum(['sandbox', 'production']).optional(),
    cfdiPacAuthType: z.enum(['basic', 'bearer', 'api-key']).optional(),
    cfdiPacApiUrl: z.string().max(500).optional(),
    cfdiPacApiKey: z.string().max(500).optional(),
    cfdiPacApiSecret: z.string().max(500).optional(),
    cfdiPacCancelPath: z.string().max(120).optional(),
    ivaRate: z.string().max(10).optional(),
    pricesIncludeIva: z.boolean().optional(),
    currency: z.string().max(10).optional(),
    lowStockThreshold: z.string().max(10).optional(),
    expirationWarningDays: z.string().max(10).optional(),
    printReceipts: z.boolean().optional(),
    autoBackup: z.boolean().optional(),
    ticketFooter: z.string().max(2000).optional(),
    ticketServicePhone: z.string().max(30).optional(),
    ticketVigencia: z.string().max(20).optional(),
    storeNumber: z.string().max(20).optional(),
    enableNotifications: z.boolean().optional(),
    telegramToken: z.string().max(500).optional(),
    telegramChatId: z.string().max(100).optional(),
    printerIp: z.string().max(100).optional(),
    loyaltyEnabled: z.boolean().optional(),
    pointsPerPeso: z.number().int().min(0).max(10000).optional(),
    pointsValue: z.number().int().min(0).max(10000).optional(),
    logoUrl: z.string().max(2000).optional(),
    slogan: z.string().max(300).optional(),
    mpEnabled: z.boolean().optional(),
    mpPublicKey: z.string().max(500).optional(),
    mpDeviceId: z.string().max(200).optional(),
    conektaEnabled: z.boolean().optional(),
    conektaPublicKey: z.string().max(500).optional(),
    stripeEnabled: z.boolean().optional(),
    stripePublicKey: z.string().max(500).optional(),
    clipEnabled: z.boolean().optional(),
    clipApiKey: z.string().max(500).optional(),
    clipSerialNumber: z.string().max(100).optional(),
    defaultMargin: z.string().max(10).optional(),
    autoCorteEnabled: z.boolean().optional(),
    autoCorteTime: z.string().max(10).optional(),
    // Customer Display
    customerDisplayEnabled: z.boolean().optional(),
    customerDisplayWelcome: z.string().max(120).optional(),
    customerDisplayFarewell: z.string().max(120).optional(),
    customerDisplayPromoText: z.string().max(200).optional(),
    customerDisplayPromoImage: z.string().max(5000).optional(),
    customerDisplayIdleAnimation: z.string().max(20).optional(),
    customerDisplayTransitionSpeed: z.string().max(10).optional(),
    customerDisplayPromoAnimation: z.string().max(20).optional(),
    customerDisplayShowClock: z.boolean().optional(),
    customerDisplayTheme: z.string().max(10).optional(),
    customerDisplayIdleCarousel: z.boolean().optional(),
    customerDisplayCarouselInterval: z.string().max(5).optional(),
    customerDisplayLogo: z.string().max(2000).optional(),
    customerDisplayFontScale: z.string().max(5).optional(),
    customerDisplayAutoReturnSec: z.string().max(5).optional(),
    customerDisplayAccentColor: z.string().max(20).optional(),
    customerDisplaySoundEnabled: z.boolean().optional(),
    customerDisplayOrientation: z.string().max(15).optional(),
    // Customer Display - Message Styling (JSON)
    customerDisplayMessageStyle: z.string().max(5000).optional(),
    // Ticket designer JSON
    ticketDesignVenta: z.string().max(5000).optional(),
    ticketDesignCorte: z.string().max(5000).optional(),
    ticketDesignProveedor: z.string().max(5000).optional(),
  })
  .passthrough(); // Allow unknown fields to not break on new config additions

// ══════════════════════════════════════════════════════
// LOYALTY
// ══════════════════════════════════════════════════════

export const createLoyaltyTransactionSchema = z.object({
  clienteId: idSchema,
  clienteName: z.string().max(300),
  tipo: z.enum(['acumulacion', 'canje', 'ajuste', 'bienvenida']),
  puntos: z.string().max(20),
  saldoAnterior: z.string().max(20),
  saldoNuevo: z.string().max(20),
  saleId: z.string().max(200).nullable().optional(),
  saleFolio: z.string().max(100).nullable().optional(),
  notas: z.string().max(2000).default(''),
  cajero: z.string().max(200).default('Sistema'),
});

// ══════════════════════════════════════════════════════
// INVENTORY AUDITS
// ══════════════════════════════════════════════════════

export const createInventoryAuditSchema = z.object({
  title: safeString('Título', 300),
  auditor: safeString('Auditor', 200),
  notes: z.string().max(2000).default(''),
});

export const saveAuditItemSchema = z.object({
  auditId: idSchema,
  productId: idSchema,
  productName: z.string().max(500),
  expectedStock: z.number().int().nonnegative().max(9_999_999),
  countedStock: z.number().int().nonnegative().max(9_999_999),
  difference: z.number().int().min(-9_999_999).max(9_999_999),
  adjustmentValue: z.number().max(99_999_999.99),
});

// ══════════════════════════════════════════════════════
// SERVICIOS (Recargas + Pagos)
// ══════════════════════════════════════════════════════

export const createRecargaSchema = z.object({
  categoria: safeString('Categoría', 200),
  nombre: safeString('Nombre', 300),
  monto: z.number().min(10).max(5000),
  numeroReferencia: z.string().min(10, 'Mínimo 10 dígitos').max(30),
  cajero: z.string().max(200).default('Cajero'),
});

export const createPagoServicioSchema = z.object({
  categoria: safeString('Categoría', 200),
  nombre: safeString('Nombre', 300),
  monto: z.number().min(1).max(50000),
  numeroReferencia: z.string().min(5, 'Mínimo 5 caracteres').max(100),
  cajero: z.string().max(200).default('Cajero'),
});

// ══════════════════════════════════════════════════════
// MERCADOPAGO REFUND
// ══════════════════════════════════════════════════════

export const createMPRefundSchema = z.object({
  mpPaymentId: safeString('Payment ID', 200),
  amount: positiveMoney,
  reason: safeString('Motivo', 500),
});

// ══════════════════════════════════════════════════════
// Helper: validate and throw
// ══════════════════════════════════════════════════════

export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Datos inválidos en ${context}: ${issues}`);
  }
  return result.data;
}
