import { create } from 'zustand';
import { DEFAULT_STORE_CONFIG } from '@/types';
import type { DashboardStore } from './types';
import { fetchDashboardFromDB, saveStoreConfig as dbSaveStoreConfig } from '@/app/actions/db-actions';
import { logger } from '@/lib/logger';
import { parseError } from '@/lib/errors';

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
    layoutSelectedProduct: null,
    isProductDetailActive: false,
    openProductDetail: (product) => set({ layoutSelectedProduct: product, isProductDetailActive: true }),
    closeProductDetail: () => set({ layoutSelectedProduct: null, isProductDetailActive: false }),
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
    lastSyncAt: 0,

    // ── Multi-tienda ──
    activeStoreId: 'main',
    stores: [{ id: 'main', name: 'Tienda Principal' }],
    switchStore: (storeId: string) => {
      const store = get().stores.find((s) => s.id === storeId);
      if (store) {
        set({ activeStoreId: storeId });
        // Reload data for the new store
        get().fetchDashboardData();
      }
    },

    // ── Core setters ──
    setKPIData: (data) => set({ kpiData: data }),
    setInventoryAlerts: (alerts) => set({ inventoryAlerts: alerts }),
    setSalesData: (data) => set({ salesData: data }),
    setHourlySalesData: (data) => set({ hourlySalesData: data }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),

    // ── Fetch all dashboard data ──
    // Shows loading spinner only on initial load (when kpiData is null).
    // Background refreshes (SyncEngine polling, visibility, cross-tab) are silent.
    // Uses Promise-based deduplication: concurrent calls share the same in-flight
    // fetch instead of a boolean flag (which is not atomic and allows races).
    fetchDashboardData: (() => {
      let fetchPromise: Promise<void> | null = null;

      return async () => {
        // Deduplicate: if a fetch is already in-flight, return the same promise
        if (fetchPromise) {
          return fetchPromise;
        }

        const isInitialLoad = get().kpiData === null;

        if (isInitialLoad) {
          set({ isLoading: true, error: null });
        }

        fetchPromise = (async () => {
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
              lastSyncAt: Date.now(),
            });

            // ── Partial error handling ──
            // Only show errors if there are significant failures (>2 modules)
            // Single module failures are often transient and self-heal
            if (data.partialErrors && data.partialErrors.length > 2) {
              import('sileo').then(({ sileo }) => {
                sileo.warning({
                  title: 'Algunos datos no cargaron',
                  description: `${data.partialErrors!.length} módulos tuvieron problemas. La app sigue funcionando.`,
                  duration: 5000,
                });
              });
            }
          } catch (error) {
            // En caso de que falle toda la llamada fetchDashboardFromDB
            const { title, description } = parseError(error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            const isNetworkError =
              errorMsg.toLowerCase() === 'failed to fetch' ||
              errorMsg.toLowerCase().includes('network') ||
              errorMsg.toLowerCase().includes('timeout') ||
              errorMsg.toLowerCase().includes('abort');

            // Only log non-network errors or first occurrence to reduce noise
            if (!isNetworkError || isInitialLoad) {
              logger.error('Dashboard fetch failed', {
                error: errorMsg,
                action: 'fetchDashboardData',
                isInitialLoad,
              });
            }

            if (isInitialLoad) {
              set({
                error: `${title}: ${description}`,
                isLoading: false,
              });
            }

            // Only show toast for initial load failures or non-network errors
            // Background polling errors are handled silently by circuit breaker
            if (isInitialLoad) {
              import('sileo').then(({ sileo }) => {
                sileo.error({ title, description, duration: isNetworkError ? 5000 : 10000 });
              });
            }
          } finally {
            fetchPromise = null;
          }
        })();

        return fetchPromise;
      };
    })(),

    saveStoreConfig: async (data) => {
      try {
        const updatedConfig = await dbSaveStoreConfig(data);
        set({ storeConfig: updatedConfig });

        // Broadcast config change to /display window
        try {
          const channel = new BroadcastChannel('customer_display');
          channel.postMessage({ type: 'UPDATE_CONFIG', payload: updatedConfig });
          channel.close();
        } catch {
          // BroadcastChannel not available (SSR or unsupported browser)
        }

        return updatedConfig;
      } catch (error) {
        const { title, description } = parseError(error);
        logger.error('Store config save failed', {
          action: 'saveStoreConfig',
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error(`${title}: ${description}`);
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
