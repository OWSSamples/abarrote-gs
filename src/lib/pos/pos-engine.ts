import { offlineDB } from '../offline/idb-manager';
import { createSale } from '@/app/actions/sales-actions';
import { SaleRecord } from '@/types';
import invariant from 'tiny-invariant';

// Payment methods that require server-side API calls to payment providers.
// These CANNOT be processed offline because they need to create charges via Conekta/Stripe.
const ONLINE_ONLY_METHODS = new Set([
  'spei_conekta',
  'spei_stripe',
  'oxxo_conekta',
  'oxxo_stripe',
  'tarjeta_web',
  'tarjeta_clip',
  'clip_terminal',
]);

/** Max age for pending offline sales before they are considered stale (48h) */
const STALE_SALE_MS = 48 * 60 * 60 * 1000;

/** Max consecutive sync failures before skipping a sale */
const MAX_RETRIES = 5;

/**
 * POS ENGINE (Advanced Hybrid Mode)
 * Orquestador inteligente que decide dónde y cuándo guardar las ventas.
 */
export class PosEngine {
  private static syncing = false;

  /**
   * Procesa una venta de forma híbrida e inmediata.
   */
  async processSale(
    saleData: Omit<SaleRecord, 'id' | 'folio' | 'date'>,
  ): Promise<{ success: boolean; folio: string; isOffline: boolean }> {
    // Blindaje Industrial: Invariantes de Seguridad de Datos
    invariant(saleData.items.length > 0, 'No se puede procesar una venta sin artículos.');
    invariant(saleData.total >= 0, 'El total de la venta no puede ser negativo.');

    // Guard: automated payment methods require internet connection
    if (!navigator.onLine && ONLINE_ONLY_METHODS.has(saleData.paymentMethod)) {
      throw new Error(
        `El método de pago "${saleData.paymentMethod}" requiere conexión a internet para generar el cargo automático. ` +
          'Usa un método manual (efectivo, transferencia, SPEI manual) o espera a tener conexión.',
      );
    }

    try {
      // 1. Intentar guardar en la nube primero (Modo Online)
      if (navigator.onLine) {
        // Generate a per-attempt idempotency key so retries from the same
        // checkout reuse it and the server-side guard rejects exact dupes
        // without rejecting legitimate identical totals from different attempts.
        const clientRequestId = crypto.randomUUID();
        const result = await createSale({ ...saleData, clientRequestId });
        return { success: true, folio: result.folio, isOffline: false };
      }
      throw new Error('Offline detected');
    } catch (_error) {
      // 2. MODO AVANZADO: Si falla el internet, guardar en IndexedDB
      console.warn('[PosEngine] Iniciando cobro en Modo Emergencia Offline...');

      // Generate idempotency key to prevent duplicate syncs
      const idempotencyKey = crypto.randomUUID();
      const tempFolio = `OFF-${Date.now()}`;
      const _tempId = await offlineDB.queueSale({
        ...saleData,
        folio: tempFolio,
        date: new Date().toISOString(),
        _idempotencyKey: idempotencyKey,
        _retries: 0,
        _queuedAt: Date.now(),
      });

      return { success: true, folio: tempFolio, isOffline: true };
    }
  }

  /**
   * Sincronizador en segundo plano con deduplicación y reintento selectivo.
   * Se activa cuando vuelve el internet o al inicio de sesión.
   */
  async syncPendingSales(): Promise<{ synced: number; failed: number; stale: number }> {
    if (PosEngine.syncing || !navigator.onLine) return { synced: 0, failed: 0, stale: 0 };

    PosEngine.syncing = true;
    const pending = await offlineDB.getPendingSales();
    let synced = 0;
    let failed = 0;
    let stale = 0;
    const syncedKeys = new Set<string>();

    for (const sale of pending) {
      try {
        const {
          tempId,
          syncStatus: _syncStatus,
          isOffline: _isOffline,
          offlineAt: _offlineAt,
          _idempotencyKey,
          _retries = 0,
          _queuedAt,
          ...cleanData
        } = sale;

        // Skip stale sales (older than 48h) — flag for manual review
        if (typeof _queuedAt === 'number' && Date.now() - _queuedAt > STALE_SALE_MS) {
          console.warn(`[PosEngine] Venta ${String(sale.folio)} tiene más de 48h pendiente, marcando como obsoleta.`);
          await offlineDB.markSaleStale(tempId);
          stale++;
          continue;
        }

        // Skip sales that exceeded max retries
        if (typeof _retries === 'number' && _retries >= MAX_RETRIES) {
          console.warn(
            `[PosEngine] Venta ${String(sale.folio)} excedió ${MAX_RETRIES} reintentos, requiere revisión manual.`,
          );
          await offlineDB.markSaleStale(tempId);
          stale++;
          continue;
        }

        // Deduplication: skip if we already synced this idempotency key in this batch
        if (typeof _idempotencyKey === 'string' && syncedKeys.has(_idempotencyKey)) {
          await offlineDB.deletePendingSale(tempId);
          synced++;
          continue;
        }

        // Llamar a la acción del servidor real
        await createSale(cleanData as Parameters<typeof createSale>[0]);

        // Si tiene éxito, borrar de la cola local
        await offlineDB.deletePendingSale(tempId);
        if (typeof _idempotencyKey === 'string') syncedKeys.add(_idempotencyKey);
        synced++;
      } catch (err) {
        console.error(`[PosEngine] Error al sincronizar venta ${sale.folio}:`, err);
        // Increment retry counter for selective retry
        await offlineDB.incrementRetry(sale.tempId);
        failed++;
      }
    }

    PosEngine.syncing = false;
    return { synced, failed, stale };
  }
}

export const posEngine = new PosEngine();
