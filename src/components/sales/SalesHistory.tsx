'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  TextField,
  Button,
  EmptyState,
  Box,
  Divider,
  Modal,
  Banner,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import { SearchIcon, PrintIcon, DeleteIcon, ExportIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/notifications/ToastProvider';
import { GenericExportModal } from '@/components/inventory/ShopifyModals';
import { generateCSV, downloadFile, generatePDF } from '@/components/export/ExportModal';
import type { SaleRecord } from '@/types';

function paymentBadge(method: string) {
  switch (method) {
    case 'efectivo':
      return <Badge tone="success">Efectivo</Badge>;
    case 'tarjeta':
      return <Badge tone="info">Tarjeta</Badge>;
    case 'transferencia':
      return <Badge tone="attention">Transferencia</Badge>;
    default:
      return <Badge>{method}</Badge>;
  }
}

export function SalesHistory() {
  const saleRecords = useDashboardStore((s) => s.saleRecords);
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const cancelSale = useDashboardStore((s) => s.cancelSale);
  const { showSuccess, showError } = useToast();
  const [searchFolio, setSearchFolio] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const filteredSales = useMemo(() => {
    return saleRecords
      .filter((sale) => {
        if (searchFolio && !sale.folio.toLowerCase().includes(searchFolio.toLowerCase())) return false;
        if (filterMethod && sale.paymentMethod !== filterMethod) return false;
        if (filterDate && !sale.date.startsWith(filterDate)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [saleRecords, searchFolio, filterMethod, filterDate]);

  const totalFiltered = useMemo(() => filteredSales.reduce((sum, s) => sum + s.total, 0), [filteredSales]);

  const handleViewSale = useCallback((sale: SaleRecord) => {
    setSelectedSale(sale);
    setDetailOpen(true);
  }, []);

  const handlePrint = useCallback(() => {
    if (!selectedSale) return;
    const saleDate = new Date(selectedSale.date);
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Ticket ${selectedSale.folio}</title>
      <style>
        @media print { @page { size: 80mm auto; margin: 2mm; } }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 8px; }
        .center { text-align: center; } .right { text-align: right; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .bold { font-weight: bold; } .row { display: flex; justify-content: space-between; }
      </style></head><body>
      <div class="center"><h2 style="margin:4px 0;font-size:16px">${storeConfig.storeName}</h2>
      <p style="margin:2px 0;font-size:11px">${storeConfig.address}</p>
      <p style="margin:2px 0;font-size:11px">Tel: ${storeConfig.phone}</p></div>
      <div class="line"></div>
      <div class="row" style="font-size:11px"><span><b>Folio:</b> ${selectedSale.folio}</span><span>${saleDate.toLocaleDateString('es-MX')}</span></div>
      <div class="row" style="font-size:11px"><span><b>Cajero:</b> ${selectedSale.cajero}</span><span>${saleDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="line"></div>
      ${selectedSale.items.map((item) => `<div style="margin:3px 0"><div class="bold" style="font-size:11px">${item.productName}</div><div class="row" style="font-size:11px"><span>${item.quantity} x $${item.unitPrice.toFixed(2)}</span><span>$${item.subtotal.toFixed(2)}</span></div></div>`).join('')}
      <div class="line"></div>
      <div class="row" style="font-size:11px"><span>Subtotal:</span><span>$${selectedSale.subtotal.toFixed(2)}</span></div>
      <div class="row" style="font-size:11px"><span>IVA (16%):</span><span>$${selectedSale.iva.toFixed(2)}</span></div>
      <div class="row bold" style="font-size:14px;margin:4px 0"><span>TOTAL:</span><span>$${selectedSale.total.toFixed(2)}</span></div>
      <div class="line"></div>
      <div class="row" style="font-size:11px"><span>Pago:</span><span style="text-transform:capitalize">${selectedSale.paymentMethod}</span></div>
      ${selectedSale.paymentMethod === 'efectivo' ? `<div class="row" style="font-size:11px"><span>Pagó:</span><span>$${selectedSale.amountPaid.toFixed(2)}</span></div><div class="row bold" style="font-size:11px"><span>Cambio:</span><span>$${selectedSale.change.toFixed(2)}</span></div>` : ''}
      <div class="line"></div>
      <div class="center" style="font-size:11px"><p style="margin:2px 0">¡Gracias por su compra!</p><p style="margin:2px 0">REIMPRESIÓN</p></div>
      <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>
    `);
    printWindow.document.close();
  }, [selectedSale]);

  const handleCancelSale = useCallback(async () => {
    if (!selectedSale) return;
    setCancelling(true);
    try {
      await cancelSale(selectedSale.id);
      showSuccess(`Venta ${selectedSale.folio} cancelada — inventario restaurado`);
      setDetailOpen(false);
      setSelectedSale(null);
      setCancelConfirm(false);
    } catch { showError('Error al cancelar la venta'); }
    setCancelling(false);
  }, [selectedSale, cancelSale, showSuccess, showError]);

  const methodOptions = [
    { label: 'Todos los métodos', value: '' },
    { label: 'Efectivo', value: 'efectivo' },
    { label: 'Tarjeta', value: 'tarjeta' },
    { label: 'Transferencia', value: 'transferencia' },
  ];

  return (
    <>
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Text as="h2" variant="headingMd">Historial de Ventas</Text>
              <Badge tone="info">{`${filteredSales.length} ventas — Total: ${formatCurrency(totalFiltered)}`}</Badge>
            </InlineStack>
            <Button icon={ExportIcon} onClick={() => setIsExportOpen(true)}>Exportar</Button>
          </InlineStack>

          {/* Filters */}
          <InlineStack gap="200" align="start" blockAlign="end">
            <Box minWidth="200px">
              <TextField
                label="Buscar por folio"
                value={searchFolio}
                onChange={setSearchFolio}
                autoComplete="off"
                placeholder="V-000001"
                prefix={<SearchIcon />}
                clearButton
                onClearButtonClick={() => setSearchFolio('')}
              />
            </Box>
            <Box minWidth="180px">
              <FormSelect
                label="Método de pago"
                options={methodOptions}
                value={filterMethod}
                onChange={setFilterMethod}
              />
            </Box>
            <Box minWidth="160px">
              <TextField
                label="Fecha"
                type="date"
                value={filterDate}
                onChange={setFilterDate}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => setFilterDate('')}
              />
            </Box>
          </InlineStack>

          {filteredSales.length === 0 ? (
            <EmptyState
              heading="Sin ventas registradas"
              image=""
            >
              <p>Registra una venta desde Acciones Rápidas para verla aquí.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: 'venta', plural: 'ventas' }}
              itemCount={filteredSales.length}
              headings={[
                { title: 'Folio' },
                { title: 'Fecha / Hora' },
                { title: 'Cajero' },
                { title: 'Items' },
                { title: 'Total' },
                { title: 'Método' },
                { title: '' },
              ]}
              selectable={false}
            >
              {filteredSales.map((sale, idx) => {
                const d = new Date(sale.date);
                return (
                  <IndexTable.Row id={sale.id} key={sale.id} position={idx}>
                    <IndexTable.Cell>
                      <Text as="span" fontWeight="bold" variant="bodyMd">{sale.folio}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span" variant="bodySm">{d.toLocaleDateString('es-MX')}</Text>
                        <Text as="span" variant="bodySm" tone="subdued">{d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</Text>
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{sale.cajero}</IndexTable.Cell>
                    <IndexTable.Cell>{sale.items.length} productos</IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" fontWeight="semibold">{formatCurrency(sale.total)}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{paymentBadge(sale.paymentMethod)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <Button variant="plain" onClick={() => handleViewSale(sale)}>Ver</Button>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>
          )}
        </BlockStack>
      </Card>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <Modal
          open={detailOpen}
          onClose={() => { setDetailOpen(false); setSelectedSale(null); }}
          title={`Venta ${selectedSale.folio}`}
          primaryAction={{ content: 'Reimprimir Ticket', icon: PrintIcon, onAction: handlePrint }}
          secondaryActions={[{ content: 'Cerrar', onAction: () => { setDetailOpen(false); setSelectedSale(null); } }]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="span" variant="bodySm" tone="subdued">
                  {new Date(selectedSale.date).toLocaleString('es-MX')}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">Cajero: {selectedSale.cajero}</Text>
              </InlineStack>

              <Divider />

              {selectedSale.items.map((item, i) => (
                <InlineStack key={i} align="space-between">
                  <BlockStack gap="050">
                    <Text as="span" fontWeight="semibold">{item.productName}</Text>
                    <Text as="span" variant="bodySm" tone="subdued">{item.quantity} x {formatCurrency(item.unitPrice)}</Text>
                  </BlockStack>
                  <Text as="span" fontWeight="semibold">{formatCurrency(item.subtotal)}</Text>
                </InlineStack>
              ))}

              <Divider />

              <InlineStack align="space-between">
                <Text as="span">Subtotal:</Text>
                <Text as="span">{formatCurrency(selectedSale.subtotal)}</Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span">IVA (16%):</Text>
                <Text as="span">{formatCurrency(selectedSale.iva)}</Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span" variant="headingMd" fontWeight="bold">TOTAL:</Text>
                <Text as="span" variant="headingMd" fontWeight="bold">{formatCurrency(selectedSale.total)}</Text>
              </InlineStack>

              <Divider />

              <InlineStack align="space-between">
                <Text as="span">Método de pago:</Text>
                {paymentBadge(selectedSale.paymentMethod)}
              </InlineStack>
              {selectedSale.paymentMethod === 'efectivo' && (
                <>
                  <InlineStack align="space-between">
                    <Text as="span">Pagó con:</Text>
                    <Text as="span">{formatCurrency(selectedSale.amountPaid)}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" fontWeight="bold">Cambio:</Text>
                    <Text as="span" fontWeight="bold">{formatCurrency(selectedSale.change)}</Text>
                  </InlineStack>
                </>
              )}

              <Divider />

              {/* Cancel Sale */}
              {cancelConfirm ? (
                <Banner tone="critical" title="¿Cancelar esta venta?" onDismiss={() => setCancelConfirm(false)}>
                  <p style={{ marginBottom: 8 }}>Se revertirá el inventario y se eliminará la venta <strong>{selectedSale.folio}</strong>. Esta acción no se puede deshacer.</p>
                  <InlineStack gap="200">
                    <Button variant="primary" tone="critical" onClick={handleCancelSale} loading={cancelling}>Sí, Cancelar Venta</Button>
                    <Button onClick={() => setCancelConfirm(false)}>No</Button>
                  </InlineStack>
                </Banner>
              ) : (
                <InlineStack align="end">
                  <Button variant="plain" tone="critical" icon={DeleteIcon} onClick={() => setCancelConfirm(true)}>
                    Cancelar / Devolver Venta
                  </Button>
                </InlineStack>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}

      <GenericExportModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Exportar ventas"
        exportName="ventas"
        onExport={(format) => {
          const exportData = filteredSales.map(s => ({
            "Folio": s.folio,
            "Fecha": new Date(s.date).toLocaleDateString('es-MX'),
            "Hora": new Date(s.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            "Cajero": s.cajero,
            "Total Artículos": s.items.length,
            "Subtotal": s.subtotal,
            "IVA": s.iva,
            "Total": s.total,
            "Método de Pago": s.paymentMethod,
            "Cancelada / Devuelta": 'No' // Si hubiera flag sería aquí
          }));
          const filename = `Ventas_Kiosco_${new Date().toISOString().split('T')[0]}`;
          if (format === 'pdf') {
            generatePDF('Reporte de Ventas', exportData as Record<string, unknown>[], `${filename}.pdf`);
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
