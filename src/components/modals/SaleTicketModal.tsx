'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Box,
  Button,
  Card,
  TextField,
} from '@shopify/polaris';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency } from '@/lib/utils';
import type { SaleItem, SaleRecord } from '@/types';

// Extracted hooks
import { usePermissions } from '@/hooks/usePermissions';
import { useSaleCalculations } from '@/hooks/useSaleCalculations';
import { useMercadoPagoTerminal } from '@/hooks/useMercadoPagoTerminal';
import { useTicketPrinter } from '@/hooks/useTicketPrinter';

// Extracted sub-components
import { TicketPreview } from './sale/TicketPreview';
import { BarcodeScannerCard } from './sale/BarcodeScannerCard';
import { SaleItemsTable } from './sale/SaleItemsTable';
import { SaleTotalsCard } from './sale/SaleTotalsCard';
import { PaymentDetailsSection } from './sale/PaymentDetailsSection';
import { PinPadModal } from './PinPadModal';

interface SaleTicketModalProps {
  open: boolean;
  onClose: () => void;
}

export function SaleTicketModal({ open, onClose }: SaleTicketModalProps) {
  const products = useDashboardStore((s) => s.products);
  const inventoryAlerts = useDashboardStore((s) => s.inventoryAlerts);
  const registerSale = useDashboardStore((s) => s.registerSale);
  const clientes = useDashboardStore((s) => s.clientes);
  const registerFiado = useDashboardStore((s) => s.registerFiado);
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const currentUserRole = useDashboardStore((s) => s.currentUserRole);
  const { showSuccess, showError } = useToast();

  // Permissions
  const { hasPermission } = usePermissions();

  // State
  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'tarjeta_manual' | 'tarjeta_web' | 'transferencia' | 'fiado' | 'puntos'>('efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [completedSale, setCompletedSale] = useState<SaleRecord | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountPending, setDiscountPending] = useState(false);
  const [pinPadOpen, setPinPadOpen] = useState(false);
  const [pinPadAction, setPinPadAction] = useState<{ type: string; payload: string } | null>(null);

  // Merged products
  const allProducts = useMemo(() => {
    const alertProducts = inventoryAlerts.map((a) => a.product);
    const merged = [...alertProducts];
    products.forEach((p) => {
      if (!merged.find((ap) => ap.id === p.id)) merged.push(p);
    });
    return merged;
  }, [products, inventoryAlerts]);

  const productOptions = useMemo(() => {
    return [
      { label: 'Seleccionar producto...', value: '' },
      ...allProducts.map((p) => ({
        label: `${p.name} — Stock: ${p.currentStock} — ${formatCurrency(p.unitPrice)}`,
        value: p.id,
      })),
    ];
  }, [allProducts]);

  // Calculations
  const {
    subtotal, discountAmount, subtotalAfterDiscount, iva, cardSurcharge,
    pointsEarned, pointsAvailable, total, pointsUsed, change,
  } = useSaleCalculations({
    items, discount, discountType, discountPending, paymentMethod, clienteId, clientes, amountPaid, storeConfig,
  });

  // Mercado Pago terminal
  const {
    mpConfig, mpProcessing, mpStatus, mpError, mpWebSuccess, setMpWebSuccess,
    handleMPTerminalPaymentRef, handleCancelMPPayment, resetMpState,
  } = useMercadoPagoTerminal({
    total, items, subtotal, iva, cardSurcharge, open,
    onSaleComplete: setCompletedSale,
  });

  // Ticket printer
  const { handlePrint } = useTicketPrinter({ completedSale, storeConfig, clienteId, clientes });

  // ── Callbacks ──

  const resetForm = useCallback(() => {
    setItems([]);
    setSelectedProduct('');
    setQuantity('1');
    setPaymentMethod('efectivo');
    setAmountPaid('');
    setClienteId('');
    setCompletedSale(null);
    setBarcodeInput('');
    setBarcodeError('');
    setDiscount('');
    setDiscountType('amount');
    setDiscountPending(false);
    resetMpState();
  }, [resetMpState]);

  const handleBarcodeScan = useCallback((code: string) => {
    if (!code.trim()) return;
    setBarcodeError('');

    const product = allProducts.find(
      (p) => p.barcode === code.trim() || p.sku === code.trim(),
    );
    if (!product) {
      setBarcodeError(`Producto no encontrado: "${code}"`);
      setBarcodeInput('');
      return;
    }

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
            : i,
        ),
      );
    } else {
      setItems((prev) => [
        ...prev,
        { productId: product.id, productName: product.name, sku: product.sku, quantity: 1, unitPrice: product.unitPrice, subtotal: product.unitPrice },
      ]);
    }
    showSuccess(`${product.name} agregado`);
    setBarcodeInput('');
  }, [allProducts, items, showSuccess]);

  const addItem = useCallback(() => {
    if (!selectedProduct) return;
    const product = allProducts.find((p) => p.id === selectedProduct);
    if (!product) return;

    const qty = parseInt(quantity) || 1;
    if (qty <= 0) return;
    if (qty > product.currentStock) {
      showError(`Stock insuficiente. Solo hay ${product.currentStock} unidades de ${product.name}.`);
      return;
    }

    const existingIdx = items.findIndex((i) => i.productId === selectedProduct);
    if (existingIdx >= 0) {
      const existing = items[existingIdx];
      const newQty = existing.quantity + qty;
      if (newQty > product.currentStock) {
        showError(`Stock insuficiente. Solo hay ${product.currentStock} unidades.`);
        return;
      }
      const updated = [...items];
      updated[existingIdx] = { ...existing, quantity: newQty, subtotal: newQty * existing.unitPrice };
      setItems(updated);
    } else {
      setItems([
        ...items,
        { productId: product.id, productName: product.name, sku: product.sku, quantity: qty, unitPrice: product.unitPrice, subtotal: qty * product.unitPrice },
      ]);
    }
    setSelectedProduct('');
    setQuantity('1');
  }, [selectedProduct, quantity, allProducts, items, showError]);

  const handleRemoveClick = useCallback((productId: string) => {
    if (hasPermission('sales.delete_item')) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } else {
      setPinPadAction({ type: 'delete', payload: productId });
      setPinPadOpen(true);
    }
  }, [hasPermission]);

  const handleApplyDiscount = useCallback(() => {
    if (!discount || parseFloat(discount) <= 0) return;
    if (hasPermission('sales.discount')) {
      setDiscountPending(false);
    } else {
      setDiscountPending(true);
      setPinPadAction({ type: 'discount', payload: '' });
      setPinPadOpen(true);
    }
  }, [discount, hasPermission]);

  const handlePinSuccess = useCallback((_uid: string, _name: string) => {
    if (pinPadAction?.type === 'delete') {
      setItems((prev) => prev.filter((i) => i.productId !== pinPadAction.payload));
      showSuccess('Artículo anulado (Autorizado)');
    }
    if (pinPadAction?.type === 'discount') {
      setDiscountPending(false);
      showSuccess('Descuento autorizado');
    }
    setPinPadOpen(false);
    setPinPadAction(null);
  }, [pinPadAction, showSuccess]);

  const finishSale = useCallback(async (pmOverride?: string) => {
    try {
      const pMethod = pmOverride || (paymentMethod === 'tarjeta_manual' ? 'tarjeta' : paymentMethod);
      const sale = await registerSale({
        items,
        subtotal: subtotalAfterDiscount,
        iva,
        cardSurcharge,
        total,
        paymentMethod: pMethod,
        amountPaid: paymentMethod === 'efectivo' ? parseFloat(amountPaid) || 0 : total,
        change: paymentMethod === 'efectivo' ? change : 0,
        cajero: currentUserRole?.globalId || currentUserRole?.employeeNumber || currentUserRole?.displayName || 'Cajero',
        pointsEarned,
        pointsUsed,
        discount: discountAmount,
        discountType,
      } as any);

      if (paymentMethod === 'fiado') {
        const itemDescriptions = items.map((i) => `${i.productName} x${i.quantity}`).join(', ');
        await registerFiado(clienteId, total, itemDescriptions, sale.folio, items);
        const cliente = clientes.find((c) => c.id === clienteId);
        showSuccess(`Venta ${sale.folio} registrada como fiado para ${cliente?.name || 'cliente'}. Total: ${formatCurrency(sale.total)}`);
      } else {
        showSuccess(`Venta ${sale.folio} registrada. Total: ${formatCurrency(sale.total)}`);
      }
      setCompletedSale(sale);
    } catch (error) {
      showError('Error al registrar la venta');
    }
  }, [items, paymentMethod, amountPaid, total, subtotalAfterDiscount, iva, cardSurcharge, change, registerSale, currentUserRole, pointsEarned, pointsUsed, discountAmount, discountType, registerFiado, clienteId, clientes, showSuccess, showError]);

  const handleSale = useCallback(async () => {
    if (items.length === 0) { showError('Agrega al menos un producto a la venta'); return; }
    if (paymentMethod === 'efectivo' && parseFloat(amountPaid) < total) { showError('El monto pagado es insuficiente'); return; }
    if (paymentMethod === 'fiado') {
      if (!clienteId) { showError('Selecciona un cliente para el fiado'); return; }
      const cliente = clientes.find((c) => c.id === clienteId);
      if (cliente && cliente.balance + total > cliente.creditLimit) {
        showError(`El cliente excede su límite de crédito de ${formatCurrency(cliente.creditLimit)}. Disponible: ${formatCurrency(Math.max(0, cliente.creditLimit - cliente.balance))}`);
        return;
      }
    }
    if (paymentMethod === 'puntos') {
      if (!clienteId) { showError('Debes seleccionar un cliente para usar sus puntos'); return; }
      if (pointsAvailable <= 0) { showError('El cliente no tiene puntos disponibles'); return; }
    }
    if (paymentMethod === 'tarjeta' && mpConfig.enabled) { handleMPTerminalPaymentRef.current?.(); return; }
    if (paymentMethod === 'tarjeta_web') { showError('Por favor completa el pago interactivo en pantalla.'); return; }

    await finishSale();
  }, [items, paymentMethod, amountPaid, total, clienteId, clientes, pointsAvailable, mpConfig.enabled, showError, finishSale, handleMPTerminalPaymentRef]);

  const handleClose = useCallback(() => { resetForm(); onClose(); }, [resetForm, onClose]);

  // ── Ticket preview (after sale completed) ──
  if (completedSale) {
    return (
      <TicketPreview
        open={open}
        completedSale={completedSale}
        storeConfig={storeConfig}
        clienteId={clienteId}
        clientes={clientes}
        onPrint={handlePrint}
        onNewSale={resetForm}
        onClose={handleClose}
      />
    );
  }

  // ── Sale form ──
  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Registrar Venta"
        primaryAction={{
          content: `Cobrar ${formatCurrency(total)}`,
          onAction: handleSale,
          disabled: items.length === 0,
        }}
        secondaryActions={[{ content: 'Cancelar', onAction: handleClose }]}
        size="large"
      >
        <Modal.Section>
          <BlockStack gap="400">
            <BarcodeScannerCard
              barcodeInput={barcodeInput}
              onBarcodeInputChange={(val) => { setBarcodeInput(val); setBarcodeError(''); }}
              barcodeError={barcodeError}
              onScan={handleBarcodeScan}
            />

            {/* Add product manually */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Agregar producto</Text>
                <InlineStack gap="200" align="end" blockAlign="end">
                  <Box minWidth="300px">
                    <SearchableSelect
                      label="Producto"
                      options={allProducts.map((p) => ({
                        label: `${p.name} — Stock: ${p.currentStock} — ${formatCurrency(p.unitPrice)}`,
                        value: p.id,
                      }))}
                      selected={selectedProduct}
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

            <SaleItemsTable items={items} allProducts={allProducts} onRemove={handleRemoveClick} />

            {items.length > 0 && (
              <SaleTotalsCard
                subtotal={subtotal}
                discountType={discountType}
                discount={discount}
                discountAmount={discountAmount}
                discountPending={discountPending}
                iva={iva}
                cardSurcharge={cardSurcharge}
                total={total}
                onDiscountTypeChange={(type) => { setDiscountType(type); setDiscount(''); }}
                onDiscountChange={(v) => { setDiscount(v); setDiscountPending(false); }}
                onApplyDiscount={handleApplyDiscount}
                onRemoveDiscount={() => { setDiscount(''); setDiscountPending(false); }}
              />
            )}

            <PaymentDetailsSection
              currentUserRole={currentUserRole}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={(v) => setPaymentMethod(v as any)}
              clienteId={clienteId}
              onClienteIdChange={setClienteId}
              clientes={clientes}
              amountPaid={amountPaid}
              onAmountPaidChange={setAmountPaid}
              total={total}
              subtotal={subtotalAfterDiscount}
              iva={iva}
              cardSurcharge={cardSurcharge}
              change={change}
              pointsAvailable={pointsAvailable}
              mpConfig={mpConfig}
              mpProcessing={mpProcessing}
              mpStatus={mpStatus}
              mpError={mpError}
              mpWebSuccess={mpWebSuccess}
              onCancelMPPayment={handleCancelMPPayment}
              onMpWebSuccess={() => setMpWebSuccess(true)}
              finishSale={finishSale}
              showError={showError}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <PinPadModal
        open={pinPadOpen}
        onClose={() => { setPinPadOpen(false); setPinPadAction(null); setDiscountPending(false); }}
        onSuccess={handlePinSuccess}
        requiredPermission={pinPadAction?.type === 'discount' ? 'sales.discount' : 'sales.delete_item'}
        title={pinPadAction?.type === 'discount' ? 'Autorizar Descuento' : 'Autorizar Cancelación de Artículo'}
      />
    </>
  );
}
