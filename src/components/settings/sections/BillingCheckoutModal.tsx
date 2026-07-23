'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Button } from '@cloudflare/kumo/components/button';
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
            'La variable de entorno STRIPE_PUBLISHABLE_KEY en el servidor está configurada con una clave secreta (sk_). Debe cambiarse por la clave pública de Stripe (pk_live_...) en Railway/Vercel.',
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
      <div className="mx-auto min-h-[100dvh] w-full max-w-[1040px] px-4 py-8 sm:px-8 lg:py-12">
        <div className="mb-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <main className="min-w-0 overflow-hidden rounded-xl border border-kumo-line bg-kumo-elevated">
            <div className="px-5 pb-2 pt-5 sm:px-6">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <LockIcon aria-hidden="true" className="size-4" />
                Facturación segura
              </div>
              <h1 id="billing-checkout-title" className="text-2xl font-semibold tracking-tight text-kumo-default">
                Activar Kiosko {plan.name}
              </h1>
            </div>

            <div className="space-y-4 px-5 py-4 text-sm text-kumo-subtle sm:px-6">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-0.5 size-4 accent-blue-600"
                />
                <span>Acepto los términos de servicio y la política de privacidad de Opendex Kiosko.</span>
              </label>
              {!isFree && (
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={acceptedRenewal}
                    onChange={(event) => setAcceptedRenewal(event.target.checked)}
                    className="mt-0.5 size-4 accent-blue-600"
                  />
                  <span>
                    Autorizo el cargo mensual de {formatMoney(plan.totalAmount, plan.currency)} hasta cancelar la suscripción.
                  </span>
                </label>
              )}
              <p className="pl-7 text-xs">
                El comprobante se enviará a {billingEmail || 'tu correo de facturación'}.
              </p>
            </div>

            <div className="border-t border-kumo-line">
              {isFree ? (
                <div className="p-5 sm:p-6">
                  <div className="mb-5 flex items-center justify-between gap-4 rounded-lg bg-kumo-recessed px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-kumo-default">No requiere tarjeta</p>
                      <p className="mt-1 text-xs text-kumo-subtle">Sin cobros ni renovación automática.</p>
                    </div>
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Gratis</span>
                  </div>
                  <Button
                    className="w-full"
                    variant="primary"
                    disabled={!canContinue}
                    loading={activating}
                    onClick={() => void activateFreePlan()}
                  >
                    Activar Kiosko {plan.name}
                  </Button>
                </div>
              ) : (
                <div
                  className={canContinue ? '' : 'pointer-events-none select-none opacity-45'}
                  aria-disabled={!canContinue}
                >
                  {loadingPayment && (
                    <div className="space-y-3 p-6" aria-label="Preparando pago seguro">
                      <div className="h-11 animate-pulse rounded-lg bg-kumo-recessed" />
                      <div className="h-32 animate-pulse rounded-lg bg-kumo-recessed" />
                      <div className="h-11 animate-pulse rounded-lg bg-kumo-recessed" />
                    </div>
                  )}
                  {embeddedSession && checkoutOptions && (
                    <EmbeddedCheckoutProvider stripe={embeddedSession.stripe} options={checkoutOptions}>
                      <EmbeddedCheckout />
                    </EmbeddedCheckoutProvider>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="m-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            {!isFree && !canContinue && (
              <p className="border-t border-kumo-line px-5 py-4 text-center text-xs text-kumo-subtle">
                Acepta los términos para habilitar el método de pago.
              </p>
            )}
          </main>

          <aside className="overflow-hidden rounded-xl border border-kumo-line bg-kumo-elevated lg:sticky lg:top-8">
            <div className="border-b border-kumo-line px-5 py-3 text-sm font-semibold text-kumo-subtle">
              Resumen del pedido
            </div>
            <div className="space-y-5 px-5 py-5">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h2 className="font-semibold text-kumo-default">Kiosko {plan.name}</h2>
                  <p className="mt-1 text-sm leading-5 text-kumo-subtle">{plan.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-kumo-default">{formatMoney(plan.totalAmount, plan.currency)}</p>
                  <p className="text-xs text-kumo-subtle">{isFree ? 'sin costo' : 'por mes'}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-kumo-default">Características incluidas</h3>
                <div className="grid gap-2 text-sm text-kumo-subtle">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon aria-hidden="true" className="size-4 text-emerald-600" />
                    {plan.maxUsers ?? 'Sin límite'} usuarios
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon aria-hidden="true" className="size-4 text-emerald-600" />
                    {plan.maxStores ?? 'Sin límite'} sucursales
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
                <div className="grid gap-2 border-t border-kumo-line pt-4 text-sm">
                  <div className="flex justify-between gap-4 text-kumo-subtle">
                    <span>Subtotal</span>
                    <span>{formatMoney(plan.baseAmount, plan.currency)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-kumo-subtle">
                    <span>IVA ({plan.taxRate}%)</span>
                    <span>{formatMoney(plan.taxAmount, plan.currency)}</span>
                  </div>
                  <div className="flex justify-between gap-4 font-semibold text-kumo-default">
                    <span>A pagar hoy</span>
                    <span>{formatMoney(plan.totalAmount, plan.currency)}</span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
