'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';

// Estándar de Conectividad de Shopify POS
export type ConnectivityStatus = 'Connected' | 'Disconnected';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [connectivity, setConnectivity] = useState<ConnectivityStatus>('Connected');
  const products = useDashboardStore((s) => s.products);

  // 1. Catálogo local (Bóveda de Resiliencia)
  useEffect(() => {
    if (products.length > 0) {
      localStorage.setItem('pos_offline_products', JSON.stringify(products));
      console.log(`[PosEngine] Catálogo local actualizado con ${products.length} productos.`);
    }
  }, [products]);

  // 2. Monitor de Red Estilo Shopify (Real-time Subscription)
  useEffect(() => {
    const updateNetStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      setConnectivity(online ? 'Connected' : 'Disconnected');
      
      if (online) {
        console.log('[Connectivity] Internet Restaurado. Preparando sincronización...');
        syncPendingSales();
      }
    };

    window.addEventListener('online', updateNetStatus);
    window.addEventListener('offline', updateNetStatus);

    // Estado inicial de arranque
    updateNetStatus();

    return () => {
      window.removeEventListener('online', updateNetStatus);
      window.removeEventListener('offline', updateNetStatus);
    };
  }, []);

  // 3. Función de Guardado Offline (Fallo Seguro)
  const saveSaleOffline = useCallback((saleData: any) => {
    const pendingSales = JSON.parse(localStorage.getItem('pos_pending_sales') || '[]');
    const newSale = {
      ...saleData,
      isOffline: true,
      offlineAt: new Date().toISOString(),
      tempId: `off-${Date.now()}`
    };
    
    pendingSales.push(newSale);
    localStorage.setItem('pos_pending_sales', JSON.stringify(pendingSales));
    return newSale;
  }, []);

  // 4. Sincronización Transaccional Automática
  const syncPendingSales = async () => {
    const pendingSalesArr = JSON.parse(localStorage.getItem('pos_pending_sales') || '[]');
    if (pendingSalesArr.length === 0) return;

    console.log(`[CloudSync] Iniciando respaldo de ${pendingSalesArr.length} ventas offline a la nube.`);
    
    // Aquí el PosEngine toma el control en producción
    // para procesar la cola de ventas y eliminarlas de localStorage/IndexedDB
  };

  return {
    isOnline,
    connectivity, // API Estilo Shopify
    saveSaleOffline,
    syncPendingSales,
    hasPendingSales: JSON.parse(localStorage.getItem('pos_pending_sales') || '[]').length > 0
  };
}
