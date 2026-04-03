'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Select,
  Badge,
  Box,
  Banner,
  Spinner,
  Divider,
  IndexTable,
  EmptyState,
} from '@shopify/polaris';
import { searchMPPayments, type MPSearchResult } from '@/app/actions/mercadopago-actions';
import { formatCurrency } from '@/lib/utils';

function statusBadge(status: string) {
  const map: Record<string, { tone: 'success' | 'warning' | 'critical' | 'info'; label: string }> = {
    approved: { tone: 'success', label: 'Aprobado' },
    pending: { tone: 'warning', label: 'Pendiente' },
    in_process: { tone: 'warning', label: 'En proceso' },
    rejected: { tone: 'critical', label: 'Rechazado' },
    cancelled: { tone: 'critical', label: 'Cancelado' },
    refunded: { tone: 'info', label: 'Reembolsado' },
  };
  const entry = map[status] ?? { tone: 'info' as const, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MPSearchPanel() {
  const [status, setStatus] = useState('');
  const [beginDate, setBeginDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MPSearchResult | null>(null);
  const [offset, setOffset] = useState(0);

  const handleSearch = useCallback(async (pageOffset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchMPPayments({
        status: status || undefined,
        beginDate: beginDate || undefined,
        endDate: endDate || undefined,
        externalReference: reference || undefined,
        offset: pageOffset,
        limit: 30,
      });
      setResults(data);
      setOffset(pageOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar');
    } finally {
      setLoading(false);
    }
  }, [status, beginDate, endDate, reference]);

  const handleClear = useCallback(() => {
    setStatus('');
    setBeginDate('');
    setEndDate('');
    setReference('');
    setResults(null);
    setError(null);
    setOffset(0);
  }, []);

  const statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'Aprobados', value: 'approved' },
    { label: 'Pendientes', value: 'pending' },
    { label: 'Rechazados', value: 'rejected' },
    { label: 'Reembolsados', value: 'refunded' },
    { label: 'Cancelados', value: 'cancelled' },
  ];

  const hasNextPage = results && (offset + 30) < results.paging.total;
  const hasPrevPage = offset > 0;

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">Buscar pagos en MercadoPago</Text>
        <Text variant="bodySm" as="p" tone="subdued">
          Busca directamente en la API de MercadoPago. Incluye todos los pagos de tu cuenta,
          no solo los registrados en el sistema.
        </Text>

        <Divider />

        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            <p>{error}</p>
          </Banner>
        )}

        <InlineStack gap="300" wrap>
          <Box minWidth="160px">
            <Select
              label="Estatus"
              options={statusOptions}
              value={status}
              onChange={setStatus}
            />
          </Box>
          <Box minWidth="160px">
            <TextField
              label="Desde"
              type="date"
              value={beginDate}
              onChange={setBeginDate}
              autoComplete="off"
            />
          </Box>
          <Box minWidth="160px">
            <TextField
              label="Hasta"
              type="date"
              value={endDate}
              onChange={setEndDate}
              autoComplete="off"
            />
          </Box>
          <Box minWidth="200px">
            <TextField
              label="Referencia externa"
              value={reference}
              onChange={setReference}
              autoComplete="off"
              placeholder="Ej: venta-abc123"
            />
          </Box>
        </InlineStack>

        <InlineStack gap="200">
          <Button variant="primary" onClick={() => handleSearch(0)} loading={loading}>
            Buscar
          </Button>
          <Button onClick={handleClear}>Limpiar</Button>
        </InlineStack>

        <Divider />

        {loading && !results && (
          <Box padding="600">
            <InlineStack align="center">
              <Spinner size="large" />
            </InlineStack>
          </Box>
        )}

        {results && results.results.length === 0 && (
          <EmptyState heading="Sin resultados" image="">
            <p>No se encontraron pagos con los filtros seleccionados.</p>
          </EmptyState>
        )}

        {results && results.results.length > 0 && (
          <BlockStack gap="300">
            <Text variant="bodySm" as="p" tone="subdued">
              Mostrando {offset + 1}–{Math.min(offset + 30, results.paging.total)} de{' '}
              {results.paging.total} pagos
            </Text>

            <IndexTable
              resourceName={{ singular: 'pago', plural: 'pagos' }}
              itemCount={results.results.length}
              headings={[
                { title: 'ID' },
                { title: 'Fecha' },
                { title: 'Monto' },
                { title: 'Método' },
                { title: 'Status' },
                { title: 'Descripción' },
                { title: 'Comisión' },
              ]}
              selectable={false}
            >
              {results.results.map((payment, index) => {
                const totalFee = payment.fee_details?.reduce((sum, f) => sum + f.amount, 0) ?? 0;
                return (
                  <IndexTable.Row
                    id={String(payment.id)}
                    key={payment.id}
                    position={index}
                  >
                    <IndexTable.Cell>
                      <Text variant="bodySm" fontWeight="semibold" as="span">
                        {payment.id}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodySm" as="span">
                        {formatDateShort(payment.date_created)}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodyMd" fontWeight="medium" as="span">
                        {formatCurrency(payment.transaction_amount)}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodySm" as="span">
                        {payment.payment_method_id} ({payment.payment_type_id})
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {statusBadge(payment.status)}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodySm" as="span" truncate>
                        {payment.description || payment.external_reference || '—'}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodySm" as="span" tone="subdued">
                        {totalFee > 0 ? formatCurrency(totalFee) : '—'}
                      </Text>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>

            <InlineStack align="center" gap="200">
              {hasPrevPage && (
                <Button onClick={() => handleSearch(Math.max(0, offset - 30))}>
                  ← Anterior
                </Button>
              )}
              {hasNextPage && (
                <Button onClick={() => handleSearch(offset + 30)}>
                  Siguiente →
                </Button>
              )}
            </InlineStack>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
