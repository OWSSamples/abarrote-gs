import { create } from 'zustand';
import {
  DashboardState, KPIData, InventoryAlert, SalesData, MermaRecord, PedidoRecord,
  Product, SaleRecord, SaleItem, CorteCaja, Cliente, FiadoTransaction, Gasto, GastoCategoria,
  Proveedor, StoreConfig, DEFAULT_STORE_CONFIG,
  UserRoleRecord, RoleDefinition, PermissionKey,
} from '@/types';
import {
  fetchDashboardFromDB,
  createProduct as dbCreateProduct,
  createSale as dbCreateSale,
  createMerma as dbCreateMerma,
  createPedido as dbCreatePedido,
  createCliente as dbCreateCliente,
  createFiado as dbCreateFiado,
  createAbono as dbCreateAbono,
  createGasto as dbCreateGasto,
  createProveedor as dbCreateProveedor,
  updateProveedor as dbUpdateProveedor,
  createCorteCaja as dbCreateCorteCaja,
  updateProductStock as dbUpdateProductStock,
  deleteProduct as dbDeleteProduct,
  fetchStoreConfig as dbFetchStoreConfig,
  saveStoreConfig as dbSaveStoreConfig,
  fetchInventoryAlerts,
  fetchKPIData,
  updateProduct as dbUpdateProduct,
  updateGasto as dbUpdateGasto,
  deleteGasto as dbDeleteGasto,
  updateCliente as dbUpdateCliente,
  deleteCliente as dbDeleteCliente,
  updatePedidoStatus as dbUpdatePedidoStatus,
  receivePedido as dbReceivePedido,
  cancelSale as dbCancelSale,
  deleteProveedor as dbDeleteProveedor,
  fetchUserRoles as dbFetchUserRoles,
  assignUserRole as dbAssignUserRole,
  updateUserRole as dbUpdateUserRole,
  removeUserRole as dbRemoveUserRole,
  ensureOwnerRole as dbEnsureOwnerRole,
  getUserRoleByUid as dbGetUserRoleByUid,
  fetchRoleDefinitions as dbFetchRoleDefinitions,
  createRoleDefinition as dbCreateRoleDefinition,
  updateRoleDefinition as dbUpdateRoleDefinition,
  deleteRoleDefinition as dbDeleteRoleDefinition,
} from '@/app/actions/db-actions';

interface DashboardStore extends DashboardState {
  storeConfig: StoreConfig;
  setKPIData: (data: KPIData) => void;
  setInventoryAlerts: (alerts: InventoryAlert[]) => void;
  setSalesData: (data: SalesData[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchDashboardData: () => Promise<void>;
  registerMerma: (merma: Omit<MermaRecord, 'id'>) => Promise<void>;
  adjustStock: (productId: string, newStock: number, reason: string) => Promise<void>;
  createPedido: (pedido: Omit<PedidoRecord, 'id' | 'fecha' | 'estado'>) => Promise<void>;
  registerProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  registerSale: (sale: Omit<SaleRecord, 'id' | 'folio' | 'date'>) => Promise<SaleRecord>;
  getAllProducts: () => Product[];
  // Corte de Caja
  createCorteCaja: (data: { cajero: string; efectivoContado: number; fondoInicial: number; notas: string }) => Promise<CorteCaja>;
  // Fiado / Crédito
  addCliente: (cliente: Omit<Cliente, 'id' | 'balance' | 'createdAt' | 'lastTransaction'>) => Promise<void>;
  registerFiado: (clienteId: string, amount: number, description: string, saleFolio?: string, items?: SaleItem[]) => Promise<void>;
  registerAbono: (clienteId: string, amount: number, description: string) => Promise<void>;
  // Gastos
  registerGasto: (gasto: Omit<Gasto, 'id'>) => Promise<void>;
  // Proveedores
  addProveedor: (proveedor: Omit<Proveedor, 'id' | 'ultimoPedido'>) => Promise<void>;
  updateProveedor: (id: string, data: Partial<Proveedor>) => Promise<void>;
  deleteProveedor: (id: string) => Promise<void>;
  // Store Config
  saveStoreConfig: (data: Partial<StoreConfig>) => Promise<void>;
  // Edit Product
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  // Edit/Delete Gasto
  updateGasto: (id: string, data: Partial<Gasto>) => Promise<void>;
  deleteGasto: (id: string) => Promise<void>;
  // Edit/Delete Cliente
  updateCliente: (id: string, data: Partial<Cliente>) => Promise<void>;
  deleteCliente: (id: string) => Promise<void>;
  // Pedido status + receive
  updatePedidoStatus: (id: string, estado: 'pendiente' | 'enviado' | 'recibido') => Promise<void>;
  receivePedido: (id: string) => Promise<void>;
  // Cancel sale
  cancelSale: (id: string) => Promise<void>;
  // Role Definitions
  roleDefinitions: RoleDefinition[];
  fetchRoleDefinitions: () => Promise<void>;
  createRoleDefinition: (data: { name: string; description: string; permissions: PermissionKey[] }, createdByUid: string) => Promise<RoleDefinition>;
  updateRoleDefinition: (id: string, data: { name?: string; description?: string; permissions?: PermissionKey[] }) => Promise<void>;
  deleteRoleDefinition: (id: string) => Promise<void>;
  // User Roles
  userRoles: UserRoleRecord[];
  currentUserRole: UserRoleRecord | null;
  fetchRoles: () => Promise<void>;
  ensureOwnerRole: (firebaseUid: string, email: string, displayName: string) => Promise<UserRoleRecord>;
  assignRole: (data: { firebaseUid: string; email: string; displayName: string; roleId: string }, assignedByUid: string) => Promise<void>;
  updateRole: (firebaseUid: string, newRoleId: string, assignedByUid: string) => Promise<void>;
  removeRole: (firebaseUid: string) => Promise<void>;
  getUserRole: (firebaseUid: string) => Promise<UserRoleRecord | null>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  kpiData: null,
  inventoryAlerts: [],
  products: [],
  salesData: [],
  saleRecords: [],
  mermaRecords: [],
  pedidos: [],
  clientes: [],
  fiadoTransactions: [],
  gastos: [],
  proveedores: [],
  cortesHistory: [],
  storeConfig: DEFAULT_STORE_CONFIG,
  roleDefinitions: [],
  userRoles: [],
  currentUserRole: null,
  isLoading: false,
  error: null,

  setKPIData: (data) => set({ kpiData: data }),
  setInventoryAlerts: (alerts) => set({ inventoryAlerts: alerts }),
  setSalesData: (data) => set({ salesData: data }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // ==================== FETCH FROM DATABASE ====================
  fetchDashboardData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await fetchDashboardFromDB();
      set({
        kpiData: data.kpiData,
        products: data.products,
        inventoryAlerts: data.inventoryAlerts,
        salesData: data.salesData,
        saleRecords: data.saleRecords,
        mermaRecords: data.mermaRecords,
        pedidos: data.pedidos,
        clientes: data.clientes,
        fiadoTransactions: data.fiadoTransactions,
        gastos: data.gastos,
        proveedores: data.proveedores,
        cortesHistory: data.cortesHistory,
        storeConfig: data.storeConfig,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      set({
        error: 'Error al cargar los datos del dashboard. Verifica tu conexión a la base de datos.',
        isLoading: false,
      });
    }
  },

  // ==================== MERMAS ====================
  registerMerma: async (merma) => {
    try {
      const newRecord = await dbCreateMerma(merma);
      const state = get();

      // Optimistic update + refresh from DB
      set({ mermaRecords: [newRecord, ...state.mermaRecords] });

      const [alerts, kpi] = await Promise.all([fetchInventoryAlerts(), fetchKPIData()]);
      set({ inventoryAlerts: alerts, kpiData: kpi });
    } catch (error) {
      console.error('Error registering merma:', error);
    }
  },

  // ==================== AJUSTAR STOCK ====================
  adjustStock: async (productId, newStock, _reason) => {
    try {
      await dbUpdateProductStock(productId, newStock);

      const [alerts, kpi] = await Promise.all([fetchInventoryAlerts(), fetchKPIData()]);
      set({ inventoryAlerts: alerts, kpiData: kpi });
    } catch (error) {
      console.error('Error adjusting stock:', error);
    }
  },

  // ==================== PEDIDOS ====================
  createPedido: async (pedido) => {
    try {
      const newPedido = await dbCreatePedido(pedido);
      const state = get();
      set({ pedidos: [newPedido, ...state.pedidos] });
    } catch (error) {
      console.error('Error creating pedido:', error);
    }
  },

  // ==================== REGISTRAR PRODUCTO ====================
  registerProduct: async (productData) => {
    try {
      const newProduct = await dbCreateProduct(productData);
      const state = get();

      set({ products: [...state.products, newProduct] });

      const alerts = await fetchInventoryAlerts();
      set({ inventoryAlerts: alerts });
    } catch (error) {
      console.error('Error registering product:', error);
    }
  },

  // ==================== ELIMINAR PRODUCTO ====================
  deleteProduct: async (productId) => {
    try {
      await dbDeleteProduct(productId);
      const state = get();
      set({
        products: state.products.filter(p => p.id !== productId),
        inventoryAlerts: state.inventoryAlerts.filter(a => a.product.id !== productId),
      });
      const kpi = await fetchKPIData();
      set({ kpiData: kpi });
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },

  // ==================== REGISTRAR VENTA ====================
  registerSale: async (saleData) => {
    try {
      const newSale = await dbCreateSale(saleData);
      const state = get();

      set({ saleRecords: [newSale, ...state.saleRecords] });

      const [alerts, kpi] = await Promise.all([fetchInventoryAlerts(), fetchKPIData()]);
      set({ inventoryAlerts: alerts, kpiData: kpi });

      return newSale;
    } catch (error) {
      console.error('Error registering sale:', error);
      throw error;
    }
  },

  getAllProducts: () => {
    const state = get();
    const alertProducts = state.inventoryAlerts.map((a) => a.product);
    const allProducts = [...alertProducts];
    state.products.forEach((p) => {
      if (!allProducts.find((ap) => ap.id === p.id)) {
        allProducts.push(p);
      }
    });
    return allProducts;
  },

  // ==================== CORTE DE CAJA ====================
  createCorteCaja: async (data) => {
    try {
      const corte = await dbCreateCorteCaja(data);
      const state = get();
      set({ cortesHistory: [corte, ...state.cortesHistory] });
      return corte;
    } catch (error) {
      console.error('Error creating corte de caja:', error);
      throw error;
    }
  },

  // ==================== FIADO / CRÉDITO ====================
  addCliente: async (clienteData) => {
    try {
      const newCliente = await dbCreateCliente(clienteData);
      const state = get();
      set({ clientes: [...state.clientes, newCliente] });
    } catch (error) {
      console.error('Error adding cliente:', error);
    }
  },

  registerFiado: async (clienteId, amount, description, saleFolio, items) => {
    try {
      await dbCreateFiado(clienteId, amount, description, saleFolio, items);

      // Refresh from DB to get updated balances
      const dashData = await fetchDashboardFromDB();
      set({
        clientes: dashData.clientes,
        fiadoTransactions: dashData.fiadoTransactions,
      });
    } catch (error) {
      console.error('Error registering fiado:', error);
    }
  },

  registerAbono: async (clienteId, amount, description) => {
    try {
      await dbCreateAbono(clienteId, amount, description);

      const dashData = await fetchDashboardFromDB();
      set({
        clientes: dashData.clientes,
        fiadoTransactions: dashData.fiadoTransactions,
      });
    } catch (error) {
      console.error('Error registering abono:', error);
    }
  },

  // ==================== GASTOS ====================
  registerGasto: async (gastoData) => {
    try {
      const newGasto = await dbCreateGasto(gastoData);
      const state = get();
      set({ gastos: [newGasto, ...state.gastos] });
    } catch (error) {
      console.error('Error registering gasto:', error);
    }
  },

  // ==================== PROVEEDORES ====================
  addProveedor: async (proveedorData) => {
    try {
      const newProveedor = await dbCreateProveedor(proveedorData);
      const state = get();
      set({ proveedores: [...state.proveedores, newProveedor] });
    } catch (error) {
      console.error('Error adding proveedor:', error);
    }
  },

  updateProveedor: async (id, data) => {
    try {
      await dbUpdateProveedor(id, data);
      const state = get();
      const updated = state.proveedores.map(p =>
        p.id === id ? { ...p, ...data } : p
      );
      set({ proveedores: updated });
    } catch (error) {
      console.error('Error updating proveedor:', error);
    }
  },

  // ==================== STORE CONFIG ====================
  saveStoreConfig: async (data) => {
    try {
      const updatedConfig = await dbSaveStoreConfig(data);
      set({ storeConfig: updatedConfig });
    } catch (error) {
      console.error('Error saving store config:', error);
    }
  },

  // ==================== EDITAR PRODUCTO ====================
  updateProduct: async (id, data) => {
    try {
      await dbUpdateProduct(id, data);
      const state = get();
      const updated = state.products.map(p => p.id === id ? { ...p, ...data } : p);
      set({ products: updated });
      const [alerts, kpi] = await Promise.all([fetchInventoryAlerts(), fetchKPIData()]);
      set({ inventoryAlerts: alerts, kpiData: kpi });
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  // ==================== EDITAR / ELIMINAR GASTO ====================
  updateGasto: async (id, data) => {
    try {
      await dbUpdateGasto(id, data);
      const state = get();
      set({ gastos: state.gastos.map(g => g.id === id ? { ...g, ...data } : g) });
    } catch (error) {
      console.error('Error updating gasto:', error);
      throw error;
    }
  },

  deleteGasto: async (id) => {
    try {
      await dbDeleteGasto(id);
      const state = get();
      set({ gastos: state.gastos.filter(g => g.id !== id) });
    } catch (error) {
      console.error('Error deleting gasto:', error);
      throw error;
    }
  },

  // ==================== EDITAR / ELIMINAR CLIENTE ====================
  updateCliente: async (id, data) => {
    try {
      await dbUpdateCliente(id, data);
      const state = get();
      set({ clientes: state.clientes.map(c => c.id === id ? { ...c, ...data } : c) });
    } catch (error) {
      console.error('Error updating cliente:', error);
      throw error;
    }
  },

  deleteCliente: async (id) => {
    try {
      await dbDeleteCliente(id);
      const state = get();
      set({
        clientes: state.clientes.filter(c => c.id !== id),
        fiadoTransactions: state.fiadoTransactions.filter(t => t.clienteId !== id),
      });
    } catch (error) {
      console.error('Error deleting cliente:', error);
      throw error;
    }
  },

  // ==================== PEDIDO STATUS + RECEPCIÓN ====================
  updatePedidoStatus: async (id, estado) => {
    try {
      await dbUpdatePedidoStatus(id, estado);
      const state = get();
      set({ pedidos: state.pedidos.map(p => p.id === id ? { ...p, estado } : p) });
    } catch (error) {
      console.error('Error updating pedido status:', error);
      throw error;
    }
  },

  receivePedido: async (id) => {
    try {
      await dbReceivePedido(id);
      const state = get();
      set({ pedidos: state.pedidos.map(p => p.id === id ? { ...p, estado: 'recibido' as const } : p) });
      // Refresh stock data
      const dashData = await fetchDashboardFromDB();
      set({
        products: dashData.products,
        inventoryAlerts: dashData.inventoryAlerts,
        kpiData: dashData.kpiData,
      });
    } catch (error) {
      console.error('Error receiving pedido:', error);
      throw error;
    }
  },

  // ==================== CANCELAR VENTA ====================
  cancelSale: async (id) => {
    try {
      await dbCancelSale(id);
      const state = get();
      set({ saleRecords: state.saleRecords.filter(s => s.id !== id) });
      // Refresh stock + KPI
      const [alerts, kpi] = await Promise.all([fetchInventoryAlerts(), fetchKPIData()]);
      set({ inventoryAlerts: alerts, kpiData: kpi });
    } catch (error) {
      console.error('Error canceling sale:', error);
      throw error;
    }
  },

  // ==================== ELIMINAR PROVEEDOR ====================
  deleteProveedor: async (id) => {
    try {
      await dbDeleteProveedor(id);
      const state = get();
      set({ proveedores: state.proveedores.filter(p => p.id !== id) });
    } catch (error) {
      console.error('Error deleting proveedor:', error);
      throw error;
    }
  },

  // ==================== DEFINICIONES DE ROL ====================
  fetchRoleDefinitions: async () => {
    try {
      const defs = await dbFetchRoleDefinitions();
      set({ roleDefinitions: defs });
    } catch (error) {
      console.error('Error fetching role definitions:', error);
    }
  },

  createRoleDefinition: async (data, createdByUid) => {
    try {
      const newDef = await dbCreateRoleDefinition(data, createdByUid);
      const state = get();
      set({ roleDefinitions: [...state.roleDefinitions, newDef] });
      return newDef;
    } catch (error) {
      console.error('Error creating role definition:', error);
      throw error;
    }
  },

  updateRoleDefinition: async (id, data) => {
    try {
      await dbUpdateRoleDefinition(id, data);
      const state = get();
      set({ roleDefinitions: state.roleDefinitions.map(d => d.id === id ? { ...d, ...data, updatedAt: new Date().toISOString() } : d) });
    } catch (error) {
      console.error('Error updating role definition:', error);
      throw error;
    }
  },

  deleteRoleDefinition: async (id) => {
    try {
      await dbDeleteRoleDefinition(id);
      const state = get();
      set({ roleDefinitions: state.roleDefinitions.filter(d => d.id !== id) });
    } catch (error) {
      console.error('Error deleting role definition:', error);
      throw error;
    }
  },

  // ==================== ROLES DE USUARIOS ====================
  fetchRoles: async () => {
    try {
      const roles = await dbFetchUserRoles();
      set({ userRoles: roles });
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  },

  ensureOwnerRole: async (firebaseUid, email, displayName) => {
    try {
      const role = await dbEnsureOwnerRole(firebaseUid, email, displayName);
      set({ currentUserRole: role });
      return role;
    } catch (error) {
      console.error('Error ensuring owner role:', error);
      throw error;
    }
  },

  assignRole: async (data, assignedByUid) => {
    try {
      const newRole = await dbAssignUserRole(data, assignedByUid);
      const state = get();
      const existing = state.userRoles.find(r => r.firebaseUid === data.firebaseUid);
      if (existing) {
        set({ userRoles: state.userRoles.map(r => r.firebaseUid === data.firebaseUid ? newRole : r) });
      } else {
        set({ userRoles: [...state.userRoles, newRole] });
      }
    } catch (error) {
      console.error('Error assigning role:', error);
      throw error;
    }
  },

  updateRole: async (firebaseUid, newRoleId, assignedByUid) => {
    try {
      await dbUpdateUserRole(firebaseUid, newRoleId, assignedByUid);
      const state = get();
      set({ userRoles: state.userRoles.map(r => r.firebaseUid === firebaseUid ? { ...r, roleId: newRoleId, updatedAt: new Date().toISOString() } : r) });
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  },

  removeRole: async (firebaseUid) => {
    try {
      await dbRemoveUserRole(firebaseUid);
      const state = get();
      set({ userRoles: state.userRoles.filter(r => r.firebaseUid !== firebaseUid) });
    } catch (error) {
      console.error('Error removing role:', error);
      throw error;
    }
  },

  getUserRole: async (firebaseUid) => {
    try {
      const role = await dbGetUserRoleByUid(firebaseUid);
      if (role) set({ currentUserRole: role });
      return role;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  },
}));
