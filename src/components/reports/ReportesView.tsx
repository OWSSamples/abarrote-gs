'use client';

import { useMemo } from 'react';
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  DataTable,
  Badge,
  Button,
  Box,
  Select,
  Divider,
  InlineGrid,
  ProgressBar,
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
  const clientes = useDashboardStore((s) => s.clientes);
  const products = useDashboardStore((s) => s.products);

  const {
    periodo,
    setPeriodo,
    filteredSales,
    estadoResultados,
    margenesPorCategoria,
    flujoMensual,
    ventasPorMetodo,
  } = useFinancialReports(saleRecords, gastos, products);

  // ── Indicadores operativos (contexto del P&L, sin duplicar) ──
  const ticketPromedio = useMemo(
    () => (filteredSales.length > 0 ? estadoResultados.ingresos / filteredSales.length : 0),
    [filteredSales, estadoResultados.ingresos],
  );

  const costoPromedioTx = useMemo(
    () => (filteredSales.length > 0 ? estadoResultados.costoMercancia / filteredSales.length : 0),
    [filteredSales, estadoResultados.costoMercancia],
  );

  const ratioGastos = useMemo(
    () => (estadoResultados.ingresos > 0 ? (estadoResultados.totalGastos / estadoResultados.ingresos) * 100 : 0),
    [estadoResultados],
  );

  // ── Ventas por método — visual display ──
  const ventasPorMetodoDisplay = useMemo(() => {
    const labels: Record<string, string> = {
      efectivo: 'Efectivo',
      tarjeta: 'Tarjeta',
      transferencia: 'Transferencia',
      fiado: 'Fiado',
    };
    const colors: Record<string, string> = {
      efectivo: '#16a34a',
      tarjeta: '#2563eb',
      transferencia: '#7c3aed',
      fiado: '#ea580c',
    };
    return Object.entries(ventasPorMetodo)
      .filter(([, d]) => d.total > 0)
      .map(([metodo, d]) => ({
        label: labels[metodo] || metodo,
        total: d.total,
        count: d.count,
        pct: estadoResultados.ingresos > 0 ? (d.total / estadoResultados.ingresos) * 100 : 0,
        color: colors[metodo] || '#6b7280',
      }))
      .sort((a, b) => b.total - a.total);
  }, [ventasPorMetodo, estadoResultados.ingresos]);

  // ── Cartera de crédito ──
  const clienteStats = useMemo(() => {
    const totalDeuda = clientes.reduce((s, c) => s + Math.max(0, c.balance), 0);
    const conDeuda = clientes.filter((c) => c.balance > 0).length;
    return { totalClientes: clientes.length, conDeuda, totalDeuda };
  }, [clientes]);

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
    generatePDF(
      `Estado de Resultados — ${periodoLabels[periodo]}`,
      data,
      `EstadoResultados_${new Date().toISOString().split('T')[0]}.pdf`,
    );
  };

  const handleExportCSV = () => {
    const data = margenesPorCategoria.map((r) => ({
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
    <BlockStack gap="600">
      {/* ═══ HERO: RESUMEN EJECUTIVO ═══ */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingLg" fontWeight="bold">
                Resumen Ejecutivo
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Visión general de rentabilidad y salud financiera
              </Text>
            </BlockStack>
            <InlineStack gap="200" blockAlign="center">
              <Badge tone="info">{periodoLabels[periodo]}</Badge>
              <Box minWidth="160px">
                <Select
                  label="Período"
                  labelHidden
                  options={periodoOptions}
                  value={periodo}
                  onChange={(v) => setPeriodo(v as ReportePeriodo)}
                />
              </Box>
              <Button icon={ExportIcon} onClick={handleExportPDF}>
                PDF
              </Button>
              <Button icon={ExportIcon} onClick={handleExportCSV} variant="secondary">
                CSV
              </Button>
            </InlineStack>
          </InlineStack>
          <Divider />
          <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="050">
                <Text as="p" variant="bodyXs" tone="subdued">
                  Ingresos
                </Text>
                <Text as="p" variant="headingMd" fontWeight="bold">
                  {formatCurrency(estadoResultados.ingresos)}
                </Text>
              </BlockStack>
            </Box>
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="050">
                <Text as="p" variant="bodyXs" tone="subdued">
                  Utilidad Neta
                </Text>
                <Text as="p" variant="headingMd" fontWeight="bold" tone={estadoResultados.utilidadNeta >= 0 ? 'success' : 'critical'}>
                  {formatCurrency(estadoResultados.utilidadNeta)}
                </Text>
              </BlockStack>
            </Box>
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="050">
                <Text as="p" variant="bodyXs" tone="subdued">
                  Margen Neto
                </Text>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" variant="headingMd" fontWeight="bold">
                    {estadoResultados.margenNeto.toFixed(1)}%
                  </Text>
                  <Badge tone={estadoResultados.margenNeto >= 15 ? 'success' : estadoResultados.margenNeto >= 5 ? 'warning' : 'critical'}>
                    {estadoResultados.margenNeto >= 15 ? 'Saludable' : estadoResultados.margenNeto >= 5 ? 'Ajustado' : 'Riesgo'}
                  </Badge>
                </InlineStack>
              </BlockStack>
            </Box>
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="050">
                <Text as="p" variant="bodyXs" tone="subdued">
                  Transacciones
                </Text>
                <Text as="p" variant="headingMd" fontWeight="bold">
                  {filteredSales.length.toLocaleString('es-MX')}
                </Text>
              </BlockStack>
            </Box>
          </InlineGrid>
        </BlockStack>
      </Card>

      {/* ═══ CHAPTER 1: ESTADO DE RESULTADOS + INDICADORES ═══ */}
      <InlineGrid columns={{ xs: 1, md: '2fr 1fr' }} gap="400">
        <IncomeStatementCard estadoResultados={estadoResultados} />
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="h3" variant="headingMd" fontWeight="bold">
                Indicadores Operativos
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Métricas de eficiencia del negocio
              </Text>
            </BlockStack>
            <Divider />
            <BlockStack gap="300">
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="050">
                  <Text as="p" variant="bodyXs" tone="subdued">
                    Ticket Promedio
                  </Text>
                  <Text as="p" variant="headingSm" fontWeight="bold">
                    {formatCurrency(ticketPromedio)}
                  </Text>
                </BlockStack>
              </Box>
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="050">
                  <Text as="p" variant="bodyXs" tone="subdued">
                    Costo Promedio / Transacción
                  </Text>
                  <Text as="p" variant="headingSm" fontWeight="bold">
                    {formatCurrency(costoPromedioTx)}
                  </Text>
                </BlockStack>
              </Box>
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="050">
                  <Text as="p" variant="bodyXs" tone="subdued">
                    Ratio Gastos / Ingresos
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="headingSm" fontWeight="bold">
                      {ratioGastos.toFixed(1)}%
                    </Text>
                    <Badge tone={ratioGastos <= 30 ? 'success' : ratioGastos <= 50 ? 'warning' : 'critical'}>
                      {ratioGastos <= 30 ? 'Eficiente' : ratioGastos <= 50 ? 'Moderado' : 'Alto'}
                    </Badge>
                  </InlineStack>
                </BlockStack>
              </Box>
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="100">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodyXs" tone="subdued">
                      Margen Bruto
                    </Text>
                    <Text as="p" variant="bodySm" fontWeight="bold">
                      {estadoResultados.margenBruto.toFixed(1)}%
                    </Text>
                  </InlineStack>
                  <ProgressBar
                    progress={Math.min(estadoResultados.margenBruto, 100)}
                    tone={estadoResultados.margenBruto >= 20 ? 'success' : 'critical'}
                    size="small"
                  />
                </BlockStack>
              </Box>
            </BlockStack>
          </BlockStack>
        </Card>
      </InlineGrid>

      {/* ═══ CHAPTER 2: FLUJO DE EFECTIVO (6 MESES) ═══ */}
      <CashFlowCard flujoMensual={flujoMensual} />

      {/* ═══ CHAPTER 3: MÁRGENES POR CATEGORÍA ═══ */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h3" variant="headingMd" fontWeight="bold">
                Márgenes por Categoría
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Rentabilidad desglosada por línea de producto
              </Text>
            </BlockStack>
            <Badge>{`${margenesPorCategoria.length} categorías`}</Badge>
          </InlineStack>
          <Divider />
          {margenesPorCategoria.length > 0 ? (
            <DataTable
              columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'numeric', 'numeric']}
              headings={['Categoría', 'Ingresos', 'Costo', 'Utilidad', 'Margen', 'Unidades']}
              rows={margenesPorCategoria.map((r) => [
                r.cat,
                formatCurrency(r.ingresos),
                formatCurrency(r.costo),
                <Text key={r.cat} as="span" variant="bodySm" tone={r.utilidad >= 0 ? 'success' : 'critical'}>
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
            <Box padding="800">
              <Text as="p" tone="subdued" alignment="center">
                Sin ventas en el período seleccionado.
              </Text>
            </Box>
          )}
        </BlockStack>
      </Card>

      {/* ═══ CHAPTER 4: COMPOSICIÓN + CARTERA ═══ */}
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        {/* Ventas por método de pago */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h3" variant="headingMd" fontWeight="bold">
                  Composición de Ingresos
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Distribución por método de pago
                </Text>
              </BlockStack>
              <Badge tone="info">{`${filteredSales.length} ventas`}</Badge>
            </InlineStack>
            <Divider />
            {ventasPorMetodoDisplay.length === 0 ? (
              <Box padding="600">
                <Text as="p" tone="subdued" alignment="center">
                  Sin ventas en el período.
                </Text>
              </Box>
            ) : (
              <BlockStack gap="400">
                {ventasPorMetodoDisplay.map((m) => (
                  <BlockStack key={m.label} gap="150">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background: m.color,
                            flexShrink: 0,
                          }}
                        />
                        <Text as="span" variant="bodySm" fontWeight="medium">
                          {m.label}
                        </Text>
                        <Text as="span" variant="bodyXs" tone="subdued">
                          {m.count} ops
                        </Text>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="span" variant="bodySm" fontWeight="semibold">
                          {formatCurrency(m.total)}
                        </Text>
                        <div
                          style={{
                            background: `${m.color}18`,
                            color: m.color,
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {m.pct.toFixed(1)}%
                        </div>
                      </InlineStack>
                    </InlineStack>
                    <div
                      style={{
                        height: 5,
                        background: '#f1f5f9',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${m.pct}%`,
                          height: '100%',
                          background: m.color,
                          borderRadius: 3,
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                  </BlockStack>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {/* Cartera de crédito */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h3" variant="headingMd" fontWeight="bold">
                  Cartera de Crédito
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Estado de cuentas por cobrar
                </Text>
              </BlockStack>
              <Badge tone={clienteStats.conDeuda > 0 ? 'attention' : 'success'}>
                {clienteStats.conDeuda > 0 ? `${clienteStats.conDeuda} con deuda` : 'Sin deuda'}
              </Badge>
            </InlineStack>
            <Divider />
            <InlineGrid columns={2} gap="300">
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="050">
                  <Text as="p" variant="bodyXs" tone="subdued">
                    Total Clientes
                  </Text>
                  <Text as="p" variant="headingSm" fontWeight="bold">
                    {clienteStats.totalClientes}
                  </Text>
                </BlockStack>
              </Box>
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="050">
                  <Text as="p" variant="bodyXs" tone="subdued">
                    Con Deuda Activa
                  </Text>
                  <Text
                    as="p"
                    variant="headingSm"
                    fontWeight="bold"
                    tone={clienteStats.conDeuda > 0 ? 'critical' : 'success'}
                  >
                    {clienteStats.conDeuda}
                  </Text>
                </BlockStack>
              </Box>
            </InlineGrid>
            <Box
              padding="300"
              background={clienteStats.totalDeuda > 0 ? 'bg-fill-critical-secondary' : 'bg-fill-success-secondary'}
              borderRadius="200"
            >
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="bodySm" fontWeight="bold">
                  Saldo Total por Cobrar
                </Text>
                <Text
                  as="p"
                  variant="headingSm"
                  fontWeight="bold"
                  tone={clienteStats.totalDeuda > 0 ? 'critical' : 'success'}
                >
                  {formatCurrency(clienteStats.totalDeuda)}
                </Text>
              </InlineStack>
            </Box>
          </BlockStack>
        </Card>
      </InlineGrid>
    </BlockStack>
  );
}
