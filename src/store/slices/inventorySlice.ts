import type { StoreSet, StoreGet, InventorySlice } from '../types';
import {
  createProduct as dbCreateProduct,
  deleteProduct as dbDeleteProduct,
  updateProduct as dbUpdateProduct,
  updateProductStock as dbUpdateProductStock,
  createMerma as dbCreateMerma,
  fetchInventoryAlerts,
  fetchKPIData,
  fetchAllProducts,
  fetchInventoryAudits,
  createCategory as dbCreateCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
  fetchCategories as dbFetchCategories,
} from '@/app/actions/db-actions';

/** Refresh only product-related data: products list, alerts, KPIs */
async function refreshProductData(set: StoreSet) {
  const [products, alerts, kpi] = await Promise.all([
    fetchAllProducts(),
    fetchInventoryAlerts(),
    fetchKPIData(),
  ]);
  set({ products, inventoryAlerts: alerts, kpiData: kpi });
}

export const createInventorySlice = (set: StoreSet, get: StoreGet): InventorySlice => ({
  registerMerma: async (merma) => {
    try {
      const newRecord = await dbCreateMerma(merma);
      const state = get();
      set({ mermaRecords: [newRecord, ...state.mermaRecords] });
      const [alerts, kpi] = await Promise.all([fetchInventoryAlerts(), fetchKPIData()]);
      set({ inventoryAlerts: alerts, kpiData: kpi });
    } catch (error) {
      console.error('[store:inventory] registerMerma failed', error);
    }
  },

  adjustStock: async (productId, newStock, _reason) => {
    const prev = get().products;
    try {
      await dbUpdateProductStock(productId, newStock);
      // Optimistic update with rollback on failure
      set({
        products: prev.map(p =>
          p.id === productId ? { ...p, currentStock: newStock } : p
        ),
      });
      const [alerts, kpi] = await Promise.all([fetchInventoryAlerts(), fetchKPIData()]);
      set({ inventoryAlerts: alerts, kpiData: kpi });
    } catch (error) {
      // Rollback to previous state
      set({ products: prev });
      console.error('[store:inventory] adjustStock failed', error);
    }
  },

  registerProduct: async (productData) => {
    try {
      await dbCreateProduct(productData);
      await refreshProductData(set);
    } catch (error) {
      console.error('[store:inventory] registerProduct failed', error);
      throw error;
    }
  },

  deleteProduct: async (productId) => {
    try {
      await dbDeleteProduct(productId);
      // Optimistic: remove from local state immediately
      const state = get();
      set({ products: state.products.filter(p => p.id !== productId) });
      // Then refresh alerts/KPIs (product list already updated)
      const [alerts, kpi] = await Promise.all([fetchInventoryAlerts(), fetchKPIData()]);
      set({ inventoryAlerts: alerts, kpiData: kpi });
    } catch (error) {
      console.error('[store:inventory] deleteProduct failed', error);
      throw error;
    }
  },

  updateProduct: async (id, data) => {
    const prev = get().products;
    try {
      await dbUpdateProduct(id, data);
      // Optimistic update with rollback on failure
      set({ products: prev.map(p => p.id === id ? { ...p, ...data } : p) });
      // Refresh alerts/KPIs (price or stock changes affect them)
      const [alerts, kpi] = await Promise.all([fetchInventoryAlerts(), fetchKPIData()]);
      set({ inventoryAlerts: alerts, kpiData: kpi });
    } catch (error) {
      set({ products: prev });
      console.error('[store:inventory] updateProduct failed', error);
      throw error;
    }
  },

  getAllProducts: () => get().products,

  createInventoryAudit: async (data) => {
    const { createInventoryAudit: dbCreate } = await import('@/app/actions/db-actions');
    const id = await dbCreate(data);
    // Only refresh audits list
    const audits = await fetchInventoryAudits();
    set({ inventoryAudits: audits });
    return id;
  },

  completeInventoryAudit: async (id) => {
    const { completeInventoryAudit: dbComplete } = await import('@/app/actions/db-actions');
    await dbComplete(id);
    // Audit completion adjusts stock → refresh products + audits
    const [products, alerts, kpi, audits] = await Promise.all([
      fetchAllProducts(),
      fetchInventoryAlerts(),
      fetchKPIData(),
      fetchInventoryAudits(),
    ]);
    set({ products, inventoryAlerts: alerts, kpiData: kpi, inventoryAudits: audits });
  },
  
  createCategory: async (data: { id?: string; name: string; description: string | null; icon: string | null }) => {
    try {
      const newCat = await dbCreateCategory(data);
      const state = get();
      set({ categories: [newCat, ...state.categories] });
    } catch (error) {
      console.error('[store:inventory] createCategory failed', error);
    }
  },

  updateCategory: async (id, data) => {
    try {
      const updated = await dbUpdateCategory(id, data);
      const state = get();
      set({ categories: state.categories.map(c => c.id === id ? updated : c) });
    } catch (error) {
      console.error('[store:inventory] updateCategory failed', error);
    }
  },

  deleteCategory: async (id) => {
    try {
      await dbDeleteCategory(id);
      const state = get();
      set({ categories: state.categories.filter(c => c.id !== id) });
    } catch (error) {
      console.error('[store:inventory] deleteCategory failed', error);
    }
  },
});
