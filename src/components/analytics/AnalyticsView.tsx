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
  Divider,
  Select,
  TextField,
  Box,
  Icon,
  InlineGrid,
  Button,
  ButtonGroup,
  Popover,
  DatePicker,
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
import { LineChart, BarChart } from '@shopify/polaris-viz';
import { useI18n } from '@shopify/react-i18n';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { useEffect } from 'react';

export function AnalyticsView() {
  const [i18n] = useI18n();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const saleRecords = useDashboardStore((s) => s.saleRecords);
  const products = useDashboardStore((s) => s.products);
  const gastos = useDashboardStore((s) => s.gastos);
  const mermaRecords = useDashboardStore((s) => s.mermaRecords);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);
  const [periodo, setPeriodo] = useState('30');
  const [selectedDayLine, setSelectedDayLine] = useState(new Intl.DateTimeFormat('en-CA').format(new Date()));
  const [popoverActive, setPopoverActive] = useState(false);
  const [{ month, year }, setDateNav] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
  });

  const getLocalDateStr = (d: Date | string) => {
    return new Intl.DateTimeFormat('en-CA').format(new Date(d));
  };

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
    const hoy = getLocalDateStr(new Date());
    return saleRecords
      .filter(s => getLocalDateStr(s.date) === hoy)
      .reduce((sum, s) => sum + parseFloat(s.total.toString()), 0);
  }, [saleRecords]);

  // Ventas de ayer
  const ventasAyer = useMemo(() => {
    const ayerDate = new Date();
    ayerDate.setDate(ayerDate.getDate() - 1);
    const ayerStr = getLocalDateStr(ayerDate);
    return saleRecords
      .filter(s => getLocalDateStr(s.date) === ayerStr)
      .reduce((sum, s) => sum + parseFloat(s.total.toString()), 0);
  }, [saleRecords]);

  // Análisis de un día específico (Explorador)
  const statsDiaSeleccionado = useMemo(() => {
    const dailySales = saleRecords.filter(s => getLocalDateStr(s.date) === selectedDayLine);
    
    let ingresos = 0;
    let costoTotal = 0;
    const productosMap: Record<string, { name: string, qty: number, profit: number }> = {};

    dailySales.forEach(sale => {
      ingresos += parseFloat(sale.total.toString());
      sale.items?.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const cost = prod ? prod.costPrice : 0;
        costoTotal += (cost * item.quantity);
        
        if (!productosMap[item.productId]) {
          productosMap[item.productId] = { name: item.productName, qty: 0, profit: 0 };
        }
        productosMap[item.productId].qty += item.quantity;
        productosMap[item.productId].profit += (item.unitPrice - cost) * item.quantity;
      });
    });

    const gananciaNeta = ingresos - costoTotal;
    const topGanancia = Object.entries(productosMap)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    return { ingresos, gananciaNeta, count: dailySales.length, topGanancia };
  }, [saleRecords, products, selectedDayLine]);

  // Ventas y conteo por día en el período (gráfica)
  const datosPorDia = useMemo(() => {
    const dias = parseInt(periodo);
    const fechas = Array.from({ length: dias }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (dias - 1 - i));
      return getLocalDateStr(date);
    });

    const agrupado = salesEnPeriodo.reduce((acc, sale) => {
      const fecha = getLocalDateStr(sale.date);
      if (!acc[fecha]) acc[fecha] = { total: 0, count: 0 };
      acc[fecha].total += parseFloat(String(sale.total || 0));
      acc[fecha].count += 1;
      return acc;
    }, {} as Record<string, { total: number, count: number }>);

    return fechas.map(fecha => ({
      fecha,
      total: agrupado[fecha]?.total || 0,
      ticketPromedio: agrupado[fecha]?.count > 0 ? agrupado[fecha].total / agrupado[fecha].count : 0,
    }));
  }, [salesEnPeriodo, periodo]);

  const ventasPorDia = useMemo(() => 
    datosPorDia.map(d => ({ key: d.fecha, value: d.total })),
  [datosPorDia]);

  const ticketPromedioPorDia = useMemo(() => 
    datosPorDia.map(d => ({ key: d.fecha, value: d.ticketPromedio })),
  [datosPorDia]);

  // Ventas por método de pago (en período)
  const ventasPorMetodo = useMemo(() => {
    if (!salesEnPeriodo.length) return [];
    
    const metodos = salesEnPeriodo.reduce((acc, sale) => {
      const metodo = sale.paymentMethod || 'Otros';
      const val = parseFloat(String(sale.total || 0));
      if (!isNaN(val)) {
        acc[metodo] = (acc[metodo] || 0) + val;
      }
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
  }, [salesEnPeriodo]);

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

  if (!mounted) {
    return (
      <div style={{ background: '#f4f6f8', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text as="p" tone="subdued">Cargando analíticas...</Text>
      </div>
    );
  }

  return (
    <div style={{ background: '#f4f6f8', minHeight: '100%', paddingBottom: '2rem' }}>
      <Page
        title={(
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon source={ChartVerticalFilledIcon} tone="base" />
            <span>Informes y estadísticas</span>
          </div>
        ) as any}
        subtitle={`Período: ${periodoLabel} · Última actualización: ${i18n.formatDate(new Date(), { hour: 'numeric', minute: '2-digit' })}`}
        fullWidth
        secondaryActions={[
          { id: 'analytics-refresh', content: 'Actualizar', icon: RefreshIcon, accessibilityLabel: 'Actualizar', onAction: fetchDashboardData },
        ]}
      >
        <BlockStack gap="400">

          {/* Selector de periodo y Explorador Diario */}
          <InlineStack align="space-between">
            <ButtonGroup variant="segmented">
              <Button pressed={periodo === '7'} onClick={() => setPeriodo('7')}>7 días</Button>
              <Button pressed={periodo === '30'} onClick={() => setPeriodo('30')}>30 días</Button>
              <Button pressed={periodo === '90'} onClick={() => setPeriodo('90')}>90 días</Button>
            </ButtonGroup>

            <Popover
              active={popoverActive}
              activator={
                <div style={{ width: '220px' }}>
                  <TextField
                    label="Fecha de análisis"
                    labelHidden
                    value={i18n.formatDate(new Date(selectedDayLine + 'T12:00:00'), { day: '2-digit', month: 'long', year: 'numeric' })}
                    onFocus={() => setPopoverActive(true)}
                    autoComplete="off"
                    prefix={<Icon source={CalendarIcon} />}
                  />
                </div>
              }
              onClose={() => setPopoverActive(false)}
            >
              <Box padding="400">
                <DatePicker
                  month={month}
                  year={year}
                  selected={new Date(selectedDayLine + 'T12:00:00')}
                  onMonthChange={(m, y) => setDateNav({ month: m, year: y })}
                  onChange={(range) => {
                    const d = range.start;
                    const dateStr = new Intl.DateTimeFormat('en-CA').format(d);
                    setSelectedDayLine(dateStr);
                    setPopoverActive(false);
                  }}
                />
              </Box>
            </Popover>
          </InlineStack>

          {/* NUEVO: Panel de Ganancia Diaria */}
          <Card background="bg-surface-secondary">
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingMd">Resultados del día: {i18n.formatDate(new Date(selectedDayLine + 'T12:00:00'), { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
                  <Text as="p" tone="subdued">Análisis detallado de rentabilidad y flujo de caja.</Text>
                </BlockStack>
                <Badge tone={statsDiaSeleccionado.gananciaNeta > 0 ? 'success' : 'attention'}>
                  {statsDiaSeleccionado.gananciaNeta > 0 ? 'Día Rentable' : 'Revisar Márgenes'}
                </Badge>
              </InlineStack>

              <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
                <Box padding="300" background="bg-surface" borderRadius="200" shadow="100">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Ingreso Total (Bruto)</Text>
                    <Text as="h2" variant="headingLg">{i18n.formatCurrency(statsDiaSeleccionado.ingresos, { currency: 'MXN' })}</Text>
                    <Text as="p" variant="bodyXs" tone="subdued">{statsDiaSeleccionado.count} transacciones</Text>
                  </BlockStack>
                </Box>
                <Box padding="300" background="bg-surface" borderRadius="200" shadow="100" borderInlineStartWidth="050" borderColor="border-success">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Ganancia Real (Utilidad)</Text>
                    <Text as="h2" variant="headingLg" tone="success">{i18n.formatCurrency(statsDiaSeleccionado.gananciaNeta, { currency: 'MXN' })}</Text>
                    <Text as="p" variant="bodyXs" tone="subdued">Venta minus Costo de adquisición</Text>
                  </BlockStack>
                </Box>
                <Box padding="300" background="bg-surface" borderRadius="200" shadow="100">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Productos con mejor margen hoy</Text>
                    <BlockStack gap="100">
                      {statsDiaSeleccionado.topGanancia.length > 0 ? statsDiaSeleccionado.topGanancia.slice(0,2).map(p => (
                        <InlineStack key={p.id} align="space-between">
                          <Text as="span" variant="bodyXs" truncate>{p.name}</Text>
                          <Text as="span" variant="bodyXs" fontWeight="bold">+{i18n.formatCurrency(p.profit, { currency: 'MXN' })}</Text>
                        </InlineStack>
                      )) : <Text as="p" variant="bodyXs" tone="subdued">Sin datos</Text>}
                    </BlockStack>
                  </BlockStack>
                </Box>
              </InlineGrid>
            </BlockStack>
          </Card>

          {/* ROW 1: KPIs Principales */}
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            <Card background="bg-surface">
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" fontWeight="semibold">Ventas brutas</Text>
                <InlineStack align="start" blockAlign="baseline" gap="200">
                  <Text as="h3" variant="headingLg">{i18n.formatCurrency(totalVentas, { currency: 'MXN' })}</Text>
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
                  <Text as="h3" variant="headingLg">{i18n.formatCurrency(ticketPromedio, { currency: 'MXN' })}</Text>
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
                    <Text as="h2" variant="headingXl">{i18n.formatCurrency(totalVentas, { currency: 'MXN' })}</Text>
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
                        labelFormatter: (value) => i18n.formatCurrency(Number(value ?? 0), { currency: 'MXN', precision: 0 }),
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
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{i18n.formatCurrency(totalVentas, { currency: 'MXN' })}</Text>
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
                          <Text as="span" variant="bodyMd" fontWeight="semibold">{i18n.formatCurrency(totalVentas, { currency: 'MXN' })}</Text>
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
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{i18n.formatCurrency(totalVentas, { currency: 'MXN' })}</Text>
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
                      <BarChart
                        data={[{
                          name: 'Ingresos por método',
                          data: ventasPorMetodo.map(({ metodo, total }) => ({
                            key: metodo || 'Otro',
                            value: Number(total || 0),
                          })),
                        }]}
                        horizontal
                        xAxisOptions={{ 
                          labelFormatter: (value) => i18n.formatCurrency(Number(value || 0), { currency: 'MXN', precision: 0 })
                        }}
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
                    <Text as="h2" variant="headingXl">{i18n.formatCurrency(ticketPromedio, { currency: 'MXN' })}</Text>
                    <Text as="span" variant="bodySm" tone="subdued">—</Text>
                  </InlineStack>
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {datosPorDia.length === 0 ? (
                      <Text as="p" tone="subdued">No hay datos para este rango de fechas</Text>
                    ) : (
                      <LineChart
                        data={[{ name: 'Promedio de ticket', data: ticketPromedioPorDia }]}
                        theme="Light"
                        xAxisOptions={{ labelFormatter: () => '' }}
                        yAxisOptions={{ 
                          labelFormatter: (value) => i18n.formatCurrency(Number(value || 0), { currency: 'MXN', precision: 0 })
                        }}
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
                                <Text as="span" variant="bodyMd" fontWeight="semibold">{i18n.formatCurrency(producto.total, { currency: 'MXN' })}</Text>
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
