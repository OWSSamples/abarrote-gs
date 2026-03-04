'use client';

import { Card, Text, BlockStack } from '@shopify/polaris';
import dynamic from 'next/dynamic';
import { SalesData } from '@/types';
import { formatCurrency } from '@/lib/utils';

const LineChart = dynamic(
  () => import('@shopify/polaris-viz').then((mod) => mod.LineChart),
  { ssr: false, loading: () => <div style={{ height: 300 }} /> }
);

interface SalesChartProps {
  data: SalesData[];
}

export function SalesChart({ data }: SalesChartProps) {
  const chartData = [
    {
      name: 'Esta semana',
      color: '#2c6ecb' as const,
      data: data.map((d) => ({
        key: d.date,
        value: d.currentWeek,
      })),
    },
    {
      name: 'Semana anterior',
      color: '#8c9196' as const,
      isComparison: true,
      data: data.map((d) => ({
        key: d.date,
        value: d.previousWeek,
      })),
    },
  ];

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h3" variant="headingMd">
          Tendencia de Ventas
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Comparativa: Esta semana vs Semana anterior
        </Text>

        <div style={{ height: 300 }}>
          <LineChart
            data={chartData}
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
      </BlockStack>
    </Card>
  );
}
