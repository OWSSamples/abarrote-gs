'use client';

import type { CSSProperties } from 'react';
import { Card, Text, InlineStack } from '@shopify/polaris';
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

const trendMap = {
  up: { symbol: '↑', color: 'var(--p-color-text-success)' },
  down: { symbol: '↓', color: 'var(--p-color-text-critical)' },
  stable: { symbol: '–', color: 'var(--p-color-text-subdued)' },
} as const;

const thBase: CSSProperties = {
  padding: '6px 16px',
  fontSize: 11,
  fontWeight: 510,
  color: 'var(--p-color-text-subdued)',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  lineHeight: 1.6,
};

export function TopProducts({
  products = defaultTopProducts,
  title = 'Top Productos',
  period = 'Hoy',
}: TopProductsProps) {
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const totalUnits = products.reduce((s, p) => s + p.unitsSold, 0);

  return (
    <Card padding="0">
      {/* Header */}
      <div style={{ padding: '16px 16px 12px' }}>
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingSm" fontWeight="semibold">
            {title}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {period}
          </Text>
        </InlineStack>
      </div>

      {/* Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <thead>
          <tr
            style={{
              borderTop: '1px solid var(--p-color-border-secondary)',
              borderBottom: '1px solid var(--p-color-border-secondary)',
            }}
          >
            <th style={{ ...thBase, textAlign: 'left' }}>Producto</th>
            <th style={{ ...thBase, textAlign: 'right', width: 48 }}>Uds</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Ingreso</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, i) => {
            const share =
              totalRevenue > 0
                ? ((product.revenue / totalRevenue) * 100).toFixed(0)
                : '0';
            const trend = trendMap[product.trend];

            return (
              <tr
                key={product.id}
                style={{
                  borderBottom:
                    i < products.length - 1
                      ? '1px solid var(--p-color-border-secondary)'
                      : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    'var(--p-color-bg-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Product */}
                <td style={{ padding: '10px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 650,
                        flexShrink: 0,
                        ...(i === 0
                          ? {
                              background:
                                'var(--p-color-bg-fill-success-secondary)',
                              color: 'var(--p-color-text-success)',
                            }
                          : {
                              color: 'var(--p-color-text-subdued)',
                            }),
                      }}
                    >
                      {i + 1}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 550,
                          color: 'var(--p-color-text)',
                          lineHeight: 1.4,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {product.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--p-color-text-subdued)',
                          lineHeight: 1.3,
                        }}
                      >
                        {product.sku} · {share}%
                      </div>
                    </div>
                  </div>
                </td>

                {/* Units */}
                <td
                  style={{
                    padding: '10px 16px',
                    textAlign: 'right',
                    fontSize: 13,
                    color: 'var(--p-color-text-subdued)',
                    verticalAlign: 'middle',
                  }}
                >
                  {product.unitsSold}
                </td>

                {/* Revenue + trend */}
                <td
                  style={{
                    padding: '10px 16px',
                    textAlign: 'right',
                    verticalAlign: 'middle',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--p-color-text)',
                      }}
                    >
                      {formatCurrency(product.revenue)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: trend.color,
                      }}
                    >
                      {trend.symbol}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr
            style={{
              borderTop: '1px solid var(--p-color-border)',
              background: 'var(--p-color-bg-surface-secondary)',
            }}
          >
            <td
              style={{
                padding: '10px 16px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--p-color-text-subdued)',
              }}
            >
              Total
            </td>
            <td
              style={{
                padding: '10px 16px',
                textAlign: 'right',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--p-color-text-subdued)',
              }}
            >
              {totalUnits}
            </td>
            <td
              style={{
                padding: '10px 16px',
                textAlign: 'right',
                fontSize: 13,
                fontWeight: 650,
                color: 'var(--p-color-text)',
              }}
            >
              {formatCurrency(totalRevenue)}
            </td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}
