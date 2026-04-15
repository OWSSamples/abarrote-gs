'use client';

import { useMemo, useState } from 'react';
import {
  Page,
  BlockStack,
  InlineStack,
  InlineGrid,
  Card,
  Text,
  Badge,
  Box,
  Divider,
  Button,
} from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { CorteCajaModal } from '@/components/caja/CorteCajaModal';
import { CortesHistory } from '@/components/caja/CortesHistory';

export default function CortePage() {
  const [corteModalOpen, setCorteModalOpen] = useState(false);
  const cortesHistory = useDashboardStore((s) => s.cortesHistory);

  // ── KPI calculations from history ──
  const kpis = useMemo(() => {
    if (cortesHistory.length === 0) {
      return { lastCorte: null, totalCortes: 0, avgDiferencia: 0, cortesOk: 0, cortesAlert: 0 };
    }

    const sorted = [...cortesHistory].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
    );
    const lastCorte = sorted[0];
    const totalCortes = cortesHistory.length;
    const avgDiferencia =
      cortesHistory.reduce((sum, c) => sum + Math.abs(c.diferencia), 0) / totalCortes;
    const cortesOk = cortesHistory.filter((c) => Math.abs(c.diferencia) <= 10).length;
    const cortesAlert = totalCortes - cortesOk;

    return { lastCorte, totalCortes, avgDiferencia, cortesOk, cortesAlert };
  }, [cortesHistory]);

  return (
    <>
      <Page
        fullWidth
        title="Corte de Caja"
        subtitle="Arqueo y control de efectivo"
        primaryAction={{
          content: 'Nuevo Corte de Caja',
          onAction: () => setCorteModalOpen(true),
        }}
        backAction={{ content: 'Ventas', url: '/dashboard/sales' }}
      >
        <BlockStack gap="600">
          {/* ═══════════════════════════════════════════════════════
              NIVEL 1 — Vista Macro: Resumen rápido
              Storytelling: "¿Cómo va la caja?"
          ═══════════════════════════════════════════════════════ */}
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
            {/* Último corte */}
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  Último corte
                </Text>
                {kpis.lastCorte ? (
                  <>
                    <Text as="p" variant="headingXl" fontWeight="bold">
                      {formatCurrency(kpis.lastCorte.totalVentas)}
                    </Text>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {new Date(kpis.lastCorte.fecha).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                      })}{' '}
                      · {kpis.lastCorte.cajero}
                    </Text>
                  </>
                ) : (
                  <Text as="p" variant="bodySm" tone="subdued">
                    Sin cortes registrados
                  </Text>
                )}
              </BlockStack>
            </Card>

            {/* Total de cortes */}
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  Cortes realizados
                </Text>
                <Text as="p" variant="headingXl" fontWeight="bold">
                  {kpis.totalCortes}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  en el historial
                </Text>
              </BlockStack>
            </Card>

            {/* Precisión de caja */}
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  Precisión de caja
                </Text>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" variant="headingXl" fontWeight="bold">
                    {kpis.totalCortes > 0
                      ? `${((kpis.cortesOk / kpis.totalCortes) * 100).toFixed(0)}%`
                      : '—'}
                  </Text>
                  {kpis.totalCortes > 0 && (
                    <Badge
                      tone={
                        kpis.cortesOk / kpis.totalCortes >= 0.9
                          ? 'success'
                          : kpis.cortesOk / kpis.totalCortes >= 0.7
                            ? 'attention'
                            : 'critical'
                      }
                    >
                      {`${kpis.cortesOk} ok / ${kpis.cortesAlert} alerta`}
                    </Badge>
                  )}
                </InlineStack>
                <Text as="span" variant="bodySm" tone="subdued">
                  cortes dentro de tolerancia (±$10)
                </Text>
              </BlockStack>
            </Card>

            {/* Diferencia promedio */}
            <Card>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  Diferencia promedio
                </Text>
                <Text
                  as="p"
                  variant="headingXl"
                  fontWeight="bold"
                  tone={kpis.avgDiferencia <= 10 ? 'success' : 'critical'}
                >
                  {kpis.totalCortes > 0 ? formatCurrency(kpis.avgDiferencia) : '—'}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  valor absoluto por corte
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>

          {/* ═══════════════════════════════════════════════════════
              NIVEL 2 — Vista Micro: Historial de cortes
              Storytelling: "¿Qué pasó en cada cierre?"
          ═══════════════════════════════════════════════════════ */}
          <CortesHistory />
        </BlockStack>
      </Page>

      <CorteCajaModal open={corteModalOpen} onClose={() => setCorteModalOpen(false)} />
    </>
  );
}
