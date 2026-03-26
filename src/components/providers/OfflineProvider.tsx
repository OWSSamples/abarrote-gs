'use client';

import { useEffect, ReactNode } from 'react';
import { offlineDB } from '@/lib/offline/idb-manager';
import { posEngine } from '@/lib/pos/pos-engine';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '../notifications/ToastProvider';

export function OfflineProvider({ children }: { children: ReactNode }) {
  const products = useDashboardStore((s) => s.products);
  const toast = useToast();

  useEffect(() => {
    async function init() {
      try {
        // 1. Inicializar la base de datos industrial IndexedDB
        await offlineDB.init();
        console.log('[Offline] Base de datos local inicializada.');

        // 2. Sincronizar productos iniciales al catálogo local
        if (products.length > 0) {
          await offlineDB.syncProducts(products);
        }

        // 3. Intentar sincronización inicial de ventas pendientes
        if (navigator.onLine) {
          const { synced } = await posEngine.syncPendingSales();
          if (synced > 0) {
            toast.showSuccess(`Se sincronizaron ${synced} ventas offline pendientes.`);
          }
        }
      } catch (err) {
        console.error('[Offline] Error en inicialización:', err);
      }
    }

    init();

    // Evento de detección de red para auto-sincronizar
    const handleOnline = async () => {
      console.log('[Offline] Red restablecida. Iniciando sincronización...');
      const { synced } = await posEngine.syncPendingSales();
      if (synced > 0) {
        toast.showSuccess(`${synced} ventas sincronizadas con la nube.`);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [products, toast]);

  return <>{children}</>;
}
