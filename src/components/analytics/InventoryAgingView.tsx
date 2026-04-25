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
  Box,
  Divider,
} from '@shopify/polaris';
import type { InventoryAgingAnalysis, AgingBucket } from '@/types';
import { fetchInventoryAging } from '@/app/actions/analytics-advanced-actions';

const BUCKET_LABELS: Record<AgingBucket, string> = {
  '0-30': '0-30 días',
  '30-60': '30-60 días',
  '60-90': '60-90 días',
  '90+': '90+ días',
};

const BUCKET_TONES: Record<AgingBucket, 'success' | 'info' | 'warning' | 'critical'> = {
  '0-30': 'success',
  '30-60': 'info',
  '60-90': 'warning',
  '90+': 'critical',
};

function formatMoney(n: number): string {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InventoryAgingView() {
  const [data, setData] = useState<InventoryAgingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, _setFilter] = useState<AgingBucket[]>([]);
  const [queryValue, _setQueryValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchInventoryAging();
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <BlockStack gap="400" inlineAlign="center">
          <Spinner size="large" />
          <Text as="p" variant="bodySm" tone="subdued">
            Analizando inventario…
          </Text>
        </BlockStack>
      </Card>
    );
  }

  if (!data || data.products.length === 0) {
    return (
      <Card>
        <EmptyState heading="Sin datos de inventario" image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-inventory.svg">
          <p>No hay productos con stock para analizar.</p>
        </EmptyState>
      </Card>
    );
  }

  const filtered = data.products.filter((p) => {
    if (filter.length > 0 && !filter.includes(p.bucket)) return false;
    if (queryValue) {
      const q = queryValue.toLowerCase();
      return p.productName.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    }
    return true;
  });

  const headings: [{ title: string }, ...{ title: string }[]] = [
    { title: 'Producto' },
    { title: 'SKU' },
    { title: 'Categoría' },
    { title: 'Stock' },
    { title: 'Costo Unitario' },
    { title: 'Valor Stock' },
    { title: 'Última Venta' },
    { title: 'Antigüedad' },
  ];

  const rowMarkup = filtered.map((p, i) => (
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
      <IndexTable.Cell>{p.currentStock}</IndexTable.Cell>
      <IndexTable.Cell>{formatMoney(p.costPrice)}</IndexTable.Cell>
      <IndexTable.Cell>{formatMoney(p.stockValue)}</IndexTable.Cell>
      <IndexTable.Cell>
        {p.daysSinceLastSale !== null ? `hace ${p.daysSinceLastSale}d` : 'Nunca vendido'}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={BUCKET_TONES[p.bucket]}>{BUCKET_LABELS[p.bucket]}</Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <BlockStack gap="400">
      {/* Summary cards */}
      <InlineStack gap="400" wrap>
        {(Object.keys(BUCKET_LABELS) as AgingBucket[]).map((bucket) => (
          <Box key={bucket} minWidth="180px">
            <Card>
              <BlockStack gap="100">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {BUCKET_LABELS[bucket]}
                  </Text>
                  <Badge tone={BUCKET_TONES[bucket]}>{`${data.buckets[bucket].skuCount} SKU`}</Badge>
                </InlineStack>
                <Text as="p" variant="headingMd">
                  {formatMoney(data.buckets[bucket].value)}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {data.buckets[bucket].count} unidades
                </Text>
              </BlockStack>
            </Card>
          </Box>
        ))}
      </InlineStack>

      <InlineStack gap="300">
        <Card>
          <BlockStack gap="100">
            <Text as="span" variant="bodySm" tone="subdued">
              Valor Total Inventario
            </Text>
            <Text as="p" variant="headingLg">
              {formatMoney(data.totalStockValue)}
            </Text>
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="100">
            <Text as="span" variant="bodySm" tone="subdued">
              Productos Muertos (90+ días)
            </Text>
            <Text as="p" variant="headingLg">
              {data.deadStockCount}
            </Text>
          </BlockStack>
        </Card>
      </InlineStack>

      <Divider />

      {/* Table */}
      <Card padding="0">
        <IndexTable
          resourceName={{ singular: 'producto', plural: 'productos' }}
          itemCount={filtered.length}
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
