import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getMPConfigFromStore,
  createPaymentIntent,
  getPaymentIntentStatus,
  cancelPaymentIntent,
  getPaymentStatusLabel,
} from '@/lib/mercadopago';
import type { MercadoPagoConfig, PaymentIntent } from '@/lib/mercadopago';
import type { SaleItem, SaleRecord } from '@/types';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency } from '@/lib/utils';

export interface UseMercadoPagoTerminalParams {
  total: number;
  items: SaleItem[];
  subtotal: number;
  iva: number;
  cardSurcharge: number;
  open: boolean;
  onSaleComplete: (sale: SaleRecord) => void;
}

export function useMercadoPagoTerminal({
  total,
  items,
  subtotal,
  iva,
  cardSurcharge,
  open,
  onSaleComplete,
}: UseMercadoPagoTerminalParams) {
  const registerSale = useDashboardStore((s) => s.registerSale);
  const currentUserRole = useDashboardStore((s) => s.currentUserRole);
  const { showSuccess, showError } = useToast();

  const [mpConfig, setMpConfig] = useState<MercadoPagoConfig>({ deviceId: '', enabled: false });
  const [mpProcessing, setMpProcessing] = useState(false);
  const [mpStatus, setMpStatus] = useState('');
  const [mpPaymentIntent, setMpPaymentIntent] = useState<PaymentIntent | null>(null);
  const [mpError, setMpError] = useState('');
  const mpPollingRef = useRef<NodeJS.Timeout | null>(null);
  const handleMPTerminalPaymentRef = useRef<(() => Promise<void>) | null>(null);
  const [mpWebSuccess, setMpWebSuccess] = useState(false);

  // Keep a stable ref to the callback so the polling closure always has the latest
  const onSaleCompleteRef = useRef(onSaleComplete);
  useEffect(() => {
    onSaleCompleteRef.current = onSaleComplete;
  }, [onSaleComplete]);

  // Load MP config from storeConfig (DB-backed)
  useEffect(() => {
    const storeConfigData = useDashboardStore.getState().storeConfig;
    const config = getMPConfigFromStore(storeConfigData);
    setMpConfig(config);
  }, [open]);

  const handleMPTerminalPayment = useCallback(async () => {
    if (!mpConfig.enabled || !mpConfig.deviceId) {
      showError('Configura tu terminal Mercado Pago en Configuración antes de cobrar con tarjeta');
      return;
    }

    setMpProcessing(true);
    setMpError('');
    setMpStatus('Enviando cobro a la terminal...');

    try {
      const intent = await createPaymentIntent(mpConfig, {
        amount: total,
        description: `Venta - ${items.length} producto(s)`,
        external_reference: `venta-${Date.now()}`,
        print_on_terminal: true,
      });

      setMpPaymentIntent(intent);
      setMpStatus('Esperando pago en la terminal...');

      mpPollingRef.current = setInterval(async () => {
        try {
          const status = await getPaymentIntentStatus(mpConfig, intent.id);
          setMpStatus(getPaymentStatusLabel(status.status));

          if (status.status === 'processed') {
            if (mpPollingRef.current) clearInterval(mpPollingRef.current);
            setMpProcessing(false);

            const sale = await registerSale({
              items,
              subtotal,
              iva,
              cardSurcharge,
              total,
              paymentMethod: 'tarjeta',
              amountPaid: total,
              change: 0,
              cajero: currentUserRole?.globalId || currentUserRole?.employeeNumber || currentUserRole?.displayName || 'Cajero',
              pointsEarned: 0,
              pointsUsed: 0,
            } as any);
            onSaleCompleteRef.current(sale);
            showSuccess(`Pago con tarjeta procesado. Venta ${sale.folio}: ${formatCurrency(sale.total)}`);
          } else if (
            status.status === 'canceled' ||
            status.status === 'error' ||
            status.status === 'expired'
          ) {
            if (mpPollingRef.current) clearInterval(mpPollingRef.current);
            setMpProcessing(false);
            setMpError(
              `Cobro ${status.status === 'canceled' ? 'cancelado' : status.status === 'expired' ? 'expirado' : 'con error'}. Intenta de nuevo.`,
            );
          }
        } catch {
          // Network error during polling — keep trying
        }
      }, 3000);
    } catch (err) {
      setMpProcessing(false);
      setMpError(err instanceof Error ? err.message : 'Error al conectar con la terminal');
    }
  }, [mpConfig, total, items, subtotal, iva, cardSurcharge, currentUserRole, registerSale, showSuccess, showError]);

  const handleCancelMPPayment = useCallback(async () => {
    if (mpPollingRef.current) {
      clearInterval(mpPollingRef.current);
      mpPollingRef.current = null;
    }
    try {
      await cancelPaymentIntent(mpConfig, mpConfig.deviceId);
      showSuccess('Cobro cancelado en la terminal');
    } catch {
      // Terminal may have already processed/canceled
    }
    setMpProcessing(false);
    setMpStatus('');
    setMpPaymentIntent(null);
  }, [mpConfig, showSuccess]);

  // Assign ref so parent can trigger from handleSale
  useEffect(() => {
    handleMPTerminalPaymentRef.current = handleMPTerminalPayment;
  }, [handleMPTerminalPayment]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (mpPollingRef.current) clearInterval(mpPollingRef.current);
    };
  }, []);

  const resetMpState = useCallback(() => {
    setMpProcessing(false);
    setMpStatus('');
    setMpPaymentIntent(null);
    setMpError('');
    setMpWebSuccess(false);
    if (mpPollingRef.current) {
      clearInterval(mpPollingRef.current);
      mpPollingRef.current = null;
    }
  }, []);

  return {
    mpConfig,
    mpProcessing,
    mpStatus,
    mpError,
    mpWebSuccess,
    setMpWebSuccess,
    handleMPTerminalPaymentRef,
    handleCancelMPPayment,
    resetMpState,
  };
}
