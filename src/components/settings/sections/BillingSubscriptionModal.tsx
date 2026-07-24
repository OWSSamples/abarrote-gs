'use client';

import { useCallback, useEffect, useState } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Button } from '@cloudflare/kumo/components/button';
import { Badge } from '@cloudflare/kumo/components/badge';
import { CheckCircleIcon, LockIcon } from '@shopify/polaris-icons';
import {
  activateFreeBillingPlan,
  createBillingSubscriptionIntent,
  synchronizeBillingSubscriptionIntent,
  type BillingAvailablePlan,
} from '@/app/actions/billing-actions';

interface BillingSubscriptionModalProps {
  plan: BillingAvailablePlan;
  billingAccountId: string;
  billingEmail: string;
  onClose: () => void;
  onComplete: () => Promise<void>;
}

interface PaymentSession {
  subscriptionId: string;
  clientSecret: string;
  stripePromise: Promise<Stripe | null>;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
  }).format(amount);
}

function CustomKumoSubscriptionForm({
  plan,
  billingEmail,
  acceptedTerms,
  setAcceptedTerms,
  acceptedRenewal,
  setAcceptedRenewal,
  subscriptionId,
  onClose,
  onComplete,
}: {
  plan: BillingAvailablePlan;
  billingEmail: string;
  acceptedTerms: boolean;
  setAcceptedTerms: (val: boolean) => void;
  acceptedRenewal: boolean;
  setAcceptedRenewal: (val: boolean) => void;
  subscriptionId: string;
  onClose: () => void;
  onComplete: () => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Address fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('MX');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const canSubmit =
    acceptedTerms &&
    acceptedRenewal &&
    Boolean(
      firstName.trim() &&
        lastName.trim() &&
        addressLine1.trim() &&
        city.trim() &&
        state.trim() &&
        postalCode.trim(),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!canSubmit) {
      setError('Por favor completa todos los campos requeridos y acepta los términos.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/settings?section=billing&subscription=complete`,
        payment_method_data: {
          billing_details: {
            name: `${firstName} ${lastName}`.trim(),
            email: billingEmail || undefined,
            address: {
              country,
              line1: addressLine1,
              line2: addressLine2 || undefined,
              city,
              state,
              postal_code: postalCode,
            },
          },
        },
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'No fue posible procesar el pago. Revisa los datos de la tarjeta.');
      setSubmitting(false);
      return;
    }

    if (
      paymentIntent &&
      (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')
    ) {
      try {
        const result = await synchronizeBillingSubscriptionIntent(subscriptionId);
        if (!result.success) {
          setError(
            result.error?.description ??
              'El pago fue recibido, pero la suscripción aún se está sincronizando. Actualiza la sección de facturación en unos momentos.',
          );
          setSubmitting(false);
          return;
        }
        await onComplete();
        onClose();
      } catch {
        setError(
          'El pago fue recibido, pero la suscripción aún se está sincronizando. Actualiza la sección de facturación en unos momentos.',
        );
        setSubmitting(false);
      }
    } else {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Header */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <LockIcon aria-hidden="true" className="size-4" />
          Facturación segura
        </div>
        <h1 id="billing-subscription-title" className="text-2xl font-bold tracking-tight text-kumo-default sm:text-3xl">
          Activar Plan de pago de Kiosko {plan.name}
        </h1>
      </div>

      {/* 2. Stripe Payment Element Card Details */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-kumo-subtle">
          Datos de la tarjeta
        </label>
        <div className="rounded-lg border border-kumo-line bg-kumo-base p-4">
          <PaymentElement
            options={{
              layout: 'tabs',
              fields: { billingDetails: 'never' },
            }}
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-kumo-subtle">
          Al suministrar tus datos de tarjeta, le permites a Opendex Kiosko efectuar futuros cargos en tu tarjeta conforme a las condiciones estipuladas.
        </p>
      </div>

      {/* 3. Dirección de facturación */}
      <div className="space-y-3.5 border-t border-kumo-line pt-6">
        <h2 className="text-sm font-semibold text-kumo-default">Dirección de facturación</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-kumo-subtle">Nombre *</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-md border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Ej. Juan"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-kumo-subtle">Apellidos *</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-md border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Ej. Pérez"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-kumo-subtle">País *</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-md border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="MX">México</option>
              <option value="US">Estados Unidos</option>
              <option value="CO">Colombia</option>
              <option value="CL">Chile</option>
              <option value="AR">Argentina</option>
              <option value="ES">España</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-kumo-subtle">Código Postal *</label>
            <input
              type="text"
              required
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="w-full rounded-md border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Ej. 06600"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-kumo-subtle">Dirección línea 1 *</label>
          <input
            type="text"
            required
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            className="w-full rounded-md border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Calle, número exterior e interior"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-kumo-subtle">Dirección línea 2 (opcional)</label>
          <input
            type="text"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            className="w-full rounded-md border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Colonia, piso, departamento"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-kumo-subtle">Ciudad *</label>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-md border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Ciudad o municipio"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-kumo-subtle">Estado / Provincia *</label>
            <input
              type="text"
              required
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full rounded-md border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Estado o provincia"
            />
          </div>
        </div>
      </div>

      {/* 4. Terms and Renewal Checkboxes */}
      <div className="space-y-3.5 border-t border-kumo-line pt-6 text-sm text-kumo-subtle">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            className="mt-0.5 size-4 rounded border-kumo-line text-blue-600 focus:ring-blue-500"
          />
          <span className="leading-snug">
            Acepto los{' '}
            <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700">
              Términos de servicio
            </a>{' '}
            y la{' '}
            <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700">
              Política de privacidad
            </a>.
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={acceptedRenewal}
            onChange={(event) => setAcceptedRenewal(event.target.checked)}
            className="mt-0.5 size-4 rounded border-kumo-line text-blue-600 focus:ring-blue-500"
          />
          <span className="leading-snug">
            Autorizo a Opendex Kiosko a cargar esta tarjeta por el importe recurrente de{' '}
            <strong>{formatMoney(plan.totalAmount, plan.currency)}/mes</strong> hasta cancelar la suscripción.
            La cancelación será efectiva al final del período de facturación actual.
          </span>
        </label>

        <p className="pt-1 text-xs text-kumo-subtle">
          El comprobante de pago se enviará a <strong>{billingEmail || 'tu correo de facturación'}</strong>.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* 5. Submit Button */}
      <Button
        type="submit"
        className="w-full"
        variant="primary"
        disabled={!canSubmit || !stripe}
        loading={submitting}
      >
        Activar Plan de pago de Kiosko {plan.name}
      </Button>
    </form>
  );
}

export function BillingSubscriptionModal({
  plan,
  billingAccountId,
  billingEmail,
  onClose,
  onComplete,
}: BillingSubscriptionModalProps) {
  const isFree = plan.totalAmount === 0;
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedRenewal, setAcceptedRenewal] = useState(false);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(!isFree);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinueFree = acceptedTerms;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (isFree) return;
    let active = true;
    setLoadingPayment(true);
    setError(null);

    void createBillingSubscriptionIntent({
      billingAccountId,
      priceId: plan.priceId,
      quantity: 1,
    })
      .then((result) => {
        if (!active) return;
        if (!result.success || !result.data) {
          setError(
            result.error?.description ??
              'No fue posible preparar el método de pago. Cierra esta ventana e intenta nuevamente.',
          );
          return;
        }
        const { subscriptionId, clientSecret, publishableKey } = result.data;
        if (!publishableKey || publishableKey.startsWith('sk_')) {
          setError(
            'La variable de entorno STRIPE_PUBLISHABLE_KEY en el servidor está configurada con una clave secreta (sk_). Debe actualizarse con la clave pública de Stripe (pk_live_...) en Railway/Vercel.',
          );
          return;
        }
        setPaymentSession({
          subscriptionId,
          clientSecret,
          stripePromise: loadStripe(publishableKey),
        });
      })
      .catch((err: unknown) => {
        if (active) {
          const msg = err instanceof Error ? err.message : '';
          setError(
            msg ||
              'No fue posible preparar el método de pago. Cierra esta ventana e intenta nuevamente.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadingPayment(false);
      });

    return () => {
      active = false;
    };
  }, [billingAccountId, isFree, plan.priceId]);

  const activateFreePlan = useCallback(async () => {
    if (!canContinueFree) return;
    setActivating(true);
    setError(null);
    try {
      const result = await activateFreeBillingPlan({ billingAccountId, planId: plan.id });
      if (!result.success) {
        setError(
          result.error?.description ??
            'No fue posible activar el plan. Verifica que no exista otra suscripción activa.',
        );
        return;
      }
      await onComplete();
      onClose();
    } catch {
      setError('No fue posible activar el plan. Verifica que no exista otra suscripción activa.');
    } finally {
      setActivating(false);
    }
  }, [billingAccountId, canContinueFree, onClose, onComplete, plan.id]);

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-kumo-base/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-subscription-title"
    >
      <div className="mx-auto min-h-[100dvh] w-full max-w-[1080px] px-4 py-6 sm:px-8 lg:py-10">
        <div className="mb-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕ Cerrar
          </Button>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
          {/* Main Form Column (Cloudflare Kumo Style) */}
          <main className="min-w-0 rounded-xl border border-kumo-line bg-kumo-elevated p-6 shadow-sm sm:p-8">
            {isFree ? (
              <div className="space-y-6">
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <LockIcon aria-hidden="true" className="size-4" />
                    Facturación segura
                  </div>
                  <h1 id="billing-subscription-title" className="text-2xl font-bold tracking-tight text-kumo-default sm:text-3xl">
                    Activar Plan de pago de Kiosko {plan.name}
                  </h1>
                </div>

                <div className="rounded-lg border border-kumo-line bg-kumo-recessed p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-kumo-default">No requiere tarjeta</p>
                      <p className="mt-1 text-xs text-kumo-subtle">Sin cobros ni renovación automática.</p>
                    </div>
                    <Badge variant="success">Gratis</Badge>
                  </div>
                </div>

                <div className="space-y-3.5 border-t border-kumo-line pt-6 text-sm text-kumo-subtle">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(event) => setAcceptedTerms(event.target.checked)}
                      className="mt-0.5 size-4 rounded border-kumo-line text-blue-600 focus:ring-blue-500"
                    />
                    <span className="leading-snug">
                      Acepto los{' '}
                      <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700">
                        Términos de servicio
                      </a>{' '}
                      y la{' '}
                      <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700">
                        Política de privacidad
                      </a>.
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                  </div>
                )}

                <Button
                  className="w-full"
                  variant="primary"
                  disabled={!canContinueFree}
                  loading={activating}
                  onClick={() => void activateFreePlan()}
                >
                  Activar Plan de pago de Kiosko {plan.name}
                </Button>
              </div>
            ) : (
              <>
                {loadingPayment && (
                  <div className="space-y-4 p-4" aria-label="Preparando pago seguro">
                    <div className="h-12 animate-pulse rounded-lg bg-kumo-recessed" />
                    <div className="h-28 animate-pulse rounded-lg bg-kumo-recessed" />
                    <div className="h-12 animate-pulse rounded-lg bg-kumo-recessed" />
                  </div>
                )}

                {paymentSession && (
                  <Elements
                    stripe={paymentSession.stripePromise}
                    options={{
                      clientSecret: paymentSession.clientSecret,
                      appearance: {
                        theme: 'stripe',
                        variables: {
                          colorPrimary: '#2563eb',
                          colorBackground: 'transparent',
                          colorText: '#1e293b',
                          borderRadius: '8px',
                        },
                      },
                    }}
                  >
                    <CustomKumoSubscriptionForm
                      plan={plan}
                      billingEmail={billingEmail}
                      acceptedTerms={acceptedTerms}
                      setAcceptedTerms={setAcceptedTerms}
                      acceptedRenewal={acceptedRenewal}
                      setAcceptedRenewal={setAcceptedRenewal}
                      subscriptionId={paymentSession.subscriptionId}
                      onClose={onClose}
                      onComplete={onComplete}
                    />
                  </Elements>
                )}

                {!loadingPayment && !paymentSession && error && (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                  </div>
                )}
              </>
            )}
          </main>

          {/* Right Column: Order Summary Sticky Card (Cloudflare Kumo Style) */}
          <aside className="min-w-0 rounded-xl border border-kumo-line bg-kumo-elevated p-6 shadow-sm lg:sticky lg:top-8">
            <h2 className="mb-4 text-base font-semibold text-kumo-default">
              Resumen del pedido
            </h2>

            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-kumo-line pb-4">
                <div>
                  <p className="font-semibold text-kumo-default">Plan de pago de Kiosko {plan.name}</p>
                  <p className="mt-0.5 text-xs text-kumo-subtle">{plan.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-kumo-default">{formatMoney(plan.totalAmount, plan.currency)}</p>
                  <p className="text-xs text-kumo-subtle">{isFree ? 'sin costo' : 'por mes'}</p>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-kumo-subtle">
                  Características incluidas
                </p>
                <div className="grid gap-2.5 text-xs text-kumo-subtle">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
                    <span>Hasta <strong>{plan.maxUsers ?? 'Sin límite'}</strong> usuarios</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
                    <span>Hasta <strong>{plan.maxStores ?? 'Sin límite'}</strong> sucursales</span>
                  </div>
                  {plan.highlights.map((highlight) => (
                    <div key={highlight} className="flex items-start gap-2">
                      <CheckCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>

              {!isFree && (
                <div className="space-y-2 border-t border-kumo-line pt-4 text-xs">
                  <div className="flex justify-between gap-4 text-kumo-subtle">
                    <span>Subtotal</span>
                    <span>{formatMoney(plan.baseAmount, plan.currency)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-kumo-subtle">
                    <span>IVA ({plan.taxRate}%)</span>
                    <span>{formatMoney(plan.taxAmount, plan.currency)}</span>
                  </div>
                  <div className="flex justify-between gap-4 pt-2 text-sm font-bold text-kumo-default">
                    <span>A pagar hoy*</span>
                    <span>{formatMoney(plan.totalAmount, plan.currency)} / mes</span>
                  </div>
                  <p className="pt-2 text-[11px] leading-relaxed text-kumo-subtle">
                    *Tarifa base cobrada hoy. Los cargos de renovación recurrente se procesarán mensualmente conforme al plan seleccionado.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
