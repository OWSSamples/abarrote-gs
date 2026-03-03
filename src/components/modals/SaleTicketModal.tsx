'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Modal,
  FormLayout,
  TextField,
  Select,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Box,
  Button,
  Divider,
  Badge,
  Card,
  IndexTable,
  Icon,
  Spinner,
  ProgressBar,
} from '@shopify/polaris';
import { DeleteIcon, PrintIcon, BarcodeIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency } from '@/lib/utils';
import {
  getMPConfig,
  createPaymentIntent,
  getPaymentIntentStatus,
  cancelPaymentIntent,
  getPaymentStatusLabel,
} from '@/lib/mercadopago';
import type { MercadoPagoConfig, PaymentIntent } from '@/lib/mercadopago';
import type { SaleItem, SaleRecord } from '@/types';

interface SaleTicketModalProps {
  open: boolean;
  onClose: () => void;
}

const paymentMethodOptions = [
  { label: 'Efectivo', value: 'efectivo' },
  { label: 'Tarjeta (Terminal Mercado Pago)', value: 'tarjeta' },
  { label: 'Tarjeta (manual sin terminal)', value: 'tarjeta_manual' },
  { label: 'Transferencia', value: 'transferencia' },
  { label: 'Fiado (crédito a cliente)', value: 'fiado' },
];

const IVA_RATE = 0.16;
const CARD_SURCHARGE_RATE = 0.025; // 2.5% comisión por tarjeta

export function SaleTicketModal({ open, onClose }: SaleTicketModalProps) {
  const inventoryAlerts = useDashboardStore((s) => s.inventoryAlerts);
  const registerSale = useDashboardStore((s) => s.registerSale);
  const clientes = useDashboardStore((s) => s.clientes);
  const registerFiado = useDashboardStore((s) => s.registerFiado);
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const { showSuccess, showError } = useToast();

  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'tarjeta_manual' | 'transferencia' | 'fiado'>('efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [cajero, setCajero] = useState('');
  const [fiadoClienteId, setFiadoClienteId] = useState('');
  const [completedSale, setCompletedSale] = useState<SaleRecord | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  // Mercado Pago terminal states
  const [mpConfig, setMpConfig] = useState<MercadoPagoConfig>({ accessToken: '', deviceId: '', enabled: false });
  const [mpProcessing, setMpProcessing] = useState(false);
  const [mpStatus, setMpStatus] = useState('');
  const [mpPaymentIntent, setMpPaymentIntent] = useState<PaymentIntent | null>(null);
  const [mpError, setMpError] = useState('');
  const mpPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load MP config from localStorage
  useEffect(() => {
    setMpConfig(getMPConfig());
  }, [open]);

  const productOptions = useMemo(() => {
    return [
      { label: 'Seleccionar producto...', value: '' },
      ...inventoryAlerts.map((a) => ({
        label: `${a.product.name} — Stock: ${a.product.currentStock} — ${formatCurrency(a.product.unitPrice)}`,
        value: a.product.id,
      })),
    ];
  }, [inventoryAlerts]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.subtotal, 0), [items]);
  const iva = useMemo(() => subtotal * IVA_RATE, [subtotal]);
  // No card surcharge for fiado
  const cardSurcharge = useMemo(() => {
    if (paymentMethod !== 'tarjeta' && paymentMethod !== 'tarjeta_manual') return 0;
    const surcharge = subtotal * CARD_SURCHARGE_RATE;
    const surchargeIva = surcharge * IVA_RATE;
    return surcharge + surchargeIva;
  }, [subtotal, paymentMethod]);
  const total = useMemo(() => subtotal + iva + cardSurcharge, [subtotal, iva, cardSurcharge]);
  const change = useMemo(() => {
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, paid - total);
  }, [amountPaid, total]);

  const resetForm = useCallback(() => {
    setItems([]);
    setSelectedProduct('');
    setQuantity('1');
    setPaymentMethod('efectivo');
    setAmountPaid('');
    setCajero('');
    setFiadoClienteId('');
    setCompletedSale(null);
    setBarcodeInput('');
    setBarcodeError('');
    setMpProcessing(false);
    setMpStatus('');
    setMpPaymentIntent(null);
    setMpError('');
    if (mpPollingRef.current) {
      clearInterval(mpPollingRef.current);
      mpPollingRef.current = null;
    }
  }, []);

  // Barcode scan handler — finds product by barcode and adds 1 unit
  const handleBarcodeScan = useCallback((code: string) => {
    if (!code.trim()) return;
    setBarcodeError('');

    const alert = inventoryAlerts.find(
      (a) => a.product.barcode === code.trim() || a.product.sku === code.trim()
    );

    if (!alert) {
      setBarcodeError(`Producto no encontrado: "${code}"`);
      setBarcodeInput('');
      return;
    }

    const product = alert.product;

    // Check stock
    const existingItem = items.find((i) => i.productId === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;

    if (currentQty + 1 > product.currentStock) {
      setBarcodeError(`Stock insuficiente de ${product.name}. Solo hay ${product.currentStock} unidades.`);
      setBarcodeInput('');
      return;
    }

    if (existingItem) {
      setItems((prev) =>
        prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
            : i
        )
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice: product.unitPrice,
          subtotal: product.unitPrice,
        },
      ]);
    }

    showSuccess(`✓ ${product.name} agregado`);
    setBarcodeInput('');
  }, [inventoryAlerts, items, showSuccess]);

  const addItem = useCallback(() => {
    if (!selectedProduct) return;
    const alert = inventoryAlerts.find((a) => a.product.id === selectedProduct);
    if (!alert) return;

    const qty = parseInt(quantity) || 1;
    if (qty <= 0) return;
    if (qty > alert.product.currentStock) {
      showError(`Stock insuficiente. Solo hay ${alert.product.currentStock} unidades de ${alert.product.name}.`);
      return;
    }

    // Check if already in list
    const existingIdx = items.findIndex((i) => i.productId === selectedProduct);
    if (existingIdx >= 0) {
      const existing = items[existingIdx];
      const newQty = existing.quantity + qty;
      if (newQty > alert.product.currentStock) {
        showError(`Stock insuficiente. Solo hay ${alert.product.currentStock} unidades.`);
        return;
      }
      const updated = [...items];
      updated[existingIdx] = {
        ...existing,
        quantity: newQty,
        subtotal: newQty * existing.unitPrice,
      };
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: alert.product.id,
          productName: alert.product.name,
          sku: alert.product.sku,
          quantity: qty,
          unitPrice: alert.product.unitPrice,
          subtotal: qty * alert.product.unitPrice,
        },
      ]);
    }

    setSelectedProduct('');
    setQuantity('1');
  }, [selectedProduct, quantity, inventoryAlerts, items, showError]);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const handleSale = useCallback(async () => {
    if (items.length === 0) {
      showError('Agrega al menos un producto a la venta');
      return;
    }
    if (!cajero.trim()) {
      showError('Ingresa el nombre del cajero');
      return;
    }
    if (paymentMethod === 'efectivo' && (parseFloat(amountPaid) || 0) < total) {
      showError('El monto pagado debe ser mayor o igual al total');
      return;
    }
    // Fiado validation
    if (paymentMethod === 'fiado') {
      if (!fiadoClienteId) {
        showError('Selecciona un cliente para el fiado');
        return;
      }
      const cliente = clientes.find((c) => c.id === fiadoClienteId);
      if (cliente && cliente.balance + total > cliente.creditLimit) {
        showError(`El cliente excede su límite de crédito de ${formatCurrency(cliente.creditLimit)}. Disponible: ${formatCurrency(Math.max(0, cliente.creditLimit - cliente.balance))}`);
        return;
      }
    }
    // If paying with MP terminal, launch terminal flow
    if (paymentMethod === 'tarjeta' && mpConfig.enabled) {
      handleMPTerminalPayment();
      return;
    }

    try {
      // Register the sale
      const sale = await registerSale({
        items,
        subtotal,
        iva,
        cardSurcharge,
        total,
        paymentMethod: paymentMethod === 'tarjeta_manual' ? 'tarjeta' : paymentMethod,
        amountPaid: paymentMethod === 'efectivo' ? parseFloat(amountPaid) || 0 : total,
        change: paymentMethod === 'efectivo' ? change : 0,
        cajero: cajero.trim(),
      });

      // If fiado, also register the fiado transaction with itemized products
      if (paymentMethod === 'fiado') {
        const itemDescriptions = items.map((i) => `${i.productName} x${i.quantity}`).join(', ');
        await registerFiado(fiadoClienteId, total, itemDescriptions, sale.folio, items);
        const cliente = clientes.find((c) => c.id === fiadoClienteId);
        showSuccess(`Venta ${sale.folio} registrada como fiado para ${cliente?.name || 'cliente'}. Total: ${formatCurrency(sale.total)}`);
      } else {
        showSuccess(`Venta ${sale.folio} registrada. Total: ${formatCurrency(sale.total)}`);
      }

      setCompletedSale(sale);
    } catch {
      showError('Error al registrar la venta');
    }
  }, [items, cajero, paymentMethod, amountPaid, total, subtotal, iva, cardSurcharge, change, registerSale, registerFiado, fiadoClienteId, clientes, showSuccess, showError, mpConfig]);

  // ===== Mercado Pago Terminal Flow =====
  const handleMPTerminalPayment = useCallback(async () => {
    if (!mpConfig.enabled || !mpConfig.accessToken || !mpConfig.deviceId) {
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

      // Poll for payment status every 3 seconds
      mpPollingRef.current = setInterval(async () => {
        try {
          const status = await getPaymentIntentStatus(mpConfig, intent.id);
          setMpStatus(getPaymentStatusLabel(status.status));

          if (status.status === 'processed') {
            // Payment successful!
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
              cajero: cajero.trim(),
            });
            setCompletedSale(sale);
            showSuccess(`✅ Pago con tarjeta procesado. Venta ${sale.folio}: ${formatCurrency(sale.total)}`);
          } else if (status.status === 'canceled' || status.status === 'error' || status.status === 'expired') {
            if (mpPollingRef.current) clearInterval(mpPollingRef.current);
            setMpProcessing(false);
            setMpError(`Cobro ${status.status === 'canceled' ? 'cancelado' : status.status === 'expired' ? 'expirado' : 'con error'}. Intenta de nuevo.`);
          }
        } catch {
          // Network error during polling — keep trying
        }
      }, 3000);
    } catch (err) {
      setMpProcessing(false);
      setMpError(err instanceof Error ? err.message : 'Error al conectar con la terminal');
    }
  }, [mpConfig, total, items, subtotal, iva, cardSurcharge, cajero, registerSale, showSuccess, showError]);

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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (mpPollingRef.current) clearInterval(mpPollingRef.current);
    };
  }, []);

  const TICKET_WIDTH = 40;
  const centerLine = (text: string, width = TICKET_WIDTH) => {
    const t = text.trim();
    if (t.length >= width) return t;
    const pad = width - t.length;
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return `${' '.repeat(left)}${t}${' '.repeat(right)}`;
  };

  const wrapAndCenter = (text: string, width = TICKET_WIDTH) => {
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (candidate.length > width) {
        if (current) lines.push(centerLine(current, width));
        current = w;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(centerLine(current, width));
    return lines.join('\n');
  };

  const handlePrint = useCallback(() => {
    if (!completedSale) return;
    const d = new Date(completedSale.date);
    const dateStr = d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const paymentLabels: Record<string, string> = {
      efectivo: 'EFECTIVO',
      tarjeta: 'T. BANCARIA',
      transferencia: 'TRANSFERENCIA',
      fiado: 'CREDITO CLIENTE',
    };
    const pmLabel = paymentLabels[completedSale.paymentMethod] || completedSale.paymentMethod.toUpperCase();
    const totalArticles = completedSale.items.reduce((s, i) => s + i.quantity, 0);
    const dashes = '----------------------------------------';
    const equals = '========================================';
    // Helper: right-align $ amount in a fixed-width column
    const fmtAmt = (n: number) => {
      const s = '$ ' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return s.padStart(16);
    };

    // Build items
    let itemsHtml = '';
    for (const item of completedSale.items) {
      const name = item.productName.toUpperCase();
      const truncName = name.length > 40 ? name.substring(0, 39) + '.' : name;
      itemsHtml += `  ${truncName}\n`;
      itemsHtml += `    ${item.quantity} pza x $${item.unitPrice.toFixed(2)}${fmtAmt(item.subtotal)}\n`;
    }

    // Fiado section
    let fiadoTxt = '';
    if (completedSale.paymentMethod === 'fiado' && fiadoClienteId) {
      const c = clientes.find((cl) => cl.id === fiadoClienteId);
      if (c) {
        fiadoTxt = `
${dashes}
       ** VENTA A CREDITO **
  CLIENTE:        ${c.name.toUpperCase()}
  SALDO ANTERIOR:${fmtAmt(c.balance - completedSale.total)}
  NUEVO SALDO:   ${fmtAmt(c.balance)}
`;
      }
    }

    const sc = storeConfig;
    const footerLines = sc.ticketFooter.split('\n').map((l: string) => centerLine(l)).join('\n');

    const ticketText = `
${centerLine(sc.legalName)}
${centerLine(sc.address)}
${centerLine(`C.P. ${sc.postalCode}, ${sc.city}`)}
${centerLine(`RFC: ${sc.rfc}`)}
${centerLine(`TEL: ${sc.phone}`)}
${centerLine(`REGIMEN FISCAL - ${sc.regimenFiscal}`)}
${wrapAndCenter(sc.regimenDescription)}
${centerLine('ESTE COMPROBANTE NO ES VALIDO PARA')}
${centerLine('EFECTOS FISCALES')}

${centerLine(`TDA#${sc.storeNumber} OP#${completedSale.cajero.toUpperCase().substring(0, 12).padEnd(12)}  TR# ${completedSale.folio}`)}
${centerLine(`${dateStr}              ${timeStr}`)}
${centerLine('RFC: SIN R.F.C.')}
${dashes}
${itemsHtml}${dashes}
  SUBTOTAL               ${fmtAmt(completedSale.subtotal)}
${completedSale.cardSurcharge > 0 ? `  COMISION TARJETA       ${fmtAmt(completedSale.cardSurcharge)}\n` : ''}
  TOTAL                  ${fmtAmt(completedSale.total)}
  ${pmLabel.padEnd(20)}${fmtAmt(completedSale.total)}
  CAMBIO                 ${fmtAmt(completedSale.change)}
${completedSale.paymentMethod === 'efectivo' ? `  RECIBIDO               ${fmtAmt(completedSale.amountPaid)}\n` : ''}${fiadoTxt}
${dashes}
  IVA    ${sc.ivaRate}.0%  ${fmtAmt(completedSale.subtotal)}${fmtAmt(completedSale.iva)}
${dashes}
  TOTAL IVA              ${fmtAmt(completedSale.iva)}

       ARTICULOS VENDIDOS    ${totalArticles}
  TC# ${completedSale.folio}${String(Date.now()).slice(-8)}
${dashes}

${footerLines}
${centerLine('Necesitas ayuda ahora?')}
${centerLine(sc.ticketServicePhone)}
${dashes}
${centerLine(`Vigencia ${sc.ticketVigencia}`)}
${centerLine(`${dateStr}     ${timeStr}`)}
`;

    const printWindow = window.open('', '_blank', 'width=380,height=800');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Ticket</title>
<style>
@media print { @page { size: 80mm auto; margin: 0; } body { margin: 0; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Courier New', 'Consolas', 'Lucida Console', monospace;
  font-size: 12px;
  width: 302px;
  margin: 0 auto;
  padding: 4px 0;
  color: #000;
  line-height: 1.3;
}
pre {
  font-family: inherit;
  font-size: inherit;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  padding: 0 6px;
}
</style></head><body>
<pre>${ticketText}</pre>
<script>window.onload=()=>{window.print();window.close();}<\/script>
</body></html>`);
    printWindow.document.close();
  }, [completedSale, fiadoClienteId, clientes]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Ticket preview (shown after sale is completed)
  if (completedSale) {
    const saleDate = new Date(completedSale.date);
    const dateStr = saleDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = saleDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const paymentLabels: Record<string, string> = {
      efectivo: 'EFECTIVO',
      tarjeta: 'T. BANCARIA',
      transferencia: 'TRANSFERENCIA',
      fiado: 'CREDITO CLIENTE',
    };
    const pmLabel = paymentLabels[completedSale.paymentMethod] || completedSale.paymentMethod.toUpperCase();
    const totalArticles = completedSale.items.reduce((s, i) => s + i.quantity, 0);
    const dashes = '----------------------------------------';

    const fmtAmt = (n: number) => {
      const s = '$ ' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return s.padStart(16);
    };

    let itemsTxt = '';
    for (const item of completedSale.items) {
      const name = item.productName.toUpperCase();
      const truncName = name.length > 40 ? name.substring(0, 39) + '.' : name;
      itemsTxt += `  ${truncName}\n`;
      itemsTxt += `    ${item.quantity} pza x $${item.unitPrice.toFixed(2)}${fmtAmt(item.subtotal)}\n`;
    }

    let fiadoTxt = '';
    if (completedSale.paymentMethod === 'fiado' && fiadoClienteId) {
      const c = clientes.find((cl) => cl.id === fiadoClienteId);
      if (c) {
        fiadoTxt = `\n${dashes}\n       ** VENTA A CREDITO **\n  CLIENTE:        ${c.name.toUpperCase()}\n  SALDO ANTERIOR:${fmtAmt(c.balance - completedSale.total)}\n  NUEVO SALDO:   ${fmtAmt(c.balance)}\n`;
      }
    }

    const sc = storeConfig;
    const footerLines = sc.ticketFooter.split('\n').map((l: string) => centerLine(l)).join('\n');

    const previewText = `
${centerLine(sc.legalName)}
${centerLine(sc.address)}
${centerLine(`C.P. ${sc.postalCode}, ${sc.city}`)}
${centerLine(`RFC: ${sc.rfc}`)}
${centerLine(`TEL: ${sc.phone}`)}
${centerLine(`REGIMEN FISCAL - ${sc.regimenFiscal}`)}
${wrapAndCenter(sc.regimenDescription)}
${centerLine('ESTE COMPROBANTE NO ES VALIDO PARA')}
${centerLine('EFECTOS FISCALES')}

${centerLine(`TDA#${sc.storeNumber} OP#${completedSale.cajero.toUpperCase().substring(0, 12).padEnd(12)}  TR# ${completedSale.folio}`)}
${centerLine(`${dateStr}              ${timeStr}`)}
${centerLine('RFC: SIN R.F.C.')}
${dashes}
${itemsTxt}${dashes}
  SUBTOTAL               ${fmtAmt(completedSale.subtotal)}
${completedSale.cardSurcharge > 0 ? `  COMISION TARJETA       ${fmtAmt(completedSale.cardSurcharge)}\n` : ''}
  TOTAL                  ${fmtAmt(completedSale.total)}
  ${pmLabel.padEnd(20)}${fmtAmt(completedSale.total)}
  CAMBIO                 ${fmtAmt(completedSale.change)}
${completedSale.paymentMethod === 'efectivo' ? `  RECIBIDO               ${fmtAmt(completedSale.amountPaid)}\n` : ''}${fiadoTxt}
${dashes}
  IVA    ${sc.ivaRate}.0%  ${fmtAmt(completedSale.subtotal)}${fmtAmt(completedSale.iva)}
${dashes}
  TOTAL IVA              ${fmtAmt(completedSale.iva)}

       ARTICULOS VENDIDOS    ${totalArticles}
  TC# ${completedSale.folio}${String(Date.now()).slice(-8)}
${dashes}

${footerLines}
${centerLine('Necesitas ayuda ahora?')}
${centerLine(sc.ticketServicePhone)}
${dashes}
${centerLine(`Vigencia ${sc.ticketVigencia}`)}
${centerLine(`${dateStr}     ${timeStr}`)}
`;

    return (
      <Modal
        open={open}
        onClose={handleClose}
        title="Ticket de Venta"
        primaryAction={{
          content: 'Imprimir Ticket',
          icon: PrintIcon,
          onAction: handlePrint,
        }}
        secondaryActions={[
          { content: 'Nueva Venta', onAction: resetForm },
          { content: 'Cerrar', onAction: handleClose },
        ]}
      >
        <Modal.Section>
          <div ref={ticketRef}>
            <div style={{ background: '#fff', padding: '8px', maxWidth: '340px', margin: '0 auto', border: '1px solid #ddd' }}>
              <pre style={{
                fontFamily: "'Courier New', 'Consolas', 'Lucida Console', monospace",
                fontSize: '11.5px',
                lineHeight: '1.3',
                margin: 0,
                padding: '4px 6px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: '#000',
                background: '#fff',
              }}>{previewText}</pre>
            </div>
          </div>
        </Modal.Section>
      </Modal>
    );
  }

  // Sale form
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Registrar Venta"
      primaryAction={{
        content: `Cobrar ${formatCurrency(total)}`,
        onAction: handleSale,
        disabled: items.length === 0,
      }}
      secondaryActions={[
        { content: 'Cancelar', onAction: handleClose },
      ]}
      size="large"
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Barcode scanner */}
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={BarcodeIcon} />
                <Text as="h3" variant="headingSm">Escanear código de barras</Text>
              </InlineStack>
              <InlineStack gap="200" align="end" blockAlign="end">
                <Box minWidth="350px">
                  <div onKeyDown={(e) => {
                    if (e.key === 'Enter' && barcodeInput.trim()) {
                      e.preventDefault();
                      handleBarcodeScan(barcodeInput);
                    }
                  }}>
                    <TextField
                      label="Código de barras"
                      value={barcodeInput}
                      onChange={(val) => {
                        setBarcodeInput(val);
                        setBarcodeError('');
                      }}
                      autoComplete="off"
                      placeholder="Escanea o escribe el código de barras..."
                      helpText="El escáner escribe el código y presiona Enter automáticamente"
                      connectedRight={
                        <Button variant="primary" onClick={() => handleBarcodeScan(barcodeInput)} disabled={!barcodeInput.trim()}>
                          Buscar
                        </Button>
                      }
                      error={barcodeError || undefined}
                    />
                  </div>
                </Box>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Add product to sale (manual) */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">Agregar producto</Text>
              <InlineStack gap="200" align="end" blockAlign="end">
                <Box minWidth="300px">
                  <Select
                    label="Producto"
                    options={productOptions}
                    value={selectedProduct}
                    onChange={setSelectedProduct}
                  />
                </Box>
                <Box minWidth="80px">
                  <TextField
                    label="Cantidad"
                    type="number"
                    value={quantity}
                    onChange={setQuantity}
                    autoComplete="off"
                    min={1}
                  />
                </Box>
                <Button variant="primary" onClick={addItem} disabled={!selectedProduct}>
                  Agregar
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Items list */}
          {items.length > 0 && (
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Productos en venta ({items.length})</Text>
                <IndexTable
                  resourceName={{ singular: 'producto', plural: 'productos' }}
                  itemCount={items.length}
                  headings={[
                    { title: 'Producto' },
                    { title: 'SKU' },
                    { title: 'Cant.' },
                    { title: 'P. Unit.' },
                    { title: 'Subtotal' },
                    { title: '' },
                  ]}
                  selectable={false}
                >
                  {items.map((item, idx) => (
                    <IndexTable.Row id={item.productId} key={item.productId} position={idx}>
                      <IndexTable.Cell>
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{item.productName}</Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span" variant="bodySm" tone="subdued">{item.sku}</Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>{item.quantity}</IndexTable.Cell>
                      <IndexTable.Cell>{formatCurrency(item.unitPrice)}</IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span" fontWeight="semibold">{formatCurrency(item.subtotal)}</Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Button
                          variant="plain"
                          icon={DeleteIcon}
                          tone="critical"
                          onClick={() => removeItem(item.productId)}
                          accessibilityLabel="Eliminar"
                        />
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </BlockStack>
            </Card>
          )}

          {/* Totals */}
          {items.length > 0 && (
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span">Subtotal:</Text>
                  <Text as="span">{formatCurrency(subtotal)}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">IVA (16%):</Text>
                  <Text as="span">{formatCurrency(iva)}</Text>
                </InlineStack>
                {cardSurcharge > 0 && (
                  <InlineStack align="space-between">
                    <Text as="span" tone="caution">Comisión tarjeta (2.5% + IVA):</Text>
                    <Text as="span" tone="caution">{formatCurrency(cardSurcharge)}</Text>
                  </InlineStack>
                )}
                <Divider />
                <InlineStack align="space-between">
                  <Text as="span" variant="headingMd" fontWeight="bold">TOTAL:</Text>
                  <Text as="span" variant="headingMd" fontWeight="bold">{formatCurrency(total)}</Text>
                </InlineStack>
              </BlockStack>
            </Card>
          )}

          {/* Payment details */}
          <FormLayout>
            <TextField
              label="Cajero"
              value={cajero}
              onChange={setCajero}
              autoComplete="off"
              placeholder="Nombre del cajero"
            />
            <Select
              label="Método de pago"
              options={paymentMethodOptions}
              value={paymentMethod}
              onChange={(v) => setPaymentMethod(v as 'efectivo' | 'tarjeta' | 'tarjeta_manual' | 'transferencia' | 'fiado')}
            />
            {paymentMethod === 'fiado' && (
              <BlockStack gap="200">
                <Banner tone="warning">
                  <p>Esta venta se registrará como <strong>fiado</strong>. El monto se sumará a la deuda del cliente.</p>
                </Banner>
                <Select
                  label="Cliente"
                  options={[
                    { label: 'Seleccionar cliente...', value: '' },
                    ...clientes.map((c) => ({
                      label: `${c.name}${c.balance > 0 ? ` — Debe: ${formatCurrency(c.balance)}` : ''} (Límite: ${formatCurrency(c.creditLimit)})`,
                      value: c.id,
                    })),
                  ]}
                  value={fiadoClienteId}
                  onChange={setFiadoClienteId}
                />
                {fiadoClienteId && (() => {
                  const c = clientes.find((cl) => cl.id === fiadoClienteId);
                  if (!c) return null;
                  const disponible = Math.max(0, c.creditLimit - c.balance);
                  const excedeCredito = total > 0 && (c.balance + total) > c.creditLimit;
                  return (
                    <Banner tone={excedeCredito ? 'critical' : 'info'}>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm">
                          Deuda actual: <strong>{formatCurrency(c.balance)}</strong> / Límite: <strong>{formatCurrency(c.creditLimit)}</strong>
                        </Text>
                        <Text as="p" variant="bodySm">
                          Crédito disponible: <strong>{formatCurrency(disponible)}</strong>
                        </Text>
                        {excedeCredito && (
                          <Text as="p" variant="bodySm" tone="critical">
                            ⚠️ Esta venta de {formatCurrency(total)} excede el crédito disponible.
                          </Text>
                        )}
                      </BlockStack>
                    </Banner>
                  );
                })()}
                {clientes.length === 0 && (
                  <Banner tone="info">
                    <p>No hay clientes registrados. Agrega clientes desde la sección de <strong>Fiado / Crédito</strong>.</p>
                  </Banner>
                )}
              </BlockStack>
            )}
            {paymentMethod === 'tarjeta' && !mpConfig.enabled && (
              <Banner tone="warning">
                <p>
                  Terminal Mercado Pago no configurada. Ve a <strong>Configuración &gt; Mercado Pago</strong> para
                  ingresar tu Access Token y Device ID. O usa &quot;Tarjeta (manual sin terminal)&quot;.
                </p>
              </Banner>
            )}
            {paymentMethod === 'tarjeta' && mpConfig.enabled && !mpProcessing && (
              <Banner tone="info">
                <p>
                  Al cobrar, se enviará el monto de <strong>{formatCurrency(total)}</strong> a tu terminal
                  Mercado Pago. El cliente pasará su tarjeta en el dispositivo.
                </p>
              </Banner>
            )}
            {mpProcessing && (
              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Spinner size="small" />
                    <Text as="p" variant="bodyMd" fontWeight="semibold">{mpStatus}</Text>
                  </InlineStack>
                  <ProgressBar progress={mpStatus.includes('Esperando') ? 50 : 25} tone="highlight" size="small" />
                  {mpError && (
                    <Banner tone="critical">
                      <p>{mpError}</p>
                    </Banner>
                  )}
                  <InlineStack align="end">
                    <Button tone="critical" onClick={handleCancelMPPayment}>
                      Cancelar cobro
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            )}
            {paymentMethod === 'efectivo' && (
              <BlockStack gap="200">
                <TextField
                  label="Monto recibido"
                  type="number"
                  value={amountPaid}
                  onChange={setAmountPaid}
                  autoComplete="off"
                  prefix="$"
                  placeholder="0.00"
                  helpText={total > 0 ? `Mínimo: ${formatCurrency(total)}` : undefined}
                />
                {parseFloat(amountPaid) >= total && total > 0 && (
                  <Banner tone="success">
                    <InlineStack align="space-between">
                      <Text as="span" fontWeight="bold">Cambio:</Text>
                      <Text as="span" variant="headingMd" fontWeight="bold">{formatCurrency(change)}</Text>
                    </InlineStack>
                  </Banner>
                )}
              </BlockStack>
            )}
          </FormLayout>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
