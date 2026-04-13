'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Page,
  Layout,
  InlineStack,
  BlockStack,
  Box,
  Text,
  Card,
  Badge,
  IndexTable,
  InlineGrid,
  ProgressBar,
} from '@shopify/polaris';
import { ExportIcon, RefreshIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { KPICard } from '@/components/kpi/KPICard';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { QuickActions } from '@/components/actions/QuickActions';
import { TopProducts } from '@/components/metrics/TopProducts';
import { ExportModal } from '@/components/export/ExportModal';
import { exportDashboardData } from '@/components/export/exportUtils';
import { Product } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const kpiData = useDashboardStore((s) => s.kpiData);
  const _currentUserRole = useDashboardStore((s) => s.currentUserRole);
  const inventoryAlerts = useDashboardStore((s) => s.inventoryAlerts);
  const salesData = useDashboardStore((s) => s.salesData);
  const saleRecords = useDashboardStore((s) => s.saleRecords);
  const clientes = useDashboardStore((s) => s.clientes);
  const mermaRecords = useDashboardStore((s) => s.mermaRecords);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);

  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }, []);

  const todaySales = useMemo(() => {
    return saleRecords.filter((r) => {
      const saleLocalDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(r.date));
      return saleLocalDate === todayStr;
    });
  }, [saleRecords, todayStr]);

  const hourlySalesData = useMemo(() => {
    const byHour: Record<number, { sales: number; transactions: number }> = {};
    for (const sale of todaySales) {
      const hour = new Date(sale.date).getHours();
      if (!byHour[hour]) byHour[hour] = { sales: 0, transactions: 0 };
      byHour[hour].sales += sale.total;
      byHour[hour].transactions += 1;
    }
    if (Object.keys(byHour).length === 0) return undefined;
    const salesValues = Object.values(byHour).map((v) => v.sales);
    const threshold = salesValues.sort((a, b) => b - a)[Math.floor(salesValues.length * 0.25)] ?? 0;
    return Object.entries(byHour)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([hour, { sales, transactions }]) => ({
        hour: `${hour}:00`,
        sales,
        transactions,
        isPeak: sales >= threshold && threshold > 0,
      }));
  }, [todaySales]);

  const topProductsData = useMemo(() => {
    // Use today's sales first; fall back to all sales so real products always show
    const source = todaySales.length > 0 ? todaySales : saleRecords;
    const byProduct: Record<string, { name: string; sku: string; unitsSold: number; revenue: number }> = {};
    for (const sale of source) {
      for (const item of sale.items) {
        if (!byProduct[item.productId]) {
          byProduct[item.productId] = { name: item.productName, sku: item.sku, unitsSold: 0, revenue: 0 };
        }
        byProduct[item.productId].unitsSold += item.quantity;
        byProduct[item.productId].revenue += item.subtotal;
      }
    }
    if (Object.keys(byProduct).length === 0) return undefined;
    return Object.entries(byProduct)
      .sort(([, a], [, b]) => b.unitsSold - a.unitsSold)
      .slice(0, 5)
      .map(([id, { name, sku, unitsSold, revenue }]) => ({
        id,
        name,
        sku,
        unitsSold,
        revenue,
        margin: 0,
        trend: 'stable' as const,
      }));
  }, [todaySales, saleRecords]);

  // ── Derived KPIs ──
  const derived = useMemo(() => {
    const totalRevenue = todaySales.reduce((acc, s) => acc + s.total, 0);
    const totalUnits = todaySales.reduce((acc, s) => acc + s.items.reduce((sum, it) => sum + it.quantity, 0), 0);
    const avgTicket = todaySales.length > 0 ? totalRevenue / todaySales.length : 0;
    const totalDebt = clientes.reduce((s, c) => s + c.balance, 0);
    const debtors = clientes.filter((c) => c.balance > 0).length;
    const monthMerma = mermaRecords.filter((m) => {
      const d = new Date(m.date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const mermaValue = monthMerma.reduce((s, m) => s + m.value, 0);
    const peakHour = hourlySalesData?.reduce((max, h) => (h.sales > max.sales ? h : max), { hour: '—', sales: 0 });
    return { totalRevenue, totalUnits, avgTicket, totalDebt, debtors, mermaValue, peakHour };
  }, [todaySales, clientes, mermaRecords, hourlySalesData]);

  const [exportModalOpen, setExportModalOpen] = useState(false);

  const handleProductClick = useCallback((product: Product) => {
    useDashboardStore.getState().openProductDetail(product);
  }, []);

  const handleExport = useCallback(
    (options: Parameters<typeof exportDashboardData>[0]) => {
      const exportData = {
        inventory: inventoryAlerts.map((a) => a.product),
        lowStock: inventoryAlerts.filter((a) => a.alertType === 'low_stock').map((a) => a.product),
        expiring: inventoryAlerts.filter((a) => a.alertType === 'expiration').map((a) => a.product),
        dailySales: salesData,
      };
      exportDashboardData(options, exportData);
    },
    [inventoryAlerts, salesData],
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  const userName = useMemo(() => {
    const name = user?.displayName?.split(' ')[0];
    if (name && /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]{2,}/i.test(name)) return name;
    const emailName = user?.email?.split('@')[0];
    if (emailName) return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    return 'Administrador';
  }, [user?.displayName, user?.email]);

  return (
    <>
      <Page
        title={`${greeting}, ${userName}`}
        subtitle={new Date().toLocaleDateString('es-MX', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        primaryAction={{
          content: 'Generar Reporte',
          icon: ExportIcon,
          onAction: () => setExportModalOpen(true),
        }}
        secondaryActions={[
          {
            content: 'Actualizar',
            icon: RefreshIcon,
            onAction: fetchDashboardData,
          },
        ]}
      >
        <BlockStack gap="500">
          {/* ═══ ROW 1: PRIMARY KPIs WITH SPARKLINES ═══ */}
          <InlineGrid columns={{ xs: 2, md: 4 }} gap="300">
            <KPICard
              title="Venta del Día"
              value={derived.totalRevenue}
              type="currency"
              data={
                hourlySalesData && hourlySalesData.length > 1
                  ? hourlySalesData.map((h) => h.sales)
                  : [0, 12, 28, 45, 80, 120, derived.totalRevenue]
              }
            />
            <KPICard
              title="Transacciones"
              value={todaySales.length}
              type="number"
              data={
                hourlySalesData && hourlySalesData.length > 1
                  ? hourlySalesData.map((h) => h.transactions)
                  : undefined
              }
            />
            <KPICard
              title="Ticket Promedio"
              value={derived.avgTicket}
              type="currency"
            />
            <KPICard
              title="Unidades Vendidas"
              value={derived.totalUnits}
              type="number"
            />
          </InlineGrid>

          {/* ═══ ROW 2: SECONDARY KPIs (compact cards) ═══ */}
          <InlineGrid columns={{ xs: 2, md: 5 }} gap="300">
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodyXs" tone="subdued">
                  Stock Bajo
                </Text>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" variant="headingMd" fontWeight="bold">
                    {kpiData?.lowStockProducts || 0}
                  </Text>
                  {(kpiData?.lowStockProducts || 0) > 0 && (
                    <Badge tone="warning">Atención</Badge>
                  )}
                </InlineStack>
                <Text as="p" variant="bodyXs" tone="subdued">
                  productos por debajo del mínimo
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodyXs" tone="subdued">
                  Por Caducar
                </Text>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" variant="headingMd" fontWeight="bold">
                    {kpiData?.expiringProducts || 0}
                  </Text>
                  {(kpiData?.expiringProducts || 0) > 0 && (
                    <Badge tone="critical">Urgente</Badge>
                  )}
                </InlineStack>
                <Text as="p" variant="bodyXs" tone="subdued">
                  productos próximos a vencer
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodyXs" tone="subdued">
                  Cartera por Cobrar
                </Text>
                <Text as="p" variant="headingMd" fontWeight="bold" tone="critical">
                  {formatCurrency(derived.totalDebt)}
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  {derived.debtors} clientes con adeudo
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodyXs" tone="subdued">
                  Merma del Mes
                </Text>
                <Text as="p" variant="headingMd" fontWeight="bold">
                  {formatCurrency(derived.mermaValue)}
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  {kpiData?.mermaRate || 0}% tasa de merma
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text as="p" variant="bodyXs" tone="subdued">
                  Hora Pico
                </Text>
                <Text as="p" variant="headingMd" fontWeight="bold">
                  {derived.peakHour?.hour || '—'}
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  {derived.peakHour?.sales ? formatCurrency(derived.peakHour.sales) : 'sin datos hoy'}
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>

          {/* ═══ ROW 3: QUICK ACTIONS ═══ */}
          <QuickActions />

          {/* ═══ ROW 4: SALES TABLE + TOP PRODUCTS SIDEBAR ═══ */}
          <Layout>
            <Layout.Section>
              <Card padding="0">
                <Box padding="400" borderBlockEndWidth="025" borderColor="border">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="050">
                      <Text as="h2" variant="headingMd" fontWeight="semibold">
                        Ventas de Hoy
                      </Text>
                      <Text as="p" variant="bodyXs" tone="subdued">
                        {todaySales.length > 10 ? `Mostrando 10 de ${todaySales.length}` : `${todaySales.length} registradas`}
                      </Text>
                    </BlockStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="span" variant="headingSm" fontWeight="bold">
                        {formatCurrency(derived.totalRevenue)}
                      </Text>
                      <Badge tone="info">{`${todaySales.length} txn`}</Badge>
                    </InlineStack>
                  </InlineStack>
                </Box>
                {todaySales.length === 0 ? (
                  <Box padding="800">
                    <BlockStack gap="200" inlineAlign="center">
                      <Text as="p" variant="headingMd" alignment="center">
                        Sin ventas todavía
                      </Text>
                      <Text as="p" tone="subdued" alignment="center">
                        Las transacciones del día aparecerán aquí conforme se registren.
                      </Text>
                    </BlockStack>
                  </Box>
                ) : (
                  <IndexTable
                    resourceName={{ singular: 'venta', plural: 'ventas' }}
                    itemCount={Math.min(todaySales.length, 10)}
                    headings={[
                      { title: 'Folio' },
                      { title: 'Hora' },
                      { title: 'Artículos' },
                      { title: 'Cajero' },
                      { title: 'Total', alignment: 'end' },
                    ]}
                    selectable={false}
                  >
                    {todaySales.slice(0, 10).map((sale, index) => {
                      const itemCount = sale.items.reduce((s, it) => s + it.quantity, 0);
                      return (
                        <IndexTable.Row id={sale.id} key={sale.id} position={index}>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {sale.folio}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {new Date(sale.date).toLocaleTimeString('es-MX', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodySm">
                              {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {sale.cajero || 'Central'}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <div style={{ textAlign: 'right' }}>
                              <Text as="span" variant="bodyMd" fontWeight="bold">
                                {formatCurrency(sale.total)}
                              </Text>
                            </div>
                          </IndexTable.Cell>
                        </IndexTable.Row>
                      );
                    })}
                  </IndexTable>
                )}
              </Card>
            </Layout.Section>
            <Layout.Section variant="oneThird">
              <BlockStack gap="400">
                <TopProducts
                  products={topProductsData}
                  period={todaySales.length > 0 ? 'Hoy' : 'General'}
                />

                {/* Hourly breakdown mini-card */}
                {hourlySalesData && hourlySalesData.length > 0 && (
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingSm" fontWeight="semibold">
                        Ventas por Hora
                      </Text>
                      <BlockStack gap="200">
                        {hourlySalesData.map((h) => {
                          const maxSales = Math.max(...hourlySalesData.map((x) => x.sales));
                          const pct = maxSales > 0 ? (h.sales / maxSales) * 100 : 0;
                          return (
                            <div key={h.hour}>
                              <InlineStack align="space-between" blockAlign="center">
                                <Text as="span" variant="bodyXs" fontWeight={h.isPeak ? 'bold' : 'regular'}>
                                  {h.hour} {h.isPeak ? '🔥' : ''}
                                </Text>
                                <Text as="span" variant="bodyXs" tone="subdued">
                                  {formatCurrency(h.sales)} · {h.transactions} txn
                                </Text>
                              </InlineStack>
                              <Box paddingBlockStart="050">
                                <ProgressBar
                                  progress={pct}
                                  size="small"
                                  tone={h.isPeak ? 'highlight' : 'primary'}
                                />
                              </Box>
                            </div>
                          );
                        })}
                      </BlockStack>
                    </BlockStack>
                  </Card>
                )}
              </BlockStack>
            </Layout.Section>
          </Layout>

          {/* ═══ ROW 5: INVENTORY ALERTS ═══ */}
          <InventoryTable alerts={inventoryAlerts} onProductClick={handleProductClick} />
        </BlockStack>
      </Page>
      <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} onExport={handleExport} />
    </>
  );
}
