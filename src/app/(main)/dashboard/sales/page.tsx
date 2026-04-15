'use client';

import { useMemo } from 'react';
import { Page, InlineGrid, Card, BlockStack, Text, Box, InlineStack, Badge, Divider } from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { SalesHistory } from '@/components/sales/SalesHistory';

export default function SalesPage() {
  const saleRecords = useDashboardStore((s) => s.saleRecords);

  // ── KPI calculations ──
  const kpis = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

    const todaySales = saleRecords.filter((s) => s.date.startsWith(todayStr));
    const yesterdaySales = saleRecords.filter((s) => s.date.startsWith(yesterdayStr));

    const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
    const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + s.total, 0);
    const todayCount = todaySales.length;
    const avgTicket = todayCount > 0 ? todayTotal / todayCount : 0;

    // Payment breakdown (today)
    const byMethod: Record<string, number> = {};
    todaySales.forEach((s) => {
      byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] || 0) + s.total;
    });

    // Trend
    const delta = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : 0;

    return { todayTotal, todayCount, avgTicket, byMethod, delta, yesterdayTotal };
  }, [saleRecords]);

  const methodLabels: Record<string, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    fiado: 'Fiado',
    puntos: 'Puntos',
    tarjeta_web: 'MP Web',
    tarjeta_manual: 'T. Manual',
    tarjeta_clip: 'Clip',
    clip_terminal: 'Clip Terminal',
  };

  return (
    <Page
      fullWidth
      title="Ventas"
      subtitle="Panorama del día y registro histórico"
    >
      <BlockStack gap="600">
        {/* ═══════════════════════════════════════════════════════
            NIVEL 1 — Vista Macro: KPIs del día
            Storytelling: "¿Cómo vamos hoy?"
        ═══════════════════════════════════════════════════════ */}
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
          {/* Venta del día */}
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Venta del día
              </Text>
              <Text as="p" variant="headingXl" fontWeight="bold">
                {formatCurrency(kpis.todayTotal)}
              </Text>
              {kpis.yesterdayTotal > 0 && (
                <InlineStack gap="100" blockAlign="center">
                  <Text as="span" variant="bodySm" tone={kpis.delta >= 0 ? 'success' : 'critical'}>
                    {kpis.delta >= 0 ? '↑' : '↓'} {Math.abs(kpis.delta).toFixed(1)}%
                  </Text>
                  <Text as="span" variant="bodySm" tone="subdued">
                    vs ayer
                  </Text>
                </InlineStack>
              )}
            </BlockStack>
          </Card>

          {/* Transacciones */}
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Transacciones hoy
              </Text>
              <Text as="p" variant="headingXl" fontWeight="bold">
                {kpis.todayCount}
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                operaciones registradas
              </Text>
            </BlockStack>
          </Card>

          {/* Ticket promedio */}
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Ticket promedio
              </Text>
              <Text as="p" variant="headingXl" fontWeight="bold">
                {formatCurrency(kpis.avgTicket)}
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                por transacción
              </Text>
            </BlockStack>
          </Card>

          {/* Desglose por método */}
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Desglose del día
              </Text>
              {Object.keys(kpis.byMethod).length === 0 ? (
                <Text as="p" variant="bodySm" tone="subdued">
                  Sin ventas aún
                </Text>
              ) : (
                <BlockStack gap="100">
                  {Object.entries(kpis.byMethod)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([method, amount]) => (
                      <InlineStack key={method} align="space-between" blockAlign="center">
                        <Text as="span" variant="bodySm">
                          {methodLabels[method] || method}
                        </Text>
                        <Text as="span" variant="bodySm" fontWeight="semibold">
                          {formatCurrency(amount)}
                        </Text>
                      </InlineStack>
                    ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* ═══════════════════════════════════════════════════════
            NIVEL 2 — Vista Micro: Historial completo
            Storytelling: "¿Qué pasó exactamente?"
        ═══════════════════════════════════════════════════════ */}
        <SalesHistory />
      </BlockStack>
    </Page>
  );
}
