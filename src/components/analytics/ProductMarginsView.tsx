'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  IndexTable,
  Badge,
  Button,
  Spinner,
  EmptyState,
  Select,
  Box,
  Divider,
  ProgressBar,
} from '@shopify/polaris';
import type { ProductMarginReport } from '@/types';
import { fetchProductMargins } from '@/app/actions/analytics-advanced-actions';

function formatMoney(n: number): string {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function marginTone(margin: number): 'success' | 'attention' | 'critical' {
  if (margin >= 30) return 'success';
  if (margin >= 15) return 'attention';
  return 'critical';
}

const PERIOD_OPTIONS = [
  { label: 'Últimos 7 días', value: '7' },
  { label: 'Últimos 30 días', value: '30' },
  { label: 'Últimos 90 días', value: '90' },
];

export function ProductMarginsView() {
  const [data, setData] = useState<ProductMarginReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchProductMargins(Number(period));
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <BlockStack gap="400" inlineAlign="center">
          <Spinner size="large" />
          <Text as="p" variant="bodySm" tone="subdued">
            Calculando márgenes…
          </Text>
        </BlockStack>
      </Card>
    );
  }

  if (!data || data.products.length === 0) {
    return (
      <Card>
        <EmptyState heading="Sin ventas en el período" image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-sales.svg">
          <p>No hay datos de ventas para calcular márgenes.</p>
        </EmptyState>
      </Card>
    );
  }

  const headings: [{ title: string }, ...{ title: string }[]] = [
    { title: 'Producto' },
    { title: 'SKU' },
    { title: 'Categoría' },
    { title: 'Costo' },
    { title: 'Precio' },
    { title: 'Margen %' },
    { title: 'Uds. Vendidas' },
    { title: 'Ingreso' },
    { title: 'Utilidad' },
  ];

  const rowMarkup = data.products.map((p, i) => (
    <IndexTable.Row id={p.productId} key={p.productId} position={i}>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {p.productName}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {p.sku}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{p.category}</IndexTable.Cell>
      <IndexTable.Cell>{formatMoney(p.costPrice)}</IndexTable.Cell>
      <IndexTable.Cell>{formatMoney(p.unitPrice)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={marginTone(p.marginPercent)}>{`${p.marginPercent}%`}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{p.unitsSold}</IndexTable.Cell>
      <IndexTable.Cell>{formatMoney(p.totalRevenue)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone={p.totalProfit >= 0 ? 'success' : 'critical'}>
          {formatMoney(p.totalProfit)}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <BlockStack gap="400">
      <InlineStack align="end">
        <Box minWidth="200px">
          <Select label="" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </Box>
      </InlineStack>

      {/* Summary */}
      <InlineStack gap="400" wrap>
        <Box minWidth="180px">
          <Card>
            <BlockStack gap="100">
              <Text as="span" variant="bodySm" tone="subdued">
                Ingresos Totales
              </Text>
              <Text as="p" variant="headingMd">
                {formatMoney(data.summary.totalRevenue)}
              </Text>
            </BlockStack>
          </Card>
        </Box>
        <Box minWidth="180px">
          <Card>
            <BlockStack gap="100">
              <Text as="span" variant="bodySm" tone="subdued">
                Costo Total
              </Text>
              <Text as="p" variant="headingMd">
                {formatMoney(data.summary.totalCost)}
              </Text>
            </BlockStack>
          </Card>
        </Box>
        <Box minWidth="180px">
          <Card>
            <BlockStack gap="100">
              <Text as="span" variant="bodySm" tone="subdued">
                Utilidad Bruta
              </Text>
              <Text as="p" variant="headingMd" tone="success">
                {formatMoney(data.summary.totalProfit)}
              </Text>
            </BlockStack>
          </Card>
        </Box>
        <Box minWidth="180px">
          <Card>
            <BlockStack gap="100">
              <Text as="span" variant="bodySm" tone="subdued">
                Margen Promedio
              </Text>
              <Text as="p" variant="headingMd">
                <Badge tone={marginTone(data.summary.avgMargin)}>{`${data.summary.avgMargin}%`}</Badge>
              </Text>
            </BlockStack>
          </Card>
        </Box>
      </InlineStack>

      {/* By Category */}
      {data.byCategory.length > 0 && (
        <Card>
          <BlockStack gap="300">
            <Text as="h3" variant="headingSm">
              Margen por Categoría
            </Text>
            <Divider />
            {data.byCategory.map((cat) => (
              <Box key={cat.category} paddingBlockStart="100" paddingBlockEnd="100">
                <BlockStack gap="100">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {cat.category}
                    </Text>
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" tone="subdued">
                        {formatMoney(cat.profit)} utilidad
                      </Text>
                      <Badge tone={marginTone(cat.margin)}>{`${cat.margin}%`}</Badge>
                    </InlineStack>
                  </InlineStack>
                  <ProgressBar
                    progress={Math.min(cat.margin, 100)}
                    tone={cat.margin >= 15 ? 'success' : 'critical'}
                    size="small"
                  />
                </BlockStack>
              </Box>
            ))}
          </BlockStack>
        </Card>
      )}

      <Divider />

      {/* Product table */}
      <Card padding="0">
        <IndexTable
          resourceName={{ singular: 'producto', plural: 'productos' }}
          itemCount={data.products.length}
          headings={headings}
          selectable={false}
          hasMoreItems={false}
        >
          {rowMarkup}
        </IndexTable>
      </Card>

      <InlineStack align="end">
        <Button onClick={load} loading={loading}>
          Actualizar
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
