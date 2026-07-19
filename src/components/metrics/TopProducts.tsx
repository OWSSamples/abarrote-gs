'use client';

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
  products: TopProduct[];
  title?: string;
  period?: string;
}

const trendConfig = {
  up: { label: '↑', color: '#1a7f37' },
  down: { label: '↓', color: '#cf222e' },
  stable: { label: '–', color: '#656d76' },
} as const;

export function TopProducts({
  products,
  title = 'Top Productos',
  period = 'Hoy',
}: TopProductsProps) {
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const totalUnits = products.reduce((s, p) => s + p.unitsSold, 0);
  const maxRevenue = products.length > 0 ? Math.max(...products.map((p) => p.revenue)) : 0;

  return (
    <Card padding="0">
      {/* Header */}
      <div style={{ padding: '16px 16px 14px' }}>
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingSm" fontWeight="semibold">
            {title}
          </Text>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--p-color-text-subdued)',
              background: 'var(--p-color-bg-surface-secondary)',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {period}
          </span>
        </InlineStack>
      </div>

      {products.length === 0 ? (
        <div
          style={{
            borderTop: '1px solid var(--p-color-border-secondary)',
            padding: '28px 20px 30px',
            textAlign: 'center',
          }}
        >
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            Sin ventas registradas
          </Text>
          <div style={{ marginTop: 4 }}>
            <Text as="p" variant="bodySm" tone="subdued">
              Los productos más vendidos aparecerán cuando este negocio registre su primera venta.
            </Text>
          </div>
        </div>
      ) : (
        <>
          {/* Product List */}
          <div>
            {products.map((product, i) => {
              const trend = trendConfig[product.trend];
              const barPct = maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0;
              const share = totalRevenue > 0 ? ((product.revenue / totalRevenue) * 100).toFixed(0) : '0';
              const isFirst = i === 0;

              return (
                <div
                  key={product.id}
                  style={{
                    borderTop: '1px solid var(--p-color-border-secondary)',
                    padding: '12px 16px',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'default',
                  }}
                >
                  {/* Revenue proportion bar — very subtle */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: `${barPct}%`,
                      background: isFirst
                        ? 'linear-gradient(90deg, rgba(26, 127, 55, 0.06), rgba(26, 127, 55, 0.02))'
                        : 'linear-gradient(90deg, rgba(0, 0, 0, 0.025), transparent)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Content */}
                  <div style={{ position: 'relative' }}>
                    {/* Row 1: Rank + Name ... Revenue */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      {/* Rank */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                          marginTop: 1,
                          background: isFirst ? '#1a7f37' : 'var(--p-color-bg-surface-secondary)',
                          color: isFirst ? '#fff' : 'var(--p-color-text-subdued)',
                        }}
                      >
                        {i + 1}
                      </span>

                      {/* Name + meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: isFirst ? 600 : 500,
                            color: 'var(--p-color-text)',
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {product.name}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 3,
                            fontSize: 11,
                            color: 'var(--p-color-text-subdued)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <span>{product.unitsSold} uds</span>
                          <span style={{ opacity: 0.4 }}>·</span>
                          <span>{share}% del total</span>
                          <span style={{ opacity: 0.4 }}>·</span>
                          <span style={{ color: trend.color, fontWeight: 600 }}>{trend.label}</span>
                        </div>
                      </div>

                      {/* Revenue */}
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 650,
                          color: 'var(--p-color-text)',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {formatCurrency(product.revenue)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              borderTop: '1px solid var(--p-color-border)',
              padding: '12px 16px',
              background: 'var(--p-color-bg-surface-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--p-color-text-subdued)',
              }}
            >
              {totalUnits} unidades
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--p-color-text)',
              }}
            >
              {formatCurrency(totalRevenue)}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
