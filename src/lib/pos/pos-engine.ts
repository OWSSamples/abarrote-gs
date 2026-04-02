import { offlineDB } from '../offline/idb-manager';
import { createSale } from '@/app/actions/sales-actions';
import { SaleRecord } from '@/types';
import invariant from 'tiny-invariant';

// Payment methods that require server-side API calls to payment providers.
// These CANNOT be processed offline because they need to create charges via Conekta/Stripe.
const ONLINE_ONLY_METHODS = new Set([
  'spei_conekta', 'spei_stripe', 'oxxo_conekta', 'oxxo_stripe', 'tarjeta_web', 'tarjeta_clip', 'clip_terminal',
]);

/**
 * POS ENGINE (Advanced Hybrid Mode)
 * Orquestador inteligente que decide dónde y cuándo guardar las ventas.
 */
export class PosEngine {
  private static syncing = false;

  /**
   * Procesa una venta de forma híbrida e inmediata.
   */
  async processSale(saleData: Omit<SaleRecord, 'id' | 'folio' | 'date'>): Promise<{ success: boolean; folio: string; isOffline: boolean }> {
    // Blindaje Industrial: Invariantes de Seguridad de Datos
    invariant(saleData.items.length > 0, "No se puede procesar una venta sin artículos.");
    invariant(saleData.total >= 0, "El total de la venta no puede ser negativo.");

    // Guard: automated payment methods require internet connection
    if (!navigator.onLine && ONLINE_ONLY_METHODS.has(saleData.paymentMethod)) {
      throw new Error(
        `El método de pago "${saleData.paymentMethod}" requiere conexión a internet para generar el cargo automático. ` +
        'Usa un método manual (efectivo, transferencia, SPEI manual) o espera a tener conexión.'
      );
    }

    try {
      // 1. Intentar guardar en la nube primero (Modo Online)
      if (navigator.onLine) {
        const result = await createSale(saleData);
        return { success: true, folio: result.folio, isOffline: false };
      }
      throw new Error('Offline detected');
    } catch (error) {
      // 2. MODO AVANZADO: Si falla el internet, guardar en IndexedDB
      console.warn('[PosEngine] Iniciando cobro en Modo Emergencia Offline...');
      
      const tempFolio = `OFF-${Date.now()}`; // Folio temporal profesional
      const tempId = await offlineDB.queueSale({
        ...saleData,
        folio: tempFolio,
        date: new Date().toISOString()
      });

      return { success: true, folio: tempFolio, isOffline: true };
    }
  }

  /**
   * Sincronizador en segundo plano.
   * Se activa cuando vuelve el internet o al inicio de sesión.
   */
  async syncPendingSales(): Promise<{ synced: number; failed: number }> {
    if (PosEngine.syncing || !navigator.onLine) return { synced: 0, failed: 0 };
    
    PosEngine.syncing = true;
    const pending = await offlineDB.getPendingSales();
    let synced = 0;
    let failed = 0;

    for (const sale of pending) {
      try {
        // Limpiar datos temporales antes de mandar a la nube
        const { tempId, syncStatus, isOffline, offlineAt, ...cleanData } = sale;
        
        // Llamar a la acción del servidor real
        await createSale(cleanData);
        
        // Si tiene éxito, borrar de la cola local
        await offlineDB.deletePendingSale(tempId);
        synced++;
      } catch (err) {
        console.error(`[PosEngine] Error al sincronizar venta ${sale.folio}:`, err);
        failed++;
      }
    }

    PosEngine.syncing = false;
    return { synced, failed };
  }
}

export const posEngine = new PosEngine();
