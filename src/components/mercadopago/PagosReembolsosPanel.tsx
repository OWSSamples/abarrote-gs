'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  IndexTable,
  EmptyState,
  Spinner,
  Box,
  Banner,
  Modal,
  TextField,
  Select,
  Tabs,
  Divider,
} from '@shopify/polaris';
import {
  fetchMercadoPagoPayments,
  fetchMercadoPagoRefunds,
  createMercadoPagoRefund,
} from '@/app/actions/mercadopago-actions';
import type { MercadoPagoRefund } from '@/types';
import { formatCurrency } from '@/lib/utils';

// ── Types ──

interface MPPaymentRow {
  id: string;
  paymentId: string;
  status: string;
  saleId: string | null;
  externalReference: string | null;
  amount: number;
  paymentMethodId: string | null;
  paymentType: string | null;
  installments: number;
  feeAmount: number | null;
  netAmount: number | null;
  payerEmail: string | null;
  createdAt: string;
}

// ── Status Helpers ──

function paymentStatusBadge(status: string) {
  const map: Record<string, { tone: 'success' | 'warning' | 'critical' | 'info' | 'attention'; label: string }> = {
    approved: { tone: 'success', label: 'Aprobado' },
    pending: { tone: 'warning', label: 'Pendiente' },
    authorized: { tone: 'info', label: 'Autorizado' },
    in_process: { tone: 'warning', label: 'En proceso' },
    rejected: { tone: 'critical', label: 'Rechazado' },
    cancelled: { tone: 'critical', label: 'Cancelado' },
    refunded: { tone: 'attention', label: 'Reembolsado' },
    partially_refunded: { tone: 'attention', label: 'Reembolso parcial' },
  };
  const entry = map[status] ?? { tone: 'info' as const, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

function refundStatusBadge(status: MercadoPagoRefund['status']) {
  const map: Record<string, { tone: 'success' | 'warning' | 'critical'; label: string }> = {
    approved: { tone: 'success', label: 'Aprobado' },
    pending: { tone: 'warning', label: 'Pendiente' },
    rejected: { tone: 'critical', label: 'Rechazado' },
  };
  const entry = map[status] ?? { tone: 'warning' as const, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

function paymentMethodLabel(methodId: string | null, typeId: string | null): string {
  if (!methodId) return '—';
  const methods: Record<string, string> = {
    visa: 'Visa',
    master: 'Mastercard',
    amex: 'American Express',
    debvisa: 'Visa Débito',
    debmaster: 'Mastercard Débito',
    oxxo: 'OXXO',
    bancomer: 'BBVA',
    banamex: 'Citibanamex',
    serfin: 'Santander',
    account_money: 'Saldo MP',
  };
  const label = methods[methodId] ?? methodId;
  if (typeId === 'debit_card') return `${label} (Débito)`;
  if (typeId === 'credit_card') return `${label} (Crédito)`;
  return label;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Main Component ──

export function PagosReembolsosPanel() {
  const [tabIndex, setTabIndex] = useState(0);
  const [payments, setPayments] = useState<MPPaymentRow[]>([]);
  const [refunds, setRefunds] = useState<MercadoPagoRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refund modal state
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<MPPaymentRow | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Data Loading ──

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [paymentsData, refundsData] = await Promise.all([
        fetchMercadoPagoPayments(),
        fetchMercadoPagoRefunds(),
      ]);
      setPayments(paymentsData);
      setRefunds(refundsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Payments Table ──

  const paymentResourceName = { singular: 'pago', plural: 'pagos' };

  // ── Refund Handlers ──

  const openRefundModal = useCallback((payment: MPPaymentRow) => {
    setSelectedPayment(payment);
    setRefundAmount(String(payment.amount));
    setRefundReason('');
    setRefundType('full');
    setRefundError(null);
    setRefundModalOpen(true);
  }, []);

  const handleRefundSubmit = useCallback(async () => {
    if (!selectedPayment) return;

    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      setRefundError('Ingresa un monto válido mayor a $0');
      return;
    }
    if (amount > selectedPayment.amount) {
      setRefundError(`El monto no puede exceder $${selectedPayment.amount.toFixed(2)}`);
      return;
    }
    if (!refundReason.trim()) {
      setRefundError('Ingresa un motivo para el reembolso');
      return;
    }

    setRefundSubmitting(true);
    setRefundError(null);

    try {
      await createMercadoPagoRefund({
        mpPaymentId: selectedPayment.paymentId,
        amount,
        reason: refundReason.trim(),
      });
      setRefundModalOpen(false);
      setSuccessMessage('Reembolso procesado exitosamente');
      setTimeout(() => setSuccessMessage(null), 5000);
      await loadData();
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'Error al procesar reembolso');
    } finally {
      setRefundSubmitting(false);
    }
  }, [selectedPayment, refundAmount, refundReason, loadData]);

  // ── Refund Type Change ──

  const handleRefundTypeChange = useCallback(
    (value: string) => {
      const type = value as 'full' | 'partial';
      setRefundType(type);
      if (type === 'full' && selectedPayment) {
        setRefundAmount(String(selectedPayment.amount));
      }
    },
    [selectedPayment],
  );

  // ── Tabs ──

  const tabs = [
    { id: 'payments', content: `Pagos (${payments.length})`, accessibilityLabel: 'Pagos MercadoPago' },
    { id: 'refunds', content: `Reembolsos (${refunds.length})`, accessibilityLabel: 'Reembolsos' },
  ];

  // ── Loading / Error States ──

  if (loading) {
    return (
      <Card>
        <Box padding="800">
          <InlineStack align="center">
            <Spinner size="large" />
          </InlineStack>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Banner tone="critical" title="Error al cargar pagos" onDismiss={() => setError(null)}>
        <p>{error}</p>
        <Box paddingBlockStart="200">
          <Button onClick={loadData}>Reintentar</Button>
        </Box>
      </Banner>
    );
  }

  // ── Payments Tab Content ──

  const refundableStatuses = ['approved', 'partially_refunded'];

  const paymentsMarkup =
    payments.length === 0 ? (
      <EmptyState
        heading="Sin pagos registrados"
        image=""
      >
        <p>Los pagos procesados por MercadoPago aparecerán aquí automáticamente al recibir pagos con terminal o web.</p>
      </EmptyState>
    ) : (
      <IndexTable
        resourceName={paymentResourceName}
        itemCount={payments.length}
        headings={[
          { title: 'ID Pago' },
          { title: 'Fecha' },
          { title: 'Monto' },
          { title: 'Método' },
          { title: 'Cuotas' },
          { title: 'Comisión' },
          { title: 'Neto' },
          { title: 'Status' },
          { title: 'Venta' },
          { title: 'Acciones' },
        ]}
        selectable={false}
      >
        {payments.map((payment, index) => (
          <IndexTable.Row
            id={payment.id}
            key={payment.id}
            position={index}
          >
            <IndexTable.Cell>
              <Text variant="bodyMd" fontWeight="semibold" as="span">
                {payment.paymentId}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodySm" as="span">{formatDate(payment.createdAt)}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodyMd" fontWeight="medium" as="span">
                {formatCurrency(payment.amount)}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodySm" as="span">
                {paymentMethodLabel(payment.paymentMethodId, payment.paymentType)}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              {payment.installments > 1 ? (
                <Badge tone="info">{`${payment.installments} MSI`}</Badge>
              ) : (
                <Text variant="bodySm" as="span">1</Text>
              )}
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodySm" as="span" tone="subdued">
                {payment.feeAmount != null ? formatCurrency(payment.feeAmount) : '—'}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodySm" as="span">
                {payment.netAmount != null ? formatCurrency(payment.netAmount) : '—'}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>{paymentStatusBadge(payment.status)}</IndexTable.Cell>
            <IndexTable.Cell>
              {payment.saleId ? (
                <Badge tone="success">Vinculado</Badge>
              ) : payment.externalReference ? (
                <Badge tone="warning">{`Ref: ${payment.externalReference}`}</Badge>
              ) : (
                <Text variant="bodySm" as="span" tone="subdued">—</Text>
              )}
            </IndexTable.Cell>
            <IndexTable.Cell>
              {refundableStatuses.includes(payment.status) && (
                <Button
                  size="slim"
                  tone="critical"
                  onClick={() => openRefundModal(payment)}
                >
                  Reembolsar
                </Button>
              )}
            </IndexTable.Cell>
          </IndexTable.Row>
        ))}
      </IndexTable>
    );

  // ── Refunds Tab Content ──

  const refundsMarkup =
    refunds.length === 0 ? (
      <EmptyState
        heading="Sin reembolsos"
        image=""
      >
        <p>Cuando proceses un reembolso desde la pestaña de Pagos, aparecerá aquí con su status actualizado.</p>
      </EmptyState>
    ) : (
      <IndexTable
        resourceName={{ singular: 'reembolso', plural: 'reembolsos' }}
        itemCount={refunds.length}
        headings={[
          { title: 'ID Reembolso' },
          { title: 'ID Pago MP' },
          { title: 'Fecha' },
          { title: 'Monto' },
          { title: 'Status' },
          { title: 'Motivo' },
          { title: 'Solicitado por' },
          { title: 'Resuelto' },
        ]}
        selectable={false}
      >
        {refunds.map((refund, index) => (
          <IndexTable.Row
            id={refund.id}
            key={refund.id}
            position={index}
          >
            <IndexTable.Cell>
              <Text variant="bodySm" fontWeight="semibold" as="span">
                {refund.mpRefundId || refund.id.slice(0, 12)}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodySm" as="span">{refund.mpPaymentId}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodySm" as="span">{formatDate(refund.createdAt)}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodyMd" fontWeight="medium" as="span" tone="critical">
                -{formatCurrency(refund.amount)}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>{refundStatusBadge(refund.status)}</IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodySm" as="span">{refund.reason}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodySm" as="span">{refund.initiatedBy}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodySm" as="span">
                {refund.resolvedAt ? formatDate(refund.resolvedAt) : '—'}
              </Text>
            </IndexTable.Cell>
          </IndexTable.Row>
        ))}
      </IndexTable>
    );

  // ── KPI Summary ──

  const totalApproved = payments
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalFees = payments
    .filter((p) => p.feeAmount != null)
    .reduce((sum, p) => sum + (p.feeAmount ?? 0), 0);
  const totalRefunded = refunds
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <BlockStack gap="500">
      {successMessage && (
        <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>
          <p>{successMessage}</p>
        </Banner>
      )}

      {/* KPI Cards */}
      <InlineStack gap="400" wrap>
        <Box minWidth="200px">
          <Card>
            <BlockStack gap="100">
              <Text variant="bodySm" as="p" tone="subdued">Total cobrado</Text>
              <Text variant="headingLg" as="p">{formatCurrency(totalApproved)}</Text>
              <Text variant="bodySm" as="p" tone="subdued">{payments.filter(p => p.status === 'approved').length} pagos</Text>
            </BlockStack>
          </Card>
        </Box>
        <Box minWidth="200px">
          <Card>
            <BlockStack gap="100">
              <Text variant="bodySm" as="p" tone="subdued">Comisiones MP</Text>
              <Text variant="headingLg" as="p" tone="critical">{formatCurrency(totalFees)}</Text>
              <Text variant="bodySm" as="p" tone="subdued">{((totalFees / (totalApproved || 1)) * 100).toFixed(1)}% del total</Text>
            </BlockStack>
          </Card>
        </Box>
        <Box minWidth="200px">
          <Card>
            <BlockStack gap="100">
              <Text variant="bodySm" as="p" tone="subdued">Reembolsado</Text>
              <Text variant="headingLg" as="p" tone="caution">{formatCurrency(totalRefunded)}</Text>
              <Text variant="bodySm" as="p" tone="subdued">{refunds.filter(r => r.status === 'approved').length} reembolsos</Text>
            </BlockStack>
          </Card>
        </Box>
        <Box minWidth="200px">
          <Card>
            <BlockStack gap="100">
              <Text variant="bodySm" as="p" tone="subdued">Neto recibido</Text>
              <Text variant="headingLg" as="p" fontWeight="bold">{formatCurrency(totalApproved - totalFees - totalRefunded)}</Text>
              <Text variant="bodySm" as="p" tone="subdued">Después de comisiones y reembolsos</Text>
            </BlockStack>
          </Card>
        </Box>
      </InlineStack>

      {/* Tabs: Pagos / Reembolsos */}
      <Card padding="0">
        <Tabs tabs={tabs} selected={tabIndex} onSelect={setTabIndex}>
          <Box padding="400">
            <InlineStack align="end" gap="200">
              <Button onClick={loadData}>Actualizar</Button>
            </InlineStack>
          </Box>
          <Divider />
          {tabIndex === 0 ? paymentsMarkup : refundsMarkup}
        </Tabs>
      </Card>

      {/* Refund Modal */}
      <Modal
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        title={`Reembolsar pago #${selectedPayment?.paymentId ?? ''}`}
        primaryAction={{
          content: refundSubmitting ? 'Procesando...' : 'Confirmar reembolso',
          onAction: handleRefundSubmit,
          loading: refundSubmitting,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: 'Cancelar',
            onAction: () => setRefundModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {refundError && (
              <Banner tone="critical" onDismiss={() => setRefundError(null)}>
                <p>{refundError}</p>
              </Banner>
            )}

            <Banner tone="warning">
              <p>Los reembolsos se procesan directamente en MercadoPago. Esta acción no se puede deshacer.</p>
            </Banner>

            {selectedPayment && (
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text variant="bodySm" as="span" tone="subdued">Monto original</Text>
                    <Text variant="bodyMd" fontWeight="semibold" as="span">
                      {formatCurrency(selectedPayment.amount)}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text variant="bodySm" as="span" tone="subdued">Método</Text>
                    <Text variant="bodySm" as="span">
                      {paymentMethodLabel(selectedPayment.paymentMethodId, selectedPayment.paymentType)}
                    </Text>
                  </InlineStack>
                  {selectedPayment.payerEmail && (
                    <InlineStack align="space-between">
                      <Text variant="bodySm" as="span" tone="subdued">Pagador</Text>
                      <Text variant="bodySm" as="span">{selectedPayment.payerEmail}</Text>
                    </InlineStack>
                  )}
                </BlockStack>
              </Card>
            )}

            <Select
              label="Tipo de reembolso"
              options={[
                { label: 'Total', value: 'full' },
                { label: 'Parcial', value: 'partial' },
              ]}
              value={refundType}
              onChange={handleRefundTypeChange}
            />

            <TextField
              label="Monto a reembolsar"
              type="number"
              value={refundAmount}
              onChange={setRefundAmount}
              autoComplete="off"
              prefix="$"
              disabled={refundType === 'full'}
              helpText={
                refundType === 'partial' && selectedPayment
                  ? `Máximo: ${formatCurrency(selectedPayment.amount)}`
                  : undefined
              }
            />

            <TextField
              label="Motivo del reembolso"
              value={refundReason}
              onChange={setRefundReason}
              autoComplete="off"
              placeholder="Ej: Producto defectuoso, error de cobro, etc."
              multiline={3}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
