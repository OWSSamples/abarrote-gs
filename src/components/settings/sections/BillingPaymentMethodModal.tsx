'use client';

import { useEffect, useState } from 'react';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Button } from '@cloudflare/kumo/components/button';
import { CreditCardIcon, LockIcon } from '@shopify/polaris-icons';
import {
  createBillingPaymentMethodSetup,
  deleteBillingPaymentMethod,
  setDefaultBillingPaymentMethod,
  type BillingPaymentMethod,
} from '@/app/actions/billing-actions';

interface BillingPaymentMethodModalProps {
  billingAccountId: string;
  billingEmail: string;
  currentMethod: BillingPaymentMethod | null;
  onClose: () => void;
  onComplete: () => Promise<void>;
}

interface SetupSession {
  clientSecret: string;
  stripePromise: Promise<Stripe | null>;
}

function PaymentMethodForm({
  billingAccountId,
  billingEmail,
  currentMethod,
  onClose,
  onComplete,
}: BillingPaymentMethodModalProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardholderName, setCardholderName] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !paymentComplete || !authorized) return;
    if (!cardholderName.trim()) {
      setError('Ingresa el nombre que aparece en la tarjeta.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const { error: setupError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/settings?section=billing&payment_method=complete`,
        payment_method_data: {
          billing_details: {
            name: cardholderName.trim(),
            email: billingEmail || undefined,
          },
        },
      },
      redirect: 'if_required',
    });

    if (setupError) {
      setError(
        setupError.message ||
          'No fue posible verificar la tarjeta. Revisa los datos e intenta nuevamente.',
      );
      setSubmitting(false);
      return;
    }

    const paymentMethodId =
      typeof setupIntent?.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;
    if (!paymentMethodId || setupIntent?.status !== 'succeeded') {
      setError(
        'La verificación de la tarjeta todavía está pendiente. Intenta nuevamente en unos momentos.',
      );
      setSubmitting(false);
      return;
    }

    try {
      const defaultResult = await setDefaultBillingPaymentMethod({
        billingAccountId,
        paymentMethodId,
      });
      if (!defaultResult.success) {
        setError(
          defaultResult.error?.description ??
            'La tarjeta fue verificada, pero no fue posible establecerla como principal. Intenta actualizar la sección.',
        );
        setSubmitting(false);
        return;
      }
      if (
        currentMethod?.id &&
        currentMethod.id !== paymentMethodId
      ) {
        try {
          const deleteResult = await deleteBillingPaymentMethod({
            billingAccountId,
            paymentMethodId: currentMethod.id,
          });
          if (!deleteResult.success) {
            await onComplete();
            setError(
              deleteResult.error?.description ??
                'La nueva tarjeta quedó como principal, pero la tarjeta anterior no pudo eliminarse. Puedes volver a intentarlo desde esta sección.',
            );
            setSubmitting(false);
            return;
          }
        } catch {
          await onComplete();
          setError(
            'La nueva tarjeta quedó como principal, pero la tarjeta anterior no pudo eliminarse. Puedes volver a intentarlo desde esta sección.',
          );
          setSubmitting(false);
          return;
        }
      }
      await onComplete();
      onClose();
    } catch {
      setError(
        'La tarjeta fue verificada, pero no fue posible establecerla como principal. Intenta actualizar la sección.',
      );
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-kumo-success">
          <LockIcon aria-hidden="true" className="size-4" />
          Datos protegidos por Stripe
        </div>
        <h1
          id="billing-payment-method-title"
          className="text-2xl font-bold tracking-tight text-kumo-default"
        >
          {currentMethod ? 'Reemplazar método de pago' : 'Agregar método de pago'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-kumo-subtle">
          La tarjeta se registra de forma segura sin guardar su número en
          Kiosko.
        </p>
      </div>

      {currentMethod?.last4 && (
        <div className="flex items-center gap-3 rounded-lg border border-kumo-line bg-kumo-recessed p-4">
          <CreditCardIcon aria-hidden="true" className="size-5 text-kumo-subtle" />
          <div>
            <p className="text-xs text-kumo-subtle">Método actual</p>
            <p className="text-sm font-semibold capitalize text-kumo-default">
              {currentMethod.brand || 'Tarjeta'} terminada en {currentMethod.last4}
            </p>
          </div>
        </div>
      )}

      <div>
        <label
          htmlFor="billing-cardholder-name"
          className="mb-2 block text-sm font-semibold text-kumo-default"
        >
          Nombre en la tarjeta
        </label>
        <input
          id="billing-cardholder-name"
          type="text"
          autoComplete="cc-name"
          value={cardholderName}
          onChange={(event) => setCardholderName(event.target.value)}
          className="w-full rounded-md border border-kumo-line bg-kumo-base px-3 py-2.5 text-sm text-kumo-default outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
          placeholder="Nombre completo"
          required
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-kumo-default">
          Datos de la tarjeta
        </p>
        <div className="rounded-lg border border-kumo-line bg-kumo-base p-4">
          <PaymentElement
            onChange={(event) => setPaymentComplete(event.complete)}
            options={{
              layout: 'tabs',
              fields: {
                billingDetails: {
                  name: 'never',
                  email: 'never',
                },
              },
              defaultValues: {
                billingDetails: {
                  email: billingEmail || undefined,
                },
              },
            }}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-kumo-subtle">
        <input
          type="checkbox"
          checked={authorized}
          onChange={(event) => setAuthorized(event.target.checked)}
          className="mt-0.5 size-4 rounded border-kumo-line text-blue-600 focus:ring-blue-500"
        />
        <span className="leading-5">
          Autorizo guardar este método en Stripe para pagos y renovaciones de
          esta cuenta de Kiosko.
        </span>
      </label>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={submitting}
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          disabled={
            !stripe ||
            !paymentComplete ||
            !authorized ||
            !cardholderName.trim()
          }
        >
          Guardar método
        </Button>
      </div>
    </form>
  );
}

export function BillingPaymentMethodModal({
  billingAccountId,
  billingEmail,
  currentMethod,
  onClose,
  onComplete,
}: BillingPaymentMethodModalProps) {
  const [session, setSession] = useState<SetupSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    let active = true;
    void createBillingPaymentMethodSetup(billingAccountId)
      .then((result) => {
        if (!active) return;
        if (!result.success || !result.data) {
          setError(
            result.error?.description ??
              'No fue posible preparar el formulario seguro de tarjeta. Intenta nuevamente.',
          );
          return;
        }
        const { clientSecret, publishableKey } = result.data;
        if (!publishableKey || publishableKey.startsWith('sk_')) {
          setError(
            'La clave pública de Stripe no está configurada correctamente.',
          );
          return;
        }
        setSession({
          clientSecret,
          stripePromise: loadStripe(publishableKey),
        });
      })
      .catch(() => {
        if (active) {
          setError(
            'No fue posible preparar el formulario seguro de tarjeta. Intenta nuevamente.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [billingAccountId]);

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-kumo-base/95 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-payment-method-title"
    >
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-kumo-line bg-kumo-elevated p-6 shadow-sm sm:p-8">
        {loading && (
          <div className="space-y-4" aria-label="Preparando formulario seguro">
            <div className="h-8 w-2/3 animate-pulse rounded bg-kumo-recessed" />
            <div className="h-12 animate-pulse rounded bg-kumo-recessed" />
            <div className="h-40 animate-pulse rounded bg-kumo-recessed" />
          </div>
        )}

        {session && (
          <Elements
            stripe={session.stripePromise}
            options={{
              clientSecret: session.clientSecret,
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
            <PaymentMethodForm
              billingAccountId={billingAccountId}
              billingEmail={billingEmail}
              currentMethod={currentMethod}
              onClose={onClose}
              onComplete={onComplete}
            />
          </Elements>
        )}

        {!loading && !session && error && (
          <div className="space-y-5">
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
