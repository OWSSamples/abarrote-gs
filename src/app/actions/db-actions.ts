// ======================================================================
// Barrel re-export — backward-compatible entry point.
// The monolithic db-actions.ts has been split into domain modules.
// All existing imports from '@/app/actions/db-actions' continue to work.
//
// NOTE: No 'use server' here — each domain module declares its own.
// A 'use server' barrel can only export async functions directly,
// not re-exports from other modules (Next.js restriction).
// ======================================================================

// Products
export {
  fetchAllProducts,
  createProduct,
  updateProductStock,
  deleteProduct,
  updateProduct,
} from './product-actions';

// Store Config
export {
  fetchStoreConfig,
  saveStoreConfig,
} from './store-config-actions';

// Inventory (alerts, KPIs, mermas, audits)
export {
  fetchInventoryAlerts,
  fetchKPIData,
  fetchMermaRecords,
  createMerma,
  fetchInventoryAudits,
  createInventoryAudit,
  getInventoryAudit,
  saveAuditItem,
  completeInventoryAudit,
} from './inventory-actions';

// Sales (ventas, cortes)
export {
  fetchSalesData,
  fetchSaleRecords,
  createSale,
  cancelSale,
  deleteSales,
  fetchCortesHistory,
  createCorteCaja,
  createAutoCorteCaja,
  deleteCortes,
} from './sales-actions';

// Customers (clientes, fiado)
export {
  fetchClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  fetchFiadoTransactions,
  createFiado,
  createAbono,
} from './customer-actions';

// Finance (gastos, proveedores, pedidos)
export {
  fetchGastos,
  createGasto,
  updateGasto,
  deleteGasto,
  fetchProveedores,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  fetchPedidos,
  createPedido,
  updatePedidoStatus,
  receivePedido,
} from './finance-actions';

// Roles & Users
export {
  fetchRoleDefinitions,
  createRoleDefinition,
  updateRoleDefinition,
  deleteRoleDefinition,
  fetchUserRoles,
  getUserRoleByUid,
  ensureOwnerRole,
  assignUserRole,
  createFirebaseUserWithRole,
  updateUserPin,
  updateUserRole,
  removeUserRole,
  generateGlobalId,
  deactivateUser,
  reactivateUser,
  updateUserProfile,
  authorizePin,
} from './role-actions';

// Dashboard
export {
  fetchDashboardFromDB,
} from './dashboard-actions';

// Devoluciones
export {
  fetchDevoluciones,
  createDevolucion,
  getSaleItemsForDevolucion,
} from './devolucion-actions';

// Movimientos de Caja
export {
  fetchCashMovements,
  createCashMovement,
} from './cash-movement-actions';

// Loyalty Transactions
export {
  fetchLoyaltyTransactions,
  createLoyaltyTransaction,
} from './loyalty-actions';
