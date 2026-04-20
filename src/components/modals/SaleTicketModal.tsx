'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useForm, useField } from '@shopify/react-form';
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Box,
  Button,
  Card,
  TextField,
  Spinner,
} from '@shopify/polaris';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
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
import { posEngine } from '@/lib/pos/pos-engine';
import { sendTicketEmailAction } from '@/app/actions/email-actions';

interface SaleTicketModalProps {
  open: boolean;
  onClose: () => void;
}

/* eslint-disable react-hooks/preserve-manual-memoization -- React Compiler cannot fully optimize this complex modal */
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

  // ── Form State (using @shopify/react-form) ──
  const {
    fields,
    reset: resetCheckoutForm,
    validate: validateCheckout,
    submitting,
  } = useForm({
    fields: {
      paymentMethod: useField<
        | 'efectivo'
        | 'tarjeta'
        | 'tarjeta_manual'
        | 'tarjeta_web'
        | 'transferencia'
        | 'fiado'
        | 'puntos'
        | 'spei'
        | 'paypal'
        | 'qr_cobro'
        | 'spei_conekta'
        | 'spei_stripe'
        | 'oxxo_conekta'
        | 'oxxo_stripe'
        | 'tarjeta_clip'
        | 'clip_terminal'
      >('efectivo'),
      amountPaid: useField({
        value: '',
        validates: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (val, allValues: any) => {
            if (allValues?.paymentMethod === 'efectivo') {
              const paid = parseFloat(val);
              if (isNaN(paid) || paid < allValues?.total)
                return `Monto insuficiente. Total: ${formatCurrency(allValues?.total ?? 0)}`;
            }
          },
        ],
      }),
      clienteId: useField({
        value: '',
        validates: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (val, allValues: any) => {
            if ((allValues?.paymentMethod === 'fiado' || allValues?.paymentMethod === 'puntos') && !val) {
              return 'Debes seleccionar un cliente';
            }
          },
        ],
      }),
      discount: useField(''),
      discountType: useField<'amount' | 'percent'>('amount'),
      barcodeInput: useField(''),
    },
    onSubmit: async () => ({ status: 'success' }),
  });

  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [completedSale, setCompletedSale] = useState<SaleRecord | null>(null);
  const [barcodeError, setBarcodeError] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
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

  // Calculations
  const {
    subtotal,
    discountAmount,
    subtotalAfterDiscount,
    iva,
    cardSurcharge,
    pointsEarned,
    pointsAvailable,
    total,
    pointsUsed,
    change,
  } = useSaleCalculations({
    items,
    discount: fields.discount.value,
    discountType: fields.discountType.value,
    discountPending,
    paymentMethod: fields.paymentMethod.value,
    clienteId: fields.clienteId.value,
    clientes,
    amountPaid: fields.amountPaid.value,
    storeConfig,
  });

  // Mercado Pago terminal
  const {
    mpConfig,
    mpProcessing,
    mpStatus,
    mpError,
    mpWebSuccess,
    setMpWebSuccess,
    handleMPTerminalPaymentRef,
    handleCancelMPPayment,
    resetMpState,
  } = useMercadoPagoTerminal({
    total,
    items,
    subtotal,
    iva,
    cardSurcharge,
    open,
    onSaleComplete: setCompletedSale,
  });

  // Ticket printer
  const { printTicket } = useTicketPrinter();

  // ── Callbacks ──

  const resetForm = useCallback(() => {
    setItems([]);
    setSelectedProduct('');
    setQuantity('1');
    resetCheckoutForm();
    setCompletedSale(null);
    setBarcodeError('');
    setCustomerEmail('');
    setDiscountPending(false);
    resetMpState();
  }, [resetCheckoutForm, resetMpState]);

  const handleBarcodeScan = useCallback(
    (code: string) => {
      if (!code.trim()) return;
      setBarcodeError('');

      const product = allProducts.find((p) => p.barcode === code.trim() || p.sku === code.trim());
      if (!product) {
        setBarcodeError(`Producto no encontrado: "${code}"`);
        fields.barcodeInput.onChange('');
        return;
      }

      const existingItem = items.find((i) => i.productId === product.id);
      const currentQty = existingItem ? existingItem.quantity : 0;
      if (currentQty + 1 > product.currentStock) {
        setBarcodeError(`Stock insuficiente de ${product.name}. Solo hay ${product.currentStock} unidades.`);
        fields.barcodeInput.onChange('');
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
      showSuccess(`${product.name} agregado`);
      fields.barcodeInput.onChange('');
    },
    [allProducts, items, showSuccess, fields.barcodeInput],
  );

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
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: qty,
          unitPrice: product.unitPrice,
          subtotal: qty * product.unitPrice,
        },
      ]);
    }
    setSelectedProduct('');
    setQuantity('1');
  }, [selectedProduct, quantity, allProducts, items, showError]);

  const handleRemoveClick = useCallback(
    (productId: string) => {
      if (hasPermission('sales.delete_item')) {
        setItems((prev) => prev.filter((i) => i.productId !== productId));
      } else {
        setPinPadAction({ type: 'delete', payload: productId });
        setPinPadOpen(true);
      }
    },
    [hasPermission],
  );

  const handleUpdateQuantity = useCallback(
    (productId: string, delta: number) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.productId !== productId) return item;
          const product = allProducts.find((p) => p.id === productId);
          const newQty = item.quantity + delta;
          if (newQty < 1 || (product && newQty > product.currentStock)) return item;
          return { ...item, quantity: newQty, subtotal: newQty * item.unitPrice };
        }),
      );
    },
    [allProducts],
  );

  const handleApplyDiscount = useCallback(() => {
    if (!fields.discount.value || parseFloat(fields.discount.value) <= 0) return;
    if (hasPermission('sales.discount')) {
      setDiscountPending(false);
    } else {
      setDiscountPending(true);
      setPinPadAction({ type: 'discount', payload: '' });
      setPinPadOpen(true);
    }
  }, [fields.discount.value, hasPermission]);

  const handlePinSuccess = useCallback(
    (_uid: string, _name: string) => {
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
    },
    [pinPadAction, showSuccess],
  );

  const finishSale = useCallback(
    async (pmOverride?: string) => {
      try {
        const pMethod =
          pmOverride || (fields.paymentMethod.value === 'tarjeta_manual' ? 'tarjeta' : fields.paymentMethod.value);

        const payload = {
          items,
          subtotal: subtotalAfterDiscount,
          iva,
          cardSurcharge,
          total,
          paymentMethod: pMethod,
          amountPaid: fields.paymentMethod.value === 'efectivo' ? parseFloat(fields.amountPaid.value) || 0 : total,
          change: fields.paymentMethod.value === 'efectivo' ? change : 0,
          cajero:
            currentUserRole?.globalId || currentUserRole?.employeeNumber || currentUserRole?.displayName || 'Cajero',
          pointsEarned,
          pointsUsed,
          discount: discountAmount,
          discountType: fields.discountType.value,
          clienteId: fields.clienteId.value || undefined,
        } as Omit<SaleRecord, 'id' | 'folio' | 'date'> & { clienteId?: string };

        const result = await posEngine.processSale(payload);

        if (fields.paymentMethod.value === 'fiado') {
          // El fiado offline requiere lógica extra, por ahora lo manejamos como venta normal
          // si es offline, pero notificamos.
          if (!result.isOffline) {
            const itemDescriptions = items.map((i) => `${i.productName} x${i.quantity}`).join(', ');
            await registerFiado(fields.clienteId.value, total, itemDescriptions, result.folio, items);
            const cliente = clientes.find((c) => c.id === fields.clienteId.value);
            showSuccess(
              `Venta ${result.folio} registrada como fiado para ${cliente?.name || 'cliente'}. Total: ${formatCurrency(total)}`,
            );
          } else {
            showSuccess(`VENTA OFFLINE (#${result.folio}): Se sincronizará el fiado al volver el internet.`);
          }
        } else {
          if (result.isOffline) {
            showSuccess(`Venta OFFLINE (#${result.folio}) guardada localmente ✔️`);
          } else {
            showSuccess(`Venta ${result.folio} registrada correctamente`);
          }
        }

        // IMPORTANTE: Para el ticket offline creamos un registro temporal
        const sale = {
          ...payload,
          id: `temp-${Date.now()}`,
          folio: result.folio,
          date: new Date().toISOString(),
        } as SaleRecord;

        setCompletedSale(sale);

        // Fire-and-forget: send ticket email if customer provided email
        if (customerEmail.trim()) {
          const fechaFormatted = new Date(sale.date).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          sendTicketEmailAction({
            to: customerEmail.trim(),
            folio: sale.folio,
            fecha: fechaFormatted,
            cajero: sale.cajero,
            items: sale.items.map((i) => ({
              name: i.productName,
              qty: i.quantity,
              price: i.unitPrice,
              subtotal: i.subtotal,
            })),
            subtotal: sale.subtotal,
            iva: sale.iva ?? 0,
            total: sale.total,
            paymentMethod: sale.paymentMethod,
          }).then((res) => {
            if (res.success) showSuccess(`Ticket enviado a ${customerEmail.trim()}`);
          }).catch(() => {
            // Email send failure should not block the sale flow
          });
        }
      } catch (error: unknown) {
        console.error('Sale Registration Error (Modal):', error);
        showError(
          `Error al registrar la venta: ${error instanceof Error ? error.message : 'Error de conexión o permisos'}`,
        );
      }
    },
    [
      items,
      fields.paymentMethod.value,
      fields.amountPaid.value,
      fields.discountType.value,
      fields.clienteId.value,
      total,
      subtotalAfterDiscount,
      iva,
      cardSurcharge,
      change,
      registerSale,
      currentUserRole,
      pointsEarned,
      pointsUsed,
      discountAmount,
      registerFiado,
      clientes,
      customerEmail,
      showSuccess,
      showError,
    ],
  );

  // ── Customer Display Synchronization ──
  useEffect(() => {
    const channel = new BroadcastChannel('customer_display');

    // Determine status
    let status: 'idle' | 'active' | 'paying' | 'finished' = 'idle';
    if (open) {
      if (completedSale) status = 'finished';
      else if (submitting || mpProcessing) status = 'paying';
      else if (items.length > 0) status = 'active';
      else status = 'idle';
    }

    channel.postMessage({
      type: 'UPDATE_SALE',
      payload: {
        items,
        total,
        subtotal,
        iva,
        cardSurcharge,
        discountAmount,
        paymentMethod: fields.paymentMethod.value,
        status,
        folio: completedSale?.folio,
      },
    });

    return () => channel.close();
  }); // React Compiler auto-optimizes dependencies

  const handleSale = useCallback(async () => {
    if (items.length === 0) {
      showError('Agrega al menos un producto a la venta');
      return;
    }

    const errors = validateCheckout();
    if (errors.length > 0) {
      showError(errors[0].message);
      return;
    }

    // Verificar horario de cierre
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (storeConfig.closeSystemTime && currentTime >= storeConfig.closeSystemTime) {
      showError(`Sistema cerrado. Cierre: ${storeConfig.closeSystemTime}`);
      return;
    }

    if (fields.paymentMethod.value === 'fiado') {
      const cliente = clientes.find((c) => c.id === fields.clienteId.value);
      if (cliente && parseFloat(String(cliente.balance)) + total > parseFloat(String(cliente.creditLimit))) {
        showError(
          `Excede límite de crédito. Disponible: ${formatCurrency(Math.max(0, parseFloat(String(cliente.creditLimit)) - parseFloat(String(cliente.balance))))}`,
        );
        return;
      }
    }

    if (fields.paymentMethod.value === 'tarjeta' && mpConfig.enabled) {
      if (handleMPTerminalPaymentRef.current) await handleMPTerminalPaymentRef.current();
      else showError('Error terminal MP');
      return;
    }

    if (fields.paymentMethod.value === 'tarjeta_web') {
      showError('Completa el pago MP Web');
      return;
    }

    await finishSale();
  }, [
    items,
    fields.paymentMethod.value,
    fields.clienteId.value,
    total,
    clientes,
    mpConfig.enabled,
    storeConfig.closeSystemTime,
    validateCheckout,
    showError,
    finishSale,
  ]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Keyboard shortcut bridge from HelpDrawer (and global shortcuts)
  useEffect(() => {
    if (!open) return;

    const onPosShortcut = (event: Event) => {
      const customEvent = event as CustomEvent<{ action?: string }>;
      const action = customEvent.detail?.action;
      if (!action || submitting) return;

      if (action === 'manual-search') {
        const barcodeInputEl = document.getElementById('sale-barcode-input') as HTMLInputElement | null;
        barcodeInputEl?.focus();
        barcodeInputEl?.select();
        return;
      }

      if (action === 'checkout') {
        if (items.length > 0) {
          void handleSale();
        }
        return;
      }

      if (items.length === 0) return;
      const lastItem = items[items.length - 1];
      if (!lastItem) return;

      if (action === 'remove-item') {
        handleRemoveClick(lastItem.productId);
        return;
      }

      if (action === 'inc-qty') {
        handleUpdateQuantity(lastItem.productId, 1);
        return;
      }

      if (action === 'dec-qty') {
        handleUpdateQuantity(lastItem.productId, -1);
      }
    };

    window.addEventListener('gs-pos-shortcut', onPosShortcut as EventListener);
    return () => {
      window.removeEventListener('gs-pos-shortcut', onPosShortcut as EventListener);
    };
  }, [open, submitting, items, handleSale, handleRemoveClick, handleUpdateQuantity]);

  // ── Responsive ──
  const isMobile = useMediaQuery('(max-width: 768px)');

  // ── Ticket preview (after sale completed) ──
  if (completedSale) {
    return (
      <TicketPreview
        open={open}
        completedSale={completedSale}
        storeConfig={storeConfig}
        clienteId={fields.clienteId.value}
        clientes={clientes}
        customerEmail={customerEmail}
        onPrint={() => printTicket(completedSale)}
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
        primaryAction={
          isMobile
            ? undefined
            : {
                content: submitting ? 'Procesando...' : `Cobrar ${formatCurrency(total)}`,
                onAction: handleSale,
                loading: submitting,
                disabled: items.length === 0 || submitting,
              }
        }
        secondaryActions={[{ content: 'Cancelar', onAction: handleClose }]}
        size="large"
      >
        <Modal.Section>
          {submitting ? (
            <Box padding="800">
              <BlockStack gap="400" align="center" inlineAlign="center">
                <Spinner size="large" />
                <BlockStack gap="100" align="center">
                  <Text as="p" variant="headingMd" alignment="center">
                    Procesando Venta...
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                    {typeof navigator !== 'undefined' && navigator.onLine
                      ? 'Sincronizando con la nube'
                      : 'Guardando en modo offline'}
                  </Text>
                </BlockStack>
              </BlockStack>
            </Box>
          ) : (
            <BlockStack gap="400">
              {/* ── Escáner de código de barras ── */}
              <BarcodeScannerCard
                barcodeInput={fields.barcodeInput.value}
                onBarcodeInputChange={(val) => {
                  fields.barcodeInput.onChange(val);
                  setBarcodeError('');
                }}
                barcodeError={barcodeError}
                onScan={handleBarcodeScan}
                inputId="sale-barcode-input"
              />

              {/* ── Agregar producto manual ── */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Agregar producto
                  </Text>
                  <BlockStack gap="200">
                    <SearchableSelect
                      label="Producto"
                      options={allProducts.map((p) => ({
                        label: `${p.name} — Stock: ${p.currentStock} — ${formatCurrency(p.unitPrice)}`,
                        value: p.id,
                      }))}
                      selected={selectedProduct}
                      onChange={setSelectedProduct}
                    />
                    <InlineStack gap="200" blockAlign="end">
                      <Box minWidth="80px" maxWidth="120px">
                        <TextField
                          label="Cantidad"
                          type="number"
                          value={quantity}
                          onChange={setQuantity}
                          autoComplete="off"
                          min={1}
                          selectTextOnFocus
                        />
                      </Box>
                      <Button variant="primary" onClick={addItem} disabled={!selectedProduct} fullWidth>
                        Agregar
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* ── Carrito ── */}
              {items.length > 0 ? (
                <Card>
                  <SaleItemsTable
                    items={items}
                    allProducts={allProducts}
                    onRemove={handleRemoveClick}
                    onUpdateQuantity={handleUpdateQuantity}
                  />
                </Card>
              ) : (
                <Card>
                  <Box padding="600">
                    <BlockStack gap="200" align="center" inlineAlign="center">
                      <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                        Escanea un código de barras o selecciona un producto para comenzar.
                      </Text>
                    </BlockStack>
                  </Box>
                </Card>
              )}

              {/* ── Totales ── */}
              {items.length > 0 && (
                <SaleTotalsCard
                  subtotal={subtotal}
                  discountType={fields.discountType.value}
                  discount={fields.discount.value}
                  discountAmount={discountAmount}
                  discountPending={discountPending}
                  iva={iva}
                  cardSurcharge={cardSurcharge}
                  total={total}
                  onDiscountTypeChange={(type) => {
                    fields.discountType.onChange(type);
                    fields.discount.onChange('');
                  }}
                  onDiscountChange={(v) => {
                    fields.discount.onChange(v);
                    setDiscountPending(false);
                  }}
                  onApplyDiscount={handleApplyDiscount}
                  onRemoveDiscount={() => {
                    fields.discount.onChange('');
                    setDiscountPending(false);
                  }}
                />
              )}

              {/* ── Método de pago ── */}
              <PaymentDetailsSection
                currentUserRole={currentUserRole}
                paymentMethodField={fields.paymentMethod}
                clienteIdField={fields.clienteId}
                amountPaidField={fields.amountPaid}
                clientes={clientes}
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
                clabeNumber={storeConfig.clabeNumber}
                paypalUsername={storeConfig.paypalUsername}
                paypalQrUrl={storeConfig.paypalQrUrl}
                cobrarQrUrl={storeConfig.cobrarQrUrl}
              />

              {/* ── Email del cliente (ticket digital) ── */}
              {items.length > 0 && storeConfig.emailEnabled && storeConfig.emailTicketEnabled && (
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      Ticket digital
                    </Text>
                    <TextField
                      label="Correo del cliente"
                      type="email"
                      value={customerEmail}
                      onChange={setCustomerEmail}
                      autoComplete="email"
                      placeholder="cliente@ejemplo.com"
                      helpText="Se enviará el ticket de compra por correo electrónico"
                    />
                  </BlockStack>
                </Card>
              )}

              {/* Spacer so content doesn't hide behind fixed Cobrar bar on mobile */}
              {isMobile && items.length > 0 && <Box minHeight="72px" />}
            </BlockStack>
          )}
        </Modal.Section>

        {/* ── Fixed bottom Cobrar bar (mobile only) ── */}
        {isMobile && items.length > 0 && !submitting && (
          <div className="sale-modal-fixed-cobrar">
            <Button
              variant="primary"
              size="large"
              onClick={handleSale}
              loading={submitting}
              disabled={items.length === 0 || submitting}
              fullWidth
            >
              {`Cobrar ${formatCurrency(total)}`}
            </Button>
          </div>
        )}
      </Modal>

      <PinPadModal
        open={pinPadOpen}
        onClose={() => {
          setPinPadOpen(false);
          setPinPadAction(null);
          setDiscountPending(false);
        }}
        onSuccess={handlePinSuccess}
        requiredPermission={pinPadAction?.type === 'discount' ? 'sales.discount' : 'sales.delete_item'}
        title={pinPadAction?.type === 'discount' ? 'Autorizar Descuento' : 'Autorizar Cancelación de Artículo'}
      />
    </>
  );
}
