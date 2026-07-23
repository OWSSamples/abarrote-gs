'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Button } from '@cloudflare/kumo/components/button';
import { Badge } from '@cloudflare/kumo/components/badge';
import { CheckCircleIcon, LockIcon } from '@shopify/polaris-icons';
import {
  activateFreeBillingPlan,
  createBillingCheckoutSession,
  type BillingAvailablePlan,
} from '@/app/actions/billing-actions';

interface BillingCheckoutModalProps {
  plan: BillingAvailablePlan;
  billingAccountId: string;
  billingEmail: string;
  onClose: () => void;
  onComplete: () => Promise<void>;
}

interface EmbeddedSession {
  clientSecret: string;
  stripe: Promise<Stripe | null>;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
  }).format(amount);
}

export function BillingCheckoutModal({
  plan,
  billingAccountId,
  billingEmail,
  onClose,
  onComplete,
}: BillingCheckoutModalProps) {
  const isFree = plan.totalAmount === 0;
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedRenewal, setAcceptedRenewal] = useState(false);
  const [embeddedSession, setEmbeddedSession] = useState<EmbeddedSession | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(!isFree);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = acceptedTerms && (isFree || acceptedRenewal);

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

    void createBillingCheckoutSession({
      billingAccountId,
      priceId: plan.priceId,
      quantity: 1,
    })
      .then(({ clientSecret, publishableKey }) => {
        if (!active) return;
        if (!publishableKey || publishableKey.startsWith('sk_')) {
          setError(
            'La variable de entorno STRIPE_PUBLISHABLE_KEY en el servidor está configurada con una clave secreta (sk_). Debe actualizarse con la clave pública de Stripe (pk_live_...) en Railway/Vercel.',
          );
          return;
        }
        setEmbeddedSession({
          clientSecret,
          stripe: loadStripe(publishableKey),
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

  const checkoutOptions = useMemo(
    () =>
      embeddedSession
        ? {
            clientSecret: embeddedSession.clientSecret,
            onComplete: () => {
              void onComplete().then(onClose);
            },
          }
        : null,
    [embeddedSession, onClose, onComplete],
  );

  const activateFreePlan = useCallback(async () => {
    if (!canContinue) return;
    setActivating(true);
    setError(null);
    try {
      await activateFreeBillingPlan({ billingAccountId, planId: plan.id });
      await onComplete();
      onClose();
    } catch {
      setError('No fue posible activar el plan. Verifica que no exista otra suscripción activa.');
    } finally {
      setActivating(false);
    }
  }, [billingAccountId, canContinue, onClose, onComplete, plan.id]);

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-kumo-base/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-checkout-title"
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
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <LockIcon aria-hidden="true" className="size-4" />
                Facturación segura
              </div>
              <h1 id="billing-checkout-title" className="text-2xl font-bold tracking-tight text-kumo-default sm:text-3xl">
                Activar Plan de pago de Kiosko {plan.name}
              </h1>
            </div>

            {/* Embedded Payment Container */}
            <div className="min-h-[220px]">
              {isFree ? (
                <div className="rounded-lg border border-kumo-line bg-kumo-recessed p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-kumo-default">No requiere tarjeta</p>
                      <p className="mt-1 text-xs text-kumo-subtle">Sin cobros ni renovación automática.</p>
                    </div>
                    <Badge variant="success">Gratis</Badge>
                  </div>
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
                  {embeddedSession && checkoutOptions && (
                    <div className="stripe-checkout-wrapper min-h-[350px]">
                      <EmbeddedCheckoutProvider stripe={embeddedSession.stripe} options={checkoutOptions}>
                        <EmbeddedCheckout />
                      </EmbeddedCheckoutProvider>
                    </div>
                  )}
                  {!loadingPayment && !embeddedSession && !error && (
                    <div className="rounded-lg border border-kumo-line bg-kumo-recessed p-6 text-center text-sm text-kumo-subtle">
                      Iniciando el formulario seguro de Stripe...
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Terms and Conditions (Cloudflare Kumo Style) */}
            <div className="mt-6 space-y-3.5 border-t border-kumo-line pt-6 text-sm text-kumo-subtle">
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

              {!isFree && (
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
              )}

              <p className="pt-1 text-xs text-kumo-subtle">
                El comprobante de pago se enviará a <strong>{billingEmail || 'tu correo de facturación'}</strong>.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Free Plan Activation Button */}
            {isFree && (
              <div className="mt-6">
                <Button
                  className="w-full"
                  variant="primary"
                  disabled={!canContinue}
                  loading={activating}
                  onClick={() => void activateFreePlan()}
                >
                  Activar Plan de pago de Kiosko {plan.name}
                </Button>
              </div>
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

