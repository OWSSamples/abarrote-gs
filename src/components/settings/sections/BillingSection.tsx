'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Card,
  Divider,
  Icon,
  IndexTable,
  InlineGrid,
  InlineStack,
  Layout,
  Select,
  Spinner,
  Text,
} from '@shopify/polaris';
import {
  CalendarIcon,
  CreditCardIcon,
  OrderIcon,
  PlanIcon,
  ReceiptDollarIcon,
} from '@shopify/polaris-icons';
import {
  createBillingPortalSession,
  fetchBillingOverview,
  type BillingInvoice,
  type BillingOverview,
} from '@/app/actions/billing-actions';
import type { SettingsSectionProps } from './types';

type InvoiceFilter = 'all' | 'paid' | 'open' | 'void';
type BillingCycle = 'monthly' | 'annual';
type InvoiceDelivery = 'email' | 'portal_email';
type BadgeTone = 'success' | 'attention' | 'warning' | 'critical' | undefined;

const INVOICE_FILTER_OPTIONS = [
  { label: 'Todas las facturas', value: 'all' },
  { label: 'Pagadas', value: 'paid' },
  { label: 'Pendientes', value: 'open' },
  { label: 'Canceladas', value: 'void' },
];

const BILLING_CYCLE_OPTIONS = [
  { label: 'Mensual', value: 'monthly' },
  { label: 'Anual', value: 'annual' },
];

const INVOICE_DELIVERY_OPTIONS = [
  { label: 'Enviar al correo fiscal', value: 'email' },
  { label: 'Guardar en portal y enviar correo', value: 'portal_email' },
];

function textOrPending(value: string | undefined | null): string {
  const normalized = value?.trim();
  return normalized ? normalized : 'Pendiente';
}

function formatMoney(amount: number | null, currency: string): string {
  if (amount === null) return 'Sin importe';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
  }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin programar';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date);
}

function subscriptionStatus(status: BillingOverview['status']): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'active':
      return { label: 'Activa', tone: 'success' };
    case 'trialing':
      return { label: 'Prueba', tone: 'attention' };
    case 'past_due':
      return { label: 'Pago pendiente', tone: 'critical' };
    case 'canceled':
      return { label: 'Cancelada', tone: 'warning' };
    case 'incomplete':
      return { label: 'Incompleta', tone: 'attention' };
    case 'none':
      return { label: 'Sin activar', tone: 'warning' };
    default:
      return { label: 'Por revisar', tone: 'attention' };
  }
}

function invoiceStatus(status: BillingInvoice['status']): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'paid':
      return { label: 'Pagada', tone: 'success' };
    case 'open':
      return { label: 'Pendiente', tone: 'attention' };
    case 'void':
      return { label: 'Cancelada', tone: 'warning' };
    case 'draft':
      return { label: 'Borrador', tone: undefined };
    default:
      return { label: 'Por revisar', tone: 'attention' };
  }
}

export function BillingSection({ config }: SettingsSectionProps) {
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [invoiceDelivery, setInvoiceDelivery] = useState<InvoiceDelivery>('portal_email');
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBillingOverview();
      setOverview(data);
    } catch {
      setOverview(null);
      setError('No fue posible consultar la información de facturación. Intenta de nuevo en unos momentos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  const openBillingPortal = useCallback(async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const url = overview?.portalUrl ?? (await createBillingPortalSession()).url;
      window.location.assign(url);
    } catch {
      setError('No fue posible abrir el portal de facturación. Verifica tu acceso e intenta nuevamente.');
    } finally {
      setPortalLoading(false);
    }
  }, [overview?.portalUrl]);

  const status = subscriptionStatus(overview?.status ?? 'none');
  const invoices = useMemo(() => {
    const list = overview?.invoices ?? [];
    return invoiceFilter === 'all' ? list : list.filter((invoice) => invoice.status === invoiceFilter);
  }, [invoiceFilter, overview?.invoices]);

  const planAmount = overview
    ? formatMoney(overview.amount, overview.currency)
    : 'Sin importe';
  const paymentMethod = overview?.paymentMethod?.last4
    ? `${overview.paymentMethod.brand ?? 'Tarjeta'} terminación ${overview.paymentMethod.last4}`
    : 'No configurado';

  return (
    <BlockStack gap="500">
      {error && (
        <Banner tone="critical" title="Facturación no disponible" onDismiss={() => setError(null)}>
          <p>{error}</p>
        </Banner>
      )}

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="start" gap="300">
                  <BlockStack gap="100">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={PlanIcon} tone="base" />
                      <Text as="h2" variant="headingMd">
                        Suscripción del negocio
                      </Text>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Consulta el plan contratado, usuarios incluidos, renovación, facturas y método de pago.
                    </Text>
                  </BlockStack>
                  <ButtonGroup>
                    <Button onClick={loadBilling} loading={loading}>
                      Actualizar
                    </Button>
                    <Button
                      variant="primary"
                      onClick={openBillingPortal}
                      loading={portalLoading}
                      disabled={loading}
                    >
                      Abrir portal de cobro
                    </Button>
                  </ButtonGroup>
                </InlineStack>

                {loading ? (
                  <Box padding="600">
                    <InlineStack align="center" blockAlign="center" gap="200">
                      <Spinner accessibilityLabel="Consultando facturación" size="small" />
                      <Text as="span" variant="bodySm" tone="subdued">
                        Consultando facturación...
                      </Text>
                    </InlineStack>
                  </Box>
                ) : (
                  <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="300">
                    {[
                      {
                        label: 'Plan',
                        value: overview?.planName ?? 'Sin plan activo',
                        caption: overview?.planCode ?? 'El portal de cobro no reporta un plan activo.',
                        icon: PlanIcon,
                      },
                      {
                        label: 'Usuarios incluidos',
                        value: String(overview?.includedUsers ?? Math.max(1, Number(config.estimatedUsers ?? 1))),
                        caption: 'Límite usado para altas de colaboradores activos.',
                        icon: OrderIcon,
                      },
                      {
                        label: 'Costo recurrente',
                        value: planAmount,
                        caption: overview?.interval === 'year' ? 'Cobro anual' : overview?.interval === 'month' ? 'Cobro mensual' : 'Ciclo no informado',
                        icon: ReceiptDollarIcon,
                      },
                      {
                        label: 'Método de pago',
                        value: paymentMethod,
                        caption: overview?.paymentMethod ? 'Método predeterminado del portal.' : 'Sin método asociado al negocio.',
                        icon: CreditCardIcon,
                      },
                    ].map((stat) => (
                      <Box
                        key={stat.label}
                        padding="400"
                        borderColor="border"
                        borderWidth="025"
                        borderRadius="300"
                        background="bg-surface-secondary"
                      >
                        <BlockStack gap="200">
                          <InlineStack align="space-between" blockAlign="center">
                            <Text as="span" variant="bodySm" tone="subdued">
                              {stat.label}
                            </Text>
                            <Icon source={stat.icon} tone="subdued" />
                          </InlineStack>
                          <Text as="p" variant="headingMd" truncate>
                            {stat.value}
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            {stat.caption}
                          </Text>
                        </BlockStack>
                      </Box>
                    ))}
                  </InlineGrid>
                )}
              </BlockStack>
            </Card>

            <Card padding="0">
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center" gap="300">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Facturas y recibos
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Historial sincronizado desde el portal de facturación del tenant.
                    </Text>
                  </BlockStack>
                  <Select
                    label="Filtrar facturas"
                    labelHidden
                    options={INVOICE_FILTER_OPTIONS}
                    value={invoiceFilter}
                    onChange={(value) => setInvoiceFilter(value as InvoiceFilter)}
                  />
                </InlineStack>
              </Box>
              <Divider />
              <IndexTable
                resourceName={{ singular: 'factura', plural: 'facturas' }}
                itemCount={invoices.length}
                selectable={false}
                headings={[
                  { title: 'Factura' },
                  { title: 'Periodo' },
                  { title: 'Importe' },
                  { title: 'Estado' },
                  { title: 'Acciones' },
                ]}
              >
                {invoices.map((invoice, index) => {
                  const invoiceBadge = invoiceStatus(invoice.status);
                  return (
                    <IndexTable.Row id={invoice.id} key={invoice.id} position={index}>
                      <IndexTable.Cell>
                        <BlockStack gap="050">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {invoice.number}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {formatDate(invoice.issuedAt)}
                          </Text>
                        </BlockStack>
                      </IndexTable.Cell>
                      <IndexTable.Cell>{invoice.period}</IndexTable.Cell>
                      <IndexTable.Cell>{formatMoney(invoice.amount, invoice.currency)}</IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone={invoiceBadge.tone}>{invoiceBadge.label}</Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <InlineStack gap="200">
                          {invoice.hostedUrl && (
                            <Button url={invoice.hostedUrl} target="_blank" size="slim">
                              Ver
                            </Button>
                          )}
                          {invoice.pdfUrl && (
                            <Button url={invoice.pdfUrl} target="_blank" size="slim">
                              PDF
                            </Button>
                          )}
                          {!invoice.hostedUrl && !invoice.pdfUrl && (
                            <Text as="span" variant="bodySm" tone="subdued">
                              Sin enlace
                            </Text>
                          )}
                        </InlineStack>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  );
                })}
              </IndexTable>
              {invoices.length === 0 && (
                <Box padding="500">
                  <BlockStack gap="300" inlineAlign="center">
                    <Box padding="300" background="bg-surface-secondary" borderRadius="300">
                      <Icon source={ReceiptDollarIcon} tone="subdued" />
                    </Box>
                    <BlockStack gap="100" inlineAlign="center">
                      <Text as="h3" variant="headingMd">
                        No hay facturas para mostrar
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                        Cuando el portal emita facturas para este tenant, aparecerán en esta tabla.
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </Box>
              )}
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={CreditCardIcon} tone="base" />
                  <Text as="h2" variant="headingMd">
                    Cobro
                  </Text>
                </InlineStack>
                <Select
                  label="Ciclo de cobro"
                  options={BILLING_CYCLE_OPTIONS}
                  value={billingCycle}
                  onChange={(value) => setBillingCycle(value as BillingCycle)}
                />
                <Select
                  label="Entrega de factura"
                  options={INVOICE_DELIVERY_OPTIONS}
                  value={invoiceDelivery}
                  onChange={(value) => setInvoiceDelivery(value as InvoiceDelivery)}
                />
                <Divider />
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Estado de pago
                    </Text>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </InlineStack>
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Renovación
                    </Text>
                    <Text as="span" variant="bodySm">
                      {formatDate(overview?.currentPeriodEnd ?? null)}
                    </Text>
                  </InlineStack>
                </BlockStack>
                <Button onClick={openBillingPortal} loading={portalLoading} disabled={loading} fullWidth>
                  Actualizar método de pago
                </Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={CalendarIcon} tone="base" />
                  <Text as="h2" variant="headingMd">
                    Perfil fiscal
                  </Text>
                </InlineStack>
                <BlockStack gap="250">
                  {[
                    {
                      label: 'Razón social',
                      value: textOrPending(config.legalName || config.storeName),
                      status: config.legalName ? 'Listo' : 'Revisar',
                      tone: config.legalName ? 'success' : 'attention',
                    },
                    {
                      label: 'RFC o identificador fiscal',
                      value: textOrPending(config.rfc),
                      status: config.rfc ? 'Validado' : 'Pendiente',
                      tone: config.rfc ? 'success' : 'warning',
                    },
                    {
                      label: 'Correo de facturación',
                      value: textOrPending(config.contactEmail || config.emailRecipients || config.emailFrom),
                      status: config.contactEmail || config.emailRecipients || config.emailFrom ? 'Activo' : 'Revisar',
                      tone: config.contactEmail || config.emailRecipients || config.emailFrom ? 'success' : 'attention',
                    },
                    {
                      label: 'País',
                      value: textOrPending(config.country),
                      status: config.country ? 'Localizado' : 'Pendiente',
                      tone: config.country ? 'success' : 'warning',
                    },
                  ].map((item) => (
                    <Box key={item.label} paddingBlockEnd="200">
                      <InlineStack align="space-between" blockAlign="start" gap="300" wrap={false}>
                        <BlockStack gap="050">
                          <Text as="span" variant="bodySm" tone="subdued">
                            {item.label}
                          </Text>
                          <Text as="span" variant="bodyMd" fontWeight="semibold" truncate>
                            {item.value}
                          </Text>
                        </BlockStack>
                        <Badge tone={item.tone as BadgeTone}>{item.status}</Badge>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
                <Divider />
                <Text as="p" variant="bodySm" tone="subdued">
                  Los datos fiscales se toman del perfil del negocio para mantener un solo registro por tenant.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </BlockStack>
  );
}
