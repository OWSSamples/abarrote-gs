import { createSale } from '@/app/actions/sales-actions';
import type { SaleRecord } from '@/types';
import invariant from 'tiny-invariant';

/** Online-only POS orchestrator. Offline sale persistence is intentionally unsupported. */
export class PosEngine {
  async processSale(
    saleData: Omit<SaleRecord, 'id' | 'folio' | 'date'> & {
      clienteId?: string;
      discountApprovalToken?: string;
    },
    clientRequestId: string,
  ): Promise<SaleRecord> {
    invariant(saleData.items.length > 0, 'No se puede procesar una venta sin artículos.');
    invariant(saleData.total >= 0, 'El total de la venta no puede ser negativo.');

    if (!navigator.onLine) {
      throw new Error('Se requiere conexión para registrar la venta. No se guardaron cambios locales.');
    }

    return createSale({ ...saleData, clientRequestId });
  }
}

export const posEngine = new PosEngine();
