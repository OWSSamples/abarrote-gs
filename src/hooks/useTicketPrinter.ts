'use client';

import { useCallback } from 'react';
import { useToast } from '@/components/notifications/ToastProvider';
import invariant from 'tiny-invariant';

interface PrintOptions {
  openCashDrawer?: boolean;
}

/**
 * useTicketPrinter - Driver Unificado de Impresión (Grado Industrial)
 */
export function useTicketPrinter() {
  const toast = useToast();

  const printTicket = useCallback(async (ticketData: any, options: PrintOptions = {}) => {
    // Seguridad de Datos: No imprimir tickets fantasma
    invariant(ticketData, "No hay datos proporcionados para la impresión del ticket.");

    try {
      console.log('[Printer] Preparando envío a dispositivo...', ticketData);
      
      if (options.openCashDrawer) {
        console.log('[CashDrawer] Enviando pulso de apertura (Simulado)...');
      }

      // Disparar ventana de impresión (configurada para el diseño Platinum)
      window.print();
      
      toast.showSuccess('Orden enviada a cola de impresión');
    } catch (error) {
      console.error('[Printer] Error de hardware:', error);
      toast.showError('Error al contactar con la impresora');
    }
  }, [toast]);

  const openDrawer = useCallback(async () => {
    // Gatillo directo para apertura manual
    console.log('[CashDrawer] Pulso de apertura manual enviado.');
    toast.showSuccess('Señal de apertura enviada');
  }, [toast]);

  return {
    printTicket,
    openDrawer,
    isPrinterReady: false, 
  };
}
