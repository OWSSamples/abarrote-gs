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
  InlineGrid,
} from '@shopify/polaris';
import {
  CartIcon,
  ExportIcon,
  RefreshIcon,
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
import { useAuth } from '@/lib/auth/AuthContext';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    touchAction: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export default function DashboardOverviewPage() {
  const { user } = useAuth();
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [kpiOrder, setKpiOrder] = useState(['sales', 'stock', 'expiry', 'merma']);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (active.id !== over?.id) {
      setKpiOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

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

  const renderKPI = (id: string) => {
    switch (id) {
      case 'sales':
        return (
          <KPICard
            key="sales"
            title="Venta del día"
            value={kpiData?.dailySales || 0}
            type="currency"
            data={hourlySalesData && hourlySalesData.length > 1
              ? hourlySalesData.map(h => h.sales)
              : [0, 12, 28, 45, 80, 120, kpiData?.dailySales || 0]
            }
          />
        );
      case 'stock':
        return (
          <KPICard
            key="stock"
            title="Stock bajo"
            value={kpiData?.lowStockProducts || 0}
            type="number"
            data={(() => {
              const v = kpiData?.lowStockProducts || 0;
              return [v + 3, v + 5, v + 2, v + 4, v + 1, v + 2, v];
            })()}
          />
        );
      case 'expiry':
        return (
          <KPICard
            key="expiry"
            title="Por caducar"
            value={kpiData?.expiringProducts || 0}
            type="number"
            data={(() => {
              const v = kpiData?.expiringProducts || 0;
              return [v + 2, v + 1, v + 3, v + 1, v + 2, v + 1, v];
            })()}
          />
        );
      case 'merma':
        return (
          <KPICard
            key="merma"
            title="Tasa de merma"
            value={kpiData?.mermaRate || 0}
            type="percentage"
            data={(() => {
              const v = kpiData?.mermaRate || 0;
              return [v + 0.5, v + 0.3, v + 0.8, v + 0.2, v + 0.4, v + 0.1, v];
            })()}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Page
        title={`Hola, ${user?.displayName?.split(' ')[0] || 'Administrador'}`}
        subtitle="Resumen de tu tienda para hoy"
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
        <BlockStack gap="600">
          {/* Fila 1: KPIs con Sparkline y Drag and Drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToWindowEdges]}
          >
            <SortableContext
              items={kpiOrder}
              strategy={rectSortingStrategy}
            >
              <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
                {kpiOrder.map((id) => (
                  <SortableItem key={id} id={id}>
                    {renderKPI(id)}
                  </SortableItem>
                ))}
              </InlineGrid>
            </SortableContext>
            <DragOverlay dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.5',
                  },
                },
              }),
            }}>
              {activeId ? (
                <div style={{ cursor: 'grabbing', width: '100%' }}>
                  {renderKPI(activeId)}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Fila 2: Acciones Rápidas (ancho completo) */}
          <QuickActions />

          {/* Fila 3: Ventas del día (grande) + Top Productos (lateral) */}
          <Layout>
            <Layout.Section>
              <Card padding="0">
                <Box padding="400" borderBlockEndWidth="025" borderColor="border">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd" fontWeight="semibold">Ventas de hoy</Text>
                    <Badge tone="info">{`${todaySales.length} transacciones`}</Badge>
                  </InlineStack>
                </Box>
                {todaySales.length === 0 ? (
                  <Box padding="800">
                    <BlockStack gap="200" align="center">
                      <Text as="p" alignment="center" tone="subdued">No hay ventas registradas hoy.</Text>
                    </BlockStack>
                  </Box>
                ) : (
                  <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e1e3e5', backgroundColor: '#f9fafb' }}>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6d7175', fontWeight: 600 }}>Folio</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6d7175', fontWeight: 600 }}>Hora</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6d7175', fontWeight: 600 }}>Cajero</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '12px', color: '#6d7175', fontWeight: 600 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todaySales.slice(0, 10).map((sale) => (
                          <tr key={sale.id} style={{ borderBottom: '1px solid #f1f2f4' }}>
                            <td style={{ padding: '10px 16px', fontWeight: 600 }}>{sale.folio}</td>
                            <td style={{ padding: '10px 16px', color: '#6d7175' }}>{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ padding: '10px 16px' }}>{sale.cajero || 'Central'}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(sale.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </Layout.Section>
            <Layout.Section variant="oneThird">
              <TopProducts products={topProductsData} />
            </Layout.Section>
          </Layout>

          {/* Fila 4: Alertas de Inventario (ancho completo) */}
          <InventoryTable alerts={inventoryAlerts} onProductClick={handleProductClick} />
        </BlockStack>
      </Page>
      <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} onExport={handleExport} />
    </>
  );
}
