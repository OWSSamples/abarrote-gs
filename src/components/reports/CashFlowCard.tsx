'use client';

import { useMemo } from 'react';
import { Card, Text, BlockStack, InlineStack, DataTable, Divider, Badge, Box, InlineGrid, ProgressBar } from '@shopify/polaris';
import { formatCurrency } from '@/lib/utils';
import type { FlujoMensualItem } from '@/hooks/useFinancialReports';

interface CashFlowCardProps {
  flujoMensual: FlujoMensualItem[];
}

export function CashFlowCard({ flujoMensual }: CashFlowCardProps) {
  const totals = useMemo(() => {
    const ingresos = flujoMensual.reduce((s, m) => s + m.ingresos, 0);
    const egresos = flujoMensual.reduce((s, m) => s + m.egresos, 0);
    return { ingresos, egresos, neto: ingresos - egresos };
  }, [flujoMensual]);

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <Text as="h3" variant="headingMd" fontWeight="bold">
              Flujo de Efectivo — Últimos 6 Meses
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Tendencia de ingresos vs egresos para evaluar liquidez
            </Text>
          </BlockStack>
          <Badge tone={totals.neto >= 0 ? 'success' : 'critical'}>
            {`Neto: ${formatCurrency(totals.neto)}`}
          </Badge>
        </InlineStack>

        {/* Summary tiles */}
        <InlineGrid columns={3} gap="300">
          <Box padding="300" background="bg-fill-success-secondary" borderRadius="200">
            <BlockStack gap="050">
              <Text as="p" variant="bodyXs" tone="subdued">
                Ingresos Totales
              </Text>
              <Text as="p" variant="headingSm" fontWeight="bold" tone="success">
                {formatCurrency(totals.ingresos)}
              </Text>
            </BlockStack>
          </Box>
          <Box padding="300" background="bg-fill-critical-secondary" borderRadius="200">
            <BlockStack gap="050">
              <Text as="p" variant="bodyXs" tone="subdued">
                Egresos Totales
              </Text>
              <Text as="p" variant="headingSm" fontWeight="bold" tone="critical">
                {formatCurrency(totals.egresos)}
              </Text>
            </BlockStack>
          </Box>
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="050">
              <Text as="p" variant="bodyXs" tone="subdued">
                Flujo Neto
              </Text>
              <Text as="p" variant="headingSm" fontWeight="bold" tone={totals.neto >= 0 ? 'success' : 'critical'}>
                {formatCurrency(totals.neto)}
              </Text>
            </BlockStack>
          </Box>
        </InlineGrid>

        <CashFlowBars data={flujoMensual} />

        <Divider />

        {/* DataTable detail */}
        <DataTable
          columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
          headings={['Mes', 'Ingresos', 'Egresos', 'Utilidad']}
          rows={flujoMensual.map((m) => [
            m.label,
            formatCurrency(m.ingresos),
            formatCurrency(m.egresos),
            <Text key={m.label} as="span" variant="bodySm" tone={m.utilidad >= 0 ? 'success' : 'critical'}>
              {formatCurrency(m.utilidad)}
            </Text>,
          ])}
        />
      </BlockStack>
    </Card>
  );
}

function CashFlowBars({ data }: { data: FlujoMensualItem[] }) {
  const max = Math.max(...data.flatMap((m) => [m.ingresos, m.egresos]), 1);

  return (
    <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="300">
      {data.map((month) => {
        const ingresosProgress = Math.max(0, Math.min(100, Math.round((month.ingresos / max) * 100)));
        const egresosProgress = Math.max(0, Math.min(100, Math.round((month.egresos / max) * 100)));
        return (
          <Box key={month.label} padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="200">
              <Text as="p" variant="headingSm" fontWeight="bold">{month.label}</Text>
              <BlockStack gap="100">
                <InlineStack align="space-between">
                  <Text as="p" variant="bodyXs" tone="subdued">Ingresos</Text>
                  <Text as="p" variant="bodyXs" tone="success">{formatCurrency(month.ingresos)}</Text>
                </InlineStack>
                <ProgressBar progress={ingresosProgress} size="small" tone="success" />
              </BlockStack>
              <BlockStack gap="100">
                <InlineStack align="space-between">
                  <Text as="p" variant="bodyXs" tone="subdued">Egresos</Text>
                  <Text as="p" variant="bodyXs" tone="critical">{formatCurrency(month.egresos)}</Text>
                </InlineStack>
                <ProgressBar progress={egresosProgress} size="small" tone="critical" />
              </BlockStack>
            </BlockStack>
          </Box>
        );
      })}
    </InlineGrid>
  );
}
