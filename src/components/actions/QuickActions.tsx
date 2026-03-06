'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  Button,
  ButtonGroup,
  BlockStack,
  Text,
  Modal,
  FormLayout,
  TextField,
  DatePicker,
  Banner,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import {
  PlusIcon,
  ArchiveIcon,
  AdjustIcon,
  ProductIcon,
  CartIcon,
  MobileIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { usePermissions } from '@/lib/usePermissions';
import { RegisterProductModal } from '@/components/modals/RegisterProductModal';
import { SaleTicketModal } from '@/components/modals/SaleTicketModal';
import { ServiciosModal } from '@/components/modals/ServiciosModal';

export function QuickActions() {
  const { inventoryAlerts, registerMerma, adjustStock, createPedido } = useDashboardStore();
  const toast = useToast();
  const { hasPermission, isLoaded: permsLoaded } = usePermissions();

  const canManageInventory = !permsLoaded || hasPermission('inventory.edit');
  const canCreateSales = !permsLoaded || hasPermission('sales.create');
  const canManagePedidos = !permsLoaded || hasPermission('pedidos.create');
  const canManageServicios = !permsLoaded || hasPermission('servicios.create');

  const [mermaModalOpen, setMermaModalOpen] = useState(false);
  const [pedidoModalOpen, setPedidoModalOpen] = useState(false);
  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);
  const [registerProductOpen, setRegisterProductOpen] = useState(false);
  const [saleTicketOpen, setSaleTicketOpen] = useState(false);
  const [serviciosOpen, setServiciosOpen] = useState(false);

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

  const selectedMermaProduct = inventoryAlerts.find(
    (a) => a.product.id === mermaProducto
  )?.product;

  const selectedAjusteProduct = inventoryAlerts.find(
    (a) => a.product.id === ajusteProducto
  )?.product;

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
    toast.showSuccess(
      `Stock de ${selectedAjusteProduct.name} ajustado: ${diff >= 0 ? '+' : ''}${diff} unidades`
    );
    setAjusteModalOpen(false);
    setAjusteProducto('');
    setAjusteNuevaCantidad('');
    setAjusteRazon('');
  }, [ajusteProducto, ajusteNuevaCantidad, ajusteRazon, selectedAjusteProduct, adjustStock, toast]);

  const lowStockCount = inventoryAlerts.filter(
    (a) => a.product.currentStock < a.product.minStock
  ).length;

  return (
    <>
      <Card>
        <BlockStack gap="400">
          <Text as="h3" variant="headingMd">
            Acciones Rápidas
          </Text>

          <ButtonGroup>
            {canManageInventory && (
              <Button
                icon={ProductIcon}
                variant="primary"
                tone="success"
                onClick={() => setRegisterProductOpen(true)}
              >
                Registrar Producto
              </Button>
            )}
            {canCreateSales && (
              <Button
                icon={CartIcon}
                variant="primary"
                onClick={() => setSaleTicketOpen(true)}
              >
                Registrar Venta
              </Button>
            )}
            {canManageServicios && (
              <Button
                icon={MobileIcon}
                variant="primary"
                onClick={() => setServiciosOpen(true)}
              >
                Recargas y Servicios
              </Button>
            )}
            {canManageInventory && (
              <Button
                icon={ArchiveIcon}
                onClick={() => setMermaModalOpen(true)}
              >
                Registrar Merma
              </Button>
            )}
            {canManagePedidos && (
              <Button
                icon={PlusIcon}
                onClick={() => setPedidoModalOpen(true)}
              >
                Crear Pedido a Proveedor
              </Button>
            )}
            {canManageInventory && (
              <Button
                icon={AdjustIcon}
                onClick={() => setAjusteModalOpen(true)}
              >
                Ajuste de Inventario
              </Button>
            )}
          </ButtonGroup>
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

            <FormSelect
              label="Razón de la merma"
              options={razonOptions}
              value={mermaRazon}
              onChange={setMermaRazon}
            />

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
              <p>
                Se generará un pedido automático con {lowStockCount} productos con stock bajo.
              </p>
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
              <p>
                Los ajustes de inventario deben estar justificados y serán registrados en el historial.
              </p>
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
                onChange={() => { }}
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
              <Text as="p" variant="bodySm" tone={
                parseInt(ajusteNuevaCantidad, 10) - selectedAjusteProduct.currentStock >= 0 ? 'success' : 'critical'
              }>
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

      {/* Modal para Registrar Producto */}
      <RegisterProductModal
        open={registerProductOpen}
        onClose={() => setRegisterProductOpen(false)}
      />

      {/* Modal para Registrar Venta y Generar Ticket */}
      <SaleTicketModal
        open={saleTicketOpen}
        onClose={() => setSaleTicketOpen(false)}
      />

      {/* Modal para Recargas y Servicios */}
      <ServiciosModal
        open={serviciosOpen}
        onClose={() => setServiciosOpen(false)}
      />
    </>
  );
}
