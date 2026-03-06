'use client';

import { useMemo } from 'react';
import { Card, Text, BlockStack, InlineStack, Badge, Box } from '@shopify/polaris';
import dynamic from 'next/dynamic';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';

const BarChart = dynamic(
  () => import('@shopify/polaris-viz').then((mod) => mod.BarChart),
  { ssr: false, loading: () => <div style={{ height: 300 }} /> }
);

const LineChart = dynamic(
  () => import('@shopify/polaris-viz').then((mod) => mod.LineChart),
  { ssr: false, loading: () => <div style={{ height: 300 }} /> }
);

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export function MonthlyProfitChart() {
  const saleRecords = useDashboardStore((s) => s.saleRecords);
  const gastos = useDashboardStore((s) => s.gastos);

  const { monthlyData, currentMonthProfit, previousMonthProfit, profitChange } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Build data for last 6 months
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      });
    }

    const data = months.map(({ year, month, label }) => {
      // Sales for this month
      const monthSales = saleRecords
        .filter((s) => {
          const d = new Date(s.date);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((sum, s) => sum + s.total, 0);

      // Expenses for this month
      const monthExpenses = gastos
        .filter((g) => {
          const d = new Date(g.fecha);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((sum, g) => sum + g.monto, 0);

      const profit = monthSales - monthExpenses;

      return {
        label,
        ventas: monthSales,
        gastos: monthExpenses,
        ganancia: profit,
      };
    });

    const current = data[data.length - 1]?.ganancia ?? 0;
    const previous = data[data.length - 2]?.ganancia ?? 0;
    const change = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;

    return {
      monthlyData: data,
      currentMonthProfit: current,
      previousMonthProfit: previous,
      profitChange: change,
    };
  }, [saleRecords, gastos]);

  const barData = [
    {
      name: 'Ventas',
      color: '#2c6ecb' as const,
      data: monthlyData.map((d) => ({ key: d.label, value: d.ventas })),
    },
    {
      name: 'Gastos',
      color: '#e4555a' as const,
      data: monthlyData.map((d) => ({ key: d.label, value: d.gastos })),
    },
  ];

  const lineData = [
    {
      name: 'Ganancia neta',
      color: '#2e7d32' as const,
      data: monthlyData.map((d) => ({ key: d.label, value: d.ganancia })),
    },
  ];

  const changeTone = profitChange >= 0 ? 'success' : 'critical';
  const changeIcon = profitChange >= 0 ? '↑' : '↓';

  const changeBadgeText = `${changeIcon} ${Math.abs(profitChange).toFixed(1)}%`;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <Text as="h3" variant="headingMd">
              Ganancias Mensuales
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Ventas vs Gastos — Últimos 6 meses
            </Text>
          </BlockStack>
          <BlockStack gap="100" inlineAlign="end">
            <Text as="p" variant="headingLg" fontWeight="bold">
              {formatCurrency(currentMonthProfit)}
            </Text>
            <InlineStack gap="100" blockAlign="center">
              <Badge tone={changeTone}>{changeBadgeText}</Badge>
              <Text as="span" variant="bodySm" tone="subdued">vs mes anterior</Text>
            </InlineStack>
          </BlockStack>
        </InlineStack>

        {/* Bar chart: Ventas vs Gastos */}
        <Box>
          <Text as="p" variant="bodySm" fontWeight="semibold">Ventas vs Gastos</Text>
          <div style={{ height: 250 }}>
            <BarChart
              data={barData}
              theme="Light"
              tooltipOptions={{
                valueFormatter: (value: string | number | null) => formatCurrency(Number(value ?? 0)),
              }}
              yAxisOptions={{
                labelFormatter: (value: string | number | null) =>
                  `$${(Number(value ?? 0) / 1000).toFixed(0)}k`,
              }}
            />
          </div>
        </Box>

        {/* Line chart: Ganancia neta */}
        <Box>
          <Text as="p" variant="bodySm" fontWeight="semibold">Ganancia Neta</Text>
          <div style={{ height: 200 }}>
            <LineChart
              data={lineData}
              theme="Light"
              tooltipOptions={{
                valueFormatter: (value: string | number | null) => formatCurrency(Number(value ?? 0)),
              }}
              yAxisOptions={{
                labelFormatter: (value: string | number | null) =>
                  `$${(Number(value ?? 0) / 1000).toFixed(0)}k`,
              }}
            />
          </div>
        </Box>

        {/* Monthly summary table */}
        <Box padding="200" background="bg-surface-secondary" borderRadius="200">
          <BlockStack gap="200">
            <Text as="p" variant="bodySm" fontWeight="semibold">Resumen por mes</Text>
            {monthlyData.map((d) => (
              <InlineStack key={d.label} align="space-between">
                <Text as="span" variant="bodySm">{d.label}</Text>
                <InlineStack gap="300">
                  <Text as="span" variant="bodySm" tone="subdued">
                    V: {formatCurrency(d.ventas)}
                  </Text>
                  <Text as="span" variant="bodySm" tone="critical">
                    G: {formatCurrency(d.gastos)}
                  </Text>
                  <Text as="span" variant="bodySm" fontWeight="bold" tone={d.ganancia >= 0 ? 'success' : 'critical'}>
                    {formatCurrency(d.ganancia)}
                  </Text>
                </InlineStack>
              </InlineStack>
            ))}
          </BlockStack>
        </Box>
      </BlockStack>
    </Card>
  );
}
