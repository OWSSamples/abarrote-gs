'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, type BadgeVariant } from '@cloudflare/kumo/components/badge';
import { Banner } from '@cloudflare/kumo/components/banner';
import { Button, LinkButton } from '@cloudflare/kumo/components/button';
import { DropdownMenu } from '@cloudflare/kumo/components/dropdown';
import { Input } from '@cloudflare/kumo/components/input';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Loader, SkeletonLine } from '@cloudflare/kumo/components/loader';
import { Select } from '@cloudflare/kumo/components/select';
import { Tabs } from '@cloudflare/kumo/components/tabs';
import {
  PlusIcon,
  RefreshIcon,
  ImportIcon,
  ResetIcon,
  CalculatorIcon,
  CalendarIcon,
  CreditCardIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartVerticalIcon,
  DeleteIcon,
  PageIcon,
  EditIcon,
  EmailIcon,
  CashDollarIcon,
  MenuHorizontalIcon,
  ExternalIcon,
  PaymentIcon,
  SearchIcon,
  WalletIcon,
} from '@shopify/polaris-icons';
import {
  activateFreeBillingPlan,
  createBillingCheckoutSession,
  createBillingPortalSession,
  fetchBillingOverview,
  type BillingAvailablePlan,
  type BillingInvoice,
  type BillingOverview,
  type BillingSubscriptionStatus,
} from '@/app/actions/billing-actions';
import { synchronizeServerSession } from '@/lib/auth/session-client';
import type { SettingsSectionProps } from './types';

type BillingTab = 'subscriptions' | 'usage' | 'invoices';
type SubscriptionFilter = 'all' | 'active' | 'free' | 'paid';
type InvoiceFilter = 'all' | 'paid' | 'open' | 'void';

const BILLING_TABS = [
  { value: 'subscriptions', label: 'Suscripciones' },
  { value: 'usage', label: 'Uso facturable' },
  { value: 'invoices', label: 'Facturas y documentos' },
];

const SUBSCRIPTION_FILTER_OPTIONS: ReadonlyArray<{ label: string; value: SubscriptionFilter }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Activas', value: 'active' },
  { label: 'Sin costo', value: 'free' },
  { label: 'De pago', value: 'paid' },
];

const INVOICE_FILTER_OPTIONS: ReadonlyArray<{ label: string; value: InvoiceFilter }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Pagadas', value: 'paid' },
  { label: 'Pendientes', value: 'open' },
  { label: 'Canceladas', value: 'void' },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string): string {
  return value.trim().replace(/[\u200B-\u200D\uFEFF]/g, '').toLowerCase();
}

function formatMoney(amount: number | null, currency: string): string {
  if (amount === null) return '-';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
  }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date);
}

function subscriptionStatus(status: BillingSubscriptionStatus): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'active':
      return { label: 'Activo', variant: 'success' };
    case 'trialing':
      return { label: 'Periodo de prueba', variant: 'info' };
    case 'past_due':
      return { label: 'Pago pendiente', variant: 'error' };
    case 'canceled':
      return { label: 'Cancelado', variant: 'warning' };
    case 'incomplete':
      return { label: 'Configuración pendiente', variant: 'warning' };
    case 'none':
      return { label: 'Sin suscripción', variant: 'neutral' };
    default:
      return { label: 'Por revisar', variant: 'neutral' };
  }
}

function invoiceStatus(status: BillingInvoice['status']): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'paid':
      return { label: 'Pagada', variant: 'success' };
    case 'open':
      return { label: 'Pendiente', variant: 'warning' };
    case 'void':
      return { label: 'Cancelada', variant: 'neutral' };
    case 'draft':
      return { label: 'Borrador', variant: 'info' };
    default:
      return { label: 'Por revisar', variant: 'neutral' };
  }
}

function BillingLoadingState() {
  return (
    <div className="mx-auto grid w-full max-w-[1680px] gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-10 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4" aria-label="Cargando facturación">
        <LayerCard className="space-y-3 p-4">
          <SkeletonLine className="w-2/3" />
          <SkeletonLine className="w-full" />
        </LayerCard>
        <LayerCard className="space-y-3 p-4">
          <SkeletonLine className="w-1/3" />
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-full" />
        </LayerCard>
      </div>
      <LayerCard className="space-y-3 p-4">
        <SkeletonLine className="w-1/2" />
        <SkeletonLine className="w-full" />
        <SkeletonLine className="w-full" />
      </LayerCard>
    </div>
  );
}

function EmptyTableState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="flex size-9 items-center justify-center rounded-md bg-kumo-recessed text-kumo-subtle">
        <PageIcon aria-hidden="true" className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-kumo-default">{title}</p>
      <p className="max-w-md text-xs leading-5 text-kumo-subtle">{description}</p>
    </div>
  );
}

export function BillingSection({ config, updateField, savePatch, saving }: SettingsSectionProps) {
  const sourceEmail = config.contactEmail || config.emailRecipients || config.emailFrom || '';
  const [activeTab, setActiveTab] = useState<BillingTab>('subscriptions');
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionFilter>('all');
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [usagePeriod, setUsagePeriod] = useState('current');
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [configuredEmail, setConfiguredEmail] = useState(sourceEmail);
  const [emailDraft, setEmailDraft] = useState(sourceEmail);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingEmail) setEmailDraft(configuredEmail);
  }, [configuredEmail, editingEmail]);

  useEffect(() => {
    setConfiguredEmail(sourceEmail);
  }, [sourceEmail]);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionStatus = await synchronizeServerSession();
      if (sessionStatus === 'unauthenticated') {
        setOverview(null);
        setError('Tu sesión expiró. Inicia sesión nuevamente para consultar la facturación.');
        return;
      }
      if (sessionStatus === 'unavailable') {
        setOverview(null);
        setError('No fue posible sincronizar tu sesión de acceso. Intenta nuevamente.');
        return;
      }

      const data = await fetchBillingOverview();
      setOverview(data);
      if (data.billingUnavailable) {
        setError(
          data.billingUnavailableDetail
            ?? 'No pudimos conectar con el servicio de facturación. La sesión puede haber expirado o el servicio no está disponible. Reintenta o contacta a soporte.',
        );
      }
    } catch (err) {
      setOverview(null);
      const message = err instanceof Error
        ? err.message
        : 'No fue posible consultar la información de facturación. Intenta de nuevo en unos momentos.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  const openBillingPortal = useCallback(async () => {
    const billingAccountId = overview?.billingAccountId ?? null;
    const existingPortalUrl = overview?.portalUrl ?? null;

    if (!billingAccountId && !existingPortalUrl) {
      setError('No hay una cuenta de facturación asociada a este negocio. Primero activa una suscripción.');
      return;
    }

    setPortalLoading(true);
    setError(null);
    try {
      let url = existingPortalUrl;
      if (!url) {
        if (!billingAccountId) throw new Error('Billing account is required.');
        url = (await createBillingPortalSession(billingAccountId)).url;
      }
      window.location.assign(url);
    } catch {
      setError('No fue posible abrir el portal de facturación. Verifica tu acceso e intenta nuevamente.');
    } finally {
      setPortalLoading(false);
    }
  }, [overview?.billingAccountId, overview?.portalUrl]);

  const startCheckout = useCallback(async (plan: BillingAvailablePlan) => {
    const billingAccountId = overview?.billingAccountId;
    if (!billingAccountId) {
      setError('No hay una cuenta de facturación asociada a este negocio. Actualiza la página e intenta nuevamente.');
      return;
    }

    setCheckoutPlanId(plan.id);
    setError(null);
    try {
      if (plan.totalAmount === 0) {
        await activateFreeBillingPlan({
          billingAccountId,
          planId: plan.id,
        });
        await loadBilling();
        return;
      }

      const { url } = await createBillingCheckoutSession({
        billingAccountId,
        priceId: plan.priceId,
        quantity: 1,
      });
      window.location.assign(url);
    } catch {
      setError(
        plan.totalAmount === 0
          ? 'No fue posible activar el plan Básico. Verifica que no tengas otra suscripción activa.'
          : 'No fue posible preparar el pago de la suscripción. Verifica tu acceso e intenta nuevamente.',
      );
    } finally {
      setCheckoutPlanId(null);
    }
  }, [loadBilling, overview?.billingAccountId]);

  const saveBillingEmail = useCallback(async () => {
    const normalizedEmail = normalizeEmail(emailDraft);
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setEmailError('Ingresa un correo de facturación válido.');
      return;
    }

    setEmailError(null);
    try {
      if (savePatch) {
        await savePatch({ contactEmail: normalizedEmail });
        setConfiguredEmail(normalizedEmail);
      } else {
        updateField('contactEmail', normalizedEmail);
      }
      setEditingEmail(false);
    } catch {
      setEmailError('No fue posible guardar el correo. Intenta nuevamente.');
    }
  }, [emailDraft, savePatch, updateField]);

  const status = subscriptionStatus(overview?.status ?? 'none');
  const invoices = useMemo(() => {
    const query = invoiceSearch.trim().toLowerCase();
    return (overview?.invoices ?? []).filter((invoice) => {
      const matchesStatus = invoiceFilter === 'all' || invoice.status === invoiceFilter;
      const matchesQuery = !query
        || invoice.number.toLowerCase().includes(query)
        || invoice.period.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [invoiceFilter, invoiceSearch, overview?.invoices]);

  const paymentMethod = overview?.paymentMethod ?? null;
  const currentPeriodLabel = overview?.currentPeriodEnd
    ? `Hasta ${formatDate(overview.currentPeriodEnd)}`
    : 'Periodo actual';
  const usagePlanLabel = overview?.planName || 'Sin suscripción activa';
  const availablePlans = useMemo(() => {
    const query = subscriptionSearch.trim().toLowerCase();
    return (overview?.availablePlans ?? []).filter((plan) => {
      const matchesQuery = !query
        || plan.name.toLowerCase().includes(query)
        || plan.description?.toLowerCase().includes(query)
        || plan.code.toLowerCase().includes(query);
      const isCurrent = plan.id === overview?.planId;
      const matchesFilter = subscriptionFilter === 'all'
        || (subscriptionFilter === 'active' && isCurrent)
        || (subscriptionFilter === 'paid' && plan.totalAmount > 0)
        || (subscriptionFilter === 'free' && plan.totalAmount === 0);
      return matchesQuery && matchesFilter;
    });
  }, [overview?.availablePlans, overview?.planId, subscriptionFilter, subscriptionSearch]);

  return (
    <section className="min-h-[620px] bg-kumo-canvas" aria-label="Facturación">
      <div className="border-b border-kumo-line bg-kumo-base">
        <div className="mx-auto w-full max-w-[1680px] px-6 py-3 lg:px-10">
          <Tabs
            tabs={BILLING_TABS}
            value={activeTab}
            onValueChange={(value) => {
              if (value) setActiveTab(value as BillingTab);
            }}
            variant="segmented"
            size="sm"
            activateOnFocus
            className="w-fit"
          />
        </div>
      </div>

      {error && (
        <div className="mx-auto w-full max-w-[1680px] px-6 pt-5 lg:px-10">
          <Banner
            variant="error"
            title="Facturación no disponible"
            description={error}
            action={(
              <div className="flex items-center gap-2">
                <Badge variant="error">No disponible</Badge>
                <Button
                  shape="square"
                  size="sm"
                  variant="ghost"
                  aria-label="Reintentar consulta de facturación"
                  title="Reintentar"
                  onClick={loadBilling}
                  icon={<RefreshIcon className="h-5 w-5" />}
                  className="text-kumo-danger hover:bg-kumo-danger-tint/60"
                />
              </div>
            )}
          />
        </div>
      )}

      {loading ? (
        <BillingLoadingState />
      ) : (
        <div
          className={activeTab === 'subscriptions'
            ? 'mx-auto grid w-full max-w-[1680px] gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-10 xl:grid-cols-[minmax(0,1fr)_420px]'
            : 'mx-auto w-full max-w-[1680px] px-6 py-8 lg:px-10'}
        >
          <div className="min-w-0 space-y-4">
            {activeTab === 'subscriptions' && (
              <>
                <LayerCard className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-3xl text-xs leading-5 text-kumo-subtle">
                    El plan Básico permanece activo sin costo y no requiere tarjeta. Los planes de pago se renuevan
                    automáticamente al final del periodo actual, salvo que canceles la renovación. Los cambios de
                    pago y cancelaciones se confirman en el portal seguro de facturación.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={openBillingPortal}
                    loading={portalLoading}
                    icon={<ExternalIcon className="h-5 w-5" />}
                    className="shrink-0"
                  >
                    Administrar facturación
                  </Button>
                </LayerCard>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_164px]">
                  <div className="relative">
                    <SearchIcon
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-kumo-subtle"
                    />
                    <Input
                      aria-label="Buscar suscripciones"
                      placeholder="Buscar"
                      value={subscriptionSearch}
                      onChange={(event) => setSubscriptionSearch(event.currentTarget.value)}
                      className="w-full pl-10"
                    />
                  </div>
                  <Select<SubscriptionFilter>
                    aria-label="Filtrar suscripciones por categoría"
                    value={subscriptionFilter}
                    onValueChange={(value) => {
                      if (value) setSubscriptionFilter(value);
                    }}
                    items={SUBSCRIPTION_FILTER_OPTIONS}
                    renderValue={(value) => SUBSCRIPTION_FILTER_OPTIONS.find((option) => option.value === value)?.label}
                  >
                    {SUBSCRIPTION_FILTER_OPTIONS.map((option) => (
                      <Select.Option key={option.value} value={option.value}>{option.label}</Select.Option>
                    ))}
                  </Select>
                </div>

                <LayerCard className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-kumo-line bg-kumo-base text-kumo-default">
                          <th className="px-4 py-3 font-semibold">Producto</th>
                          <th className="px-4 py-3 font-semibold">Estado del servicio</th>
                          <th className="px-4 py-3 font-semibold">Se renueva el</th>
                          <th className="px-4 py-3 font-semibold">Precio</th>
                          <th className="w-12 px-3 py-3"><span className="sr-only">Acciones</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-kumo-hairline bg-kumo-recessed/60">
                          <th colSpan={5} className="px-4 py-2 text-xs font-medium uppercase text-kumo-subtle">
                            Planes
                          </th>
                        </tr>
                        {availablePlans.length > 0 ? availablePlans.map((plan) => {
                          const isCurrent = plan.id === overview?.planId;
                          return (
                            <tr key={plan.id} className="border-b border-kumo-hairline last:border-b-0">
                              <td className="px-4 py-3">
                                <p className="font-semibold text-kumo-default">{plan.name}</p>
                                <p className="mt-0.5 max-w-md text-xs text-kumo-subtle">{plan.description}</p>
                                <p className="mt-1 text-xs text-kumo-subtle">
                                  {plan.maxUsers ?? '-'} usuarios · {plan.maxStores ?? '-'} sucursales
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={isCurrent ? status.variant : 'neutral'}>
                                  {isCurrent ? status.label : 'Disponible'}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-kumo-subtle">
                                {plan.totalAmount === 0
                                  ? 'No requiere renovación'
                                  : isCurrent
                                  ? overview?.cancelAtPeriodEnd
                                    ? 'No se renovará'
                                    : formatDate(overview?.currentPeriodEnd ?? null)
                                  : 'Mensual'}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-kumo-default">
                                  {formatMoney(plan.totalAmount, plan.currency)} / mes
                                </p>
                                <p className="mt-0.5 text-xs text-kumo-subtle">
                                  {formatMoney(plan.baseAmount, plan.currency)} + {formatMoney(plan.taxAmount, plan.currency)} IVA
                                </p>
                              </td>
                              <td className="px-3 py-3 text-right">
                                {isCurrent ? (
                                  <DropdownMenu>
                                    <DropdownMenu.Trigger>
                                      <Button
                                        shape="square"
                                        size="sm"
                                        variant="ghost"
                                        aria-label={`Abrir acciones del plan ${plan.name}`}
                                        icon={<MenuHorizontalIcon className="h-5 w-5" />}
                                      />
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content>
                                      <DropdownMenu.Item icon={<ExternalIcon className="h-5 w-5" />} onClick={openBillingPortal}>
                                        Administrar suscripción
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item icon={<RefreshIcon className="h-5 w-5" />} onClick={loadBilling}>
                                        Actualizar información
                                      </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                  </DropdownMenu>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    loading={checkoutPlanId === plan.id}
                                    disabled={checkoutPlanId !== null}
                                    onClick={() => void startCheckout(plan)}
                                  >
                                    {plan.totalAmount === 0 ? 'Activar gratis' : 'Elegir'}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={5}>
                              <EmptyTableState
                                title={overview ? 'No hay resultados' : 'No hay una suscripción disponible'}
                                description={overview
                                  ? 'Ajusta la búsqueda o cambia la categoría seleccionada.'
                                  : 'Cuando actives un plan para este negocio, aparecerá en esta tabla.'}
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </LayerCard>
              </>
            )}

            {activeTab === 'usage' && (
              <div className="grid min-h-[650px] gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="border-r border-kumo-line pr-6" aria-label="Filtros de uso facturable">
                  <div className="flex items-center justify-between border-b border-kumo-line pb-3">
                    <h2 className="text-sm font-semibold text-kumo-default">Filtros</h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<ResetIcon className="h-5 w-5" />}
                      onClick={() => setUsagePeriod('current')}
                    >
                      Reiniciar
                    </Button>
                  </div>

                  <div className="space-y-4 pt-4">
                    <LayerCard className="overflow-hidden p-0">
                      <div className="border-b border-kumo-line px-4 py-3">
                        <p className="text-sm font-medium text-kumo-subtle">Suscripción</p>
                      </div>
                      <div className="p-4">
                        <Select<string>
                          aria-label="Filtrar por suscripción"
                          value="current"
                          items={[{ label: usagePlanLabel, value: 'current' }]}
                          renderValue={() => usagePlanLabel}
                        >
                          <Select.Option value="current">{usagePlanLabel}</Select.Option>
                        </Select>
                      </div>
                    </LayerCard>

                    <LayerCard className="overflow-hidden p-0">
                      <div className="border-b border-kumo-line px-4 py-3">
                        <p className="text-sm font-medium text-kumo-subtle">Periodo de facturación</p>
                      </div>
                      <div className="p-4">
                        <Select<string>
                          aria-label="Filtrar por periodo de facturación"
                          value={usagePeriod}
                          onValueChange={(value) => {
                            if (value) setUsagePeriod(value);
                          }}
                          items={[{ label: currentPeriodLabel, value: 'current' }]}
                          renderValue={() => currentPeriodLabel}
                        >
                          <Select.Option value="current">
                            <span className="inline-flex items-center gap-2">
                              <CalendarIcon aria-hidden="true" className="h-5 w-5" />
                              {currentPeriodLabel}
                            </span>
                          </Select.Option>
                        </Select>
                      </div>
                    </LayerCard>
                  </div>
                </aside>

                <div className="min-w-0 space-y-5">
                  <div className="flex min-h-9 items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-kumo-subtle">
                      <ChartVerticalIcon aria-hidden="true" className="h-5 w-5" />
                      <span className="text-xs">Consumo del periodo seleccionado</span>
                    </div>
                    <Button
                      size="base"
                      variant="secondary"
                      icon={<PlusIcon className="h-5 w-5" />}
                      disabled
                      title="Requiere soporte de alertas de presupuesto en el servicio de facturación"
                    >
                      Crear alerta de presupuesto
                    </Button>
                  </div>

                  <LayerCard className="overflow-hidden p-0">
                    <div className="border-b border-kumo-line px-4 py-3">
                      <h2 className="text-sm font-semibold text-kumo-subtle">Resumen de gastos</h2>
                    </div>
                    <dl className="grid sm:grid-cols-3">
                      {[
                        {
                          label: 'Costo total',
                          value: '-',
                          description: 'Sin consumo medido reportado',
                          icon: <CashDollarIcon aria-hidden="true" className="h-5 w-5" />,
                        },
                        {
                          label: 'Costo del ciclo proyectado',
                          value: '-',
                          description: currentPeriodLabel,
                          icon: <CalculatorIcon aria-hidden="true" className="h-5 w-5" />,
                        },
                        {
                          label: 'Costo medio diario',
                          value: '-',
                          description: 'Sin observaciones suficientes',
                          icon: <ClockIcon aria-hidden="true" className="h-5 w-5" />,
                        },
                      ].map((metric) => (
                        <div
                          key={metric.label}
                          className="border-b border-kumo-line px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
                        >
                          <dt className="flex items-center gap-2 text-xs font-medium uppercase text-kumo-subtle">
                            {metric.icon}
                            {metric.label}
                          </dt>
                          <dd className="mt-1 text-lg font-semibold text-kumo-default">{metric.value}</dd>
                          <p className="mt-1 text-xs text-kumo-subtle">{metric.description}</p>
                        </div>
                      ))}
                    </dl>
                  </LayerCard>

                  <LayerCard className="overflow-hidden p-0">
                    <div className="border-b border-kumo-line px-4 py-3">
                      <h2 className="text-sm font-semibold text-kumo-subtle">Desglose de costos</h2>
                    </div>
                    <div className="flex min-h-[430px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                      <ChartVerticalIcon className="h-5 w-5 text-kumo-subtle" aria-hidden="true" />
                      <p className="text-sm font-medium text-kumo-default">
                        No hay datos de uso disponibles para mostrar
                      </p>
                      <p className="max-w-lg text-xs leading-5 text-kumo-subtle">
                        El servicio de facturación todavía no reporta cargos medidos para esta suscripción y periodo.
                      </p>
                    </div>
                  </LayerCard>
                </div>
              </div>
            )}

            {activeTab === 'invoices' && (
              <>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="relative">
                    <SearchIcon
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-kumo-subtle"
                    />
                    <Input
                      aria-label="Buscar facturas"
                      placeholder="Buscar por folio o periodo"
                      value={invoiceSearch}
                      onChange={(event) => setInvoiceSearch(event.currentTarget.value)}
                      className="w-full pl-10"
                    />
                  </div>
                  <Select<InvoiceFilter>
                    aria-label="Filtrar facturas por estado"
                    value={invoiceFilter}
                    onValueChange={(value) => {
                      if (value) setInvoiceFilter(value);
                    }}
                    items={INVOICE_FILTER_OPTIONS}
                    renderValue={(value) => INVOICE_FILTER_OPTIONS.find((option) => option.value === value)?.label}
                  >
                    {INVOICE_FILTER_OPTIONS.map((option) => (
                      <Select.Option key={option.value} value={option.value}>{option.label}</Select.Option>
                    ))}
                  </Select>
                </div>

                <LayerCard className="overflow-hidden p-0">
                  {invoices.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-kumo-line bg-kumo-recessed/60">
                            <th className="px-4 py-3 font-semibold">Documento</th>
                            <th className="px-4 py-3 font-semibold">Periodo</th>
                            <th className="px-4 py-3 font-semibold">Importe</th>
                            <th className="px-4 py-3 font-semibold">Estado</th>
                            <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((invoice) => {
                            const invoiceBadge = invoiceStatus(invoice.status);
                            return (
                              <tr key={invoice.id} className="border-b border-kumo-hairline last:border-b-0">
                                <td className="px-4 py-3">
                                  <p className="font-medium text-kumo-default">{invoice.number}</p>
                                  <p className="mt-0.5 text-xs text-kumo-subtle">{formatDate(invoice.issuedAt)}</p>
                                </td>
                                <td className="px-4 py-3 text-kumo-subtle">{invoice.period}</td>
                                <td className="px-4 py-3 font-medium text-kumo-default">
                                  {formatMoney(invoice.amount, invoice.currency)}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant={invoiceBadge.variant}>
                                    {invoiceBadge.label}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex justify-end gap-2">
                                    {invoice.hostedUrl && (
                                      <LinkButton
                                        size="sm"
                                        variant="secondary"
                                        href={invoice.hostedUrl}
                                        external
                                        icon={<ExternalIcon className="h-5 w-5" />}
                                      >
                                        Ver
                                      </LinkButton>
                                    )}
                                    {invoice.pdfUrl && (
                                      <LinkButton
                                        size="sm"
                                        variant="secondary"
                                        href={invoice.pdfUrl}
                                        external
                                        icon={<ImportIcon className="h-5 w-5" />}
                                      >
                                        PDF
                                      </LinkButton>
                                    )}
                                    {!invoice.hostedUrl && !invoice.pdfUrl && (
                                      <span className="text-xs text-kumo-subtle">Sin archivo</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyTableState
                      title="No hay facturas para mostrar"
                      description="Los documentos emitidos para este negocio aparecerán aquí."
                    />
                  )}
                </LayerCard>
              </>
            )}
          </div>

          {activeTab === 'subscriptions' && (
          <aside aria-label="Datos de facturación">
            <LayerCard className="overflow-hidden p-0">
              <section aria-labelledby="billing-email-heading">
              <header className="flex items-center gap-2 border-b border-kumo-line px-4 py-3">
                <EmailIcon aria-hidden="true" className="h-5 w-5 text-kumo-subtle" />
                <h2 id="billing-email-heading" className="text-sm font-semibold text-kumo-subtle">
                  Correo de facturación
                </h2>
              </header>
              <div className="p-4">
                {editingEmail ? (
                  <div className="space-y-3">
                    <Input
                      label="Correo para documentos y avisos"
                      type="email"
                      value={emailDraft}
                      onChange={(event) => setEmailDraft(event.currentTarget.value)}
                      error={emailError ?? undefined}
                      autoComplete="email"
                      className="w-full"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEmailDraft(configuredEmail);
                          setEmailError(null);
                          setEditingEmail(false);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button size="sm" variant="primary" onClick={saveBillingEmail} loading={saving}>
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2 text-sm text-kumo-default">
                      <EmailIcon className="h-5 w-5 shrink-0 text-kumo-subtle" aria-hidden="true" />
                      <span className="truncate">{configuredEmail || 'Sin correo configurado'}</span>
                    </div>
                    <Button
                      shape="square"
                      size="sm"
                      variant="ghost"
                      aria-label="Editar correo de facturación"
                      icon={<EditIcon className="h-5 w-5" />}
                      onClick={() => setEditingEmail(true)}
                    />
                  </div>
                )}
              </div>
            </section>

            <section aria-labelledby="billing-payment-heading" className="border-t border-kumo-line">
              <header className="flex items-center justify-between gap-3 border-b border-kumo-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <PaymentIcon aria-hidden="true" className="h-5 w-5 text-kumo-subtle" />
                  <div>
                    <h2 id="billing-payment-heading" className="text-sm font-semibold text-kumo-default">
                      Método de facturación
                    </h2>
                    <p className="text-xs text-kumo-subtle">Método principal del negocio</p>
                  </div>
                </div>
              </header>

              {paymentMethod?.last4 ? (
                <div>
                  <div className="min-h-44 bg-kumo-recessed/55 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex size-10 items-center justify-center rounded-md border border-kumo-line bg-kumo-base text-kumo-subtle">
                        <CreditCardIcon aria-hidden="true" className="h-5 w-5" />
                      </div>
                      <Badge variant="success">Principal</Badge>
                    </div>
                    <div className="mt-8 space-y-1 font-mono text-sm text-kumo-default">
                      <p className="tracking-[0.14em]">•••• •••• •••• {paymentMethod.last4}</p>
                      <p className="capitalize">{paymentMethod.brand || 'Tarjeta'}</p>
                      {paymentMethod.expMonth && paymentMethod.expYear && (
                        <p className="pt-2 text-xs text-kumo-subtle">
                          Expira {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-kumo-line p-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={openBillingPortal}
                      loading={portalLoading}
                      icon={<EditIcon className="h-5 w-5" />}
                    >
                      Actualizar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary-destructive"
                      onClick={openBillingPortal}
                      loading={portalLoading}
                      icon={<DeleteIcon className="h-5 w-5" />}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-kumo-recessed text-kumo-subtle">
                      <WalletIcon aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-kumo-default">Sin método de pago</p>
                      <p className="mt-1 text-xs leading-5 text-kumo-subtle">
                        Agrega un método seguro para activar renovaciones y compras.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={openBillingPortal}
                    loading={portalLoading}
                    disabled={!overview?.billingAccountId && !overview?.portalUrl}
                    icon={<WalletIcon className="h-5 w-5" />}
                    className="mt-4 w-full"
                  >
                    Agregar método
                  </Button>
                </div>
              )}
            </section>

            <section
              aria-labelledby="billing-security-heading"
              className="border-t border-dashed border-kumo-line bg-kumo-recessed/40 px-4 py-3"
            >
              <div className="flex items-start gap-3 text-xs leading-5 text-kumo-subtle">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-kumo-success" aria-hidden="true" />
                <p id="billing-security-heading">
                  Los cambios del método de pago se realizan en el portal seguro y permanecen aislados para este negocio.
                </p>
              </div>
            </section>
          </LayerCard>
          </aside>
          )}
        </div>
      )}

      {portalLoading && (
        <span className="sr-only" role="status">
          <Loader size="sm" aria-label="Abriendo portal de facturación" />
        </span>
      )}
    </section>
  );
}
