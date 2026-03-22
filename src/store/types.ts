import type {
  DashboardState, KPIData, InventoryAlert, SalesData,
  StoreConfig, SaleRecord, SaleItem, CorteCaja, Cliente,
  MermaRecord, PedidoRecord, Product, Gasto, Proveedor,
  RoleDefinition, UserRoleRecord, PermissionKey, InventoryAudit,
  Devolucion, DevolucionItem, CashMovement, LoyaltyTransaction,
} from '@/types';

// Re-export for convenience
export type { StoreConfig };

// === Slice interfaces ===

export interface SalesSlice {
  registerSale: (sale: Omit<SaleRecord, 'id' | 'folio' | 'date'>) => Promise<SaleRecord>;
  cancelSale: (id: string) => Promise<void>;
  deleteSales: (ids: string[]) => Promise<void>;
  deleteCortes: (ids: string[]) => Promise<void>;
  createCorteCaja: (data: { cajero: string; efectivoContado: number; fondoInicial: number; notas: string }) => Promise<CorteCaja>;
  checkMidnightCorte: () => Promise<void>;
  registerDevolucion: (data: {
    saleId: string;
    saleFolio: string;
    tipo: Devolucion['tipo'];
    motivo: Devolucion['motivo'];
    notas: string;
    montoDevuelto: number;
    metodoDev: Devolucion['metodoDev'];
    cajero: string;
    clienteId?: string;
    items: Omit<DevolucionItem, 'id'>[];
  }) => Promise<Devolucion>;
  addCashMovement: (data: {
    corteId?: string;
    tipo: CashMovement['tipo'];
    concepto: CashMovement['concepto'];
    monto: number;
    notas: string;
    cajero: string;
  }) => Promise<CashMovement>;
  fetchLoyaltyTransactions: (clienteId?: string) => Promise<void>;
}

export interface InventorySlice {
  registerMerma: (merma: Omit<MermaRecord, 'id'>) => Promise<void>;
  adjustStock: (productId: string, newStock: number, reason: string) => Promise<void>;
  registerProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  getAllProducts: () => Product[];
  createInventoryAudit: (data: { title: string; auditor: string; notes: string }) => Promise<string>;
  completeInventoryAudit: (id: string) => Promise<void>;
}

export interface CustomerSlice {
  addCliente: (cliente: Omit<Cliente, 'id' | 'balance' | 'createdAt' | 'lastTransaction'>) => Promise<void>;
  updateCliente: (id: string, data: Partial<Cliente>) => Promise<void>;
  deleteCliente: (id: string) => Promise<void>;
  registerFiado: (clienteId: string, amount: number, description: string, saleFolio?: string, items?: SaleItem[]) => Promise<void>;
  registerAbono: (clienteId: string, amount: number, description: string) => Promise<void>;
}

export interface FinanceSlice {
  registerGasto: (gasto: Omit<Gasto, 'id'>) => Promise<void>;
  updateGasto: (id: string, data: Partial<Gasto>) => Promise<void>;
  deleteGasto: (id: string) => Promise<void>;
  addProveedor: (proveedor: Omit<Proveedor, 'id' | 'ultimoPedido'>) => Promise<Proveedor>;
  updateProveedor: (id: string, data: Partial<Proveedor>) => Promise<void>;
  deleteProveedor: (id: string) => Promise<void>;
  createPedido: (pedido: Omit<PedidoRecord, 'id' | 'fecha' | 'estado'>) => Promise<PedidoRecord>;
  updatePedidoStatus: (id: string, estado: 'pendiente' | 'enviado' | 'recibido') => Promise<void>;
  receivePedido: (id: string) => Promise<void>;
}

export interface RoleSlice {
  roleDefinitions: RoleDefinition[];
  userRoles: UserRoleRecord[];
  currentUserRole: UserRoleRecord | null;
  fetchRoleDefinitions: () => Promise<void>;
  createRoleDefinition: (data: { name: string; description: string; permissions: PermissionKey[] }, createdByUid: string) => Promise<RoleDefinition>;
  updateRoleDefinition: (id: string, data: { name?: string; description?: string; permissions?: PermissionKey[] }) => Promise<void>;
  deleteRoleDefinition: (id: string) => Promise<void>;
  fetchRoles: () => Promise<void>;
  ensureOwnerRole: (firebaseUid: string, email: string, displayName: string) => Promise<UserRoleRecord>;
  assignRole: (data: { firebaseUid: string; email: string; displayName: string; roleId: string }, assignedByUid: string) => Promise<void>;
  createUserWithRole: (data: { email: string; password?: string; displayName: string; roleId: string; pinCode?: string }, assignedByUid: string) => Promise<void>;
  updateRole: (firebaseUid: string, newRoleId: string, assignedByUid: string) => Promise<void>;
  updateUserPin: (firebaseUid: string, pinCode: string) => Promise<void>;
  removeRole: (firebaseUid: string) => Promise<void>;
  getUserRole: (firebaseUid: string) => Promise<UserRoleRecord | null>;
  generateGlobalId: (firebaseUid: string) => Promise<string>;
  deactivateUser: (firebaseUid: string) => Promise<void>;
  reactivateUser: (firebaseUid: string) => Promise<void>;
  updateUserProfile: (firebaseUid: string, data: { displayName?: string; avatarUrl?: string }) => Promise<UserRoleRecord>;
  authorizePin: (pinCode: string, requiredPermission: PermissionKey) => Promise<{ success: boolean; authorizedByUid?: string; userDisplayName?: string; error?: string }>;
}

export interface CoreSlice extends DashboardState {
  storeConfig: StoreConfig;
  setKPIData: (data: KPIData) => void;
  setInventoryAlerts: (alerts: InventoryAlert[]) => void;
  setSalesData: (data: SalesData[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchDashboardData: () => Promise<void>;
  saveStoreConfig: (data: Partial<StoreConfig>) => Promise<void>;
}

/** Full combined store type — used by all slices and consumers */
export type DashboardStore = CoreSlice & SalesSlice & InventorySlice & CustomerSlice & FinanceSlice & RoleSlice;

/** Zustand set/get helpers, typed to the full store */
export type StoreSet = (partial: Partial<DashboardStore> | ((state: DashboardStore) => Partial<DashboardStore>)) => void;
export type StoreGet = () => DashboardStore;
