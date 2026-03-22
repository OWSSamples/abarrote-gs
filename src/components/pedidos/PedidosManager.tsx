'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Badge,
  BlockStack,
  Button,
  Card,
  IndexTable,
  InlineStack,
  Tabs,
  Text,
  useIndexResourceState,
} from '@shopify/polaris';
import {
  FilterIcon,
  PlusIcon,
  SearchIcon,
  SortIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { GenericExportModal } from '@/components/inventory/ShopifyModals';
import { generateCSV, downloadFile } from '@/components/export/ExportModal';
import { generatePDF } from '@/components/export/generatePDF';
import type { PedidoRecord, Product } from '@/types';
import { printTicketSurtido, type OrderLineItem } from './printTicketSurtido';
import { PedidoDetailModal } from './PedidoDetailModal';
import { formatCurrency } from '@/lib/utils';

// --- Mapeo de estados ---
type PedidoStatus = 'todas' | 'pendiente' | 'enviado' | 'recibido';

const estadoBadge: Record<PedidoRecord['estado'], { tone: 'attention' | 'info' | 'success'; label: string }> = {
  pendiente: { tone: 'attention', label: 'Borrador' },
  enviado: { tone: 'info', label: 'Ordenado' },
  recibido: { tone: 'success', label: 'Recibido' },
};

const TABS = [
  { id: 'todas', content: 'Todas', accessibilityLabel: 'Todas las órdenes', panelID: 'todas-panel' },
  { id: 'pendiente', content: 'Borrador', accessibilityLabel: 'Borradores', panelID: 'borrador-panel' },
  { id: 'enviado', content: 'Ordenado', accessibilityLabel: 'Ordenados', panelID: 'ordenado-panel' },
  { id: 'parcial', content: 'Parcial', accessibilityLabel: 'Parcial', panelID: 'parcial-panel' },
  { id: 'recibido', content: 'Recibido', accessibilityLabel: 'Recibidos', panelID: 'recibido-panel' },
  { id: 'cerrado', content: 'Cerrado', accessibilityLabel: 'Cerrados', panelID: 'cerrado-panel' },
];

const TAB_FILTER_MAP: Record<string, PedidoStatus> = {
  todas: 'todas',
  pendiente: 'pendiente',
  enviado: 'enviado',
  parcial: 'todas', // no hay estado parcial, muestra todas
  recibido: 'recibido',
  cerrado: 'recibido', // cerrado = recibido
};

interface PedidosManagerProps {
  onCreateOrder: () => void;
}

export function PedidosManager({ onCreateOrder }: PedidosManagerProps) {
  const pedidos = useDashboardStore((s) => s.pedidos);
  const updatePedidoStatus = useDashboardStore((s) => s.updatePedidoStatus);
  const receivePedido = useDashboardStore((s) => s.receivePedido);
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const products = useDashboardStore((s) => s.products);
  const { showSuccess, showError } = useToast();

  const [selectedTab, setSelectedTab] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<PedidoRecord | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [queryValue, setQueryValue] = useState('');

  // --- Filtrar por tab ---
  const filteredPedidos = useMemo(() => {
    const tabId = TABS[selectedTab]?.id || 'todas';
    const statusFilter = TAB_FILTER_MAP[tabId];
    const order = { pendiente: 0, enviado: 1, recibido: 2 };

    let result = [...pedidos].sort(
      (a, b) => order[a.estado] - order[b.estado] || new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );

    if (statusFilter !== 'todas') {
      result = result.filter((p) => p.estado === statusFilter);
    }

    if (queryValue.trim()) {
      const q = queryValue.toLowerCase();
      result = result.filter(
        (p) =>
          p.proveedor.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.notas?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [pedidos, selectedTab, queryValue]);

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(filteredPedidos as any);

  // --- Handlers ---
  const handleViewDetail = useCallback((pedido: PedidoRecord) => {
    setSelectedPedido(pedido);
    setDetailOpen(true);
  }, []);

  const handleStatusChange = useCallback(async (id: string, estado: PedidoRecord['estado']) => {
    try {
      await updatePedidoStatus(id, estado);
      showSuccess(`Pedido marcado como "${estado}"`);
      setSelectedPedido((prev) => (prev?.id === id ? { ...prev, estado } : prev));
    } catch {
      showError('Error al actualizar estado');
    }
  }, [updatePedidoStatus, showSuccess, showError]);

  const handleReceive = useCallback(async (id: string) => {
    setReceiving(true);
    try {
      await receivePedido(id);
      showSuccess('Pedido recibido — inventario actualizado');
      setSelectedPedido((prev) => (prev?.id === id ? { ...prev, estado: 'recibido' as const } : prev));
    } catch {
      showError('Error al recibir mercancía');
    }
    setReceiving(false);
  }, [receivePedido, showSuccess, showError]);

  const handleReprint = useCallback((pedido: PedidoRecord) => {
    const lineItems: OrderLineItem[] = pedido.productos.map((p) => {
      const found = products.find((pr: Product) => pr.id === p.productId);
      return {
        productId: p.productId,
        productName: p.productName,
        sku: found?.sku ?? '',
        precio: found?.costPrice ?? 0,
        cantidad: p.cantidad,
      };
    });
    const subtotal = lineItems.reduce((s, l) => s + l.precio * l.cantidad, 0);
    printTicketSurtido({
      folio: pedido.id,
      fecha: pedido.fecha,
      proveedor: pedido.proveedor,
      terminosPago: '',
      moneda: 'MXN',
      destino: storeConfig.storeName,
      destinoAddress: [storeConfig.address, storeConfig.city].filter(Boolean).join(', '),
      notas: pedido.notas ?? '',
      lineItems,
      subtotal,
      storeName: storeConfig.storeName,
      storeAddress: [storeConfig.address, storeConfig.city, storeConfig.postalCode].filter(Boolean).join(', '),
      storePhone: storeConfig.phone,
      templateProveedor: storeConfig.ticketTemplateProveedor,
    });
  }, [products, storeConfig]);

  const handleDetailClose = useCallback(() => {
    setDetailOpen(false);
    setSelectedPedido(null);
  }, []);

  // --- Calcular total de un pedido ---
  const getPedidoTotal = useCallback((pedido: PedidoRecord) => {
    return pedido.productos.reduce((sum, p) => {
      const found = products.find((pr) => pr.id === p.productId);
      return sum + (found?.costPrice ?? 0) * p.cantidad;
    }, 0);
  }, [products]);

  // --- Calcular recibido ---
  const getRecibidoText = useCallback((pedido: PedidoRecord) => {
    const total = pedido.productos.reduce((s, p) => s + p.cantidad, 0);
    if (pedido.estado === 'recibido') return `${total} de ${total}`;
    return `0 de ${total}`;
  }, []);

  // --- Format fecha corta ---
  const formatFechaCorta = (fecha: string) => {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  // --- Generar folio corto ---
  const getFolio = (pedido: PedidoRecord, index: number) => {
    return `#PO${index + 1}`;
  };

  // --- Row markup (7 columnas del screenshot) ---
  const rowMarkup = filteredPedidos.map((pedido, index) => {
    const total = getPedidoTotal(pedido);
    const badge = estadoBadge[pedido.estado];

    return (
      <IndexTable.Row
        id={pedido.id}
        key={pedido.id}
        position={index}
        selected={selectedResources.includes(pedido.id)}
        onClick={() => handleViewDetail(pedido)}
      >
        {/* Orden de compra */}
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="bold">
              {getFolio(pedido, index)}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {pedido.id.slice(0, 6)}
            </Text>
          </BlockStack>
        </IndexTable.Cell>

        {/* Distribuidor */}
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {pedido.proveedor}
          </Text>
        </IndexTable.Cell>

        {/* Destino */}
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {formatFechaCorta(pedido.fecha)} {storeConfig.storeNumber || ''}
          </Text>
        </IndexTable.Cell>

        {/* Estado */}
        <IndexTable.Cell>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </IndexTable.Cell>

        {/* Recibido */}
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {getRecibidoText(pedido)}
          </Text>
        </IndexTable.Cell>

        {/* Total */}
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {formatCurrency(total)}
          </Text>
        </IndexTable.Cell>

        {/* Llegada prevista */}
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" tone="subdued">
            —
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <>
      <BlockStack gap="400">
        <Card padding="0">
          {/* Toolbar: Tabs izquierda + iconos derecha */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--p-color-border-subdued, #e1e3e5)',
            }}
          >
            {/* Izquierda: Tabs + boton + */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Tabs tabs={TABS} selected={selectedTab} onSelect={setSelectedTab} fitted={false} />
              <Button icon={PlusIcon} variant="plain" accessibilityLabel="Agregar vista" />
            </div>

            {/* Derecha: Search/Filter + Sort */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingRight: '12px' }}>
              {showSearch ? (
                <div style={{ width: '200px' }}>
                  <input
                    type="text"
                    value={queryValue}
                    onChange={(e) => setQueryValue(e.target.value)}
                    onBlur={() => { if (!queryValue) setShowSearch(false); }}
                    placeholder="Buscar órdenes..."
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid var(--p-color-border-subdued, #dcdfe3)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    border: '1px solid var(--p-color-border-subdued, #dcdfe3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: 'var(--p-color-bg-surface, white)',
                  }}
                  onClick={() => setShowSearch(true)}
                >
                  <SearchIcon />
                  <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--p-color-border-subdued, #e1e3e5)' }} />
                  <FilterIcon />
                </div>
              )}

              <Button icon={SortIcon} variant="tertiary" onClick={() => {}} />
            </div>
          </div>

          {/* Tabla 7 columnas del screenshot */}
          <IndexTable
            resourceName={{ singular: 'orden', plural: 'órdenes' }}
            itemCount={filteredPedidos.length}
            selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: 'Orden de compra' },
              { title: 'Distribuidor' },
              { title: 'Destino' },
              { title: 'Estado' },
              { title: 'Recibido' },
              { title: 'Total' },
              { title: 'Llegada prevista' },
            ] as any}
          >
            {rowMarkup}
          </IndexTable>
        </Card>

        {/* Footer */}
        <InlineStack align="center">
          <Button variant="monochromePlain">Más información sobre órdenes de compra</Button>
        </InlineStack>
      </BlockStack>

      {/* Detail Modal */}
      <PedidoDetailModal
        open={detailOpen}
        pedido={selectedPedido}
        products={products}
        receiving={receiving}
        onClose={handleDetailClose}
        onReceive={handleReceive}
        onStatusChange={handleStatusChange}
        onReprint={handleReprint}
      />

      {/* Export Modal */}
      <GenericExportModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Exportar órdenes de compra"
        exportName="órdenes"
        onExport={(format) => {
          const exportData = filteredPedidos.map((p) => ({
            'Orden': p.id.slice(0, 6),
            'Distribuidor': p.proveedor,
            'Fecha': new Date(p.fecha).toLocaleDateString('es-MX'),
            'Estado': estadoBadge[p.estado].label,
            'Recibido': getRecibidoText(p),
            'Total': formatCurrency(getPedidoTotal(p)),
            'Notas': p.notas || 'N/A',
          }));
          const filename = `Ordenes_Compra_${new Date().toISOString().split('T')[0]}`;
          if (format === 'pdf') {
            generatePDF('Órdenes de compra', exportData as Record<string, unknown>[], `${filename}.pdf`);
          } else {
            const csvContent = generateCSV(exportData as Record<string, unknown>[], true);
            const mime = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
            downloadFile(csvContent, `${filename}.csv`, mime);
          }
        }}
      />
    </>
  );
}
