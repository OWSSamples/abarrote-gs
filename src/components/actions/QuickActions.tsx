'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  BlockStack,
  Text,
  Modal,
  FormLayout,
  TextField,
  DatePicker,
  Banner,
  Icon,
  InlineGrid,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import {
  PlusIcon,
  ArchiveIcon,
  AdjustIcon,
  CartIcon,
  CashDollarIcon,
  PlusIcon as PlusMinorIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { AperturaCajaModal } from '@/components/modals/AperturaCajaModal';
import { useToast } from '@/components/notifications/ToastProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { RegisterProductModal } from '@/components/modals/RegisterProductModal';
import { SaleTicketModal } from '@/components/modals/SaleTicketModal';
import { ServiciosModal } from '@/components/modals/ServiciosModal';
import { PinPadModal } from '@/components/modals/PinPadModal';
import { formatCurrency } from '@/lib/utils';
import { useTicketPrinter } from '@/hooks/useTicketPrinter';

export function QuickActions() {
  const inventoryAlerts = useDashboardStore((s) => s.inventoryAlerts);
  const registerMerma = useDashboardStore((s) => s.registerMerma);
  const adjustStock = useDashboardStore((s) => s.adjustStock);
  const createPedido = useDashboardStore((s) => s.createPedido);
  const clientes = useDashboardStore((s) => s.clientes);
  const registerAbono = useDashboardStore((s) => s.registerAbono);
  const toast = useToast();
  const { hasPermission, isLoaded: permsLoaded } = usePermissions();

  const canManageInventory = !permsLoaded || hasPermission('inventory.edit');
  const canCreateSales = !permsLoaded || hasPermission('sales.create');
  const canManagePedidos = !permsLoaded || hasPermission('pedidos.create');
  const _canManageServicios = !permsLoaded || hasPermission('servicios.create');
  const canCreateFiado = !permsLoaded || hasPermission('fiado.create');

  const [mermaModalOpen, setMermaModalOpen] = useState(false);
  const [pedidoModalOpen, setPedidoModalOpen] = useState(false);
  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);
  const [registerProductOpen, setRegisterProductOpen] = useState(false);
  const [saleTicketOpen, setSaleTicketOpen] = useState(false);
  const [serviciosOpen, setServiciosOpen] = useState(false);
  const [aperturaOpen, setAperturaOpen] = useState(false);
  const [pinPadOpen, setPinPadOpen] = useState(false);
  const { openDrawer } = useTicketPrinter();

  const [abonoOpen, setAbonoOpen] = useState(false);
  const [abonoClienteId, setAbonoClienteId] = useState('');
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoDescription, setAbonoDescription] = useState('');

  // Form states for Merma
  const [mermaProducto, setMermaProducto] = useState('');
  const [mermaCantidad, setMermaCantidad] = useState('');
  const [mermaRazon, setMermaRazon] = useState('expiration');
  const [mermaDate, setMermaDate] = useState(new Date());
  const [mermaMonth, setMermaMonth] = useState(new Date().getMonth());
  const [mermaYear, setMermaYear] = useState(new Date().getFullYear());

  // Form states for Pedido
  const [pedidoProveedor, setPedidoProveedor] = useState('');
  const [pedidoNotas, setPedidoNotas] = useState('');

  // Form states for Ajuste
  const [ajusteProducto, setAjusteProducto] = useState('');
  const [ajusteNuevaCantidad, setAjusteNuevaCantidad] = useState('');
  const [ajusteRazon, setAjusteRazon] = useState('');

  const productOptions = inventoryAlerts.map((a) => ({
    label: `${a.product.name} (${a.product.sku})`,
    value: a.product.id,
  }));

  const razonOptions = [
    { label: 'Vencimiento', value: 'expiration' },
    { label: 'Daño físico', value: 'damage' },
    { label: 'Deterioro', value: 'spoilage' },
    { label: 'Otro', value: 'other' },
  ];

  const ajusteRazonOptions = [
    { label: 'Seleccionar razón...', value: '' },
    { label: 'Recuento físico', value: 'recount' },
    { label: 'Recepción de mercancía', value: 'reception' },
    { label: 'Devolución de cliente', value: 'return' },
    { label: 'Merma/Robo', value: 'shrinkage' },
    { label: 'Error de sistema', value: 'system_error' },
    { label: 'Otro', value: 'other' },
  ];

  const selectedMermaProduct = inventoryAlerts.find((a) => a.product.id === mermaProducto)?.product;

  const selectedAjusteProduct = inventoryAlerts.find((a) => a.product.id === ajusteProducto)?.product;

  const handleMermaSubmit = useCallback(async () => {
    if (!mermaProducto || !mermaCantidad || !selectedMermaProduct) return;

    const qty = parseInt(mermaCantidad, 10);
    await registerMerma({
      productId: mermaProducto,
      productName: selectedMermaProduct.name,
      quantity: qty,
      reason: mermaRazon as 'expiration' | 'damage' | 'spoilage' | 'other',
      date: mermaDate.toISOString(),
      value: qty * selectedMermaProduct.unitPrice,
    });

    toast.showSuccess(`Merma registrada: ${qty} unidades de ${selectedMermaProduct.name}`);
    setMermaModalOpen(false);
    setMermaProducto('');
    setMermaCantidad('');
    setMermaRazon('expiration');
  }, [mermaProducto, mermaCantidad, mermaRazon, mermaDate, selectedMermaProduct, registerMerma, toast]);

  const handlePedidoSubmit = useCallback(async () => {
    if (!pedidoProveedor) return;

    const lowStockProducts = inventoryAlerts
      .filter((a) => a.alertType === 'low_stock' || a.product.currentStock < a.product.minStock)
      .map((a) => ({
        productId: a.product.id,
        productName: a.product.name,
        cantidad: a.product.minStock - a.product.currentStock,
      }));

    await createPedido({
      proveedor: pedidoProveedor,
      productos: lowStockProducts,
      notas: pedidoNotas,
    });

    toast.showSuccess(`Pedido creado para ${pedidoProveedor} con ${lowStockProducts.length} productos`);
    setPedidoModalOpen(false);
    setPedidoProveedor('');
    setPedidoNotas('');
  }, [pedidoProveedor, pedidoNotas, inventoryAlerts, createPedido, toast]);

  const handleAjusteSubmit = useCallback(async () => {
    if (!ajusteProducto || !ajusteNuevaCantidad || !ajusteRazon || !selectedAjusteProduct) return;

    const newQty = parseInt(ajusteNuevaCantidad, 10);
    await adjustStock(ajusteProducto, newQty, ajusteRazon);

    const diff = newQty - selectedAjusteProduct.currentStock;
    toast.showSuccess(`Stock de ${selectedAjusteProduct.name} ajustado: ${diff >= 0 ? '+' : ''}${diff} unidades`);
    setAjusteModalOpen(false);
    setAjusteProducto('');
    setAjusteNuevaCantidad('');
    setAjusteRazon('');
  }, [ajusteProducto, ajusteNuevaCantidad, ajusteRazon, selectedAjusteProduct, adjustStock, toast]);

  const handleAbono = useCallback(async () => {
    if (!abonoClienteId || !abonoAmount) return;
    await registerAbono(abonoClienteId, parseFloat(abonoAmount), abonoDescription.trim() || 'Abono');
    toast.showSuccess(`Abono de ${formatCurrency(parseFloat(abonoAmount))} registrado`);
    setAbonoClienteId('');
    setAbonoAmount('');
    setAbonoDescription('');
    setAbonoOpen(false);
  }, [abonoClienteId, abonoAmount, abonoDescription, registerAbono, toast]);

  const clientesWithDebt = clientes.filter((c) => c.balance > 0);
  const clientesWithDebtOptions = [
    { label: 'Seleccionar cliente...', value: '' },
    ...clientesWithDebt.map((c) => ({
      label: `${c.name} — Debe: ${formatCurrency(c.balance)}`,
      value: c.id,
    })),
  ];

  const lowStockCount = inventoryAlerts.filter((a) => a.product.currentStock < a.product.minStock).length;

  const actions = [
    canCreateSales && {
      label: 'Punto de Venta',
      desc: 'Venta rápida',
      icon: CartIcon,
      onClick: () => setSaleTicketOpen(true),
      tone: 'var(--p-color-bg-fill-brand-subdued)',
      color: 'var(--p-color-text-brand)',
      disabled: false,
    },
    {
      label: 'Abrir Turno',
      desc: 'Fondo inicial',
      icon: PlusMinorIcon,
      onClick: () => setAperturaOpen(true),
      tone: 'var(--p-color-bg-fill-success-subdued)',
      color: 'var(--p-color-text-success)',
      disabled: false,
    },
    {
      label: 'Abrir Cajón',
      desc: 'Acceso físico',
      icon: CashDollarIcon,
      onClick: () => setPinPadOpen(true),
      tone: 'var(--p-color-bg-fill-info-subdued)',
      color: 'var(--p-color-text-info)',
      disabled: false,
    },
    canCreateFiado && {
      label: 'Abonos',
      desc: 'Registrar pagos',
      icon: CashDollarIcon,
      onClick: () => setAbonoOpen(true),
      tone: 'var(--p-color-bg-fill-warning-subdued)',
      color: 'var(--p-color-text-warning)',
      disabled: false,
    },
    canManageInventory && {
      label: 'Mermas',
      desc: 'Control de pérdidas',
      icon: ArchiveIcon,
      onClick: () => setMermaModalOpen(true),
      tone: 'var(--p-color-bg-fill-critical-subdued)',
      color: 'var(--p-color-text-critical)',
      disabled: false,
    },
    canManagePedidos && {
      label: 'Surtidos',
      desc: 'Pedido a proveedor',
      icon: PlusIcon,
      onClick: () => setPedidoModalOpen(true),
      tone: 'var(--p-color-bg-fill-info-subdued)',
      color: 'var(--p-color-text-info)',
      disabled: false,
    },
    canManageInventory && {
      label: 'Ajuste Manual',
      desc: 'Inventario físico',
      icon: AdjustIcon,
      onClick: () => setAjusteModalOpen(true),
      tone: '#f4f6f8',
      color: '#6d7175',
      disabled: false,
    },
  ].filter(Boolean) as {
    label: string;
    desc: string;
    icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
    onClick: () => void;
    tone: string;
    color: string;
    disabled: boolean;
  }[];

  return (
    <>
      <Card>
        <BlockStack gap="400">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd" fontWeight="semibold">
              Operaciones
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Accesos directos a procesos del negocio
            </Text>
          </BlockStack>

          <InlineGrid columns={{ xs: 3, sm: 3, md: 6 }} gap="300">
            {actions.map((action) => (
              <div
                key={action.label}
                onClick={action.disabled ? undefined : action.onClick}
                style={{
                  cursor: action.disabled ? 'default' : 'pointer',
                  padding: '14px 8px',
                  borderRadius: '12px',
                  border: '1px solid #e3e5e7',
                  backgroundColor: '#fff',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                  opacity: action.disabled ? 0.5 : 1,
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!action.disabled) {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#c9cccf';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff';
                  e.currentTarget.style.borderColor = '#e3e5e7';
                }}
              >
                <BlockStack gap="300" align="center" inlineAlign="center">
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '10px',
                      backgroundColor: action.tone,
                      color: action.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon source={action.icon} />
                  </div>
                  <BlockStack gap="050">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      {action.label}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {action.desc}
                    </Text>
                  </BlockStack>
                </BlockStack>
              </div>
            ))}
          </InlineGrid>
        </BlockStack>
      </Card>

      {/* Modal para Registrar Merma */}
      <Modal
        open={mermaModalOpen}
        onClose={() => setMermaModalOpen(false)}
        title="Registrar Merma"
        primaryAction={{
          content: 'Guardar Merma',
          onAction: handleMermaSubmit,
          disabled: !mermaProducto || !mermaCantidad,
        }}
        secondaryActions={[
          {
            content: 'Cancelar',
            onAction: () => setMermaModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <Banner tone="warning">
              <p>
                Registrar una merma afectará el inventario y se reflejará en el cálculo de la tasa de merma del mes.
              </p>
            </Banner>

            <SearchableSelect
              label="Producto"
              options={productOptions}
              selected={mermaProducto}
              onChange={setMermaProducto}
            />

            {selectedMermaProduct && (
              <Text as="p" variant="bodySm" tone="subdued">
                Stock actual: {selectedMermaProduct.currentStock} unidades — Precio: ${selectedMermaProduct.unitPrice}
              </Text>
            )}

            <TextField
              label="Cantidad"
              value={mermaCantidad}
              onChange={setMermaCantidad}
              type="number"
              autoComplete="off"
              min={1}
              max={selectedMermaProduct?.currentStock}
              helpText={selectedMermaProduct ? `Máximo: ${selectedMermaProduct.currentStock}` : undefined}
            />

            <FormSelect label="Razón de la merma" options={razonOptions} value={mermaRazon} onChange={setMermaRazon} />

            <div>
              <Text as="p" variant="bodyMd">
                Fecha de la merma
              </Text>
              <DatePicker
                month={mermaMonth}
                year={mermaYear}
                onChange={({ start }) => {
                  if (start) {
                    setMermaDate(start);
                  }
                }}
                onMonthChange={(month, year) => {
                  setMermaMonth(month);
                  setMermaYear(year);
                }}
                selected={{ start: mermaDate, end: mermaDate }}
              />
            </div>

            {selectedMermaProduct && mermaCantidad && (
              <Banner tone="info">
                <p>
                  Valor de la merma: ${(parseInt(mermaCantidad, 10) * selectedMermaProduct.unitPrice).toFixed(2)} MXN
                </p>
              </Banner>
            )}
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Modal para Crear Pedido */}
      <Modal
        open={pedidoModalOpen}
        onClose={() => setPedidoModalOpen(false)}
        title="Crear Pedido a Proveedor"
        primaryAction={{
          content: 'Crear Pedido',
          onAction: handlePedidoSubmit,
          disabled: !pedidoProveedor,
        }}
        secondaryActions={[
          {
            content: 'Cancelar',
            onAction: () => setPedidoModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <Banner tone="info">
              <p>Se generará un pedido automático con {lowStockCount} productos con stock bajo.</p>
            </Banner>

            <TextField
              label="Proveedor"
              value={pedidoProveedor}
              onChange={setPedidoProveedor}
              autoComplete="off"
              placeholder="Nombre del proveedor..."
            />

            {lowStockCount > 0 && (
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" fontWeight="semibold">
                  Productos a pedir:
                </Text>
                {inventoryAlerts
                  .filter((a) => a.product.currentStock < a.product.minStock)
                  .map((a) => (
                    <Text key={a.id} as="p" variant="bodySm" tone="subdued">
                      • {a.product.name} — Pedir {a.product.minStock - a.product.currentStock} unidades
                    </Text>
                  ))}
              </BlockStack>
            )}

            <TextField
              label="Notas adicionales"
              value={pedidoNotas}
              onChange={setPedidoNotas}
              multiline={4}
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Modal para Ajuste de Inventario */}
      <Modal
        open={ajusteModalOpen}
        onClose={() => setAjusteModalOpen(false)}
        title="Ajuste de Inventario"
        primaryAction={{
          content: 'Guardar Ajuste',
          onAction: handleAjusteSubmit,
          disabled: !ajusteProducto || !ajusteNuevaCantidad || !ajusteRazon,
        }}
        secondaryActions={[
          {
            content: 'Cancelar',
            onAction: () => setAjusteModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <Banner tone="warning">
              <p>Los ajustes de inventario deben estar justificados y serán registrados en el historial.</p>
            </Banner>

            <SearchableSelect
              label="Producto"
              options={productOptions}
              selected={ajusteProducto}
              onChange={(value) => {
                setAjusteProducto(value);
                setAjusteNuevaCantidad('');
              }}
            />

            {selectedAjusteProduct && (
              <TextField
                label="Cantidad actual"
                value={selectedAjusteProduct.currentStock.toString()}
                onChange={() => {}}
                type="number"
                autoComplete="off"
                disabled
              />
            )}

            <TextField
              label="Nueva cantidad"
              value={ajusteNuevaCantidad}
              onChange={setAjusteNuevaCantidad}
              type="number"
              autoComplete="off"
              min={0}
            />

            {selectedAjusteProduct && ajusteNuevaCantidad && (
              <Text
                as="p"
                variant="bodySm"
                tone={
                  parseInt(ajusteNuevaCantidad, 10) - selectedAjusteProduct.currentStock >= 0 ? 'success' : 'critical'
                }
              >
                Diferencia: {parseInt(ajusteNuevaCantidad, 10) - selectedAjusteProduct.currentStock >= 0 ? '+' : ''}
                {parseInt(ajusteNuevaCantidad, 10) - selectedAjusteProduct.currentStock} unidades
              </Text>
            )}

            <FormSelect
              label="Razón del ajuste"
              options={ajusteRazonOptions}
              value={ajusteRazon}
              onChange={setAjusteRazon}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Modal para Registrar Abono */}
      <Modal
        open={abonoOpen}
        onClose={() => setAbonoOpen(false)}
        title="Registrar Abono"
        primaryAction={{ content: 'Registrar Abono', onAction: handleAbono, disabled: !abonoClienteId || !abonoAmount }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setAbonoOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <Banner tone="success">
              <p>El abono reducirá la deuda del cliente dado de alta.</p>
            </Banner>
            <FormSelect
              label="Cliente"
              options={clientesWithDebtOptions}
              value={abonoClienteId}
              onChange={setAbonoClienteId}
            />
            {abonoClienteId &&
              (() => {
                const c = clientes.find((cl) => cl.id === abonoClienteId);
                return c ? (
                  <Text as="p" variant="bodySm" tone="critical">
                    Deuda actual: {formatCurrency(c.balance)}
                  </Text>
                ) : null;
              })()}
            <TextField
              label="Monto del abono (MXN)"
              type="number"
              value={abonoAmount}
              onChange={setAbonoAmount}
              autoComplete="off"
              prefix="$"
              placeholder="0.00"
            />
            <TextField
              label="Descripción (opcional)"
              value={abonoDescription}
              onChange={setAbonoDescription}
              autoComplete="off"
              placeholder="Ej: Abono semanal"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Modal para Registrar Producto */}
      <RegisterProductModal open={registerProductOpen} onClose={() => setRegisterProductOpen(false)} />

      {/* Modal para Registrar Venta y Generar Ticket */}
      <SaleTicketModal open={saleTicketOpen} onClose={() => setSaleTicketOpen(false)} />

      {/* Modal para Recargas y Servicios */}
      <ServiciosModal open={serviciosOpen} onClose={() => setServiciosOpen(false)} />

      <AperturaCajaModal open={aperturaOpen} onClose={() => setAperturaOpen(false)} />

      <PinPadModal
        open={pinPadOpen}
        onClose={() => setPinPadOpen(false)}
        requiredPermission="cashdrawer.open"
        onSuccess={(_uid: string, _name: string) => {
          setPinPadOpen(false);
          // Apertura autorizada — señal enviada al driver
          openDrawer();
        }}
        title="Autorizar Apertura de Cajón"
        label="Ingresa PIN para abrir cajón de dinero"
      />
    </>
  );
}
