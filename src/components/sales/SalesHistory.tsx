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
  Box,
  Icon,
  IndexFilters,
  useSetIndexFiltersMode,
  ChoiceList,
} from '@shopify/polaris';
import { ReceiptIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/notifications/ToastProvider';
import { printWithIframe, posTicketCSS, applyTicketTemplate, generateTicketHtml } from '@/lib/printTicket';
import { GenericExportModal } from '@/components/inventory/ShopifyModals';
import { generateCSV, downloadFile, generatePDF } from '@/components/export/ExportModal';
import { DevolucionModal } from '@/components/modals/DevolucionModal';
import { SaleDetailModal } from '@/components/sales/SaleDetailModal';
import { DateRangeFilter } from '@/components/sales/DateRangeFilter';
import type { RangeOption } from '@/components/sales/DateRangeFilter';
import type { SaleRecord } from '@/types';

function paymentBadge(method: string) {
  const styles: Record<
    string,
    { tone: 'success' | 'info' | 'attention' | 'warning' | 'critical' | 'magic' | 'new' | undefined; label: string }
  > = {
    efectivo: { tone: 'success', label: 'Efectivo' },
    tarjeta: { tone: 'info', label: 'Tarjeta' },
    tarjeta_web: { tone: 'info', label: 'MP Web' },
    tarjeta_manual: { tone: 'info', label: 'T. Manual' },
    transferencia: { tone: 'attention', label: 'Transfer' },
    fiado: { tone: 'warning', label: 'Fiado' },
    puntos: { tone: 'magic', label: 'Puntos' },
  };
  const s = styles[method] || { tone: 'subdued', label: method };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function SalesHistory() {
  const saleRecords = useDashboardStore((s) => s.saleRecords);
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const cancelSale = useDashboardStore((s) => s.cancelSale);
  const currentUserRole = useDashboardStore((s) => s.currentUserRole);
  const devolucionesStore = useDashboardStore((s) => s.devoluciones);
  const { showSuccess, showError } = useToast();

  const [searchFolio, setSearchFolio] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [devolucionOpen, setDevolucionOpen] = useState(false);

  const [activeDateRange, setActiveDateRange] = useState<RangeOption | null>(null);

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

  const handleViewSale = useCallback((sale: SaleRecord) => {
    setSelectedSale(sale);
    setDetailOpen(true);
  }, []);

  const handlePrint = useCallback(() => {
    if (!selectedSale) return;
    const saleDate = new Date(selectedSale.date);
    const dateStr = saleDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = saleDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const now = new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });

    const paymentLabels: Record<string, string> = {
      efectivo: 'Efectivo',
      tarjeta: 'Tarjeta bancaria',
      tarjeta_manual: 'Tarjeta (manual)',
      tarjeta_web: 'Mercado Pago Web',
      transferencia: 'Transferencia',
      fiado: 'Crédito cliente',
      puntos: 'Puntos de lealtad',
    };

    const itemsHtml = selectedSale.items
      .map(
        (item) => `
      <div class="item-name">${item.productName}</div>
      <div class="item-detail">
        <span>${item.quantity} pza × $${item.unitPrice.toFixed(2)}</span>
        <span>$${item.subtotal.toFixed(2)}</span>
      </div>`,
      )
      .join('');

    const logoHtml = storeConfig.logoUrl
      ? `<div class="logo-area"><img src="${storeConfig.logoUrl}" alt="${storeConfig.storeName}"/></div>`
      : `<div class="logo-area"><div class="logo-placeholder">${(storeConfig.storeName || 'T').charAt(0)}</div></div>`;

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><title>Ticket ${selectedSale.folio}</title><style>${posTicketCSS}</style></head>
<body><div class="ticket">
  ${logoHtml}
  <div class="store-name">${storeConfig.storeName || storeConfig.legalName || 'Tienda'}</div>
  ${storeConfig.address ? `<div class="store-sub">${storeConfig.address}</div>` : ''}
  <hr class="line"/>
  <div class="doc-type">Ticket de Venta</div>
  <div class="folio">Folio: ${selectedSale.folio}</div>
  <div class="fecha">${dateStr} · ${timeStr}</div>
  <hr class="line-thin"/>
  <div class="row"><span class="label">Cajero</span><span class="val">${selectedSale.cajero || '—'}</span></div>
  <div class="row"><span class="label">Pago</span><span class="val">${paymentLabels[selectedSale.paymentMethod] || selectedSale.paymentMethod}</span></div>
  <hr class="line"/>
  ${itemsHtml}
  <hr class="line-double"/>
  <div class="total-row main"><span>TOTAL</span><span>$${selectedSale.total.toFixed(2)}</span></div>
  <hr class="line-thin"/>
  <div class="reprint-badge">— REIMPRESIÓN —</div>
  <div class="footer-line">Impreso el ${now}</div>
  <div class="powered-by">OPENDEX POS</div>
</div></body></html>`;

    const templateVars: Record<string, string> = {
      storeName: storeConfig.storeName || storeConfig.legalName || 'Tienda',
      folio: selectedSale.folio,
      fecha: `${dateStr} ${timeStr}`,
      cajero: selectedSale.cajero || '—',
      metodoPago: paymentLabels[selectedSale.paymentMethod] || selectedSale.paymentMethod,
      items: selectedSale.items
        .map(
          (item) =>
            `<div class="item-name">${item.productName}</div><div class="item-detail"><span>${item.quantity} pza × $${item.unitPrice.toFixed(2)}</span><span>$${item.subtotal.toFixed(2)}</span></div>`,
        )
        .join(''),
      total: `$${selectedSale.total.toFixed(2)}`,
      footer: storeConfig.ticketFooter || '¡Gracias por su compra!',
    };

    // Priority: 1) Custom HTML template, 2) Design config, 3) Hardcoded fallback
    if (storeConfig.ticketTemplateVenta) {
      printWithIframe(applyTicketTemplate(storeConfig.ticketTemplateVenta, templateVars, html));
    } else if (storeConfig.ticketDesignVenta) {
      const subtotal = selectedSale.items.reduce((s, i) => s + i.subtotal, 0);
      const ivaRate = parseFloat(storeConfig.ivaRate || '16');
      const iva = subtotal * (ivaRate / 100);
      const designHtml = generateTicketHtml(storeConfig.ticketDesignVenta, {
        storeName: storeConfig.storeName || 'Tienda',
        legalName: storeConfig.legalName || '',
        address: storeConfig.address || '',
        city: storeConfig.city || '',
        postalCode: storeConfig.postalCode || '',
        phone: storeConfig.phone || '',
        rfc: storeConfig.rfc || '',
        regimenDescription: storeConfig.regimenDescription || '',
        storeNumber: storeConfig.storeNumber || '001',
        logoUrl: storeConfig.logoUrl,
        ivaRate: storeConfig.ivaRate || '16',
        folio: selectedSale.folio,
        fecha: `${dateStr} ${timeStr}`,
        cajero: selectedSale.cajero || '—',
        metodoPago: paymentLabels[selectedSale.paymentMethod] || selectedSale.paymentMethod,
        items: selectedSale.items.map((i) => ({
          name: i.productName,
          qty: i.quantity,
          unit: 'pza',
          unitPrice: i.unitPrice,
          subtotal: i.subtotal,
        })),
        subtotal,
        iva,
        discount: 0,
        total: selectedSale.total,
        amountPaid: selectedSale.total,
        change: 0,
        ticketFooter: storeConfig.ticketFooter,
        ticketServicePhone: storeConfig.ticketServicePhone,
        ticketVigencia: storeConfig.ticketVigencia,
      });
      printWithIframe(designHtml);
    } else {
      printWithIframe(html);
    }
  }, [selectedSale, storeConfig]);

  const handleCancelSale = useCallback(async () => {
    if (!selectedSale) return;
    try {
      await cancelSale(selectedSale.id);
      showSuccess(`Venta ${selectedSale.folio} cancelada`);
      setDetailOpen(false);
      setSelectedSale(null);
    } catch {
      showError('Error al cancelar la venta');
      throw new Error('cancel failed');
    }
  }, [selectedSale, cancelSale, showSuccess, showError]);

  const searchFilters = [
    {
      key: 'paymentMethod',
      label: 'Método de Pago',
      filter: (
        <ChoiceList
          title="Método de Pago"
          titleHidden
          choices={[
            { label: 'Efectivo', value: 'efectivo' },
            { label: 'Tarjeta', value: 'tarjeta' },
            { label: 'Transferencia', value: 'transferencia' },
          ]}
          selected={[filterMethod]}
          onChange={(val) => setFilterMethod(val[0])}
        />
      ),
      shortcut: true,
    },
    {
      key: 'dateRange',
      label: 'Rango de Fechas',
      filter: (
        <Box padding="200">
          <DateRangeFilter
            activeDateRange={activeDateRange}
            onApply={setActiveDateRange}
            onClear={() => setActiveDateRange(null)}
          />
        </Box>
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = useMemo(() => {
    const tmp = [];
    if (filterMethod) {
      tmp.push({
        key: 'paymentMethod',
        label: `Método: ${filterMethod}`,
        onRemove: () => setFilterMethod(''),
      });
    }
    if (activeDateRange) {
      tmp.push({
        key: 'dateRange',
        label: `Período: ${activeDateRange.title}`,
        onRemove: () => setActiveDateRange(null),
      });
    }
    return tmp;
  }, [filterMethod, activeDateRange]);

  const { mode, setMode } = useSetIndexFiltersMode();

  return (
    <BlockStack gap="500">
      <Card padding="0">
        <IndexFilters
          queryValue={searchFolio}
          queryPlaceholder="Buscar por folio, cajero..."
          onQueryChange={setSearchFolio}
          onQueryClear={() => setSearchFolio('')}
          cancelAction={{
            onAction: () => {
              setSearchFolio('');
              setFilterMethod('');
              setActiveDateRange(null);
            },
            disabled: !searchFolio && !filterMethod && !activeDateRange,
            loading: false,
          }}
          tabs={[]}
          selected={0}
          onSelect={() => {}}
          filters={searchFilters}
          appliedFilters={appliedFilters}
          onClearAll={() => {
            setSearchFolio('');
            setFilterMethod('');
            setActiveDateRange(null);
          }}
          mode={mode}
          setMode={setMode}
          loading={false}
        />

        <Box>
          {filteredSales.length === 0 ? (
            <Box paddingBlockStart="1200" paddingBlockEnd="1200">
              <BlockStack gap="300" inlineAlign="center">
                <div style={{ opacity: 0.4 }}>
                  <Icon source={ReceiptIcon} />
                </div>
                <BlockStack gap="100" inlineAlign="center">
                  <Text as="p" variant="headingSm">
                    Sin ventas registradas
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Registra una venta para verla aquí.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Box>
          ) : (
            <IndexTable
              resourceName={{ singular: 'venta', plural: 'ventas' }}
              itemCount={filteredSales.length}
              headings={[
                { title: 'Folio' },
                { title: 'Fecha' },
                { title: 'Cajero' },
                { title: 'Artículos' },
                { title: 'Total', alignment: 'end' },
                { title: 'Método' },
                { title: 'Estado' },
                { title: '' },
              ]}
              selectable={false}
            >
              {filteredSales.map((sale, idx) => {
                const d = new Date(sale.date);
                const hasReturn = devolucionesStore.some((dev: { saleId?: string }) => dev.saleId === sale.id);
                return (
                  <IndexTable.Row id={sale.id} key={sale.id} position={idx}>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd" fontWeight="semibold" tone="magic">
                        {sale.folio}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span" variant="bodySm">
                          {d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodySm">
                        {sale.cajero}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {sale.items.length} {sale.items.length === 1 ? 'producto' : 'productos'}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd" fontWeight="bold" alignment="end">
                        {formatCurrency(sale.total)}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{paymentBadge(sale.paymentMethod)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      {hasReturn ? (
                        <Badge tone="warning" size="small">Devuelto</Badge>
                      ) : (
                        <Badge tone="success" size="small">Pagado</Badge>
                      )}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <InlineStack gap="100">
                        <Button size="micro" variant="plain" onClick={() => handleViewSale(sale)}>
                          Ver
                        </Button>
                        <Button
                          size="micro"
                          variant="plain"
                          onClick={() => {
                            setSelectedSale(sale);
                            setTimeout(() => handlePrint(), 0);
                          }}
                        >
                          Imprimir
                        </Button>
                      </InlineStack>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>
          )}
        </Box>

        {/* Footer: count + export */}
        {filteredSales.length > 0 && (
          <Box padding="300" borderBlockStartWidth="025" borderColor="border">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodySm" tone="subdued">
                {filteredSales.length} venta{filteredSales.length !== 1 ? 's' : ''}
                {activeDateRange ? ` · ${activeDateRange.title}` : ''}
              </Text>
              <Button size="slim" onClick={() => setIsExportOpen(true)}>
                Exportar
              </Button>
            </InlineStack>
          </Box>
        )}
      </Card>

      {selectedSale && (
        <SaleDetailModal
          open={detailOpen}
          sale={selectedSale}
          onClose={() => {
            setDetailOpen(false);
            setSelectedSale(null);
          }}
          onCancel={handleCancelSale}
          onReturn={() => setDevolucionOpen(true)}
          onPrint={handlePrint}
        />
      )}

      {selectedSale && (
        <DevolucionModal
          open={devolucionOpen}
          sale={selectedSale}
          cajero={currentUserRole?.displayName ?? 'Cajero'}
          onClose={() => setDevolucionOpen(false)}
          onSuccess={() => setDevolucionOpen(false)}
        />
      )}

      <GenericExportModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Exportar ventas"
        exportName="ventas"
        onExport={(format) => {
          const exportData = filteredSales.map((s) => ({
            Folio: s.folio,
            Fecha: new Date(s.date).toLocaleDateString('es-MX'),
            Hora: new Date(s.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            Cajero: s.cajero,
            'Total Artículos': s.items.length,
            Total: s.total,
            Método: s.paymentMethod,
          }));
          const filename = `Ventas_${new Date().toISOString().split('T')[0]}`;
          if (format === 'pdf') {
            generatePDF('Reporte de Ventas', exportData as Record<string, unknown>[], `${filename}.pdf`);
          } else {
            const csvContent = generateCSV(exportData as Record<string, unknown>[], true);
            downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
          }
        }}
      />
    </BlockStack>
  );
}
