// Tipos para el Dashboard de Abarrotes

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
};

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
  isPerishable: boolean;
}

export interface InventoryAlert {
  id: string;
  product: Product;
  alertType: 'low_stock' | 'expiration' | 'expired' | 'merma';
  severity: 'critical' | 'warning' | 'info';
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

export interface MermaRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: 'expiration' | 'damage' | 'spoilage' | 'other';
  date: string;
  value: number;
}

export type AlertStatus = 'critical' | 'warning' | 'info';

export interface PedidoRecord {
  id: string;
  proveedor: string;
  productos: { productId: string; productName: string; cantidad: number }[];
  notas: string;
  fecha: string;
  estado: 'pendiente' | 'enviado' | 'recibido';
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
  paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia' | 'fiado';
  amountPaid: number;
  change: number;
  date: string;
  cajero: string;
  pointsEarned: number;
  pointsUsed: number;
}

export interface DashboardState {
  kpiData: KPIData | null;
  inventoryAlerts: InventoryAlert[];
  products: Product[];
  salesData: SalesData[];
  saleRecords: SaleRecord[];
  mermaRecords: MermaRecord[];
  pedidos: PedidoRecord[];
  clientes: Cliente[];
  fiadoTransactions: FiadoTransaction[];
  gastos: Gasto[];
  proveedores: Proveedor[];
  cortesHistory: CorteCaja[];
  inventoryAudits: InventoryAudit[];
  isLoading: boolean;
  error: string | null;
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
  status: 'abierto' | 'cerrado';
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
  status: 'draft' | 'completed';
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
export type GastoCategoria = 'renta' | 'servicios' | 'proveedores' | 'salarios' | 'mantenimiento' | 'impuestos' | 'otro';

export interface Gasto {
  id: string;
  concepto: string;
  categoria: GastoCategoria;
  monto: number;
  fecha: string;
  notas: string;
  comprobante: boolean;
}

// === Roles y Permisos ===

export type PermissionKey =
  | 'dashboard.view'
  | 'sales.create'
  | 'sales.view'
  | 'sales.cancel'
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
  | 'notifications.edit';

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
  roleId: string;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
}

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'dashboard.view': 'Ver dashboard',
  'sales.create': 'Registrar ventas',
  'sales.view': 'Ver ventas',
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
};

export const PERMISSION_GROUPS: { title: string; permissions: PermissionKey[] }[] = [
  { title: 'Dashboard', permissions: ['dashboard.view'] },
  { title: 'Ventas', permissions: ['sales.create', 'sales.view', 'sales.cancel', 'corte.create', 'corte.view'] },
  { title: 'Inventario', permissions: ['inventory.view', 'inventory.edit', 'inventory.create', 'inventory.delete'] },
  { title: 'Clientes', permissions: ['customers.view', 'customers.edit', 'fiado.create', 'fiado.view'] },
  { title: 'Gastos', permissions: ['expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete'] },
  { title: 'Proveedores y Pedidos', permissions: ['suppliers.view', 'suppliers.edit', 'pedidos.view', 'pedidos.create'] },
  { title: 'Reportes', permissions: ['analytics.view', 'reports.view', 'reports.export'] },
  { title: 'Sistema', permissions: ['settings.view', 'settings.edit', 'roles.manage'] },
];

export const ALL_PERMISSIONS: PermissionKey[] = [
  'dashboard.view', 'sales.create', 'sales.view', 'sales.cancel',
  'inventory.view', 'inventory.edit', 'inventory.create', 'inventory.delete',
  'customers.view', 'customers.edit', 'fiado.create', 'fiado.view',
  'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete',
  'suppliers.view', 'suppliers.edit', 'pedidos.view', 'pedidos.create',
  'analytics.view', 'reports.view', 'reports.export',
  'corte.create', 'corte.view',
  'settings.view', 'settings.edit', 'roles.manage',
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
    permissions: ALL_PERMISSIONS.filter(p => p !== 'roles.manage'),
    isSystem: true,
    createdBy: 'system',
  },
  {
    name: 'Gerente',
    description: 'Gestion de inventario, proveedores, reportes y gastos.',
    permissions: [
      'dashboard.view', 'sales.view',
      'inventory.view', 'inventory.edit', 'inventory.create',
      'customers.view', 'customers.edit', 'fiado.create', 'fiado.view',
      'expenses.view', 'expenses.create', 'expenses.edit',
      'suppliers.view', 'suppliers.edit', 'pedidos.view', 'pedidos.create',
      'analytics.view', 'reports.view', 'reports.export', 'corte.view',
      'servicios.view', 'servicios.create', 'servicios.edit',
    ],
    isSystem: true,
    createdBy: 'system',
  },
  {
    name: 'Cajero',
    description: 'Punto de venta, cortes de caja y consulta de inventario.',
    permissions: [
      'dashboard.view', 'sales.create', 'sales.view',
      'inventory.view', 'customers.view', 'fiado.create', 'fiado.view',
      'corte.create', 'corte.view', 'servicios.create', 'servicios.view',
    ],
    isSystem: true,
    createdBy: 'system',
  },
  {
    name: 'Solo lectura',
    description: 'Solo puede ver informacion. No puede modificar nada.',
    permissions: [
      'dashboard.view', 'sales.view', 'inventory.view',
      'customers.view', 'fiado.view', 'expenses.view',
      'suppliers.view', 'pedidos.view', 'analytics.view',
      'reports.view', 'corte.view', 'servicios.view',
    ],
    isSystem: true,
    createdBy: 'system',
  },
];

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
  estado: 'completado' | 'pendiente' | 'cancelado';
  cajero: string;
  fecha: string;
}
