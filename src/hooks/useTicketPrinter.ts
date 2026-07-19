'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/notifications/ToastProvider';
import { ThermalPrinter, buildDrawerKick } from '@/lib/escpos';
import type { PrinterStatus, PrinterInfo } from '@/lib/escpos';
import { printWithIframe } from '@/lib/printTicket';
import invariant from 'tiny-invariant';

interface PrintOptions {
  openCashDrawer?: boolean;
  /** Raw ESC/POS bytes — if provided, sends directly to thermal printer */
  escposData?: Uint8Array;
  /** Fallback HTML — used when thermal printer is not connected */
  fallbackHtml?: string;
}

const sharedPrinter = new ThermalPrinter();

/**
 * useTicketPrinter — Unified printing driver.
 *
 * Priority order:
 * 1. ESC/POS via WebSerial (if printer connected and escposData provided)
 * 2. HTML via printWithIframe (if fallbackHtml provided)
 * 3. window.print() (last resort)
 */
export function useTicketPrinter() {
  const toast = useToast();
  const printerRef = useRef<ThermalPrinter>(sharedPrinter);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>(sharedPrinter.status);
  const [printerInfo, setPrinterInfo] = useState<PrinterInfo>(sharedPrinter.info);

  // All consumers share one WebSerial session for the lifetime of the tab.
  useEffect(() => {
    setPrinterStatus(sharedPrinter.status);
    setPrinterInfo(sharedPrinter.info);
    return sharedPrinter.onStatusChange((info) => {
      setPrinterStatus(info.status);
      setPrinterInfo(info);
    });
  }, []);

  /** Connect to a thermal printer via WebSerial (requires user gesture) */
  const connectPrinter = useCallback(async (): Promise<boolean> => {
    const printer = printerRef.current;
    if (!ThermalPrinter.isSupported()) {
      toast.showError('WebSerial no disponible. Usa Chrome o Edge en escritorio.');
      return false;
    }

    const connected = await printer.connect(9600);
    if (connected) {
      toast.showSuccess('Impresora térmica conectada');
    }
    return connected;
  }, [toast]);

  /** Disconnect from the thermal printer */
  const disconnectPrinter = useCallback(async (): Promise<void> => {
    await printerRef.current.disconnect();
    toast.showInfo('Impresora desconectada');
  }, [toast]);

  /**
   * Print a ticket.
   *
   * If the thermal printer is connected and escposData is provided,
   * it sends raw ESC/POS commands. Otherwise falls back to HTML printing.
   */
  const printTicket = useCallback(
    async (ticketData: object, options: PrintOptions = {}) => {
      invariant(ticketData, 'No hay datos proporcionados para la impresión del ticket.');

      const printer = printerRef.current;
      const isThermalReady = printer.status === 'ready';

      try {
        // Strategy 1: ESC/POS direct to thermal printer
        if (isThermalReady && options.escposData) {
          const success = await printer.print(options.escposData);
          if (success) {
            toast.showSuccess('Ticket impreso en térmica');
            return;
          }
          // If thermal print failed, fall through to HTML
          toast.showWarning('Error en térmica, usando impresión del navegador');
        }

        // Strategy 2: HTML via hidden iframe
        if (options.fallbackHtml) {
          printWithIframe(options.fallbackHtml);
          toast.showSuccess('Ticket enviado a impresión');
          return;
        }

        // Strategy 3: Last resort — browser print dialog
        window.print();
        toast.showSuccess('Orden enviada a cola de impresión');
      } catch (error) {
        console.error('[Printer] Error de hardware:', error);
        toast.showError('Error al imprimir el ticket');
      }
    },
    [toast],
  );

  /** Open the cash drawer (via ESC/POS command or toast fallback) */
  const openDrawer = useCallback(
    async (pin: 2 | 5 = 2) => {
      const printer = printerRef.current;

      if (printer.status === 'ready') {
        const drawerCmd = buildDrawerKick(pin);
        const success = await printer.print(drawerCmd);
        if (success) {
          toast.showSuccess('Cajón de dinero abierto');
          return;
        }
      }

      toast.showWarning('Conecta una impresora térmica para abrir el cajón de dinero');
    },
    [toast],
  );

  return {
    // Actions
    printTicket,
    openDrawer,
    connectPrinter,
    disconnectPrinter,
    // State
    isPrinterReady: printerStatus === 'ready',
    printerStatus,
    printerInfo,
    isWebSerialSupported: ThermalPrinter.isSupported(),
  };
}
