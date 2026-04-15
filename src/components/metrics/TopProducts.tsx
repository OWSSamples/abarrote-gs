'use client';

import { Card, Text, BlockStack, InlineStack, Box, Divider } from '@shopify/polaris';
import { formatCurrency } from '@/lib/utils';

interface TopProduct {
  id: string;
  name: string;
  sku: string;
  unitsSold: number;
  revenue: number;
  margin: number;
  trend: 'up' | 'down' | 'stable';
}

interface TopProductsProps {
  products?: TopProduct[];
  title?: string;
  period?: string;
}

const defaultTopProducts: TopProduct[] = [
  { id: '1', name: 'Coca-Cola 600ml', sku: 'BEB-001', unitsSold: 245, revenue: 4165, margin: 22, trend: 'up' },
  { id: '2', name: 'Leche Entera 1L', sku: 'LAC-001', unitsSold: 180, revenue: 5130, margin: 15, trend: 'up' },
  { id: '3', name: 'Pan Blanco Bimbo', sku: 'PAN-001', unitsSold: 156, revenue: 5460, margin: 18, trend: 'stable' },
  { id: '4', name: 'Huevo Blanco 1kg', sku: 'HUE-001', unitsSold: 142, revenue: 7384, margin: 12, trend: 'up' },
  { id: '5', name: 'Sabritas Original', sku: 'BOT-001', unitsSold: 128, revenue: 2560, margin: 35, trend: 'down' },
];

export function TopProducts({ products = defaultTopProducts, title = 'Top Productos', period = 'Hoy' }: TopProductsProps) {
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const maxRevenue = Math.max(...products.map((p) => p.revenue));

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingSm" fontWeight="semibold">
            {title}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {period}
          </Text>
        </InlineStack>

        {/* Column headers */}
        <Box paddingInlineStart="200" paddingInlineEnd="200">
          <InlineStack align="space-between">
            <Text as="span" variant="bodyXs" tone="subdued">Producto</Text>
            <InlineStack gap="600">
              <Text as="span" variant="bodyXs" tone="subdued">Uds</Text>
              <Box minWidth="80px">
                <Text as="span" variant="bodyXs" tone="subdued" alignment="end">Ingreso</Text>
              </Box>
            </InlineStack>
          </InlineStack>
        </Box>

        <Divider />

        <BlockStack gap="0">
          {products.map((product, i) => {
            const barWidth = maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0;
            return (
              <div
                key={product.id}
                style={{
                  padding: '10px 8px',
                  borderRadius: 8,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Revenue bar background */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${barWidth}%`,
                    background: i === 0 ? 'rgba(5, 150, 105, 0.06)' : 'rgba(0, 0, 0, 0.02)',
                    borderRadius: 8,
                    transition: 'width 0.3s ease',
                  }}
                />
                <div style={{ position: 'relative' }}>
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      <Text
                        as="span"
                        variant="bodySm"
                        fontWeight="bold"
                        tone={i === 0 ? 'success' : 'subdued'}
                      >
                        {i + 1}
                      </Text>
                      <BlockStack gap="0">
                        <Text as="p" variant="bodySm" fontWeight="semibold">
                          {product.name}
                        </Text>
                        <Text as="p" variant="bodyXs" tone="subdued">
                          {product.sku}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    <InlineStack gap="600" blockAlign="center">
                      <Text as="span" variant="bodySm" tone="subdued">
                        {product.unitsSold}
                      </Text>
                      <Box minWidth="80px">
                        <Text as="span" variant="bodySm" fontWeight="semibold" alignment="end">
                          {formatCurrency(product.revenue)}
                        </Text>
                      </Box>
                    </InlineStack>
                  </InlineStack>
                </div>
              </div>
            );
          })}
        </BlockStack>

        <Divider />

        <Box paddingInlineStart="200" paddingInlineEnd="200">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" variant="bodySm" tone="subdued">
              Total Top {products.length}
            </Text>
            <Text as="span" variant="bodySm" fontWeight="bold">
              {formatCurrency(totalRevenue)}
            </Text>
          </InlineStack>
        </Box>
      </BlockStack>
    </Card>
  );
}
