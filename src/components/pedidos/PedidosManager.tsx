'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  Button,
  Modal,
  EmptyState,
  Banner,
  Divider,
} from '@shopify/polaris';
import { ExportIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { GenericExportModal } from '@/components/inventory/ShopifyModals';
import { generateCSV, downloadFile, generatePDF } from '@/components/export/ExportModal';
import type { PedidoRecord } from '@/types';

const estadoBadge: Record<PedidoRecord['estado'], { tone: 'attention' | 'info' | 'success'; label: string }> = {
  pendiente: { tone: 'attention', label: '⏳ Pendiente' },
  enviado: { tone: 'info', label: '🚚 Enviado' },
  recibido: { tone: 'success', label: 'Recibido' },
};

export function PedidosManager() {
  const { storeConfig, pedidos, updatePedidoStatus, receivePedido } = useDashboardStore();
  const { showSuccess, showError } = useToast();

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<PedidoRecord | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const sortedPedidos = useMemo(() => {
    const order = { pendiente: 0, enviado: 1, recibido: 2 };
    return [...pedidos].sort((a, b) => order[a.estado] - order[b.estado] || new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [pedidos]);

  const handleViewDetail = useCallback((pedido: PedidoRecord) => {
    setSelectedPedido(pedido);
    setDetailOpen(true);
  }, []);

  const handleStatusChange = useCallback(async (id: string, estado: PedidoRecord['estado']) => {
    try {
      await updatePedidoStatus(id, estado);
      showSuccess(`Pedido marcado como "${estado}"`);
      // Update local selection for the modal
      setSelectedPedido(prev => prev?.id === id ? { ...prev, estado } : prev);
    } catch { showError('Error al actualizar estado'); }
  }, [updatePedidoStatus, showSuccess, showError]);

  const handleReceive = useCallback(async (id: string) => {
    setReceiving(true);
    try {
      await receivePedido(id);
      showSuccess('Pedido recibido — inventario actualizado');
      setSelectedPedido(prev => prev?.id === id ? { ...prev, estado: 'recibido' as const } : prev);
    } catch { showError('Error al recibir mercancía'); }
    setReceiving(false);
  }, [receivePedido, showSuccess, showError]);

  const pendingCount = pedidos.filter(p => p.estado !== 'recibido').length;

  return (
    <>
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="300" blockAlign="center">
                <Text as="h2" variant="headingMd">Pedidos a Proveedores</Text>
                {pendingCount > 0 && (
                  <Badge tone="attention">{`${pendingCount} pendientes`}</Badge>
                )}
              </InlineStack>
              <Button icon={ExportIcon} onClick={() => setIsExportOpen(true)}>Exportar</Button>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              Administra el estado de tus pedidos. Al marcar como &quot;Recibido&quot; se actualiza automáticamente el inventario.
            </Text>
          </BlockStack>
        </Card>

        {sortedPedidos.length === 0 ? (
          <Card>
            <EmptyState heading="Sin pedidos registrados" image="">
              <p>Crea un pedido desde la sección de Inventario para ver tus pedidos aquí.</p>
            </EmptyState>
          </Card>
        ) : (
          <Card>
            <IndexTable
              resourceName={{ singular: 'pedido', plural: 'pedidos' }}
              itemCount={sortedPedidos.length}
              headings={[
                { title: 'Proveedor' },
                { title: 'Fecha' },
                { title: 'Productos' },
                { title: 'Estado' },
                { title: 'Acciones' },
              ]}
              selectable={false}
            >
              {sortedPedidos.map((pedido, idx) => (
                <IndexTable.Row id={pedido.id} key={pedido.id} position={idx}>
                  <IndexTable.Cell>
                    <Text as="span" fontWeight="bold">{pedido.proveedor}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" variant="bodySm">{new Date(pedido.fecha).toLocaleDateString('es-MX')}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" variant="bodySm">{pedido.productos.length} productos</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={estadoBadge[pedido.estado].tone}>
                      {estadoBadge[pedido.estado].label}
                    </Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="100">
                      <Button variant="plain" onClick={() => handleViewDetail(pedido)}>Ver</Button>
                      {pedido.estado === 'pendiente' && (
                        <Button variant="plain" onClick={() => handleStatusChange(pedido.id, 'enviado')}>Marcar Enviado</Button>
                      )}
                      {pedido.estado !== 'recibido' && (
                        <Button variant="plain" tone="critical" onClick={() => handleReceive(pedido.id)} loading={receiving}>
                          Recibir
                        </Button>
                      )}
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        )}
      </BlockStack>

      {/* Detail Modal */}
      {selectedPedido && (
        <Modal
          open={detailOpen}
          onClose={() => { setDetailOpen(false); setSelectedPedido(null); }}
          title={`Pedido — ${selectedPedido.proveedor}`}
          primaryAction={
            selectedPedido.estado !== 'recibido'
              ? { content: 'Recibir Mercancia', onAction: () => handleReceive(selectedPedido.id), loading: receiving }
              : undefined
          }
          secondaryActions={[{ content: 'Cerrar', onAction: () => { setDetailOpen(false); setSelectedPedido(null); } }]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="span" variant="bodySm" tone="subdued">{new Date(selectedPedido.fecha).toLocaleString('es-MX')}</Text>
                <Badge tone={estadoBadge[selectedPedido.estado].tone}>
                  {estadoBadge[selectedPedido.estado].label}
                </Badge>
              </InlineStack>

              {selectedPedido.notas && (
                <Banner tone="info"><p>{selectedPedido.notas}</p></Banner>
              )}

              <Divider />

              <Text as="h3" variant="headingSm">Productos del Pedido</Text>
              {selectedPedido.productos.map((p, i) => (
                <InlineStack key={i} align="space-between">
                  <Text as="span">{p.productName}</Text>
                  <Badge tone="info">{`${p.cantidad} unidades`}</Badge>
                </InlineStack>
              ))}

              <Divider />

              {selectedPedido.estado === 'pendiente' && (
                <InlineStack gap="200">
                  <Button onClick={() => handleStatusChange(selectedPedido.id, 'enviado')}>
                    🚚 Marcar como Enviado
                  </Button>
                </InlineStack>
              )}

              {selectedPedido.estado === 'recibido' && (
                <Banner tone="success">
                  <p>Este pedido ya fue recibido y el inventario fue actualizado.</p>
                </Banner>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}

      <GenericExportModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Exportar pedidos"
        exportName="pedidos"
        onExport={(format) => {
          const exportData = sortedPedidos.map(p => ({
            "Proveedor": p.proveedor,
            "Fecha": new Date(p.fecha).toLocaleDateString('es-MX'),
            "Productos Solicitados": p.productos.length,
            "Unidades Totales": p.productos.reduce((sum, pr) => sum + pr.cantidad, 0),
            "Estado": estadoBadge[p.estado].label,
            "Notas Especiales": p.notas || 'N/A'
          }));
          const filename = `Pedidos_Kiosco_${new Date().toISOString().split('T')[0]}`;
          if (format === 'pdf') {
            generatePDF('Reporte de Pedidos', exportData as Record<string, unknown>[], `${filename}.pdf`, storeConfig);
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
