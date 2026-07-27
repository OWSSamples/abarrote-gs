'use client';

import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Box,
  Badge,
  Icon,
  TextField,
  InlineGrid,
  ProgressBar,
  DataTable,
} from '@shopify/polaris';
import {
  EditIcon,
  CreditCardIcon,
  DeleteIcon,
  CashDollarIcon,
  ReceiptIcon,
  OrderFilledIcon,
  LocationIcon,
  PhoneIcon,
} from '@shopify/polaris-icons';
import { useState, useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Cliente, FiadoTransaction, LoyaltyTransaction } from '@/types';

interface CustomerProfileProps {
  cliente: Cliente;
  transactions: FiadoTransaction[];
  loyaltyTransactions?: LoyaltyTransaction[];
  onBack: () => void;
  onDelete?: () => void;
}

export function CustomerProfile({
  cliente,
  transactions,
  loyaltyTransactions = [],
  onBack,
  onDelete,
}: CustomerProfileProps) {
  const deleteCliente = useDashboardStore((s) => s.deleteCliente);
  const registerAbono = useDashboardStore((s) => s.registerAbono);
  const { showSuccess, showError } = useToast();
  const [comment, setComment] = useState('');

  const stats = useMemo(() => {
    const fiadoTx = transactions.filter((t) => t.type === 'fiado');
    const abonoTx = transactions.filter((t) => t.type === 'abono');
    const totalSpent = fiadoTx.reduce((sum, t) => sum + t.amount, 0);
    const totalAbonos = abonoTx.reduce((sum, t) => sum + t.amount, 0);
    const ordersCount = fiadoTx.length;
    const avgOrderValue = ordersCount > 0 ? totalSpent / ordersCount : 0;

    const lastOrder = fiadoTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    // Time since creation
    const createdDate = new Date(cliente.createdAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - createdDate.getTime()) / 86400000);
    let timeSince = 'Hoy';
    if (diffDays >= 365) timeSince = `${Math.floor(diffDays / 365)} año${Math.floor(diffDays / 365) > 1 ? 's' : ''}`;
    else if (diffDays >= 30) timeSince = `${Math.floor(diffDays / 30)} mes${Math.floor(diffDays / 30) > 1 ? 'es' : ''}`;
    else if (diffDays > 0) timeSince = `${diffDays} día${diffDays > 1 ? 's' : ''}`;

    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const creditUsagePercent = cliente.creditLimit > 0 ? (cliente.balance / cliente.creditLimit) * 100 : 0;

    return {
      totalSpent,
      totalAbonos,
      ordersCount,
      avgOrderValue,
      timeSince,
      lastOrder,
      sortedTransactions,
      creditUsagePercent,
    };
  }, [cliente, transactions]);

  return (
    <Page
      fullWidth
      backAction={{ content: 'Clientes', onAction: onBack }}
      title={cliente.name}
      subtitle={`Cliente desde hace ${stats.timeSince} · ID: ${cliente.id.slice(0, 8)}`}
      actionGroups={[
        {
          title: 'Acciones',
          actions: [
            {
              content: 'Saldar deuda completa',
              icon: CashDollarIcon,
              disabled: cliente.balance <= 0,
              onAction: async () => {
                if (
                  window.confirm(
                    `¿Saldar ${formatCurrency(cliente.balance)} de ${cliente.name}? Su saldo quedará en $0.00.`,
                  )
                ) {
                  try {
                    await registerAbono(cliente.id, cliente.balance, 'Ajuste administrativo: Deuda saldada');
                    showSuccess('Deuda saldada correctamente');
                  } catch {
                    showError('No se pudo saldar la deuda');
                  }
                }
              },
            },
            {
              content: 'Eliminar cliente',
              icon: DeleteIcon,
              destructive: true,
              onAction: async () => {
                if (
                  window.confirm(
                    `¿Eliminar permanentemente a ${cliente.name}? Esta acción no se puede deshacer.`,
                  )
                ) {
                  try {
                    await deleteCliente(cliente.id);
                  } catch {
                    showError('No se pudo eliminar el cliente');
                    return;
                  }
                  if (onDelete) onDelete();
                  onBack();
                }
              },
            },
          ],
        },
      ]}
    >
      <BlockStack gap="400">
        {/* ═══ TOP KPI BAR ═══ */}
        <InlineGrid columns={{ xs: 2, md: 5 }} gap="300">
          <Card>
            <BlockStack gap="050">
              <Text as="p" variant="bodyXs" tone="subdued">
                Total Compras (Fiado)
              </Text>
              <Text as="p" variant="headingMd" fontWeight="bold">
                {formatCurrency(stats.totalSpent)}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="050">
              <Text as="p" variant="bodyXs" tone="subdued">
                Total Abonos
              </Text>
              <Text as="p" variant="headingMd" fontWeight="bold" tone="success">
                {formatCurrency(stats.totalAbonos)}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="050">
              <Text as="p" variant="bodyXs" tone="subdued">
                Operaciones
              </Text>
              <Text as="p" variant="headingMd" fontWeight="bold">
                {stats.ordersCount}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="050">
              <Text as="p" variant="bodyXs" tone="subdued">
                Ticket Promedio
              </Text>
              <Text as="p" variant="headingMd" fontWeight="bold">
                {formatCurrency(stats.avgOrderValue)}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="050">
              <Text as="p" variant="bodyXs" tone="subdued">
                Puntos Lealtad
              </Text>
              <Text as="p" variant="headingMd" fontWeight="bold">
                {(cliente.points || 0).toLocaleString()} pts
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          {/* ═══ MAIN COLUMN ═══ */}
          <Layout.Section>
            <BlockStack gap="400">
              {/* Last Order */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingSm">
                    Último pedido
                  </Text>
                  {stats.lastOrder ? (
                    <Box padding="400" borderRadius="200" background="bg-surface-secondary">
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="300" blockAlign="center">
                          <Box padding="200" background="bg-surface" borderRadius="200">
                            <Icon source={ReceiptIcon} tone="base" />
                          </Box>
                          <BlockStack gap="050">
                            <Text as="p" variant="bodyMd" fontWeight="bold">
                              {stats.lastOrder.description || `Ticket ${stats.lastOrder.saleFolio || 'S/N'}`}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              {formatDate(stats.lastOrder.date)} · {stats.lastOrder.items?.length || 0} artículos
                            </Text>
                          </BlockStack>
                        </InlineStack>
                        <Text as="p" variant="bodyLg" fontWeight="bold">
                          {formatCurrency(stats.lastOrder.amount)}
                        </Text>
                      </InlineStack>

                      {stats.lastOrder.items && stats.lastOrder.items.length > 0 && (
                        <Box paddingBlockStart="300">
                          <DataTable
                            columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
                            headings={['Producto', 'Cant.', 'Precio', 'Subtotal']}
                            rows={stats.lastOrder.items.map((item) => [
                              item.productName,
                              String(item.quantity),
                              formatCurrency(item.unitPrice),
                              formatCurrency(item.subtotal),
                            ])}
                          />
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Box
                      padding="600"
                      borderStyle="dashed"
                      borderWidth="025"
                      borderColor="border-secondary"
                      borderRadius="200"
                    >
                      <BlockStack gap="200" inlineAlign="center">
                        <Icon source={OrderFilledIcon} tone="subdued" />
                        <Text as="p" tone="subdued" alignment="center">
                          Sin pedidos registrados
                        </Text>
                      </BlockStack>
                    </Box>
                  )}
                </BlockStack>
              </Card>

              {/* ── Timeline / Cronología ── */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingSm">
                      Cronología
                    </Text>
                    <Badge>{`${transactions.length} movimientos`}</Badge>
                  </InlineStack>

                  {/* Comment box */}
                  <Box
                    background="bg-surface-secondary"
                    padding="300"
                    borderRadius="200"
                    borderWidth="025"
                    borderColor="border"
                    borderStyle="solid"
                  >
                    <BlockStack gap="200">
                      <TextField
                        label="Comentario"
                        labelHidden
                        value={comment}
                        onChange={setComment}
                        multiline={2}
                        placeholder="Deja un comentario sobre este cliente..."
                        autoComplete="off"
                      />
                      <InlineStack align="end">
                        <Button disabled={!comment.trim()} size="slim">
                          Publicar
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Box>

                  {/* Timeline feed */}
                  <div
                    style={{
                      paddingLeft: '16px',
                      borderLeft: '2px solid var(--p-color-border-secondary)',
                      marginLeft: '6px',
                    }}
                  >
                    <BlockStack gap="500">
                      {stats.sortedTransactions.map((t) => (
                        <div key={t.id} style={{ position: 'relative' }}>
                          <div
                            style={{
                              position: 'absolute',
                              left: '-22px',
                              top: '4px',
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: t.type === 'fiado' ? 'var(--p-color-bg-fill-critical)' : 'var(--p-color-bg-fill-success)',
                              border: '2px solid var(--p-color-bg-surface)',
                              boxShadow: '0 0 0 1px var(--p-color-border-secondary)',
                            }}
                          />
                          <BlockStack gap="100">
                            <InlineStack align="space-between" blockAlign="start">
                              <BlockStack gap="050">
                                <Text as="span" variant="bodyXs" tone="subdued">
                                  {new Date(t.date).toLocaleDateString('es-MX', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </Text>
                                <InlineStack gap="200" blockAlign="center">
                                  <Badge tone={t.type === 'fiado' ? 'critical' : 'success'}>
                                    {t.type === 'fiado' ? 'Fiado' : 'Abono'}
                                  </Badge>
                                  <Text as="span" variant="bodySm" fontWeight="medium">
                                    {t.description}
                                  </Text>
                                </InlineStack>
                                {t.saleFolio && (
                                  <Text as="span" variant="bodyXs" tone="subdued">
                                    Folio: {t.saleFolio}
                                  </Text>
                                )}
                              </BlockStack>
                              <Text
                                as="span"
                                variant="bodyMd"
                                fontWeight="bold"
                                tone={t.type === 'fiado' ? 'critical' : 'success'}
                              >
                                {t.type === 'fiado' ? '-' : '+'}
                                {formatCurrency(t.amount)}
                              </Text>
                            </InlineStack>

                            {t.items && t.items.length > 0 && (
                              <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                                <BlockStack gap="050">
                                  {t.items.map((item, i) => (
                                    <InlineStack key={i} align="space-between">
                                      <Text as="span" variant="bodyXs">
                                        {item.quantity}× {item.productName}
                                      </Text>
                                      <Text as="span" variant="bodyXs" tone="subdued">
                                        {formatCurrency(item.subtotal)}
                                      </Text>
                                    </InlineStack>
                                  ))}
                                </BlockStack>
                              </Box>
                            )}
                          </BlockStack>
                        </div>
                      ))}

                      {/* Creation event */}
                      <div style={{ position: 'relative' }}>
                        <div
                          style={{
                            position: 'absolute',
                            left: '-22px',
                            top: '4px',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: 'var(--p-color-bg-fill-secondary)',
                            border: '2px solid var(--p-color-bg-surface)',
                          }}
                        />
                        <BlockStack gap="050">
                          <Text as="span" variant="bodyXs" tone="subdued">
                            {new Date(cliente.createdAt).toLocaleDateString('es-MX', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            Cliente registrado en el sistema
                          </Text>
                        </BlockStack>
                      </div>
                    </BlockStack>
                  </div>

                  <Text as="p" variant="bodyXs" tone="subdued">
                    Solo tú y otros empleados pueden ver los comentarios
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* ═══ SIDEBAR ═══ */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {/* ── Estado de Cuenta (Credit) ── */}
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingSm">
                      Estado de Cuenta
                    </Text>
                    <Icon source={CreditCardIcon} tone="subdued" />
                  </InlineStack>

                  <Box padding="300" background={cliente.balance > 0 ? 'bg-fill-critical-secondary' : 'bg-fill-success-secondary'} borderRadius="200">
                    <BlockStack gap="050" inlineAlign="center">
                      <Text as="p" variant="bodyXs" tone="subdued">
                        Saldo Actual
                      </Text>
                      <Text as="p" variant="headingLg" fontWeight="bold" tone={cliente.balance > 0 ? 'critical' : 'success'}>
                        {formatCurrency(cliente.balance)}
                      </Text>
                    </BlockStack>
                  </Box>

                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodySm" tone="subdued">
                        Límite de crédito
                      </Text>
                      <Text as="p" variant="bodySm" fontWeight="semibold">
                        {formatCurrency(cliente.creditLimit)}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodySm" tone="subdued">
                        Disponible
                      </Text>
                      <Text as="p" variant="bodySm" fontWeight="semibold" tone="success">
                        {formatCurrency(Math.max(0, cliente.creditLimit - cliente.balance))}
                      </Text>
                    </InlineStack>
                    <BlockStack gap="100">
                      <InlineStack align="space-between">
                        <Text as="p" variant="bodyXs" tone="subdued">
                          Uso del crédito
                        </Text>
                        <Text as="p" variant="bodyXs" fontWeight="medium">
                          {Math.min(100, stats.creditUsagePercent).toFixed(0)}%
                        </Text>
                      </InlineStack>
                      <ProgressBar
                        progress={Math.min(100, stats.creditUsagePercent)}
                        size="small"
                        tone={
                          stats.creditUsagePercent > 80
                            ? 'critical'
                            : stats.creditUsagePercent > 50
                              ? 'highlight'
                              : 'primary'
                        }
                      />
                    </BlockStack>
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* ── Contact Info ── */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingSm">
                    Información de Contacto
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={PhoneIcon} tone="subdued" />
                      <Text as="p" variant="bodyMd">
                        {cliente.phone || 'Sin teléfono'}
                      </Text>
                    </InlineStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={LocationIcon} tone="subdued" />
                      <Text as="p" variant="bodyMd">
                        {cliente.address || 'Sin dirección'}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* ── Loyalty Points ── */}
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingSm">
                      Programa de Lealtad
                    </Text>
                    <Badge tone="info">{`${cliente.points || 0} pts`}</Badge>
                  </InlineStack>

                  {loyaltyTransactions.length > 0 ? (
                    <BlockStack gap="200">
                      {loyaltyTransactions.slice(0, 6).map((lt) => (
                        <InlineStack key={lt.id} align="space-between" blockAlign="center">
                          <BlockStack gap="050">
                            <Text as="span" variant="bodySm" fontWeight="medium">
                              {lt.tipo === 'acumulacion'
                                ? 'Acumulación'
                                : lt.tipo === 'canje'
                                  ? 'Canje'
                                  : lt.tipo === 'ajuste'
                                    ? 'Ajuste'
                                    : 'Expiración'}
                            </Text>
                            <Text as="span" variant="bodyXs" tone="subdued">
                              {new Date(lt.fecha).toLocaleDateString('es-MX', {
                                day: 'numeric',
                                month: 'short',
                              })}
                              {lt.saleFolio ? ` · Folio ${lt.saleFolio}` : ''}
                            </Text>
                          </BlockStack>
                          <Badge tone={lt.puntos >= 0 ? 'success' : 'critical'}>
                            {`${lt.puntos >= 0 ? '+' : ''}${lt.puntos}`}
                          </Badge>
                        </InlineStack>
                      ))}
                      {loyaltyTransactions.length > 6 && (
                        <Text as="p" variant="bodyXs" tone="subdued">
                          +{loyaltyTransactions.length - 6} movimientos más
                        </Text>
                      )}
                    </BlockStack>
                  ) : (
                    <Text as="p" variant="bodySm" tone="subdued">
                      Sin movimientos de lealtad
                    </Text>
                  )}
                </BlockStack>
              </Card>

              {/* ── Tags ── */}
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingSm">
                    Etiquetas
                  </Text>
                  <Box background="bg-surface-secondary" padding="200" borderRadius="100" minHeight="40px">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Sin etiquetas
                    </Text>
                  </Box>
                </BlockStack>
              </Card>

              {/* ── Notes ── */}
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingSm">
                      Notas
                    </Text>
                    <Icon source={EditIcon} tone="subdued" />
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Sin notas
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
