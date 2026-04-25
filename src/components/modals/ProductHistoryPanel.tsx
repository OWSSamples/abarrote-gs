'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BlockStack,
  InlineStack,
  Text,
  Box,
  Badge,
  Spinner,
  Banner,
  Card,
  Divider,
  Icon,
  EmptyState,
  Select,
} from '@shopify/polaris';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  AlertCircleIcon,
  RefreshIcon,
} from '@shopify/polaris-icons';
import { fetchStockMovements } from '@/app/actions/db-actions';
import type { StockMovement, StockMovementType } from '@/types';

const TYPE_LABEL: Record<StockMovementType, string> = {
  restock: 'Surtido',
  sale: 'Venta',
  merma: 'Merma',
  adjustment: 'Ajuste',
  audit: 'Auditoría',
  return: 'Devolución',
};

const TYPE_TONE: Record<StockMovementType, 'success' | 'info' | 'warning' | 'attention' | 'critical' | 'magic'> = {
  restock: 'success',
  sale: 'info',
  merma: 'critical',
  adjustment: 'attention',
  audit: 'magic',
  return: 'warning',
};

const FILTER_OPTIONS: { label: string; value: StockMovementType | 'all' }[] = [
  { label: 'Todos los movimientos', value: 'all' },
  { label: 'Solo surtidos', value: 'restock' },
  { label: 'Solo ventas', value: 'sale' },
  { label: 'Solo mermas', value: 'merma' },
  { label: 'Solo devoluciones', value: 'return' },
  { label: 'Solo auditorías', value: 'audit' },
  { label: 'Solo ajustes', value: 'adjustment' },
];

function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}

interface ProductHistoryPanelProps {
  productId: string;
  unit?: string;
}

export function ProductHistoryPanel({ productId, unit = 'pieza' }: ProductHistoryPanelProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StockMovementType | 'all'>('all');

  const load = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchStockMovements(productId, 100);
        setMovements(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el historial');
      } finally {
        setLoading(false);
      }
    },
    [productId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = filter === 'all' ? movements : movements.filter((m) => m.type === filter);

  // Stats: totals across the loaded window
  const restocks = movements.filter((m) => m.type === 'restock');
  const totalRestocks = restocks.length;
  const totalRestockedQty = restocks.reduce((sum, m) => sum + m.quantity, 0);
  const totalRestockValue = restocks.reduce((sum, m) => sum + (m.totalValue ?? 0), 0);
  const lastRestock = restocks[0];
  const supplierFreq = new Map<string, number>();
  for (const m of restocks) {
    const key = m.sourceLabel || 'Sin proveedor';
    supplierFreq.set(key, (supplierFreq.get(key) ?? 0) + 1);
  }
  const topSupplier = [...supplierFreq.entries()].sort((a, b) => b[1] - a[1])[0];

  if (loading) {
    return (
      <Box padding="600">
        <InlineStack align="center" blockAlign="center" gap="200">
          <Spinner accessibilityLabel="Cargando historial" size="small" />
          <Text as="p" variant="bodySm" tone="subdued">
            Cargando historial de movimientos…
          </Text>
        </InlineStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Banner tone="critical" title="Error al cargar el historial">
        <p>{error}</p>
      </Banner>
    );
  }

  return (
    <BlockStack gap="400">
      {/* ── Stats cards ── */}
      <Box
        padding="400"
        background="bg-surface-secondary"
        borderRadius="300"
      >
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm" fontWeight="semibold">
            Resumen de surtidos
          </Text>
          <InlineStack gap="500" wrap>
            <BlockStack gap="050">
              <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
                Veces surtido
              </Text>
              <Text as="span" variant="headingLg" fontWeight="bold">
                {totalRestocks}
              </Text>
            </BlockStack>
            <BlockStack gap="050">
              <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
                Unidades surtidas
              </Text>
              <Text as="span" variant="headingLg" fontWeight="bold">
                {totalRestockedQty} {unit}
              </Text>
            </BlockStack>
            <BlockStack gap="050">
              <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
                Inversión total
              </Text>
              <Text as="span" variant="headingLg" fontWeight="bold">
                {formatCurrency(totalRestockValue)}
              </Text>
            </BlockStack>
            {lastRestock && (
              <BlockStack gap="050">
                <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
                  Último surtido
                </Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  {formatDate(lastRestock.createdAt).date}
                </Text>
              </BlockStack>
            )}
            {topSupplier && (
              <BlockStack gap="050">
                <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
                  Proveedor frecuente
                </Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  {topSupplier[0]}
                </Text>
              </BlockStack>
            )}
          </InlineStack>
        </BlockStack>
      </Box>

      {/* ── Filter ── */}
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h3" variant="headingSm" fontWeight="semibold">
          Movimientos ({filtered.length})
        </Text>
        <Box minWidth="220px">
          <Select
            label="Filtrar"
            labelHidden
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(v) => setFilter(v as StockMovementType | 'all')}
          />
        </Box>
      </InlineStack>

      {/* ── Timeline list ── */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            heading="Sin movimientos"
            image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-history.svg"
            action={{ content: 'Recargar', icon: RefreshIcon, onAction: () => void load() }}
          >
            <Text as="p" variant="bodyMd" tone="subdued">
              {filter === 'all'
                ? 'Este producto aún no tiene movimientos registrados.'
                : 'No hay movimientos de este tipo para mostrar.'}
            </Text>
          </EmptyState>
        </Card>
      ) : (
        <Card padding="0">
          <BlockStack gap="0">
            {filtered.map((m, i) => {
              const { date, time } = formatDate(m.createdAt);
              const isIn = m.direction === 'in';
              return (
                <Box key={m.id}>
                  {i > 0 && <Divider />}
                  <Box padding="400">
                    <InlineStack gap="400" blockAlign="start" wrap={false} align="space-between">
                      <InlineStack gap="300" blockAlign="start" wrap={false}>
                        <Box
                          padding="200"
                          background={isIn ? 'bg-fill-success-secondary' : 'bg-fill-critical-secondary'}
                          borderRadius="200"
                        >
                          <Icon
                            source={isIn ? ArrowDownIcon : ArrowUpIcon}
                            tone={isIn ? 'success' : 'critical'}
                          />
                        </Box>
                        <BlockStack gap="100">
                          <InlineStack gap="200" blockAlign="center" wrap>
                            <Badge tone={TYPE_TONE[m.type]} size="small">
                              {TYPE_LABEL[m.type]}
                            </Badge>
                            {m.sourceLabel && (
                              <Text as="span" variant="bodySm" tone="subdued">
                                · {m.sourceLabel}
                              </Text>
                            )}
                          </InlineStack>
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {isIn ? '+' : '−'}
                            {m.quantity} {unit}
                          </Text>
                          {m.notes && (
                            <Text as="span" variant="bodySm" tone="subdued">
                              {m.notes}
                            </Text>
                          )}
                          {m.userName && (
                            <Text as="span" variant="bodySm" tone="subdued">
                              Por {m.userName}
                            </Text>
                          )}
                        </BlockStack>
                      </InlineStack>
                      <BlockStack gap="050" align="end">
                        <Text as="span" variant="bodySm" fontWeight="medium">
                          {date}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {time}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          Stock: {m.balanceAfter}
                        </Text>
                        {m.totalValue != null && (
                          <Text as="span" variant="bodySm" tone="subdued">
                            {formatCurrency(m.totalValue)}
                          </Text>
                        )}
                      </BlockStack>
                    </InlineStack>
                  </Box>
                </Box>
              );
            })}
          </BlockStack>
        </Card>
      )}

      {movements.length >= 100 && (
        <Banner tone="info" icon={AlertCircleIcon}>
          <p>Mostrando los últimos 100 movimientos.</p>
        </Banner>
      )}
    </BlockStack>
  );
}
