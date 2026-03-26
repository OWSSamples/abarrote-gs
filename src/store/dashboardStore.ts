import { create } from 'zustand';
import { DEFAULT_STORE_CONFIG } from '@/types';
import type { DashboardStore } from './types';
import {
  fetchDashboardFromDB,
  saveStoreConfig as dbSaveStoreConfig,
} from '@/app/actions/db-actions';

// Slices
import { createSalesSlice } from './slices/salesSlice';
import { createInventorySlice } from './slices/inventorySlice';
import { createCustomerSlice } from './slices/customerSlice';
import { createFinanceSlice } from './slices/financeSlice';
import { createRoleSlice } from './slices/roleSlice';

// Re-export the full store type for external consumers
export type { DashboardStore } from './types';

export const useDashboardStore = create<DashboardStore>((set, get) => {
  return {
    // ── Initial state ──
    kpiData: null,
    inventoryAlerts: [],
    products: [],
    categories: [],
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
    inventoryAudits: [],
    devoluciones: [],
    cashMovements: [],
    loyaltyTransactions: [],
    hourlySalesData: [],
    isLoading: false,
    error: null,

    // ── Core setters ──
    setKPIData: (data) => set({ kpiData: data }),
    setInventoryAlerts: (alerts) => set({ inventoryAlerts: alerts }),
    setSalesData: (data) => set({ salesData: data }),
    setHourlySalesData: (data) => set({ hourlySalesData: data }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),

    // ── Fetch all dashboard data ──
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
          inventoryAudits: data.inventoryAudits,
          storeConfig: data.storeConfig,
          devoluciones: data.devoluciones,
          cashMovements: data.cashMovements,
          loyaltyTransactions: data.loyaltyTransactions,
          hourlySalesData: data.hourlySalesData,
          categories: data.categories || [],
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

    saveStoreConfig: async (data) => {
      try {
        const updatedConfig = await dbSaveStoreConfig(data);
        set({ storeConfig: updatedConfig });
      } catch (error) {
        console.error('Error saving store config:', error);
      }
    },

    // ── Domain slices ──
    ...createSalesSlice(set, get),
    ...createInventorySlice(set, get),
    ...createCustomerSlice(set, get),
    ...createFinanceSlice(set, get),
    ...createRoleSlice(set, get),
  };
});
