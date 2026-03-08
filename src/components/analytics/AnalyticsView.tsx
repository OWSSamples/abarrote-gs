'use client';

import { useMemo, useState } from 'react';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  ProgressBar,
  Divider,
  Select,
  Box,
  Icon,
  InlineGrid,
  Button,
  ButtonGroup,
} from '@shopify/polaris';
import {
  PlusIcon,
  MinusIcon,
  CashDollarIcon,
  ReceiptIcon,
  ArrowUpIcon,
  ChartVerticalIcon,
  CalendarIcon,
  RefreshIcon,
  MaximizeIcon,
  EditIcon
} from '@shopify/polaris-icons';
import { LineChart, DonutChart } from '@shopify/polaris-viz';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';

export function AnalyticsView() {
  const { saleRecords, products, gastos, mermaRecords, kpiData } = useDashboardStore();
  const [periodo, setPeriodo] = useState('30');

  // Calcular ventas del mes actual
  const ventasMesActual = useMemo(() => {
    const now = new Date();
    const mesActual = now.getMonth();
    const añoActual = now.getFullYear();

    return saleRecords
      .filter(sale => {
        const fecha = new Date(sale.date);
        return fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
      })
      .reduce((sum, sale) => sum + parseFloat(sale.total.toString()), 0);
  }, [saleRecords]);

  // Calcular ventas del día
  const ventasHoy = useMemo(() => {
    const hoy = new Date().toISOString().split('T')[0];
    return saleRecords
      .filter(sale => new Date(sale.date).toISOString().split('T')[0] === hoy)
      .reduce((sum, sale) => sum + parseFloat(sale.total.toString()), 0);
  }, [saleRecords]);

  // Calcular ventas de ayer
  const ventasAyer = useMemo(() => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const ayerStr = ayer.toISOString().split('T')[0];
    return saleRecords
      .filter(sale => new Date(sale.date).toISOString().split('T')[0] === ayerStr)
      .reduce((sum, sale) => sum + parseFloat(sale.total.toString()), 0);
  }, [saleRecords]);

  // Ventas por día según período seleccionado
  const ventasPorDia = useMemo(() => {
    const dias = parseInt(periodo);
    const fechas = Array.from({ length: dias }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (dias - 1 - i));
      return date.toISOString().split('T')[0];
    });

    const ventasPorFecha = saleRecords.reduce((acc, sale) => {
      const fecha = new Date(sale.date).toISOString().split('T')[0];
      acc[fecha] = (acc[fecha] || 0) + parseFloat(sale.total.toString());
      return acc;
    }, {} as Record<string, number>);

    return fechas.map(fecha => ({
      key: fecha,
      value: ventasPorFecha[fecha] || 0,
    }));
  }, [saleRecords, periodo]);

  // Ventas por método de pago
  const ventasPorMetodo = useMemo(() => {
    const metodos = saleRecords.reduce((acc, sale) => {
      const metodo = sale.paymentMethod;
      acc[metodo] = (acc[metodo] || 0) + parseFloat(sale.total.toString());
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(metodos).map(([metodo, total]) => ({
      metodo: metodo === 'efectivo' ? 'Efectivo' :
        metodo === 'tarjeta' ? 'Tarjeta' :
          metodo === 'transferencia' ? 'Transferencia' :
            metodo === 'fiado' ? 'Fiado' : metodo,
      total,
    }));
  }, [saleRecords]);

  // Top 10 productos más vendidos
  const topProductos = useMemo(() => {
    const productosVendidos = saleRecords.flatMap(sale =>
      sale.items?.map(item => ({
        id: item.productId,
        name: item.productName,
        quantity: item.quantity,
        total: parseFloat(item.subtotal.toString()),
      })) || []
    );

    const agrupados = productosVendidos.reduce((acc, item) => {
      if (!acc[item.id]) {
        acc[item.id] = { name: item.name, quantity: 0, total: 0 };
      }
      acc[item.id].quantity += item.quantity;
      acc[item.id].total += item.total;
      return acc;
    }, {} as Record<string, { name: string; quantity: number; total: number }>);

    return Object.entries(agrupados)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [saleRecords]);

  // Productos con bajo stock
  const productosStockBajo = useMemo(() => {
    return products
      .filter(p => p.currentStock < p.minStock)
      .sort((a, b) => (a.currentStock / a.minStock) - (b.currentStock / b.minStock))
      .slice(0, 10);
  }, [products]);

  // Métricas generales
  const totalVentas = saleRecords.reduce((sum, sale) => sum + parseFloat(sale.total.toString()), 0);
  const totalGastos = gastos.reduce((sum, gasto) => sum + parseFloat(gasto.monto.toString()), 0);
  const totalMermas = mermaRecords.reduce((sum, merma) => sum + parseFloat(merma.value.toString()), 0);
  const utilidadBruta = totalVentas - totalGastos - totalMermas;
  const margenUtilidad = totalVentas > 0 ? (utilidadBruta / totalVentas) * 100 : 0;

  // Ticket promedio
  const ticketPromedio = saleRecords.length > 0 ? totalVentas / saleRecords.length : 0;

  // Productos vendidos
  const productosVendidos = saleRecords.reduce((sum, sale) =>
    sum + (sale.items?.reduce((s, i) => s + i.quantity, 0) || 0), 0
  );

  return (
    <div style={{ background: '#f4f6f8', minHeight: '100%', paddingBottom: '2rem' }}>
      <Page
        title="Informes y estadísticas"
        subtitle={`Última actualización: ${new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}`}
        fullWidth
        primaryAction={{ content: 'Nueva exploración' }}
        secondaryActions={[
          { content: '', icon: RefreshIcon },
          { content: '', icon: MaximizeIcon },
          { content: '', icon: EditIcon },
        ]}
      >
        <BlockStack gap="400">

          {/* Filters Row */}
          <InlineStack gap="200">
            <Button icon={CalendarIcon}>Hoy</Button>
            <Button icon={CalendarIcon}>{new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</Button>
            <Button>$ MXN $</Button>
          </InlineStack>

          {/* ROW 1: KPIs Principales */}
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            <Card background="bg-surface">
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" fontWeight="semibold">Ventas brutas</Text>
                <InlineStack align="start" blockAlign="baseline" gap="200">
                  <Text as="h3" variant="headingLg">{formatCurrency(totalVentas)}</Text>
                  <Text as="span" variant="bodySm" tone="subdued">—</Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card background="bg-surface">
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" fontWeight="semibold">Tasa de clientes habituales</Text>
                <InlineStack align="start" blockAlign="baseline" gap="200">
                  <Text as="h3" variant="headingLg">0 %</Text>
                  <Text as="span" variant="bodySm" tone="subdued">—</Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card background="bg-surface">
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" fontWeight="semibold">Pedidos preparados</Text>
                <InlineStack align="start" blockAlign="baseline" gap="200">
                  <Text as="h3" variant="headingLg">0</Text>
                  <Text as="span" variant="bodySm" tone="subdued">—</Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card background="bg-surface">
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" fontWeight="semibold">Pedidos</Text>
                <InlineStack align="start" blockAlign="baseline" gap="200">
                  <Text as="h3" variant="headingLg">{saleRecords.length}</Text>
                  <Text as="span" variant="bodySm" tone="subdued">—</Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </InlineGrid>

          {/* ROW 2: Historico y Desglose */}
          <Layout>
            {/* Main Chart */}
            <Layout.Section>
              <Card background="bg-surface">
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">Ventas totales a lo largo del tiempo</Text>
                  <InlineStack align="start" blockAlign="baseline" gap="200">
                    <Text as="h2" variant="headingXl">{formatCurrency(totalVentas)}</Text>
                    <Text as="span" variant="bodySm" tone="subdued">—</Text>
                  </InlineStack>
                  <div style={{ height: 350 }}>
                    <LineChart
                      data={[{ name: 'Ventas', data: ventasPorDia }]}
                      theme="Light"
                      xAxisOptions={{
                        labelFormatter: (value) => {
                          const date = new Date(String(value ?? ''));
                          return `${date.getDate()}/${date.getMonth() + 1}`;
                        },
                      }}
                      yAxisOptions={{
                        labelFormatter: (value) => formatCurrency(Number(value ?? 0)),
                      }}
                    />
                  </div>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Desglose */}
            <Layout.Section variant="oneThird">
              <Card background="bg-surface">
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">Desglose de ventas totales</Text>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Ventas brutas</Text>
                      <InlineStack gap="100">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{formatCurrency(totalVentas)}</Text>
                        <Text as="span" tone="subdued">—</Text>
                      </InlineStack>
                    </InlineStack>

                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Descuentos</Text>
                      <InlineStack gap="100">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{formatCurrency(0)}</Text>
                        <Text as="span" tone="subdued">—</Text>
                      </InlineStack>
                    </InlineStack>

                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Devoluciones</Text>
                      <InlineStack gap="100">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{formatCurrency(0)}</Text>
                        <Text as="span" tone="subdued">—</Text>
                      </InlineStack>
                    </InlineStack>

                    <Box background="bg-surface-secondary" padding="200" borderRadius="100">
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">Ventas netas</Text>
                        <InlineStack gap="100">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">{formatCurrency(totalVentas)}</Text>
                          <Text as="span" tone="subdued">—</Text>
                        </InlineStack>
                      </InlineStack>
                    </Box>

                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Cargos de envío</Text>
                      <InlineStack gap="100">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{formatCurrency(0)}</Text>
                        <Text as="span" tone="subdued">—</Text>
                      </InlineStack>
                    </InlineStack>

                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Cargos por devolución</Text>
                      <InlineStack gap="100">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{formatCurrency(0)}</Text>
                        <Text as="span" tone="subdued">—</Text>
                      </InlineStack>
                    </InlineStack>

                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Impuestos</Text>
                      <InlineStack gap="100">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{formatCurrency(0)}</Text>
                        <Text as="span" tone="subdued">—</Text>
                      </InlineStack>
                    </InlineStack>

                    <Divider />

                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">Ventas totales</Text>
                      <InlineStack gap="100">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{formatCurrency(totalVentas)}</Text>
                        <Text as="span" tone="subdued">—</Text>
                      </InlineStack>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>

          {/* ROW 3: 3 Columns */}
          <Layout>
            {/* Method */}
            <Layout.Section variant="oneThird">
              <Card background="bg-surface">
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">Ventas totales por canal de ventas</Text>
                  <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ventasPorMetodo.length === 0 ? (
                      <Text as="p" tone="subdued">No hay datos para este rango de fechas</Text>
                    ) : (
                      <DonutChart
                        data={[{
                          name: 'Ventas por Canal',
                          data: ventasPorMetodo.map(({ metodo, total }) => ({
                            key: metodo,
                            value: total,
                          })),
                        }]}
                        theme="Light"
                        legendPosition="bottom"
                      />
                    )}
                  </div>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Average Order Value (just placeholder line chart for now, or use our ticket promedio over time if we have it? No just use sales data) */}
            <Layout.Section variant="oneThird">
              <Card background="bg-surface">
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">Valor medio del pedido a lo largo del tiempo</Text>
                  <InlineStack align="start" blockAlign="baseline" gap="200">
                    <Text as="h2" variant="headingXl">{formatCurrency(ticketPromedio)}</Text>
                    <Text as="span" variant="bodySm" tone="subdued">—</Text>
                  </InlineStack>
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ventasPorDia.length === 0 ? (
                      <Text as="p" tone="subdued">No hay datos para este rango de fechas</Text>
                    ) : (
                      <LineChart
                        data={[{ name: 'Promedio', data: ventasPorDia.map(d => ({ key: d.key, value: ticketPromedio })) }]}
                        theme="Light"
                        xAxisOptions={{ labelFormatter: () => '' }}
                        yAxisOptions={{ labelFormatter: () => '' }}
                      />
                    )}
                  </div>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Top Products */}
            <Layout.Section variant="oneThird">
              <Card background="bg-surface">
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">Ventas totales por producto</Text>
                  <div style={{ height: 250, overflowY: 'auto' }}>
                    {topProductos.length === 0 ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Text as="p" tone="subdued">No hay datos para este rango de fechas</Text>
                      </div>
                    ) : (
                      <BlockStack gap="300">
                        {topProductos.slice(0, 5).map((producto, index) => (
                          <div key={producto.id}>
                            <InlineStack align="space-between" blockAlign="center">
                              <BlockStack gap="0">
                                <Text as="span" variant="bodyMd">{producto.name}</Text>
                              </BlockStack>
                              <InlineStack gap="100">
                                <Text as="span" variant="bodyMd" fontWeight="semibold">{formatCurrency(producto.total)}</Text>
                                <Text as="span" tone="subdued">—</Text>
                              </InlineStack>
                            </InlineStack>
                            {index < Math.min(topProductos.length, 5) - 1 && <div style={{ paddingTop: '8px' }}><Divider /></div>}
                          </div>
                        ))}
                      </BlockStack>
                    )}
                  </div>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>

        </BlockStack>
      </Page>
    </div>
  );
}
