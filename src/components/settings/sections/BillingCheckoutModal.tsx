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
        setEmbeddedSession({
          clientSecret,
          stripe: loadStripe(publishableKey),
        });
      })
      .catch(() => {
        if (active) {
          setError('No fue posible preparar el método de pago. Cierra esta ventana e intenta nuevamente.');
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
      <div className="mx-auto min-h-[100dvh] w-full max-w-[760px] px-4 py-8 sm:px-8 lg:py-12">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <LockIcon aria-hidden="true" className="size-4" />
              Facturación segura
            </div>
            <h1 id="billing-checkout-title" className="text-2xl font-semibold tracking-tight text-kumo-default">
              Activar Kiosko {plan.name}
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <section className="overflow-hidden rounded-xl border border-kumo-line bg-kumo-elevated">
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
                <p className="font-semibold text-kumo-default">
                  {formatMoney(plan.totalAmount, plan.currency)}
                </p>
                <p className="text-xs text-kumo-subtle">{isFree ? 'sin costo' : 'por mes'}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-kumo-default">Características incluidas</h3>
              <div className="grid gap-2 text-sm text-kumo-subtle sm:grid-cols-2">
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
                  <span>Total mensual</span>
                  <span>{formatMoney(plan.totalAmount, plan.currency)}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-xl border border-kumo-line bg-kumo-elevated">
          <div className="border-b border-kumo-line px-5 py-3 text-sm font-semibold text-kumo-subtle">
            Método de pago
          </div>
          {isFree ? (
            <div className="flex items-center justify-between gap-4 px-5 py-5">
              <div>
                <p className="text-sm font-semibold text-kumo-default">No requiere tarjeta</p>
                <p className="mt-1 text-xs text-kumo-subtle">El plan Básico se activa sin cobros ni renovación.</p>
              </div>
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Gratis</span>
            </div>
          ) : (
            <div className={canContinue ? '' : 'pointer-events-none select-none opacity-45'} aria-disabled={!canContinue}>
              {loadingPayment && (
                <div className="space-y-3 p-5" aria-label="Preparando pago seguro">
                  <div className="h-11 animate-pulse rounded-lg bg-kumo-recessed" />
                  <div className="h-24 animate-pulse rounded-lg bg-kumo-recessed" />
                </div>
              )}
              {embeddedSession && checkoutOptions && (
                <EmbeddedCheckoutProvider stripe={embeddedSession.stripe} options={checkoutOptions}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              )}
            </div>
          )}
        </section>

        <div className="mt-5 space-y-4 px-1 text-sm text-kumo-subtle">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-0.5 size-4 accent-blue-600"
            />
            <span>
              Acepto los términos de servicio y la política de privacidad de Opendex Kiosko.
            </span>
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
          <p className="pl-7 text-xs text-kumo-subtle">
            El comprobante y las notificaciones se enviarán a {billingEmail || 'tu correo de facturación'}.
          </p>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {isFree && (
          <Button
            className="mt-6 w-full"
            variant="primary"
            disabled={!canContinue}
            loading={activating}
            onClick={() => void activateFreePlan()}
          >
            Activar Kiosko {plan.name}
          </Button>
        )}

        {!isFree && !canContinue && (
          <p className="mt-5 text-center text-xs text-kumo-subtle">
            Acepta los términos para habilitar el método de pago.
          </p>
        )}
      </div>
    </div>
  );
}
