'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Page,
  Layout,
  InlineStack,
  Button,
  BlockStack,
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
import { SalesChart } from '@/components/charts/SalesChart';
import { HourlySalesChart } from '@/components/charts/HourlySalesChart';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { QuickActions } from '@/components/actions/QuickActions';
import { TopProducts } from '@/components/metrics/TopProducts';
import { ExportModal } from '@/components/export/ExportModal';
import { exportDashboardData } from '@/components/export/exportUtils';
import { Product } from '@/types';

export default function DashboardOverviewPage() {
  const kpiData = useDashboardStore((s) => s.kpiData);
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

  const fancyTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Icon source={HomeFilledIcon} tone="base" />
      <span>Inicio</span>
    </div>
  );

  return (
    <>
      <Page
        fullWidth
        title={fancyTitle as any}
        secondaryActions={[
          { content: 'Actualizar', icon: RefreshIcon, onAction: fetchDashboardData },
          { content: 'Exportar', icon: ExportIcon, onAction: () => setExportModalOpen(true) },
        ]}
      >
        <Layout>
          <Layout.Section>
            <InlineStack gap="400" wrap={true}>
              <div style={{ flex: '1 1 240px' }}>
                <KPICard title="Ventas Hoy" value={kpiData?.dailySales || 0} type="currency" icon={<MoneyIcon />} />
              </div>
              <div style={{ flex: '1 1 240px' }}>
                <KPICard title="Stock Bajo" value={kpiData?.lowStockProducts || 0} type="number" icon={<InventoryIcon />} />
              </div>
              <div style={{ flex: '1 1 240px' }}>
                <KPICard title="Por Vencer" value={kpiData?.expiringProducts || 0} type="number" icon={<CalendarIcon />} />
              </div>
              <div style={{ flex: '1 1 240px' }}>
                <KPICard title="Tasa Merma" value={kpiData?.mermaRate || 0} type="percentage" icon={<CartIcon />} />
              </div>
            </InlineStack>
          </Layout.Section>
          <Layout.Section>
            <BlockStack gap="400">
              <QuickActions />
              <Layout>
                <Layout.Section variant="oneHalf">
                  <SalesChart data={salesData} />
                </Layout.Section>
                <Layout.Section variant="oneHalf">
                   <HourlySalesChart data={hourlySalesData} />
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
          </Layout.Section>
        </Layout>
      </Page>
      <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} onExport={handleExport} />
    </>
  );
}
