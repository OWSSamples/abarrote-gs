'use client';

import { useState, useCallback } from 'react';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { Badge } from '@cloudflare/kumo/components/badge';
import {
  Cart24Regular,
  Add24Regular,
  Money24Regular,
  Archive24Regular,
  Wrench24Regular,
  Box24Regular,
} from '@fluentui/react-icons';
import { FormSelect } from '@/components/ui/FormSelect';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useDashboardStore } from '@/store/dashboardStore';
import { AperturaCajaModal } from '@/components/modals/AperturaCajaModal';
import { useToast } from '@/components/notifications/ToastProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { RegisterProductModal } from '@/components/modals/RegisterProductModal';
import { SaleTicketModal } from '@/components/modals/SaleTicketModal';
import { PinPadModal } from '@/components/modals/PinPadModal';
import { formatCurrency } from '@/lib/utils';
import { useTicketPrinter } from '@/hooks/useTicketPrinter';
import './QuickActions.css';

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
  const canCreateFiado = !permsLoaded || hasPermission('fiado.create');

  const [mermaModalOpen, setMermaModalOpen] = useState(false);
  const [pedidoModalOpen, setPedidoModalOpen] = useState(false);
  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);
  const [registerProductOpen, setRegisterProductOpen] = useState(false);
  const [saleTicketOpen, setSaleTicketOpen] = useState(false);
  const [aperturaOpen, setAperturaOpen] = useState(false);
  const [pinPadOpen, setPinPadOpen] = useState(false);
  const { openDrawer } = useTicketPrinter();
  const storeConfig = useDashboardStore((s) => s.storeConfig);

  const [abonoOpen, setAbonoOpen] = useState(false);
  const [abonoClienteId, setAbonoClienteId] = useState('');
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoDescription, setAbonoDescription] = useState('');

  // Form states for Merma
  const [mermaProducto, setMermaProducto] = useState('');
  const [mermaCantidad, setMermaCantidad] = useState('');
  const [mermaRazon, setMermaRazon] = useState('expiration');

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
      date: new Date().toISOString(),
      value: qty * selectedMermaProduct.unitPrice,
    });

    toast.showSuccess(`Merma registrada: ${qty} unidades de ${selectedMermaProduct.name}`);
    setMermaModalOpen(false);
    setMermaProducto('');
    setMermaCantidad('');
    setMermaRazon('expiration');
  }, [mermaProducto, mermaCantidad, mermaRazon, selectedMermaProduct, registerMerma, toast]);

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
      label: 'Punto de venta',
      desc: 'Venta rápida',
      icon: Cart24Regular,
      onClick: () => setSaleTicketOpen(true),
      badgeTone: 'info',
    },
    {
      label: 'Abrir turno',
      desc: 'Fondo inicial',
      icon: Add24Regular,
      onClick: () => setAperturaOpen(true),
      badgeTone: 'success',
    },
    {
      label: 'Abrir cajón',
      desc: 'Acceso físico',
      icon: Money24Regular,
      onClick: () => setPinPadOpen(true),
      badgeTone: 'secondary',
    },
    canCreateFiado && {
      label: 'Abonos',
      desc: 'Registrar pagos',
      icon: Money24Regular,
      onClick: () => setAbonoOpen(true),
      badgeTone: 'warning',
    },
    canManageInventory && {
      label: 'Mermas',
      desc: 'Control de pérdidas',
      icon: Archive24Regular,
      onClick: () => setMermaModalOpen(true),
      badgeTone: 'error',
    },
    canManagePedidos && {
      label: 'Surtidos',
      desc: 'Pedido a proveedor',
      icon: Box24Regular,
      onClick: () => setPedidoModalOpen(true),
      badgeTone: 'secondary',
    },
    canManageInventory && {
      label: 'Ajuste manual',
      desc: 'Inventario físico',
      icon: Wrench24Regular,
      onClick: () => setAjusteModalOpen(true),
      badgeTone: 'secondary',
    },
  ].filter(Boolean) as {
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    badgeTone: 'info' | 'success' | 'warning' | 'error' | 'secondary';
  }[];

  return (
    <>
      <LayerCard className="kumo-quick-actions">
        <LayerCard.Secondary className="kumo-quick-actions__header">
          <h2 className="kumo-quick-actions__title">Operaciones</h2>
          <p className="kumo-quick-actions__subtitle">Accesos directos a procesos del negocio</p>
        </LayerCard.Secondary>

        <LayerCard.Primary className="kumo-quick-actions__body">
          <div className="kumo-quick-actions__grid">
            {actions.map((action) => {
              const IconComp = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="kumo-quick-action-btn"
                >
                  <span className={`kumo-quick-action-icon kumo-quick-action-icon--${action.badgeTone}`}>
                    <IconComp />
                  </span>
                  <div className="kumo-quick-action-text">
                    <span className="kumo-quick-action-label">{action.label}</span>
                    <span className="kumo-quick-action-desc">{action.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </LayerCard.Primary>
      </LayerCard>

      {/* Modal para Registrar Merma */}
      {mermaModalOpen && (
        <div className="kumo-modal-overlay" onClick={() => setMermaModalOpen(false)}>
          <div className="kumo-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="kumo-modal-header">
              <h3>Registrar merma</h3>
              <button type="button" className="kumo-modal-close" onClick={() => setMermaModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="kumo-modal-body">
              <p className="kumo-modal-hint">
                Registrar una merma afectará el inventario y se reflejará en el cálculo de la tasa del mes.
              </p>

              <div className="kumo-form-group">
                <SearchableSelect
                  label="Producto"
                  options={productOptions}
                  selected={mermaProducto}
                  onChange={setMermaProducto}
                />
                {selectedMermaProduct && (
                  <span className="kumo-form-help">
                    Stock actual: {selectedMermaProduct.currentStock} uds — Precio: ${selectedMermaProduct.unitPrice}
                  </span>
                )}
              </div>

              <div className="kumo-form-group">
                <label className="kumo-form-label">Cantidad</label>
                <Input
                  type="number"
                  value={mermaCantidad}
                  onChange={(e) => setMermaCantidad(e.target.value)}
                  placeholder="0"
                  min="1"
                  max={selectedMermaProduct?.currentStock?.toString()}
                />
              </div>

              <div className="kumo-form-group">
                <FormSelect label="Razón de la merma" options={razonOptions} value={mermaRazon} onChange={setMermaRazon} />
              </div>
            </div>
            <div className="kumo-modal-footer">
              <Button type="button" variant="secondary" onClick={() => setMermaModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!mermaProducto || !mermaCantidad}
                onClick={handleMermaSubmit}
              >
                Guardar merma
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Crear Pedido */}
      {pedidoModalOpen && (
        <div className="kumo-modal-overlay" onClick={() => setPedidoModalOpen(false)}>
          <div className="kumo-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="kumo-modal-header">
              <h3>Crear pedido a proveedor</h3>
              <button type="button" className="kumo-modal-close" onClick={() => setPedidoModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="kumo-modal-body">
              <p className="kumo-modal-hint">
                Se generará un pedido automático con {lowStockCount} productos con stock bajo.
              </p>

              <div className="kumo-form-group">
                <label className="kumo-form-label">Proveedor</label>
                <Input
                  type="text"
                  value={pedidoProveedor}
                  onChange={(e) => setPedidoProveedor(e.target.value)}
                  placeholder="Nombre del proveedor..."
                />
              </div>

              {lowStockCount > 0 && (
                <div className="kumo-pedido-preview">
                  <strong>Productos a pedir:</strong>
                  <ul>
                    {inventoryAlerts
                      .filter((a) => a.product.currentStock < a.product.minStock)
                      .map((a) => (
                        <li key={a.id}>
                          {a.product.name} — Pedir {a.product.minStock - a.product.currentStock} unidades
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <div className="kumo-form-group">
                <label className="kumo-form-label">Notas adicionales</label>
                <textarea
                  className="kumo-textarea"
                  value={pedidoNotas}
                  onChange={(e) => setPedidoNotas(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="kumo-modal-footer">
              <Button type="button" variant="secondary" onClick={() => setPedidoModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" disabled={!pedidoProveedor} onClick={handlePedidoSubmit}>
                Crear pedido
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Ajuste Manual */}
      {ajusteModalOpen && (
        <div className="kumo-modal-overlay" onClick={() => setAjusteModalOpen(false)}>
          <div className="kumo-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="kumo-modal-header">
              <h3>Ajuste de inventario</h3>
              <button type="button" className="kumo-modal-close" onClick={() => setAjusteModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="kumo-modal-body">
              <p className="kumo-modal-hint">
                Los ajustes de inventario deben estar justificados y serán registrados en el historial.
              </p>

              <div className="kumo-form-group">
                <SearchableSelect
                  label="Producto"
                  options={productOptions}
                  selected={ajusteProducto}
                  onChange={(val) => {
                    setAjusteProducto(val);
                    setAjusteNuevaCantidad('');
                  }}
                />
              </div>

              {selectedAjusteProduct && (
                <div className="kumo-form-group">
                  <label className="kumo-form-label">Cantidad actual</label>
                  <Input type="text" value={selectedAjusteProduct.currentStock.toString()} readOnly disabled />
                </div>
              )}

              <div className="kumo-form-group">
                <label className="kumo-form-label">Nueva cantidad</label>
                <Input
                  type="number"
                  value={ajusteNuevaCantidad}
                  onChange={(e) => setAjusteNuevaCantidad(e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>

              <div className="kumo-form-group">
                <FormSelect
                  label="Razón del ajuste"
                  options={ajusteRazonOptions}
                  value={ajusteRazon}
                  onChange={setAjusteRazon}
                />
              </div>
            </div>
            <div className="kumo-modal-footer">
              <Button type="button" variant="secondary" onClick={() => setAjusteModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!ajusteProducto || !ajusteNuevaCantidad || !ajusteRazon}
                onClick={handleAjusteSubmit}
              >
                Guardar ajuste
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Registrar Abono */}
      {abonoOpen && (
        <div className="kumo-modal-overlay" onClick={() => setAbonoOpen(false)}>
          <div className="kumo-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="kumo-modal-header">
              <h3>Registrar abono</h3>
              <button type="button" className="kumo-modal-close" onClick={() => setAbonoOpen(false)}>
                ✕
              </button>
            </div>
            <div className="kumo-modal-body">
              <div className="kumo-form-group">
                <FormSelect
                  label="Cliente"
                  options={clientesWithDebtOptions}
                  value={abonoClienteId}
                  onChange={setAbonoClienteId}
                />
              </div>

              <div className="kumo-form-group">
                <label className="kumo-form-label">Monto del abono (MXN)</label>
                <Input
                  type="number"
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="kumo-form-group">
                <label className="kumo-form-label">Descripción (opcional)</label>
                <Input
                  type="text"
                  value={abonoDescription}
                  onChange={(e) => setAbonoDescription(e.target.value)}
                  placeholder="Ej: Abono semanal"
                />
              </div>
            </div>
            <div className="kumo-modal-footer">
              <Button type="button" variant="secondary" onClick={() => setAbonoOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" disabled={!abonoClienteId || !abonoAmount} onClick={handleAbono}>
                Registrar abono
              </Button>
            </div>
          </div>
        </div>
      )}

      <RegisterProductModal open={registerProductOpen} onClose={() => setRegisterProductOpen(false)} />
      <SaleTicketModal open={saleTicketOpen} onClose={() => setSaleTicketOpen(false)} />
      <AperturaCajaModal open={aperturaOpen} onClose={() => setAperturaOpen(false)} />

      <PinPadModal
        open={pinPadOpen}
        onClose={() => setPinPadOpen(false)}
        requiredPermission="cashdrawer.open"
        onSuccess={(_uid: string, _name: string) => {
          setPinPadOpen(false);
          const pin =
            storeConfig.cashDrawerPort && /pin\s*5|^5$/i.test(storeConfig.cashDrawerPort.trim()) ? 5 : 2;
          openDrawer(pin);
        }}
        title="Autorizar apertura de cajón"
        label="Ingresa PIN para abrir cajón de dinero"
      />
    </>
  );
}
