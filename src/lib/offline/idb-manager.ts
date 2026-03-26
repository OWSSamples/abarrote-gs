/**
 * ADMINISTRADOR DE BASE DE DATOS LOCAL (Offline Advanced)
 * Utiliza IndexedDB para persistencia masiva y rápida en el navegador.
 */

const DB_NAME = 'PosOfflineDB';
const DB_VERSION = 1;

export class LocalPOSDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        
        // Almacén de productos (Caché local)
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        
        // Cola de ventas pendientes de sincronizar
        if (!db.objectStoreNames.contains('pending_sales')) {
          db.createObjectStore('pending_sales', { keyPath: 'tempId' });
        }

        // Estado del carrito (Resiliencia de sesión)
        if (!db.objectStoreNames.contains('cart_state')) {
          db.createObjectStore('cart_state', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event: any) => reject(event.target.error);
    });
  }

  // --- PRODUCTOS ---
  async syncProducts(products: any[]): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    await Promise.all(products.map(p => store.put(p)));
  }

  async findProductByBarcode(barcode: string): Promise<any | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const request = store.getAll();
      request.onsuccess = () => {
        const found = request.result.find((p: any) => p.barcode === barcode || p.sku === barcode);
        resolve(found || null);
      };
    });
  }

  // --- VENTAS ---
  async queueSale(saleData: any): Promise<string> {
    if (!this.db) throw new Error('DB no inicializada');
    const tempId = `off-${Date.now()}`;
    const tx = this.db.transaction('pending_sales', 'readwrite');
    await tx.objectStore('pending_sales').add({ ...saleData, tempId, syncStatus: 'pending' });
    return tempId;
  }

  async getPendingSales(): Promise<any[]> {
    if (!this.db) return [];
    return new Promise((resolve) => {
      const tx = this.db!.transaction('pending_sales', 'readonly');
      const request = tx.objectStore('pending_sales').getAll();
      request.onsuccess = () => resolve(request.result);
    });
  }

  async deletePendingSale(tempId: string): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction('pending_sales', 'readwrite');
    await tx.objectStore('pending_sales').delete(tempId);
  }
}

export const offlineDB = new LocalPOSDB();
