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
} from '@shopify/polaris';
import { LineChart } from '@shopify/polaris-viz';
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
    <Page title="Análisis y Métricas" fullWidth>
      <Layout>
        {/* KPIs Principales */}
        <Layout.Section>
          <InlineStack gap="400" wrap>
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">Ventas Hoy</Text>
                <Text as="h2" variant="heading2xl" tone="success">
                  {formatCurrency(ventasHoy)}
                </Text>
                <Text as="p" variant="bodySm">
                  Ayer: {formatCurrency(ventasAyer)}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">Ventas del Mes</Text>
                <Text as="h2" variant="heading2xl" tone="success">
                  {formatCurrency(ventasMesActual)}
                </Text>
                <Text as="p" variant="bodySm">
                  {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">Utilidad Bruta</Text>
                <Text as="h2" variant="heading2xl" tone={utilidadBruta >= 0 ? 'success' : 'critical'}>
                  {formatCurrency(utilidadBruta)}
                </Text>
                <Text as="p" variant="bodySm">Margen: {margenUtilidad.toFixed(1)}%</Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">Ticket Promedio</Text>
                <Text as="h2" variant="heading2xl">
                  {formatCurrency(ticketPromedio)}
                </Text>
                <Text as="p" variant="bodySm">{saleRecords.length} transacciones</Text>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        {/* Gráfica de Ventas */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingMd">Historial de Ventas</Text>
                <Select
                  label=""
                  labelHidden
                  options={[
                    { label: 'Últimos 7 días', value: '7' },
                    { label: 'Últimos 15 días', value: '15' },
                    { label: 'Últimos 30 días', value: '30' },
                    { label: 'Últimos 60 días', value: '60' },
                    { label: 'Últimos 90 días', value: '90' },
                  ]}
                  value={periodo}
                  onChange={setPeriodo}
                />
              </InlineStack>
              <div style={{ height: 300 }}>
                <LineChart
                  data={[
                    {
                      name: 'Ventas',
                      data: ventasPorDia,
                    },
                  ]}
                  theme="Light"
                  xAxisOptions={{
                    labelFormatter: (value) => {
                      const date = new Date(value);
                      return `${date.getDate()}/${date.getMonth() + 1}`;
                    },
                  }}
                  yAxisOptions={{
                    labelFormatter: (value) => formatCurrency(value),
                  }}
                />
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Ventas por Método de Pago */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">Ventas por Método de Pago</Text>
              <div style={{ height: 300 }}>
                <LineChart
                  data={ventasPorMetodo.map(({ metodo, total }) => ({
                    name: metodo,
                    data: [{ key: metodo, value: total }],
                  }))}
                  theme="Light"
                  yAxisOptions={{
                    labelFormatter: (value) => formatCurrency(value),
                  }}
                />
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Top 10 Productos */}
        <Layout.Section oneHalf>
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">Top 10 Productos Más Vendidos</Text>
              <BlockStack gap="300">
                {topProductos.map((producto, index) => (
                  <div key={producto.id}>
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Badge tone={index < 3 ? 'success' : 'info'}>#{index + 1}</Badge>
                        <BlockStack gap="100">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {producto.name}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {producto.quantity} unidades
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {formatCurrency(producto.total)}
                      </Text>
                    </InlineStack>
                    {index < topProductos.length - 1 && <Divider />}
                  </div>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Productos con Stock Bajo */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h3" variant="headingMd">Productos con Stock Bajo</Text>
                <Badge tone="critical">{productosStockBajo.length}</Badge>
              </InlineStack>
              <BlockStack gap="300">
                {productosStockBajo.length === 0 ? (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No hay productos con stock bajo
                  </Text>
                ) : (
                  productosStockBajo.map((producto) => {
                    const porcentaje = (producto.currentStock / producto.minStock) * 100;
                    return (
                      <BlockStack key={producto.id} gap="200">
                        <InlineStack align="space-between">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {producto.name}
                          </Text>
                          <Text as="span" variant="bodyMd">
                            {producto.currentStock} / {producto.minStock}
                          </Text>
                        </InlineStack>
                        <ProgressBar 
                          progress={porcentaje} 
                          size="small" 
                          tone={porcentaje <= 25 ? 'critical' : 'warning'} 
                        />
                      </BlockStack>
                    );
                  })
                )}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Resumen de Mermas */}
        <Layout.Section oneThird>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">Mermas Totales</Text>
              <Text as="h2" variant="headingLg" tone="critical">
                {formatCurrency(totalMermas)}
              </Text>
              <Text as="p" variant="bodySm">{mermaRecords.length} registros</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {totalVentas > 0 ? `${((totalMermas / totalVentas) * 100).toFixed(2)}% de ventas` : '0%'}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Inventario Total */}
        <Layout.Section oneThird>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">Valor de Inventario</Text>
              <Text as="h2" variant="headingLg">
                {formatCurrency(
                  products.reduce((sum, p) => sum + (p.currentStock * parseFloat(p.unitPrice.toString())), 0)
                )}
              </Text>
              <Text as="p" variant="bodySm">{products.length} productos</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {products.reduce((sum, p) => sum + p.currentStock, 0)} unidades totales
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Productos Registrados */}
        <Layout.Section oneThird>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">Catálogo</Text>
              <Text as="h2" variant="headingLg">
                {products.length}
              </Text>
              <Text as="p" variant="bodySm">productos registrados</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {kpiData?.lowStockProducts || 0} con stock bajo
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
