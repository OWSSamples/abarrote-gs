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
  useIndexResourceState,
  ChoiceList,
  EmptySearchResult,
} from '@shopify/polaris';
import { ReceiptIcon, XCircleIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/notifications/ToastProvider';
import { printWithIframe, posTicketCSS, applyTicketTemplate, generateTicketHtml } from '@/lib/printTicket';
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
    tarjeta_clip: { tone: 'info', label: 'Clip' },
    clip_terminal: { tone: 'info', label: 'Clip Term.' },
  };
  const s = styles[method] || { tone: undefined, label: method };
  return <Badge tone={s.tone} size="small">{s.label}</Badge>;
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
  const [devolucionOpen, setDevolucionOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [activeDateRange, setActiveDateRange] = useState<RangeOption | null>(null);

  // ── Tabs: Shopify Orders-style segmentation ──
  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);
  const weekAgo = useMemo(() => {
    const d = new Date(today); d.setDate(d.getDate() - 6); return d;
  }, [today]);

  const tabs = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    const todayCount = saleRecords.filter((s) => s.date.startsWith(todayStr)).length;
    const weekCount = saleRecords.filter((s) => new Date(s.date) >= weekAgo).length;
    const efectivoCount = saleRecords.filter((s) => s.paymentMethod === 'efectivo').length;
    const tarjetaCount = saleRecords.filter((s) =>
      ['tarjeta', 'tarjeta_web', 'tarjeta_manual', 'tarjeta_clip', 'clip_terminal'].includes(s.paymentMethod),
    ).length;
    const fiadoCount = saleRecords.filter((s) => s.paymentMethod === 'fiado').length;

    return [
      { content: 'Todas', id: 'all', badge: String(saleRecords.length), accessibilityLabel: 'Todas las ventas' },
      { content: 'Hoy', id: 'today', badge: String(todayCount), accessibilityLabel: 'Ventas de hoy' },
      { content: 'Esta semana', id: 'week', badge: String(weekCount), accessibilityLabel: 'Ventas de esta semana' },
      ...(efectivoCount > 0 ? [{ content: 'Efectivo', id: 'efectivo', badge: String(efectivoCount), accessibilityLabel: 'Pagos en efectivo' }] : []),
      ...(tarjetaCount > 0 ? [{ content: 'Tarjeta', id: 'tarjeta', badge: String(tarjetaCount), accessibilityLabel: 'Pagos con tarjeta' }] : []),
      ...(fiadoCount > 0 ? [{ content: 'Fiado', id: 'fiado', badge: String(fiadoCount), accessibilityLabel: 'Ventas a crédito' }] : []),
    ];
  }, [saleRecords, today, weekAgo]);

  const filteredSales = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0];
    const tabId = tabs[selectedTab]?.id || 'all';

    return saleRecords
      .filter((sale) => {
        // Tab filter
        if (tabId === 'today' && !sale.date.startsWith(todayStr)) return false;
        if (tabId === 'week' && new Date(sale.date) < weekAgo) return false;
        if (tabId === 'efectivo' && sale.paymentMethod !== 'efectivo') return false;
        if (tabId === 'tarjeta' && !['tarjeta', 'tarjeta_web', 'tarjeta_manual', 'tarjeta_clip', 'clip_terminal'].includes(sale.paymentMethod)) return false;
        if (tabId === 'fiado' && sale.paymentMethod !== 'fiado') return false;

        // Search filter
        if (searchFolio) {
          const q = searchFolio.toLowerCase();
          if (!sale.folio.toLowerCase().includes(q) && !sale.cajero.toLowerCase().includes(q)) return false;
        }

        // Method filter (from IndexFilters)
        if (filterMethod && sale.paymentMethod !== filterMethod) return false;

        // Date range filter
        if (activeDateRange) {
          const d = new Date(sale.date); d.setHours(0, 0, 0, 0);
          if (d < activeDateRange.period.since || d > activeDateRange.period.until) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [saleRecords, searchFolio, filterMethod, activeDateRange, selectedTab, tabs, today, weekAgo]);

  // ── Selectable rows + bulk actions ──
  const {
    selectedResources: selectedIds,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(filteredSales as { id: string }[]);

  const handleBulkCancel = useCallback(async () => {
    let cancelled = 0;
    for (const id of selectedIds) {
      try {
        await cancelSale(id);
        cancelled++;
      } catch { /* skip */ }
    }
    if (cancelled > 0) {
      showSuccess(`${cancelled} venta${cancelled !== 1 ? 's' : ''} cancelada${cancelled !== 1 ? 's' : ''}`);
    }
    clearSelection();
  }, [selectedIds, cancelSale, showSuccess, clearSelection]);

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
            { label: 'Fiado', value: 'fiado' },
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

  // ── Summary for footer ──
  const totalAmount = useMemo(
    () => filteredSales.reduce((sum, s) => sum + s.total, 0),
    [filteredSales],
  );

  // ── Promoted bulk actions (Shopify pattern) ──
  const promotedBulkActions = [
    { content: 'Cancelar ventas', onAction: handleBulkCancel, icon: XCircleIcon },
  ];

  return (
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
        tabs={tabs}
        selected={selectedTab}
        onSelect={(idx) => {
          setSelectedTab(idx);
          clearSelection();
        }}
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

      {filteredSales.length === 0 ? (
        <Box paddingBlockStart="1600" paddingBlockEnd="1600">
          <EmptySearchResult
            title="No se encontraron ventas"
            description="Intenta con otro término de búsqueda o cambia los filtros."
            withIllustration
          />
        </Box>
      ) : (
        <IndexTable
          resourceName={{ singular: 'venta', plural: 'ventas' }}
          itemCount={filteredSales.length}
          selectedItemsCount={allResourcesSelected ? 'All' : selectedIds.length}
          onSelectionChange={handleSelectionChange}
          promotedBulkActions={promotedBulkActions}
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
        >
          {filteredSales.map((sale, idx) => {
            const d = new Date(sale.date);
            const hasReturn = devolucionesStore.some((dev: { saleId?: string }) => dev.saleId === sale.id);
            return (
              <IndexTable.Row
                id={sale.id}
                key={sale.id}
                position={idx}
                selected={selectedIds.includes(sale.id)}
              >
                <IndexTable.Cell>
                  <Text as="span" variant="bodyMd" fontWeight="semibold" tone="magic">
                    {sale.folio}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <BlockStack gap="050">
                    <Text as="span" variant="bodySm">
                      {d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </Text>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm">{sale.cajero}</Text>
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

      {/* ── Footer: count + total ── */}
      {filteredSales.length > 0 && (
        <Box padding="300" borderBlockStartWidth="025" borderColor="border">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" variant="bodySm" tone="subdued">
              {filteredSales.length} venta{filteredSales.length !== 1 ? 's' : ''}
              {activeDateRange ? ` · ${activeDateRange.title}` : ''}
            </Text>
            <Text as="span" variant="bodySm" fontWeight="semibold">
              Total: {formatCurrency(totalAmount)}
            </Text>
          </InlineStack>
        </Box>
      )}

      {/* ── Modals ── */}
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
    </Card>
  );
}
