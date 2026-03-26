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
import type { KPIData } from '@/types';
import { DEFAULT_STORE_CONFIG } from '@/types';

// ==================== FULL DASHBOARD FETCH ====================

/** Safely resolve a promise, returning a fallback on failure */
async function safe<T>(promise: Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    const isConnError = error instanceof Error && (
      error.message.includes('ECONNREFUSED') || 
      error.message.includes('ETIMEDOUT') || 
      error.message.includes('Connection failed')
    );
    
    if (isConnError) {
      console.warn(`[Dashboard] OFFLINE: No se pudo conectar a la base de datos en la nube para "${label}".`);
    } else {
      console.error(`[Dashboard] Error inesperado en "${label}":`, error instanceof Error ? error.message : error);
    }
    return fallback;
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

export async function fetchDashboardFromDB() {
  const [
    kpiData,
    allProducts,
    inventoryAlerts,
    salesData,
    saleRecordsList,
    mermaRecordsList,
    pedidosList,
    clientesList,
    fiadoList,
    gastosList,
    proveedoresList,
    cortesHistoryList,
    inventoryAuditsList,
    storeConfigData,
    devolucionesList,
    cashMovementsList,
    loyaltyTransactionsList,
    hourlySalesList,
    categoriesList,
  ] = await Promise.all([
    safe(fetchKPIData(), DEFAULT_KPI, 'KPI'),
    safe(fetchAllProducts(), [], 'products'),
    safe(fetchInventoryAlerts(), [], 'inventory alerts'),
    safe(fetchSalesData(), [], 'sales data'),
    safe(fetchSaleRecords(), [], 'sale records'),
    safe(fetchMermaRecords(), [], 'merma records'),
    safe(fetchPedidos(), [], 'pedidos'),
    safe(fetchClientes(), [], 'clientes'),
    safe(fetchFiadoTransactions(), [], 'fiado transactions'),
    safe(fetchGastos(), [], 'gastos'),
    safe(fetchProveedores(), [], 'proveedores'),
    safe(fetchCortesHistory(), [], 'cortes history'),
    safe(fetchInventoryAudits(), [], 'inventory audits'),
    safe(fetchStoreConfig(), DEFAULT_STORE_CONFIG, 'store config'),
    safe(fetchDevoluciones(), [], 'devoluciones'),
    safe(fetchCashMovements(), [], 'cash movements'),
    safe(fetchLoyaltyTransactions(), [], 'loyalty transactions'),
    safe(fetchHourlySalesData(), [], 'hourly sales'),
    safe(fetchCategories(), [], 'categories'),
  ]);

  return {
    kpiData,
    products: allProducts,
    inventoryAlerts,
    salesData,
    saleRecords: saleRecordsList,
    mermaRecords: mermaRecordsList,
    pedidos: pedidosList,
    clientes: clientesList,
    fiadoTransactions: fiadoList,
    gastos: gastosList,
    proveedores: proveedoresList,
    cortesHistory: cortesHistoryList,
    inventoryAudits: inventoryAuditsList,
    storeConfig: storeConfigData,
    devoluciones: devolucionesList,
    cashMovements: cashMovementsList,
    loyaltyTransactions: loyaltyTransactionsList,
    hourlySalesData: hourlySalesList,
    categories: categoriesList,
    isOffline: allProducts.length === 0 && kpiData.dailySales === 0, // Inferencia básica de offline
  };
}
