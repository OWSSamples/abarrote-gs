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
export type UserRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'viewer';

export interface UserRoleRecord {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  role: UserRole;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
}

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
  | 'roles.manage';

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  manager: 'Gerente',
  cashier: 'Cajero',
  viewer: 'Solo lectura',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: 'Acceso total al sistema. Puede gestionar roles y toda la configuración.',
  admin: 'Acceso completo excepto cambiar al dueño. Puede asignar roles menores.',
  manager: 'Gestión de inventario, proveedores, reportes y gastos.',
  cashier: 'Punto de venta, cortes de caja y consulta de inventario.',
  viewer: 'Solo puede ver información. No puede modificar nada.',
};

export const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  owner: [
    'dashboard.view', 'sales.create', 'sales.view', 'sales.cancel',
    'inventory.view', 'inventory.edit', 'inventory.create', 'inventory.delete',
    'customers.view', 'customers.edit', 'fiado.create', 'fiado.view',
    'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete',
    'suppliers.view', 'suppliers.edit', 'pedidos.view', 'pedidos.create',
    'analytics.view', 'reports.view', 'reports.export',
    'corte.create', 'corte.view',
    'settings.view', 'settings.edit', 'roles.manage',
  ],
  admin: [
    'dashboard.view', 'sales.create', 'sales.view', 'sales.cancel',
    'inventory.view', 'inventory.edit', 'inventory.create', 'inventory.delete',
    'customers.view', 'customers.edit', 'fiado.create', 'fiado.view',
    'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete',
    'suppliers.view', 'suppliers.edit', 'pedidos.view', 'pedidos.create',
    'analytics.view', 'reports.view', 'reports.export',
    'corte.create', 'corte.view',
    'settings.view', 'settings.edit', 'roles.manage',
  ],
  manager: [
    'dashboard.view', 'sales.view',
    'inventory.view', 'inventory.edit', 'inventory.create',
    'customers.view', 'customers.edit', 'fiado.create', 'fiado.view',
    'expenses.view', 'expenses.create', 'expenses.edit',
    'suppliers.view', 'suppliers.edit', 'pedidos.view', 'pedidos.create',
    'analytics.view', 'reports.view', 'reports.export',
    'corte.view',
  ],
  cashier: [
    'dashboard.view', 'sales.create', 'sales.view',
    'inventory.view',
    'customers.view', 'fiado.create', 'fiado.view',
    'corte.create', 'corte.view',
  ],
  viewer: [
    'dashboard.view', 'sales.view', 'inventory.view',
    'customers.view', 'fiado.view', 'expenses.view',
    'suppliers.view', 'pedidos.view', 'analytics.view',
    'reports.view', 'corte.view',
  ],
};

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
  'analytics.view': 'Ver análisis',
  'reports.view': 'Ver reportes',
  'reports.export': 'Exportar reportes',
  'corte.create': 'Hacer corte de caja',
  'corte.view': 'Ver cortes',
  'settings.view': 'Ver configuración',
  'settings.edit': 'Editar configuración',
  'roles.manage': 'Gestionar roles',
};
