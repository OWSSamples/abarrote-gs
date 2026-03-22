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
  Select,
  Box,
  Icon,
} from '@shopify/polaris';
import { ExportIcon, SearchIcon, ReceiptIcon, RefreshIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/notifications/ToastProvider';
import { printWithIframe, posTicketCSS, applyTicketTemplate } from '@/lib/printTicket';
import { GenericExportModal } from '@/components/inventory/ShopifyModals';
import { generateCSV, downloadFile, generatePDF } from '@/components/export/ExportModal';
import { DevolucionModal } from '@/components/modals/DevolucionModal';
import { SaleDetailModal } from '@/components/sales/SaleDetailModal';
import { DateRangeFilter } from '@/components/sales/DateRangeFilter';
import type { RangeOption } from '@/components/sales/DateRangeFilter';
import type { SaleRecord } from '@/types';

function paymentBadge(method: string) {
  switch (method) {
    case 'efectivo':      return <Badge tone="success">Efectivo</Badge>;
    case 'tarjeta':       return <Badge tone="info">Tarjeta</Badge>;
    case 'transferencia': return <Badge tone="attention">Transferencia</Badge>;
    default:              return <Badge>{method}</Badge>;
  }
}

export function SalesHistory() {
  const saleRecords     = useDashboardStore((s) => s.saleRecords);
  const storeConfig     = useDashboardStore((s) => s.storeConfig);
  const cancelSale      = useDashboardStore((s) => s.cancelSale);
  const currentUserRole = useDashboardStore((s) => s.currentUserRole);
  const { showSuccess, showError } = useToast();

  const [searchFolio,    setSearchFolio]    = useState('');
  const [filterMethod,   setFilterMethod]   = useState('');
  const [selectedSale,   setSelectedSale]   = useState<SaleRecord | null>(null);
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [isExportOpen,   setIsExportOpen]   = useState(false);
  const [devolucionOpen, setDevolucionOpen] = useState(false);

  // ── Date range state (lifted for filtering) ────────────────────────────────
  const [activeDateRange, setActiveDateRange] = useState<RangeOption | null>(null);

  // ── Filter logic ───────────────────────────────────────────────────────────
  const filteredSales = useMemo(() => {
    return saleRecords
      .filter((sale) => {
        if (searchFolio && !sale.folio.toLowerCase().includes(searchFolio.toLowerCase())) return false;
        if (filterMethod && sale.paymentMethod !== filterMethod) return false;
        if (activeDateRange) {
          const d = new Date(sale.date);
          d.setHours(0, 0, 0, 0);
          if (d < activeDateRange.period.since || d > activeDateRange.period.until) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [saleRecords, searchFolio, filterMethod, activeDateRange]);

  const totalFiltered = useMemo(() => filteredSales.reduce((s, r) => s + r.total, 0), [filteredSales]);

  const handleViewSale = useCallback((sale: SaleRecord) => {
    setSelectedSale(sale);
    setDetailOpen(true);
  }, []);

  // ── Print ticket ───────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    if (!selectedSale) return;
    const saleDate = new Date(selectedSale.date);
    const dateStr = saleDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = saleDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const now = new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    const paymentLabels: Record<string, string> = {
      efectivo: 'Efectivo', tarjeta: 'Tarjeta bancaria', tarjeta_manual: 'Tarjeta (manual)',
      tarjeta_web: 'Mercado Pago Web', transferencia: 'Transferencia',
      fiado: 'Crédito cliente', puntos: 'Puntos de lealtad',
    };
    const itemsHtml = selectedSale.items.map((item) => `
      <div class="item-name">${item.productName}</div>
      <div class="item-detail">
        <span>${item.quantity} pza × $${item.unitPrice.toFixed(2)}</span>
        <span>$${item.subtotal.toFixed(2)}</span>
      </div>`).join('');

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<title>Ticket ${selectedSale.folio}</title>
<style>${posTicketCSS}</style></head>
<body><div class="ticket">
  <div class="store-name">${storeConfig.storeName || storeConfig.legalName || 'Tienda'}</div>
  ${storeConfig.address ? `<div class="store-sub">${storeConfig.address}</div>` : ''}
  ${storeConfig.phone ? `<div class="store-sub">Tel: ${storeConfig.phone}</div>` : ''}
  <hr class="dash"/>
  <div class="doc-type">Ticket de Venta</div>
  <div class="folio">Folio: ${selectedSale.folio}</div>
  <div class="fecha">${dateStr} ${timeStr}</div>
  <hr class="dash"/>
  <div class="row"><span class="label">Cajero</span><span class="val">${selectedSale.cajero || '—'}</span></div>
  <div class="row"><span class="label">Pago</span><span class="val">${paymentLabels[selectedSale.paymentMethod] || selectedSale.paymentMethod}</span></div>
  <hr class="dash"/>
  ${itemsHtml}
  <hr class="solid"/>
  <div class="total-row"><span>Subtotal</span><span>$${selectedSale.subtotal.toFixed(2)}</span></div>
  <div class="total-row"><span>IVA (16%)</span><span>$${selectedSale.iva.toFixed(2)}</span></div>
  ${selectedSale.cardSurcharge > 0 ? `<div class="total-row"><span>Comisión tarjeta</span><span>$${selectedSale.cardSurcharge.toFixed(2)}</span></div>` : ''}
  <hr class="solid"/>
  <div class="total-row main"><span>TOTAL</span><span>$${selectedSale.total.toFixed(2)}</span></div>
  ${selectedSale.paymentMethod === 'efectivo' ? `
  <hr class="dash"/>
  <div class="total-row"><span>Recibido</span><span>$${selectedSale.amountPaid.toFixed(2)}</span></div>
  <div class="total-row bold"><span>Cambio</span><span>$${selectedSale.change.toFixed(2)}</span></div>` : ''}
  <hr class="dash"/>
  <div style="text-align:center;margin:4px 0;"><span class="reprint-badge">REIMPRESIÓN</span></div>
  ${storeConfig.ticketFooter ? `<div class="footer-line">${storeConfig.ticketFooter.replace(/\n/g, '<br/>')}</div>` : '<div class="footer-line">¡Gracias por su compra!</div>'}
  <div class="footer-line">Impreso el ${now}</div>
</div></body></html>`;

    const templateVars: Record<string, string> = {
      storeName: storeConfig.storeName || storeConfig.legalName || 'Tienda',
      folio: selectedSale.folio, fecha: `${dateStr} ${timeStr}`,
      cajero: selectedSale.cajero || '—',
      metodoPago: paymentLabels[selectedSale.paymentMethod] || selectedSale.paymentMethod,
      items: selectedSale.items.map((item) =>
        `<div class="item-name">${item.productName}</div><div class="item-detail"><span>${item.quantity} pza × $${item.unitPrice.toFixed(2)}</span><span>$${item.subtotal.toFixed(2)}</span></div>`
      ).join(''),
      subtotal: `$${selectedSale.subtotal.toFixed(2)}`,
      iva: `$${selectedSale.iva.toFixed(2)}`,
      total: `$${selectedSale.total.toFixed(2)}`,
      cambio: `$${selectedSale.change.toFixed(2)}`,
      recibido: `$${selectedSale.amountPaid.toFixed(2)}`,
      footer: storeConfig.ticketFooter || '¡Gracias por su compra!',
    };
    printWithIframe(applyTicketTemplate(storeConfig.ticketTemplateVenta, templateVars, html));
  }, [selectedSale, storeConfig]);

  // ── Cancel sale ────────────────────────────────────────────────────────────
  const handleCancelSale = useCallback(async () => {
    if (!selectedSale) return;
    try {
      await cancelSale(selectedSale.id);
      showSuccess(`Venta ${selectedSale.folio} cancelada — inventario restaurado`);
      setDetailOpen(false);
      setSelectedSale(null);
    } catch {
      showError('Error al cancelar la venta');
      throw new Error('cancel failed');
    }
  }, [selectedSale, cancelSale, showSuccess, showError]);

  const methodOptions = [
    { label: 'Todos los métodos', value: '' },
    { label: 'Efectivo',          value: 'efectivo' },
    { label: 'Tarjeta',           value: 'tarjeta' },
    { label: 'Transferencia',     value: 'transferencia' },
  ];

  return (
    <>
      <div style={{ marginBottom: '20px' }}>
        <Text as="h1" variant="headingLg" fontWeight="bold">Historial de Ventas</Text>
      </div>

      <Card padding="0">

        {/* ══ Header ═══════════════════════════════════════════════════════════ */}
        <Box
          background="bg-surface-active"
          paddingInlineStart="600"
          paddingInlineEnd="600"
          paddingBlockStart="500"
          paddingBlockEnd="500"
        >
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd" fontWeight="bold">Historial de Ventas</Text>
              <InlineStack gap="300" blockAlign="center" wrap={false}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '2px 10px', borderRadius: 20,
                  background: 'var(--p-color-bg-fill-success)',
                  color: 'var(--p-color-text-success)',
                  fontSize: 13, fontWeight: 600,
                }}>
                  {filteredSales.length} {filteredSales.length === 1 ? 'venta' : 'ventas'}
                </div>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--p-color-border)' }} />
                <Text as="span" variant="bodyLg" fontWeight="semibold">{formatCurrency(totalFiltered)}</Text>
                {activeDateRange && (
                  <Badge tone="info" size="small">{activeDateRange.title}</Badge>
                )}
                {filterMethod && (
                  <Badge tone="attention" size="small">
                    {methodOptions.find(o => o.value === filterMethod)?.label ?? filterMethod}
                  </Badge>
                )}
              </InlineStack>
            </BlockStack>

            <InlineStack gap="200">
              <Button icon={RefreshIcon} onClick={() => window.location.reload()}>
                Actualizar
              </Button>
              <Button icon={ExportIcon} onClick={() => setIsExportOpen(true)}>
                Exportar
              </Button>
            </InlineStack>
          </InlineStack>
        </Box>

        {/* ══ Filter bar ═══════════════════════════════════════════════════════ */}
        <Box
          background="bg-surface-secondary"
          paddingInlineStart="600"
          paddingInlineEnd="600"
          paddingBlockStart="300"
          paddingBlockEnd="300"
          borderBlockStartWidth="025"
          borderColor="border"
        >
          <InlineStack gap="300" blockAlign="end" wrap={false}>
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <TextField
                label="Buscar"
                labelHidden
                value={searchFolio}
                onChange={setSearchFolio}
                autoComplete="off"
                placeholder="Buscar por folio…"
                prefix={<Icon source={SearchIcon} />}
                clearButton
                onClearButtonClick={() => setSearchFolio('')}
                variant="borderless"
              />
            </div>

            <div style={{ width: 1, height: 36, background: 'var(--p-color-border)', flexShrink: 0 }} />

            <div style={{ minWidth: 190, flexShrink: 0 }}>
              <Select
                label="Método"
                labelHidden
                options={methodOptions}
                value={filterMethod}
                onChange={setFilterMethod}
              />
            </div>

            <div style={{ width: 1, height: 36, background: 'var(--p-color-border)', flexShrink: 0 }} />

            <DateRangeFilter
              activeDateRange={activeDateRange}
              onApply={setActiveDateRange}
              onClear={() => setActiveDateRange(null)}
            />
          </InlineStack>
        </Box>

        {/* ══ Table ════════════════════════════════════════════════════════════ */}
        <Box>
          {filteredSales.length === 0 ? (
            <Box paddingBlockStart="800" paddingBlockEnd="800">
              <BlockStack gap="300" inlineAlign="center">
                <Icon source={ReceiptIcon} tone="subdued" />
                <BlockStack gap="100" inlineAlign="center">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">Sin ventas registradas</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Registra una venta desde Acciones Rápidas para verla aquí.</Text>
                </BlockStack>
              </BlockStack>
            </Box>
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
        </Box>
      </Card>

      {/* ── Sale Detail Modal ── */}
      <SaleDetailModal
        open={detailOpen}
        sale={selectedSale}
        onClose={() => { setDetailOpen(false); setSelectedSale(null); }}
        onCancel={handleCancelSale}
        onReturn={() => setDevolucionOpen(true)}
        onPrint={handlePrint}
      />

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
            "Cancelada / Devuelta": 'No',
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

      {selectedSale && devolucionOpen && (
        <DevolucionModal
          open={devolucionOpen}
          sale={selectedSale}
          cajero={currentUserRole?.displayName ?? 'Cajero'}
          onClose={() => setDevolucionOpen(false)}
          onSuccess={() => setDevolucionOpen(false)}
        />
      )}
    </>
  );
}
