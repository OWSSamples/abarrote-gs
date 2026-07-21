'use server';

import { fetchKPIData, fetchInventoryAlerts, fetchMermaRecords, fetchInventoryAudits } from './inventory-actions';
import { fetchAllProducts } from './product-actions';
import { fetchSalesData, fetchSaleRecords, fetchCortesHistory, fetchHourlySalesData } from './sales-actions';
import { fetchClientes, fetchFiadoTransactions } from './customer-actions';
import { fetchGastos, fetchProveedores, fetchPedidos } from './finance-actions';
import { fetchStoreConfig } from './store-config-actions';
import { fetchDevoluciones } from './devolucion-actions';
import { fetchCashMovements } from './cash-movement-actions';
import { fetchLoyaltyTransactions } from './loyalty-actions';
import { fetchCategories } from './category-actions';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { logger } from '@/lib/logger';
import type { KPIData } from '@/types';
import { DEFAULT_STORE_CONFIG } from '@/types';
import { cacheGet, cacheSet } from '@/infrastructure/redis/cache';

import { parseError, withLogging } from '@/lib/errors';

// ==================== FULL DASHBOARD FETCH ====================

/** Safely resolve a promise, returning data and any error that occurred without crashing Promise.all */
async function safe<T>(
  promise: Promise<T>,
  fallback: T,
  label: string,
): Promise<{ data: T; error: { title: string; description: string } | null }> {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    const parsed = parseError(error);
    const nested = error as { cause?: { message?: string; code?: string } };

    // Log the error locally for server observability
    logger.error(`Dashboard unexpected error for "${label}"`, {
      label,
      title: parsed.title,
      error: error instanceof Error ? error.message : String(error),
      cause: nested?.cause?.message,
      code: nested?.cause?.code,
    });

    return {
      data: fallback,
      error: {
        title: `Error cargando ${label}`,
        description: parsed.description,
      },
    };
  }
}

const DEFAULT_KPI: KPIData = {
  dailySales: 0,
  dailySalesChange: 0,
  lowStockProducts: 0,
  expiringProducts: 0,
  mermaRate: 0,
  mermaRateChange: 0,
};

async function _fetchDashboardFromDB() {
  // Resolve the server-owned tenant boundary before loading any dashboard module.
  const scope = await requireStoreScope();
  const storeId = scope.storeId;
  const accessibleStores = scope.accessibleStores;

  // ── L1/L2 Cache check ──
  const cacheKey = `dashboard:v1:${storeId}`;
  const cached = await cacheGet<Record<string, unknown>>(cacheKey);
  if (cached) {
    // Merge fresh scope metadata (stores may change between cache hits)
    return {
      ...cached,
      activeStoreId: storeId,
      stores: accessibleStores.map(({ id, name }) => ({ id, name })),
    };
  }

  const results = await Promise.all([
    safe(fetchKPIData(), DEFAULT_KPI, 'KPI'),
    safe(fetchAllProducts(), [], 'Productos'),
    safe(fetchInventoryAlerts(), [], 'Alertas de inventario'),
    safe(fetchSalesData(), [], 'Gráficos de ventas'),
    safe(fetchSaleRecords(), [], 'Registro de ventas'),
    safe(fetchMermaRecords(), [], 'Mermas'),
    safe(fetchPedidos(), [], 'Pedidos'),
    safe(fetchClientes(), [], 'Clientes'),
    safe(fetchFiadoTransactions(), [], 'Fiado'),
    safe(fetchGastos(), [], 'Gastos'),
    safe(fetchProveedores(), [], 'Proveedores'),
    safe(fetchCortesHistory(), [], 'Cortes de caja'),
    safe(fetchInventoryAudits(), [], 'Auditorías'),
    safe(fetchStoreConfig(), DEFAULT_STORE_CONFIG, 'Configuración de tienda'),
    safe(fetchDevoluciones(), [], 'Devoluciones'),
    safe(fetchCashMovements(), [], 'Movimientos de caja'),
    safe(fetchLoyaltyTransactions(), [], 'Lealtad y recompensas'),
    safe(fetchHourlySalesData(), [], 'Ventas por hora'),
    safe(fetchCategories(), [], 'Categorías'),
  ]);

  const [
    kpiDataReq,
    allProductsReq,
    inventoryAlertsReq,
    salesDataReq,
    saleRecordsListReq,
    mermaRecordsListReq,
    pedidosListReq,
    clientesListReq,
    fiadoListReq,
    gastosListReq,
    proveedoresListReq,
    cortesHistoryListReq,
    inventoryAuditsListReq,
    storeConfigDataReq,
    devolucionesListReq,
    cashMovementsListReq,
    loyaltyTransactionsListReq,
    hourlySalesListReq,
    categoriesListReq,
  ] = results;

  // Extract all non-null errors to report them to Sileo UI
  const partialErrors = results.map((r) => r.error).filter((e) => e !== null) as {
    title: string;
    description: string;
  }[];

  const result = {
    kpiData: kpiDataReq.data,
    products: allProductsReq.data,
    inventoryAlerts: inventoryAlertsReq.data,
    salesData: salesDataReq.data,
    saleRecords: saleRecordsListReq.data,
    mermaRecords: mermaRecordsListReq.data,
    pedidos: pedidosListReq.data,
    clientes: clientesListReq.data,
    fiadoTransactions: fiadoListReq.data,
    gastos: gastosListReq.data,
    proveedores: proveedoresListReq.data,
    cortesHistory: cortesHistoryListReq.data,
    inventoryAudits: inventoryAuditsListReq.data,
    storeConfig: storeConfigDataReq.data,
    devoluciones: devolucionesListReq.data,
    cashMovements: cashMovementsListReq.data,
    loyaltyTransactions: loyaltyTransactionsListReq.data,
    hourlySalesData: hourlySalesListReq.data,
    categories: categoriesListReq.data,
    activeStoreId: storeId,
    stores: accessibleStores.map(({ id, name }) => ({ id, name })),
    partialErrors,
  };

  // Cache for 30 seconds to reduce DB load on repeated dashboard loads / sync polling
  await cacheSet(cacheKey, result, { ttlMs: 30_000 });

  return result;
}

// ==================== EXPORTS WITH LOGGING ====================
export const fetchDashboardFromDB = withLogging('dashboard.fetchDashboardFromDB', _fetchDashboardFromDB);
