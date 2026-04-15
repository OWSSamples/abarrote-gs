// Tipos para el Dashboard de Abarrotes

// === Enums / Constantes de Dominio ===

export const PAYMENT_METHODS = [
  'efectivo',
  'tarjeta',
  'tarjeta_web',
  'transferencia',
  'fiado',
  'spei',
  'paypal',
  'qr_cobro',
  'spei_conekta',
  'spei_stripe',
  'oxxo_conekta',
  'oxxo_stripe',
  'tarjeta_clip',
  'clip_terminal',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MERMA_REASONS = ['expiration', 'damage', 'spoilage', 'other'] as const;
export type MermaReason = (typeof MERMA_REASONS)[number];

export const PEDIDO_ESTADOS = ['pendiente', 'enviado', 'recibido'] as const;
export type PedidoEstado = (typeof PEDIDO_ESTADOS)[number];

export const GASTO_CATEGORIAS = [
  'renta',
  'servicios',
  'proveedores',
  'salarios',
  'mantenimiento',
  'impuestos',
  'otro',
] as const;
export type GastoCategoria = (typeof GASTO_CATEGORIAS)[number];

export const ALERT_TYPES = ['low_stock', 'expiration', 'expired', 'merma'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = ['critical', 'warning', 'info'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const USER_STATUSES = ['activo', 'baja'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CORTE_STATUSES = ['abierto', 'cerrado'] as const;
export type CorteStatus = (typeof CORTE_STATUSES)[number];

export const AUDIT_STATUSES = ['draft', 'completed'] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const SERVICIO_ESTADOS = ['completado', 'pendiente', 'procesando', 'fallido', 'cancelado'] as const;
export type ServicioEstado = (typeof SERVICIO_ESTADOS)[number];

// === Customer Display Animation Types ===
export const CUSTOMER_DISPLAY_ANIMATIONS = [
  'none',
  'fade',
  'slideUp',
  'slideDown',
  'slideLeft',
  'slideRight',
  'zoom',
  'bounce',
] as const;
export type CustomerDisplayAnimation = (typeof CUSTOMER_DISPLAY_ANIMATIONS)[number];

export const CUSTOMER_DISPLAY_PROMO_ANIMATIONS = [
  'none',
  'slideUp',
  'slideLeft',
  'slideRight',
  'fade',
  'zoom',
  'pulse',
  'kenBurns',
] as const;
export type CustomerDisplayPromoAnimation = (typeof CUSTOMER_DISPLAY_PROMO_ANIMATIONS)[number];

export const TRANSITION_SPEEDS = ['slow', 'normal', 'fast'] as const;
export type TransitionSpeed = (typeof TRANSITION_SPEEDS)[number];

export const CUSTOMER_DISPLAY_THEMES = ['light', 'dark', 'brand'] as const;
export type CustomerDisplayTheme = (typeof CUSTOMER_DISPLAY_THEMES)[number];

export const CUSTOMER_DISPLAY_ORIENTATIONS = ['landscape', 'portrait'] as const;
export type CustomerDisplayOrientation = (typeof CUSTOMER_DISPLAY_ORIENTATIONS)[number];

// === Customer Display Message Styling ===
export const MESSAGE_TEXT_SIZES = ['sm', 'md', 'lg', 'xl', '2xl'] as const;
export type MessageTextSize = (typeof MESSAGE_TEXT_SIZES)[number];

export const MESSAGE_TEXT_WEIGHTS = ['regular', 'semibold', 'bold'] as const;
export type MessageTextWeight = (typeof MESSAGE_TEXT_WEIGHTS)[number];

export const MESSAGE_TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export type MessageTextAlign = (typeof MESSAGE_TEXT_ALIGNS)[number];

/** Styling overrides for a single message on the customer display. */
export interface MessageStyle {
  subtitle: string;
  textSize: MessageTextSize;
  textWeight: MessageTextWeight;
  textAlign: MessageTextAlign;
  textColor: string; // hex, '' = use theme default
  uppercase: boolean;
  showIcon: boolean;
}

/** All message styles for the customer display, keyed by message slot. */
export interface CustomerDisplayMessageStyle {
  welcome: MessageStyle;
  farewell: MessageStyle;
  promo: MessageStyle;
}

export const DEFAULT_MESSAGE_STYLE: MessageStyle = {
  subtitle: '',
  textSize: 'lg',
  textWeight: 'bold',
  textAlign: 'center',
  textColor: '',
  uppercase: false,
  showIcon: true,
};

export const DEFAULT_CUSTOMER_DISPLAY_MESSAGE_STYLE: CustomerDisplayMessageStyle = {
  welcome: { ...DEFAULT_MESSAGE_STYLE, subtitle: 'Estamos a su servicio', textSize: '2xl' },
  farewell: { ...DEFAULT_MESSAGE_STYLE, subtitle: '', textSize: 'xl' },
  promo: { ...DEFAULT_MESSAGE_STYLE, textSize: 'lg', textWeight: 'semibold' },
};

// ═══════════════════════════════════════════════════════════
// Ticket Designer
// ═══════════════════════════════════════════════════════════
export const TICKET_PAPER_WIDTHS = ['58mm', '72mm', '80mm'] as const;
export type TicketPaperWidth = (typeof TICKET_PAPER_WIDTHS)[number];

export const TICKET_SEPARATOR_STYLES = ['dashes', 'dots', 'line', 'double', 'stars', 'none'] as const;
export type TicketSeparatorStyle = (typeof TICKET_SEPARATOR_STYLES)[number];

export const TICKET_FONT_SIZES = ['small', 'medium', 'large'] as const;
export type TicketFontSize = (typeof TICKET_FONT_SIZES)[number];

export const TICKET_HEADER_ALIGNMENTS = ['left', 'center'] as const;
export type TicketHeaderAlignment = (typeof TICKET_HEADER_ALIGNMENTS)[number];

export type TicketSectionKey = 'header' | 'supplier' | 'items' | 'totals' | 'footer' | 'barcode';

export const DEFAULT_SECTION_ORDER: TicketSectionKey[] = ['header', 'items', 'totals', 'barcode', 'footer'];
export const DEFAULT_SECTION_ORDER_PROVEEDOR: TicketSectionKey[] = ['header', 'supplier', 'items', 'totals', 'footer'];

export interface TicketDesignConfig {
  // Header
  showLogo: boolean;
  logoSize: 'small' | 'medium' | 'large';
  showStoreName: boolean;
  showLegalName: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showRfc: boolean;
  showRegimen: boolean;
  showStoreNumber: boolean;
  headerAlignment: TicketHeaderAlignment;
  // Body (products)
  showSku: boolean;
  showBarcode: boolean;
  showUnitDetail: boolean; // e.g. "2 pza x $25.00"
  // Totals
  showSubtotal: boolean;
  showIva: boolean;
  showDiscount: boolean;
  showAmountPaid: boolean;
  showChange: boolean;
  showItemCount: boolean;
  showPaymentMethod: boolean;
  showDateTime: boolean;
  showCashierInfo: boolean;
  showCurrency: boolean;
  // Footer
  customFooterMessage: string;
  showServicePhone: boolean;
  showVigencia: boolean;
  showPoweredBy: boolean;
  // Barcode / QR
  showTicketBarcode: boolean;
  barcodeFormat: 'CODE128' | 'CODE39' | 'QR';
  // Style
  paperWidth: TicketPaperWidth;
  fontSize: TicketFontSize;
  separatorStyle: TicketSeparatorStyle;
  // Extra
  copies: number;
  headerNote: string; // e.g. "COMPROBANTE DE VENTA"
  // Proveedor-specific (only used when ticket type is 'proveedor')
  showSupplierInfo: boolean;
  showOrderFolio: boolean;
  showDeliveryDate: boolean;
  showPaymentTerms: boolean;
  showOrderNotes: boolean;
  showCostPrice: boolean;
  showTotalPieces: boolean;
  showDestination: boolean;
  // Section order (for drag-and-drop reordering)
  sectionOrder: TicketSectionKey[];
}

export const DEFAULT_TICKET_DESIGN: TicketDesignConfig = {
  showLogo: true,
  logoSize: 'medium',
  showStoreName: true,
  showLegalName: true,
  showAddress: true,
  showPhone: true,
  showRfc: true,
  showRegimen: false,
  showStoreNumber: true,
  headerAlignment: 'center',
  showSku: false,
  showBarcode: false,
  showUnitDetail: true,
  showSubtotal: true,
  showIva: true,
  showDiscount: true,
  showAmountPaid: true,
  showChange: true,
  showItemCount: true,
  showPaymentMethod: true,
  showDateTime: true,
  showCashierInfo: true,
  showCurrency: false,
  customFooterMessage: '',
  showServicePhone: true,
  showVigencia: true,
  showPoweredBy: true,
  showTicketBarcode: true,
  barcodeFormat: 'CODE128',
  paperWidth: '72mm',
  fontSize: 'medium',
  separatorStyle: 'line',
  copies: 1,
  headerNote: 'COMPROBANTE DE VENTA',
  showSupplierInfo: false,
  showOrderFolio: false,
  showDeliveryDate: false,
  showPaymentTerms: false,
  showOrderNotes: false,
  showCostPrice: false,
  showTotalPieces: false,
  showDestination: false,
  sectionOrder: [...DEFAULT_SECTION_ORDER],
};

export const DEFAULT_TICKET_DESIGN_PROVEEDOR: TicketDesignConfig = {
  ...DEFAULT_TICKET_DESIGN,
  headerNote: 'ORDEN DE COMPRA',
  showSku: true,
  showUnitDetail: true,
  showAmountPaid: false,
  showChange: false,
  showPaymentMethod: false,
  showItemCount: false,
  showVigencia: false,
  showCashierInfo: false,
  // Proveedor-specific
  showSupplierInfo: true,
  showOrderFolio: true,
  showDeliveryDate: true,
  showPaymentTerms: true,
  showOrderNotes: true,
  showCostPrice: true,
  showTotalPieces: true,
  showDestination: true,
  sectionOrder: [...DEFAULT_SECTION_ORDER_PROVEEDOR],
};

// === Configuración de Tienda (Ticket) ===
export interface StoreConfig {
  id: string;
  storeName: string;
  legalName: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  rfc: string;
  regimenFiscal: string;
  regimenDescription: string;
  ivaRate: string;
  pricesIncludeIva: boolean;
  currency: string;
  lowStockThreshold: string;
  expirationWarningDays: string;
  printReceipts: boolean;
  autoBackup: boolean;
  ticketFooter: string;
  ticketServicePhone: string;
  ticketVigencia: string;
  storeNumber: string;
  ticketBarcodeFormat: string;
  // Notifications
  enableNotifications: boolean;
  telegramToken?: string;
  telegramChatId?: string;
  // Email (AWS SES)
  emailEnabled: boolean;
  emailFrom?: string;
  emailFromName?: string;
  emailReplyTo?: string;
  emailRecipients?: string;
  emailAccentColor?: string;
  // Email — per-type toggles
  emailTicketEnabled: boolean;
  emailDailyReportEnabled: boolean;
  emailWeeklyReportEnabled: boolean;
  emailStockAlertEnabled: boolean;
  emailRefundAlertEnabled: boolean;
  emailExpenseAlertEnabled: boolean;
  emailSecurityAlertEnabled: boolean;
  // Email — schedule & customization
  emailDailyReportTime: string;
  emailWeeklyReportDay: string;
  emailWeeklyReportTime: string;
  emailFooterText?: string;
  emailSignature?: string;
  // Email — premium features
  emailCcRecipients?: string;
  emailBccRecipients?: string;
  emailSubjectPrefix?: string;
  emailDigestEnabled: boolean;
  emailDigestIntervalMinutes: number;
  emailMaxAlertsPerHour: number;
  emailAutoRetry: boolean;
  emailMaxRetries: number;
  emailAttachPdfTicket: boolean;
  emailAttachExcelReport: boolean;
  emailMonthlyReportEnabled: boolean;
  emailMonthlyReportDay: number;
  // Hardware
  printerIp?: string;
  cashDrawerPort?: string;
  scalePort?: string;
  // Loyalty
  loyaltyEnabled: boolean;
  pointsPerPeso: number;
  pointsValue: number;
  // Branding
  logoUrl?: string;
  inventoryGeneralColumns: string;
  // Margen de ganancia predeterminado (%)
  defaultMargin: string;
  // Ticket templates (custom HTML uploaded by user)
  // If set, these override the default generated HTML for printing.
  // Supports template variables: {{storeName}}, {{folio}}, {{fecha}}, {{items}}, {{total}}, etc.
  ticketTemplateVenta?: string;
  ticketTemplateProveedor?: string;
  // Ticket designer JSON config
  ticketDesignVenta: TicketDesignConfig;
  ticketDesignCorte: TicketDesignConfig;
  ticketDesignProveedor: TicketDesignConfig;
  // Métodos de pago adicionales
  clabeNumber?: string;
  paypalUsername?: string;
  paypalQrUrl?: string;
  cobrarQrUrl?: string;
  // MercadoPago terminal config
  mpDeviceId?: string;
  mpPublicKey?: string;
  mpEnabled: boolean;
  // Conekta
  conektaEnabled: boolean;
  conektaPublicKey?: string;
  // Stripe
  stripeEnabled: boolean;
  stripePublicKey?: string;
  // Clip
  clipEnabled: boolean;
  clipApiKey?: string;
  clipSerialNumber?: string;
  // System Schedules
  closeSystemTime: string;
  autoCorteTime: string;
  defaultStartingFund: number;
  // Customer Display
  customerDisplayEnabled: boolean;
  customerDisplayWelcome: string;
  customerDisplayFarewell: string;
  customerDisplayPromoText: string;
  customerDisplayPromoImage: string; // JSON array of URLs: '["url1","url2"]'
  // Customer Display - Animations
  customerDisplayIdleAnimation: CustomerDisplayAnimation;
  customerDisplayTransitionSpeed: TransitionSpeed;
  customerDisplayPromoAnimation: CustomerDisplayPromoAnimation;
  customerDisplayShowClock: boolean;
  customerDisplayTheme: CustomerDisplayTheme;
  customerDisplayIdleCarousel: boolean;
  customerDisplayCarouselInterval: string;
  // Customer Display - Extended
  customerDisplayLogo: string;
  customerDisplayFontScale: string;
  customerDisplayAutoReturnSec: string;
  customerDisplayAccentColor: string;
  customerDisplaySoundEnabled: boolean;
  customerDisplayOrientation: string;
  // Customer Display - Message Styling (JSON)
  customerDisplayMessageStyle: CustomerDisplayMessageStyle;
  // Servicios (recargas / pagos)
  serviciosProvider: string;
  serviciosApiKey?: string;
  serviciosApiSecret?: string;
  serviciosSandbox: boolean;
}

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  id: 'main',
  storeName: 'MI ABARROTES',
  legalName: 'MI ABARROTES S DE RL DE CV',
  address: 'AV. PRINCIPAL #123, COL. CENTRO',
  city: 'MEXICO',
  postalCode: '00000',
  phone: '(555) 123-4567',
  rfc: 'XAXX010101000',
  regimenFiscal: '612',
  regimenDescription: 'REGIMEN SIMPLIFICADO DE CONFIANZA',
  ivaRate: '16',
  pricesIncludeIva: true,
  currency: 'MXN',
  lowStockThreshold: '25',
  expirationWarningDays: '7',
  printReceipts: true,
  autoBackup: false,
  ticketFooter: 'Espera algo especial\nSU TICKET DE COMPRA SERA\nREVISADO AL SALIR DE ACUERDO\nAL REGLAMENTO',
  ticketServicePhone: '800-000-0000',
  ticketVigencia: '12/2026',
  storeNumber: '001',
  ticketBarcodeFormat: 'CODE128',
  enableNotifications: false,
  emailEnabled: false,
  emailTicketEnabled: true,
  emailDailyReportEnabled: true,
  emailWeeklyReportEnabled: true,
  emailStockAlertEnabled: true,
  emailRefundAlertEnabled: true,
  emailExpenseAlertEnabled: true,
  emailSecurityAlertEnabled: true,
  emailDailyReportTime: '08:00',
  emailWeeklyReportDay: 'monday',
  emailWeeklyReportTime: '07:00',
  emailDigestEnabled: false,
  emailDigestIntervalMinutes: 60,
  emailMaxAlertsPerHour: 20,
  emailAutoRetry: true,
  emailMaxRetries: 3,
  emailAttachPdfTicket: false,
  emailAttachExcelReport: false,
  emailMonthlyReportEnabled: false,
  emailMonthlyReportDay: 1,
  loyaltyEnabled: false,
  pointsPerPeso: 100, // $100 spent = 1 point
  pointsValue: 1, // 1 point = $1 discount
  inventoryGeneralColumns: '["title","sku","available","onHand"]',
  defaultMargin: '30',
  closeSystemTime: '23:00',
  autoCorteTime: '00:00',
  defaultStartingFund: 500,
  mpEnabled: false,
  conektaEnabled: false,
  stripeEnabled: false,
  clipEnabled: false,
  customerDisplayEnabled: false,
  customerDisplayWelcome: '',
  customerDisplayFarewell: '',
  customerDisplayPromoText: '',
  customerDisplayPromoImage: '',
  customerDisplayIdleAnimation: 'fade',
  customerDisplayTransitionSpeed: 'normal',
  customerDisplayPromoAnimation: 'slideUp',
  customerDisplayShowClock: true,
  customerDisplayTheme: 'light',
  customerDisplayIdleCarousel: false,
  customerDisplayCarouselInterval: '5',
  customerDisplayLogo: '',
  customerDisplayFontScale: '1',
  customerDisplayAutoReturnSec: '6',
  customerDisplayAccentColor: '',
  customerDisplaySoundEnabled: false,
  customerDisplayOrientation: 'landscape',
  customerDisplayMessageStyle: { ...DEFAULT_CUSTOMER_DISPLAY_MESSAGE_STYLE },
  serviciosProvider: 'local',
  serviciosSandbox: true,
  ticketDesignVenta: { ...DEFAULT_TICKET_DESIGN },
  ticketDesignCorte: {
    ...DEFAULT_TICKET_DESIGN,
    headerNote: 'CORTE DE CAJA',
    showItemCount: false,
    showDiscount: false,
    showUnitDetail: false,
  },
  ticketDesignProveedor: { ...DEFAULT_TICKET_DESIGN_PROVEEDOR },
};

export interface ProductCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  currentStock: number;
  minStock: number;
  expirationDate: string | null;
  category: string;
  costPrice: number;
  unitPrice: number;
  unit?: string;
  unitMultiple?: number;
  isPerishable: boolean;
  imageUrl?: string;
}

export interface InventoryAlert {
  id: string;
  product: Product;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  createdAt: string;
}

export interface KPIData {
  dailySales: number;
  dailySalesChange: number;
  lowStockProducts: number;
  expiringProducts: number;
  mermaRate: number;
  mermaRateChange: number;
}

export interface SalesData {
  date: string;
  currentWeek: number;
  previousWeek: number;
}

export interface HourlySalesData {
  hour: string;
  sales: number;
  transactions: number;
  isPeak: boolean;
}

export interface MermaRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: MermaReason;
  notes?: string;
  evidenceUrl?: string;
  date: string;
  value: number;
}

export type AlertStatus = AlertSeverity;

export interface PedidoRecord {
  id: string;
  proveedor: string;
  productos: { productId: string; productName: string; cantidad: number }[];
  notas: string;
  fecha: string;
  estado: PedidoEstado;
}

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SaleRecord {
  id: string;
  folio: string;
  items: SaleItem[];
  subtotal: number;
  iva: number;
  cardSurcharge: number;
  total: number;
  paymentMethod: PaymentMethod;
  installments: number;
  mpPaymentId: string | null;
  amountPaid: number;
  change: number;
  date: string;
  cajero: string;
  pointsEarned: number;
  pointsUsed: number;
  discount: number;
  discountType: 'amount' | 'percent';
  status: 'completada' | 'cancelada' | 'devuelta';
}

export const REFUND_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export interface MercadoPagoRefund {
  id: string;
  mpPaymentId: string;
  mpRefundId: string;
  saleId: string | null;
  amount: number;
  status: RefundStatus;
  reason: string;
  initiatedBy: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface DashboardState {
  kpiData: KPIData | null;
  inventoryAlerts: InventoryAlert[];
  products: Product[];
  categories: ProductCategory[];
  salesData: SalesData[];
  hourlySalesData: HourlySalesData[];
  saleRecords: SaleRecord[];
  mermaRecords: MermaRecord[];
  pedidos: PedidoRecord[];
  clientes: Cliente[];
  fiadoTransactions: FiadoTransaction[];
  gastos: Gasto[];
  proveedores: Proveedor[];
  cortesHistory: CorteCaja[];
  inventoryAudits: InventoryAudit[];
  devoluciones: Devolucion[];
  cashMovements: CashMovement[];
  loyaltyTransactions: LoyaltyTransaction[];
  isLoading: boolean;
  error: string | null;
  /** Timestamp (ms) of the last successful data sync from the database */
  lastSyncAt: number;
}

// === Corte de Caja ===
export interface CorteCaja {
  id: string;
  fecha: string;
  cajero: string;
  ventasEfectivo: number;
  ventasTarjeta: number;
  ventasTransferencia: number;
  ventasFiado: number;
  totalVentas: number;
  totalTransacciones: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
  fondoInicial: number;
  gastosDelDia: number;
  notas: string;
  status: CorteStatus;
}

// === Fiado / Crédito a Clientes ===
export interface Cliente {
  id: string;
  name: string;
  phone: string;
  address: string;
  balance: number;
  creditLimit: number;
  createdAt: string;
  lastTransaction: string | null;
  points: number;
}

export interface FiadoTransaction {
  id: string;
  clienteId: string;
  clienteName: string;
  type: 'fiado' | 'abono';
  amount: number;
  description: string;
  saleFolio?: string;
  items?: SaleItem[];
  date: string;
}

// === Auditoría de Inventario ===
export interface InventoryAudit {
  id: string;
  title: string;
  date: string;
  auditor: string;
  status: AuditStatus;
  notes: string;
  items?: InventoryAuditItem[];
}

export interface InventoryAuditItem {
  id: string;
  auditId: string;
  productId: string;
  productName: string;
  expectedStock: number;
  countedStock: number;
  difference: number;
  adjustmentValue: number;
}

// === Proveedores ===
export interface Proveedor {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  direccion: string;
  categorias: string[];
  notas: string;
  activo: boolean;
  ultimoPedido: string | null;
}

// === Gastos del Negocio ===
// GastoCategoria is now defined above as a const-derived type

export interface Gasto {
  id: string;
  concepto: string;
  categoria: GastoCategoria;
  monto: number;
  fecha: string;
  notas: string;
  comprobante: boolean;
  comprobanteUrl?: string | null;
}

// === Roles y Permisos ===

export type PermissionKey =
  | 'dashboard.view'
  | 'sales.create'
  | 'sales.view'
  | 'sales.cancel'
  | 'sales.refund'
  | 'sales.refund'
  | 'inventory.view'
  | 'inventory.edit'
  | 'inventory.create'
  | 'inventory.delete'
  | 'customers.view'
  | 'customers.edit'
  | 'fiado.create'
  | 'fiado.view'
  | 'expenses.view'
  | 'expenses.create'
  | 'expenses.edit'
  | 'expenses.delete'
  | 'suppliers.view'
  | 'suppliers.edit'
  | 'pedidos.view'
  | 'pedidos.create'
  | 'analytics.view'
  | 'reports.view'
  | 'reports.export'
  | 'corte.create'
  | 'corte.view'
  | 'settings.view'
  | 'settings.edit'
  | 'roles.manage'
  | 'servicios.view'
  | 'servicios.create'
  | 'servicios.edit'
  | 'inventory.audit'
  | 'notifications.edit'
  | 'pos.settings'
  | 'sales.discount'
  | 'sales.delete_item'
  | 'sales.change_price'
  | 'corte.blind_view'
  | 'cashdrawer.open';

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
  isSystem: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleRecord {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  employeeNumber: string;
  globalId?: string; // Permanent unique ID, generated once, never reused
  status: UserStatus; // Active or deactivated
  deactivatedAt?: string; // ISO date when deactivated
  pinCode?: string;
  roleId: string;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
}

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'dashboard.view': 'Ver dashboard',
  'sales.create': 'Registrar ventas',
  'sales.view': 'Ver ventas',
  'sales.refund': 'Procesar reembolsos (MercadoPago)',
  'sales.cancel': 'Cancelar ventas',
  'inventory.view': 'Ver inventario',
  'inventory.edit': 'Editar inventario',
  'inventory.create': 'Crear productos',
  'inventory.delete': 'Eliminar productos',
  'customers.view': 'Ver clientes',
  'customers.edit': 'Editar clientes',
  'fiado.create': 'Registrar fiado/abonos',
  'fiado.view': 'Ver fiado',
  'expenses.view': 'Ver gastos',
  'expenses.create': 'Registrar gastos',
  'expenses.edit': 'Editar gastos',
  'expenses.delete': 'Eliminar gastos',
  'suppliers.view': 'Ver proveedores',
  'suppliers.edit': 'Editar proveedores',
  'pedidos.view': 'Ver pedidos',
  'pedidos.create': 'Crear pedidos',
  'analytics.view': 'Ver analisis',
  'reports.view': 'Ver reportes',
  'reports.export': 'Exportar reportes',
  'corte.create': 'Hacer corte de caja',
  'corte.view': 'Ver cortes',
  'settings.view': 'Ver configuracion',
  'settings.edit': 'Editar configuracion',
  'roles.manage': 'Gestionar roles',
  'servicios.view': 'Ver servicios',
  'servicios.create': 'Registrar servicios/recargas',
  'servicios.edit': 'Editar servicios',
  'inventory.audit': 'Realizar auditorías de inventario',
  'notifications.edit': 'Configurar notificaciones',
  'pos.settings': 'Configuración avanzada de hardware/POS',
  'sales.discount': 'Autorizar Descuentos en Ventas',
  'sales.delete_item': 'Eliminar articulos del ticket',
  'sales.change_price': 'Modificar precio de articulos manual mente',
  'corte.blind_view': 'Ver totales en corte (Evita el Arqueo Ciego)',
  'cashdrawer.open': 'Abrir cajón de dinero (Manual)',
};

export const PERMISSION_GROUPS: { title: string; permissions: PermissionKey[] }[] = [
  { title: 'Dashboard', permissions: ['dashboard.view'] },
  {
    title: 'Ventas',
    permissions: [
      'sales.create',
      'sales.view',
      'sales.cancel',
      'sales.refund',
      'sales.discount',
      'sales.delete_item',
      'sales.change_price',
      'corte.create',
      'corte.view',
      'corte.blind_view',
      'cashdrawer.open',
    ],
  },
  {
    title: 'Inventario',
    permissions: ['inventory.view', 'inventory.edit', 'inventory.create', 'inventory.delete', 'inventory.audit'],
  },
  { title: 'Clientes', permissions: ['customers.view', 'customers.edit', 'fiado.create', 'fiado.view'] },
  { title: 'Gastos', permissions: ['expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete'] },
  {
    title: 'Proveedores y Pedidos',
    permissions: ['suppliers.view', 'suppliers.edit', 'pedidos.view', 'pedidos.create'],
  },
  { title: 'Reportes', permissions: ['analytics.view', 'reports.view', 'reports.export'] },
  {
    title: 'Sistema y Avanzados',
    permissions: [
      'settings.view',
      'settings.edit',
      'roles.manage',
      'pos.settings',
      'notifications.edit',
      'servicios.view',
      'servicios.create',
      'servicios.edit',
    ],
  },
];

export const ALL_PERMISSIONS: PermissionKey[] = [
  'dashboard.view',
  'sales.create',
  'sales.view',
  'sales.cancel',
  'sales.refund',
  'sales.discount',
  'sales.delete_item',
  'sales.change_price',
  'inventory.view',
  'inventory.edit',
  'inventory.create',
  'inventory.delete',
  'inventory.audit',
  'customers.view',
  'customers.edit',
  'fiado.create',
  'fiado.view',
  'expenses.view',
  'expenses.create',
  'expenses.edit',
  'expenses.delete',
  'suppliers.view',
  'suppliers.edit',
  'pedidos.view',
  'pedidos.create',
  'analytics.view',
  'reports.view',
  'reports.export',
  'corte.create',
  'corte.view',
  'corte.blind_view',
  'cashdrawer.open',
  'settings.view',
  'settings.edit',
  'roles.manage',
  'pos.settings',
  'notifications.edit',
  'servicios.view',
  'servicios.create',
  'servicios.edit',
];

/** Default system roles seeded on first use */
export const DEFAULT_SYSTEM_ROLES: Omit<RoleDefinition, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Propietario',
    description: 'Acceso total al sistema. Puede gestionar roles y toda la configuracion.',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
    createdBy: 'system',
  },
  {
    name: 'Administrador',
    description: 'Acceso completo excepto cambiar al propietario.',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
    createdBy: 'system',
  },
  {
    name: 'Gerente',
    description: 'Gestion de inventario, proveedores, reportes y gastos.',
    permissions: [
      'dashboard.view',
      'sales.view',
      'inventory.view',
      'inventory.edit',
      'inventory.create',
      'customers.view',
      'customers.edit',
      'fiado.create',
      'fiado.view',
      'expenses.view',
      'expenses.create',
      'expenses.edit',
      'suppliers.view',
      'suppliers.edit',
      'pedidos.view',
      'pedidos.create',
      'analytics.view',
      'reports.view',
      'reports.export',
      'corte.view',
      'servicios.view',
      'servicios.create',
      'servicios.edit',
    ],
    isSystem: true,
    createdBy: 'system',
  },
  {
    name: 'Cajero',
    description: 'Punto de venta, cortes de caja y consulta de inventario.',
    permissions: [
      'dashboard.view',
      'sales.create',
      'sales.view',
      'inventory.view',
      'customers.view',
      'fiado.create',
      'fiado.view',
      'corte.create',
      'corte.view',
      'servicios.create',
      'servicios.view',
    ],
    isSystem: true,
    createdBy: 'system',
  },
  {
    name: 'Solo lectura',
    description: 'Solo puede ver informacion. No puede modificar nada.',
    permissions: [
      'dashboard.view',
      'sales.view',
      'inventory.view',
      'customers.view',
      'fiado.view',
      'expenses.view',
      'suppliers.view',
      'pedidos.view',
      'analytics.view',
      'reports.view',
      'corte.view',
      'servicios.view',
    ],
    isSystem: true,
    createdBy: 'system',
  },
];

// === Devoluciones ===
export type DevolucionTipo = 'total' | 'parcial';
export type DevolucionMotivo = 'producto_danado' | 'producto_incorrecto' | 'insatisfaccion' | 'otro';
export type DevolucionMetodo = 'efectivo' | 'credito_cliente' | 'transferencia';

export interface DevolucionItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  regresoInventario: boolean;
}

export interface Devolucion {
  id: string;
  saleId: string;
  saleFolio: string;
  tipo: DevolucionTipo;
  motivo: DevolucionMotivo;
  notas: string;
  montoDevuelto: number;
  metodoDev: DevolucionMetodo;
  cajero: string;
  clienteId?: string;
  fecha: string;
  items: DevolucionItem[];
}

// === Movimientos de Caja ===
export type CashMovementTipo = 'entrada' | 'salida';
export type CashMovementConcepto = 'fondo_inicial' | 'retiro_parcial' | 'deposito' | 'gasto' | 'ajuste' | 'otro';

export interface CashMovement {
  id: string;
  corteId?: string;
  tipo: CashMovementTipo;
  concepto: CashMovementConcepto;
  monto: number;
  notas: string;
  cajero: string;
  fecha: string;
}

// === Loyalty Transactions ===
export type LoyaltyTipo = 'acumulacion' | 'canje' | 'ajuste' | 'expiracion';

export interface LoyaltyTransaction {
  id: string;
  clienteId: string;
  clienteName: string;
  tipo: LoyaltyTipo;
  puntos: number;
  saldoAnterior: number;
  saldoNuevo: number;
  saleId?: string;
  saleFolio?: string;
  notas: string;
  cajero: string;
  fecha: string;
}

// === Servicios (Recargas y Pagos) ===
export interface Servicio {
  id: string;
  tipo: 'recarga' | 'servicio';
  categoria: string;
  nombre: string;
  monto: number;
  comision: number;
  numeroReferencia: string;
  folio: string;
  estado: ServicioEstado;
  cajero: string;
  fecha: string;
  // Provider tracking
  providerId: string;
  providerTransactionId?: string;
  providerAuthCode?: string;
  providerError?: string;
  providerRespondedAt?: string;
}

// === ABC Inventory Classification (Pareto) ===
export type ABCClassification = 'A' | 'B' | 'C';

export interface ABCProduct {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  totalRevenue: number;
  totalQuantity: number;
  revenuePercentage: number;
  cumulativePercentage: number;
  classification: ABCClassification;
  currentStock: number;
  costPrice: number;
  unitPrice: number;
}

// === Inventory Aging ===
export type AgingBucket = '0-30' | '30-60' | '60-90' | '90+';
export interface AgingProduct {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  currentStock: number;
  costPrice: number;
  stockValue: number;
  daysSinceLastSale: number | null;
  bucket: AgingBucket;
  expirationDate: string | null;
  isPerishable: boolean;
}
export interface InventoryAgingAnalysis {
  products: AgingProduct[];
  buckets: Record<AgingBucket, { count: number; value: number; skuCount: number }>;
  totalStockValue: number;
  deadStockCount: number;
}

// === Product Margin Report ===
export interface ProductMarginRow {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  costPrice: number;
  unitPrice: number;
  marginPercent: number;
  unitsSold: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}
export interface ProductMarginReport {
  products: ProductMarginRow[];
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    avgMargin: number;
  };
  byCategory: Array<{ category: string; revenue: number; cost: number; profit: number; margin: number }>;
}

export interface ABCAnalysis {
  products: ABCProduct[];
  summary: {
    A: { count: number; revenueShare: number; skuShare: number };
    B: { count: number; revenueShare: number; skuShare: number };
    C: { count: number; revenueShare: number; skuShare: number };
  };
  totalRevenue: number;
  periodDays: number;
}

// === Smart Reorder (Auto-pedido) ===
export interface ReorderSuggestion {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  minStock: number;
  avgDailySales: number;
  daysUntilStockout: number;
  suggestedQuantity: number;
  estimatedCost: number;
  supplier: string | null;
  urgency: 'critical' | 'warning' | 'normal';
}

// === RFM Customer Analysis ===
export type RFMSegment =
  | 'champions'
  | 'loyal'
  | 'potential_loyal'
  | 'recent'
  | 'promising'
  | 'needs_attention'
  | 'about_to_sleep'
  | 'at_risk'
  | 'lost';

export interface RFMCustomer {
  clienteId: string;
  clienteName: string;
  phone: string;
  recency: number; // days since last purchase
  frequency: number; // purchases in period
  monetary: number; // total spent in period
  rScore: number; // 1-5
  fScore: number; // 1-5
  mScore: number; // 1-5
  segment: RFMSegment;
  balance: number;
  points: number;
}

export interface RFMAnalysis {
  customers: RFMCustomer[];
  segments: Record<RFMSegment, number>;
  averageRecency: number;
  averageFrequency: number;
  averageMonetary: number;
}

export const RFM_SEGMENT_LABELS: Record<RFMSegment, string> = {
  champions: 'Campeones',
  loyal: 'Leales',
  potential_loyal: 'Potenciales leales',
  recent: 'Nuevos',
  promising: 'Prometedores',
  needs_attention: 'Necesitan atención',
  about_to_sleep: 'Por dormirse',
  at_risk: 'En riesgo',
  lost: 'Perdidos',
};

// === Demand Forecasting ===
export interface ForecastProduct {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  currentStock: number;
  avgDailySales: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  forecastNextWeek: number;
  forecastNextMonth: number;
  daysOfStock: number;
  confidence: 'high' | 'medium' | 'low';
  historicalWeekly: number[]; // last 8 weeks of sales
}

// === CFDI / Facturación Electrónica (Próximamente — pendiente integración con PAC) ===
export const CFDI_USOS = [
  { clave: 'G01', descripcion: 'Adquisición de mercancías' },
  { clave: 'G03', descripcion: 'Gastos en general' },
  { clave: 'P01', descripcion: 'Por definir' },
  { clave: 'S01', descripcion: 'Sin efectos fiscales' },
] as const;

export const CFDI_REGIMENES = [
  { clave: '601', descripcion: 'General de Ley Personas Morales' },
  { clave: '603', descripcion: 'Personas Morales con Fines no Lucrativos' },
  { clave: '605', descripcion: 'Sueldos y Salarios' },
  { clave: '606', descripcion: 'Arrendamiento' },
  { clave: '608', descripcion: 'Demás ingresos' },
  { clave: '612', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave: '616', descripcion: 'Sin obligaciones fiscales' },
  { clave: '621', descripcion: 'Incorporación Fiscal' },
  {
    clave: '625',
    descripcion: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
  },
  { clave: '626', descripcion: 'Régimen Simplificado de Confianza' },
] as const;

export interface CFDIRequest {
  saleId: string;
  receptorRfc: string;
  receptorNombre: string;
  receptorRegimenFiscal: string;
  receptorDomicilioFiscal: string;
  usoCfdi: string;
}

export interface CFDIRecord {
  id: string;
  saleId: string;
  folio: string;
  uuid: string;
  receptorRfc: string;
  receptorNombre: string;
  total: number;
  status: 'timbrada' | 'cancelada' | 'error';
  xmlUrl: string;
  pdfUrl: string;
  fechaTimbrado: string;
  createdAt: string;
}

// === Promociones ===
export const PROMOTION_TYPES = ['percentage', 'fixed', 'bogo', 'bundle'] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  percentage: 'Porcentaje de descuento',
  fixed: 'Descuento fijo',
  bogo: 'Compra X lleva Y',
  bundle: 'Paquete / combo',
};

export const APPLICABLE_TO_OPTIONS = ['all', 'category', 'product'] as const;
export type ApplicableTo = (typeof APPLICABLE_TO_OPTIONS)[number];

export interface Promotion {
  id: string;
  name: string;
  description: string;
  type: PromotionType;
  value: number;
  minPurchase: number;
  maxDiscount: number | null;
  applicableTo: ApplicableTo;
  applicableIds: string[];
  startDate: string;
  endDate: string;
  active: boolean;
  usageLimit: number | null;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
