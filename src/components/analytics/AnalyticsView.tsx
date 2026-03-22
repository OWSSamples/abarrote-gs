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
  EditIcon,
  ChartVerticalFilledIcon
} from '@shopify/polaris-icons';
import { LineChart, DonutChart } from '@shopify/polaris-viz';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';

export function AnalyticsView() {
  const saleRecords = useDashboardStore((s) => s.saleRecords);
  const products = useDashboardStore((s) => s.products);
  const gastos = useDashboardStore((s) => s.gastos);
  const mermaRecords = useDashboardStore((s) => s.mermaRecords);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);
  const [periodo, setPeriodo] = useState('30');

  // Fecha de inicio del período seleccionado (medianoche local)
  const periodoStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (parseInt(periodo) - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [periodo]);

  // Registros filtrados por período
  const salesEnPeriodo = useMemo(
    () => saleRecords.filter(s => new Date(s.date) >= periodoStart),
    [saleRecords, periodoStart]
  );
  const gastosEnPeriodo = useMemo(
    () => gastos.filter(g => new Date(g.fecha) >= periodoStart),
    [gastos, periodoStart]
  );
  const mermasEnPeriodo = useMemo(
    () => mermaRecords.filter(m => new Date(m.date) >= periodoStart),
    [mermaRecords, periodoStart]
  );

  // Ventas del día
  const ventasHoy = useMemo(() => {
    const hoy = new Date().toISOString().split('T')[0];
    return saleRecords
      .filter(s => new Date(s.date).toISOString().split('T')[0] === hoy)
      .reduce((sum, s) => sum + parseFloat(s.total.toString()), 0);
  }, [saleRecords]);

  // Ventas de ayer
  const ventasAyer = useMemo(() => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const ayerStr = ayer.toISOString().split('T')[0];
    return saleRecords
      .filter(s => new Date(s.date).toISOString().split('T')[0] === ayerStr)
      .reduce((sum, s) => sum + parseFloat(s.total.toString()), 0);
  }, [saleRecords]);

  // Ventas por día en el período (gráfica)
  const ventasPorDia = useMemo(() => {
    const dias = parseInt(periodo);
    const fechas = Array.from({ length: dias }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (dias - 1 - i));
      return date.toISOString().split('T')[0];
    });
    const ventasPorFecha = salesEnPeriodo.reduce((acc, sale) => {
      const fecha = new Date(sale.date).toISOString().split('T')[0];
      acc[fecha] = (acc[fecha] || 0) + parseFloat(sale.total.toString());
      return acc;
    }, {} as Record<string, number>);

    return fechas.map(fecha => ({
      key: fecha,
      value: ventasPorFecha[fecha] || 0,
    }));
  }, [salesEnPeriodo, periodo]);

  // Ventas por método de pago (en período)
  const ventasPorMetodo = useMemo(() => {
    const metodos = salesEnPeriodo.reduce((acc, sale) => {
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
  }, [salesEnPeriodo]);

  // Top 10 productos más vendidos (en período)
  const topProductos = useMemo(() => {
    const productosVendidos = salesEnPeriodo.flatMap(sale =>
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

  // Métricas generales — todas filtradas por período
  const totalVentas = salesEnPeriodo.reduce((sum, sale) => sum + parseFloat(sale.total.toString()), 0);
  const totalGastos = gastosEnPeriodo.reduce((sum, gasto) => sum + parseFloat(gasto.monto.toString()), 0);
  const totalMermas = mermasEnPeriodo.reduce((sum, merma) => sum + parseFloat(merma.value.toString()), 0);
  const utilidadBruta = totalVentas - totalGastos - totalMermas;
  const margenUtilidad = totalVentas > 0 ? (utilidadBruta / totalVentas) * 100 : 0;

  // Ticket promedio (período)
  const ticketPromedio = salesEnPeriodo.length > 0 ? totalVentas / salesEnPeriodo.length : 0;

  // Productos vendidos (período)
  const productosVendidos = salesEnPeriodo.reduce((sum, sale) =>
    sum + (sale.items?.reduce((s, i) => s + i.quantity, 0) || 0), 0
  );

  const periodoLabel = periodo === '7' ? 'últimos 7 días' : periodo === '30' ? 'últimos 30 días' : 'últimos 90 días';

  return (
    <div style={{ background: '#f4f6f8', minHeight: '100%', paddingBottom: '2rem' }}>
      <Page
        title={(
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon source={ChartVerticalFilledIcon} tone="base" />
            <span>Informes y estadísticas</span>
          </div>
        ) as any}
        subtitle={`Período: ${periodoLabel} · Última actualización: ${new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}`}
        fullWidth
        secondaryActions={[
          { id: 'analytics-refresh', content: 'Actualizar', icon: RefreshIcon, accessibilityLabel: 'Actualizar', onAction: fetchDashboardData },
        ]}
      >
        <BlockStack gap="400">

          {/* Selector de período */}
          <InlineStack gap="200">
            <ButtonGroup variant="segmented">
              <Button pressed={periodo === '7'} onClick={() => setPeriodo('7')}>7 días</Button>
              <Button pressed={periodo === '30'} onClick={() => setPeriodo('30')}>30 días</Button>
              <Button pressed={periodo === '90'} onClick={() => setPeriodo('90')}>90 días</Button>
            </ButtonGroup>
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
                <Text as="p" variant="bodySm" fontWeight="semibold">Ticket promedio</Text>
                <InlineStack align="start" blockAlign="baseline" gap="200">
                  <Text as="h3" variant="headingLg">{formatCurrency(ticketPromedio)}</Text>
                  <Text as="span" variant="bodySm" tone="subdued">{periodoLabel}</Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card background="bg-surface">
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" fontWeight="semibold">Ventas (transacciones)</Text>
                <InlineStack align="start" blockAlign="baseline" gap="200">
                  <Text as="h3" variant="headingLg">{salesEnPeriodo.length}</Text>
                  <Text as="span" variant="bodySm" tone="subdued">{periodoLabel}</Text>
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
