'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Page,
  Layout,
  InlineStack,
  Button,
  BlockStack,
  Box,
  Text,
  Grid,
  Card,
  Badge,
} from '@shopify/polaris';
import {
  MoneyIcon,
  InventoryIcon,
  CalendarIcon,
  CartIcon,
  ExportIcon,
  RefreshIcon,
  HomeFilledIcon,
} from '@shopify/polaris-icons';
import { Icon } from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import { KPICard } from '@/components/kpi/KPICard';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { QuickActions } from '@/components/actions/QuickActions';
import { TopProducts } from '@/components/metrics/TopProducts';
import { ExportModal } from '@/components/export/ExportModal';
import { exportDashboardData } from '@/components/export/exportUtils';
import { Product } from '@/types';
import { formatCurrency } from '@/lib/utils';

export default function DashboardOverviewPage() {
  const kpiData = useDashboardStore((s) => s.kpiData);
  const currentUserRole = useDashboardStore((s) => s.currentUserRole);
  const inventoryAlerts = useDashboardStore((s) => s.inventoryAlerts);
  const salesData = useDashboardStore((s) => s.salesData);
  const saleRecords = useDashboardStore((s) => s.saleRecords);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);

  // Ventas de hoy
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = useMemo(
    () => saleRecords.filter((r) => r.date.startsWith(todayStr)),
    [saleRecords, todayStr]
  );

  // Datos para HourlySalesChart: ventas por hora de hoy
  const hourlySalesData = useMemo(() => {
    const byHour: Record<number, { sales: number; transactions: number }> = {};
    for (const sale of todaySales) {
      const hour = new Date(sale.date).getHours();
      if (!byHour[hour]) byHour[hour] = { sales: 0, transactions: 0 };
      byHour[hour].sales += sale.total;
      byHour[hour].transactions += 1;
    }
    if (Object.keys(byHour).length === 0) return undefined;
    // Determinar horas pico (top 25% de ventas)
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

  // Datos para TopProducts: top 5 productos de hoy
  const topProductsData = useMemo(() => {
    const byProduct: Record<string, { name: string; sku: string; unitsSold: number; revenue: number }> = {};
    for (const sale of todaySales) {
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
  }, [todaySales]);

  const [exportModalOpen, setExportModalOpen] = useState(false);

  const handleProductClick = useCallback((product: Product) => {
    // TODO: integrate with layout's product detail modal via context or URL
  }, []);

  const handleExport = useCallback((options: Parameters<typeof exportDashboardData>[0]) => {
    const exportData = {
      inventory: inventoryAlerts.map(a => a.product),
      lowStock: inventoryAlerts.filter(a => a.alertType === 'low_stock').map(a => a.product),
      expiring: inventoryAlerts.filter(a => a.alertType === 'expiration').map(a => a.product),
      dailySales: salesData,
    };
    exportDashboardData(options, exportData);
  }, [inventoryAlerts, salesData]);

  const welcomeMarkup = (
    <Box paddingBlockEnd="800">
      <Card padding="600">
        <InlineStack align="space-between" blockAlign="center" gap="400">
          <InlineStack gap="500" blockAlign="center">
            <div style={{ backgroundColor: 'var(--blue-zodiac-50)', borderRadius: 'var(--p-border-radius-400)', border: '1px solid var(--blue-zodiac-200)' }}>
              <Box
                padding="400"
              >
                <div style={{ color: 'var(--blue-zodiac-600)', display: 'flex' }}>
                  <Icon source={HomeFilledIcon} />
                </div>
              </Box>
            </div>
            <BlockStack gap="100">
              <Text as="h1" variant="heading2xl" fontWeight="bold">
                Escritorio Principal
              </Text>
              <InlineStack gap="200" blockAlign="center">
                <Badge tone="info">Abarrote-GS v2.0</Badge>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Tu centro de control para ventas e inventarios
                </Text>
              </InlineStack>
            </BlockStack>
          </InlineStack>
          <InlineStack gap="300">
            <Button size="large" icon={RefreshIcon} onClick={fetchDashboardData}>
              Sincronizar
            </Button>
            <Button size="large" variant="primary" icon={ExportIcon} onClick={() => setExportModalOpen(true)}>
              Reporte Ejecutivo
            </Button>
          </InlineStack>
        </InlineStack>
      </Card>
    </Box>
  );

  return (
    <>
      <Page title="" compactTitle>
        <Box paddingBlockStart="800" paddingBlockEnd="800">
          {welcomeMarkup}

          <BlockStack gap="600">
            <Layout>
              <Layout.Section>
                <Grid>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3 }}>
                    <KPICard title="Venta Neta (Hoy)" value={kpiData?.dailySales || 0} type="currency" icon={<MoneyIcon />} />
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3 }}>
                    <KPICard title="Reponer Stock" value={kpiData?.lowStockProducts || 0} type="number" icon={<InventoryIcon />} />
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3 }}>
                    <KPICard title="Caducidad Próxima" value={kpiData?.expiringProducts || 0} type="number" icon={<CalendarIcon />} />
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3 }}>
                    <KPICard title="Tasa de Merma" value={kpiData?.mermaRate || 0} type="percentage" icon={<CartIcon />} />
                  </Grid.Cell>
                </Grid>
              </Layout.Section>

              <Layout.Section>
                <Box
                  background="bg-surface"
                  borderRadius="300"
                  shadow="300"
                  borderWidth="025"
                  borderColor="border"
                  overflowX="hidden"
                  overflowY="hidden"
                >
                  <QuickActions />
                </Box>
              </Layout.Section>
            </Layout>

            <Layout>
              <Layout.Section>
                <Card padding="0">
                  <Box padding="400" borderBlockEndWidth="025" borderColor="border">
                    <Text as="h2" variant="headingMd" fontWeight="semibold">Últimas Transacciones (Hoy)</Text>
                  </Box>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--p-font-size-200)' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--p-color-border-subdued)' }}>
                          <th style={{ padding: '12px 16px' }}>Folio</th>
                          <th style={{ padding: '12px 16px' }}>Hora</th>
                          <th style={{ padding: '12px 16px' }}>Cajero</th>
                          <th style={{ padding: '12px 16px' }}>Total</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todaySales.slice(0, 8).map((sale) => (
                          <tr key={sale.id} style={{ borderBottom: '1px solid var(--p-color-border-subdued)' }}>
                            <td style={{ padding: '12px 16px' }}>{sale.folio}</td>
                            <td style={{ padding: '12px 16px' }}>{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ padding: '12px 16px' }}>{sale.cajero || 'Central'}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{formatCurrency(sale.total)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <Badge tone="success">Completado</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </Layout.Section>
            </Layout>

            <Layout>
              <Layout.Section variant="oneHalf">
                <InventoryTable alerts={inventoryAlerts} onProductClick={handleProductClick} />
              </Layout.Section>
              <Layout.Section variant="oneHalf">
                <TopProducts products={topProductsData} />
              </Layout.Section>
            </Layout>
          </BlockStack>
        </Box>
      </Page>
      <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} onExport={handleExport} />
    </>
  );
}
