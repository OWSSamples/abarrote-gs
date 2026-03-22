'use client';

import { useMemo } from 'react';
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  DataTable,
  Layout,
  Badge,
  Button,
  Box,
  Select,
} from '@shopify/polaris';
import { ExportIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { generateCSV, downloadFile } from '@/components/export/ExportModal';
import { generatePDF } from '@/components/export/generatePDF';
import { useFinancialReports } from '@/hooks/useFinancialReports';
import type { ReportePeriodo } from '@/hooks/useFinancialReports';
import { IncomeStatementCard } from './IncomeStatementCard';
import { CashFlowCard } from './CashFlowCard';

const periodoOptions = [
  { label: 'Hoy', value: 'today' },
  { label: 'Esta semana', value: 'week' },
  { label: 'Este mes', value: 'month' },
  { label: 'Todo el tiempo', value: 'all' },
];

const periodoLabels: Record<ReportePeriodo, string> = {
  today: 'Hoy',
  week: 'Esta Semana',
  month: 'Este Mes',
  all: 'Todo',
};

export function ReportesView() {
  const saleRecords = useDashboardStore((s) => s.saleRecords);
  const gastos = useDashboardStore((s) => s.gastos);
  const inventoryAlerts = useDashboardStore((s) => s.inventoryAlerts);
  const clientes = useDashboardStore((s) => s.clientes);
  const products = useDashboardStore((s) => s.products);

  const {
    periodo,
    setPeriodo,
    filteredSales,
    estadoResultados,
    margenesPorCategoria,
    flujoMensual,
    maxFlujo,
    ventasPorMetodo,
  } = useFinancialReports(saleRecords, gastos, products);

  // ── Ventas por método — format rows for DataTable ──
  const ventasPorMetodoRows = useMemo(() => {
    const labels: Record<string, string> = {
      efectivo: 'Efectivo',
      tarjeta: 'Tarjeta',
      transferencia: 'Transferencia',
      fiado: 'Fiado',
    };
    return Object.entries(ventasPorMetodo).map(([m, d]) => [
      labels[m] || m,
      formatCurrency(d.total),
      `${d.count}`,
      `${estadoResultados.ingresos > 0 ? ((d.total / estadoResultados.ingresos) * 100).toFixed(1) : '0'}%`,
    ]);
  }, [ventasPorMetodo, estadoResultados.ingresos]);

  // ── Exportar ──
  const handleExportPDF = () => {
    const data: Record<string, unknown>[] = [
      { Concepto: 'INGRESOS POR VENTAS', Monto: formatCurrency(estadoResultados.ingresos) },
      { Concepto: '(-) Costo de Mercancía Vendida', Monto: formatCurrency(estadoResultados.costoMercancia) },
      { Concepto: 'UTILIDAD BRUTA', Monto: formatCurrency(estadoResultados.utilidadBruta) },
      { Concepto: '  Margen Bruto', Monto: `${estadoResultados.margenBruto.toFixed(1)}%` },
      ...Object.entries(estadoResultados.gastosByCategory).map(([cat, monto]) => ({
        Concepto: `  (-) Gastos — ${cat}`,
        Monto: formatCurrency(monto),
      })),
      { Concepto: '(-) Total Gastos Operativos', Monto: formatCurrency(estadoResultados.totalGastos) },
      { Concepto: 'UTILIDAD NETA', Monto: formatCurrency(estadoResultados.utilidadNeta) },
      { Concepto: '  Margen Neto', Monto: `${estadoResultados.margenNeto.toFixed(1)}%` },
    ];
    generatePDF(`Estado de Resultados — ${periodoLabels[periodo]}`, data, `EstadoResultados_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportCSV = () => {
    const data = margenesPorCategoria.map(r => ({
      Categoría: r.cat,
      Ingresos: r.ingresos,
      'Costo de Ventas': r.costo,
      'Utilidad Bruta': r.utilidad,
      'Margen (%)': r.margen.toFixed(1),
      Unidades: r.qty,
    }));
    const csv = generateCSV(data as Record<string, unknown>[], true);
    downloadFile(csv, `MargenesPorCategoria_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
  };

  return (
    <BlockStack gap="500">
      {/* Header con selector de período y botones de exportación */}
      <InlineStack align="space-between" blockAlign="center">
        <Text variant="headingLg" as="h2">Reportes Financieros</Text>
        <InlineStack gap="200" blockAlign="center">
          <Box minWidth="180px">
            <Select
              label="Período"
              labelHidden
              options={periodoOptions}
              value={periodo}
              onChange={(v) => setPeriodo(v as ReportePeriodo)}
            />
          </Box>
          <Button icon={ExportIcon} onClick={handleExportPDF}>PDF</Button>
          <Button icon={ExportIcon} onClick={handleExportCSV} variant="secondary">CSV</Button>
        </InlineStack>
      </InlineStack>

      {/* ── KPIs ── */}
      <Layout>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="100">
              <Text variant="bodySm" tone="subdued" as="p">Ingresos por Ventas</Text>
              <Text variant="headingLg" as="p">{formatCurrency(estadoResultados.ingresos)}</Text>
              <Text variant="bodySm" tone="subdued" as="p">{filteredSales.length} transacciones</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="100">
              <Text variant="bodySm" tone="subdued" as="p">Utilidad Bruta</Text>
              <Text
                variant="headingLg"
                as="p"
                tone={estadoResultados.utilidadBruta >= 0 ? 'success' : 'critical'}
              >
                {formatCurrency(estadoResultados.utilidadBruta)}
              </Text>
              <Badge tone={estadoResultados.margenBruto >= 20 ? 'success' : estadoResultados.margenBruto >= 10 ? 'warning' : 'critical'}>
                {`Margen: ${estadoResultados.margenBruto.toFixed(1)}%`}
              </Badge>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="100">
              <Text variant="bodySm" tone="subdued" as="p">Utilidad Neta</Text>
              <Text
                variant="headingLg"
                as="p"
                tone={estadoResultados.utilidadNeta >= 0 ? 'success' : 'critical'}
              >
                {formatCurrency(estadoResultados.utilidadNeta)}
              </Text>
              <Badge tone={estadoResultados.utilidadNeta >= 0 ? 'success' : 'critical'}>
                {`Margen: ${estadoResultados.margenNeto.toFixed(1)}%`}
              </Badge>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* ── Estado de Resultados Formal ── */}
      <IncomeStatementCard estadoResultados={estadoResultados} />

      {/* ── Flujo de Efectivo Mensual ── */}
      <CashFlowCard flujoMensual={flujoMensual} maxFlujo={maxFlujo} />

      {/* ── Márgenes por Categoría ── */}
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h3">Márgenes por Categoría de Producto</Text>
          {margenesPorCategoria.length > 0 ? (
            <DataTable
              columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'numeric', 'numeric']}
              headings={['Categoría', 'Ingresos', 'Costo de Venta', 'Utilidad Bruta', 'Margen', 'Unidades']}
              rows={margenesPorCategoria.map(r => [
                r.cat,
                formatCurrency(r.ingresos),
                formatCurrency(r.costo),
                <Text
                  key={r.cat}
                  as="span"
                  variant="bodySm"
                  tone={r.utilidad >= 0 ? 'success' : 'critical'}
                >
                  {formatCurrency(r.utilidad)}
                </Text>,
                <Badge
                  key={`${r.cat}-badge`}
                  tone={r.margen >= 20 ? 'success' : r.margen >= 10 ? 'warning' : 'critical'}
                >
                  {`${r.margen.toFixed(1)}%`}
                </Badge>,
                `${r.qty}`,
              ])}
            />
          ) : (
            <Text variant="bodySm" tone="subdued" as="p">Sin ventas en el período seleccionado.</Text>
          )}
        </BlockStack>
      </Card>

      {/* ── Ventas por Método de Pago ── */}
      <Layout>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">Ventas por Método de Pago</Text>
              {filteredSales.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                  headings={['Método', 'Total', 'Operaciones', '% del Total']}
                  rows={ventasPorMetodoRows}
                />
              ) : (
                <Text variant="bodySm" tone="subdued" as="p">Sin ventas en el período.</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">Cartera de Clientes</Text>
              <DataTable
                columnContentTypes={['text', 'numeric']}
                headings={['Indicador', 'Valor']}
                rows={[
                  ['Total clientes', `${clientes.length}`],
                  ['Con deuda activa', `${clientes.filter(c => c.balance > 0).length}`],
                  ['Total deuda por cobrar', formatCurrency(clientes.reduce((s, c) => s + c.balance, 0))],
                  ['Alertas de inventario (bajo stock)', `${inventoryAlerts.filter(a => a.alertType === 'low_stock').length}`],
                  ['Alertas críticas', `${inventoryAlerts.filter(a => a.severity === 'critical').length}`],
                ]}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </BlockStack>
  );
}
