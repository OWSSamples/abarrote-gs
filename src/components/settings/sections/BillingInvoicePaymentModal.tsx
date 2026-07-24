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
import { LockIcon } from '@shopify/polaris-icons';
import {
  createBillingInvoicePaymentIntent,
  type BillingInvoice,
} from '@/app/actions/billing-actions';

interface BillingInvoicePaymentModalProps {
  invoice: BillingInvoice;
  onClose: () => void;
  onComplete: () => Promise<void>;
}

interface InvoicePaymentSession {
  amount: number;
  currency: string;
  clientSecret: string;
  stripePromise: Promise<Stripe | null>;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
  }).format(amount);
}

function InvoicePaymentForm({
  invoice,
  amount,
  currency,
  onClose,
  onComplete,
}: BillingInvoicePaymentModalProps & {
  amount: number;
  currency: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !paymentComplete) return;

    setSubmitting(true);
    setError(null);
    const { error: paymentError, paymentIntent } =
      await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/settings?section=billing&invoice=paid`,
        },
        redirect: 'if_required',
      });

    if (paymentError) {
      setError(
        paymentError.message ||
          'No fue posible pagar la factura. Revisa el método de pago.',
      );
      setSubmitting(false);
      return;
    }

    if (
      paymentIntent?.status !== 'succeeded' &&
      paymentIntent?.status !== 'processing'
    ) {
      setError(
        'El pago no se completó. Selecciona otro método o intenta nuevamente.',
      );
      setSubmitting(false);
      return;
    }

    await onComplete();
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-kumo-success">
          <LockIcon aria-hidden="true" className="size-4" />
          Pago seguro dentro de Kiosko
        </div>
        <h1
          id="billing-invoice-payment-title"
          className="text-2xl font-bold tracking-tight text-kumo-default"
        >
          Pagar factura {invoice.number}
        </h1>
        <div className="mt-4 flex items-center justify-between rounded-lg border border-kumo-line bg-kumo-recessed p-4">
          <span className="text-sm text-kumo-subtle">Total pendiente</span>
          <strong className="text-lg text-kumo-default">
            {formatMoney(amount, currency)}
          </strong>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-kumo-default">
          Método de pago
        </p>
        <div className="rounded-lg border border-kumo-line bg-kumo-base p-4">
          <PaymentElement
            onChange={(event) => setPaymentComplete(event.complete)}
            options={{ layout: 'tabs' }}
          />
        </div>
      </div>

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
          disabled={!stripe || !paymentComplete}
        >
          Pagar {formatMoney(amount, currency)}
        </Button>
      </div>
    </form>
  );
}

export function BillingInvoicePaymentModal({
  invoice,
  onClose,
  onComplete,
}: BillingInvoicePaymentModalProps) {
  const [session, setSession] = useState<InvoicePaymentSession | null>(null);
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
    void createBillingInvoicePaymentIntent(invoice.id)
      .then(({ amount, currency, clientSecret, publishableKey }) => {
        if (!active) return;
        if (!publishableKey || publishableKey.startsWith('sk_')) {
          setError(
            'La clave pública de Stripe no está configurada correctamente.',
          );
          return;
        }
        setSession({
          amount,
          currency,
          clientSecret,
          stripePromise: loadStripe(publishableKey),
        });
      })
      .catch(() => {
        if (active) {
          setError(
            'No fue posible preparar el pago de esta factura dentro de Kiosko.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [invoice.id]);

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-kumo-base/95 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-invoice-payment-title"
    >
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-kumo-line bg-kumo-elevated p-6 shadow-sm sm:p-8">
        {loading && (
          <div className="space-y-4" aria-label="Preparando pago de factura">
            <div className="h-8 w-2/3 animate-pulse rounded bg-kumo-recessed" />
            <div className="h-20 animate-pulse rounded bg-kumo-recessed" />
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
            <InvoicePaymentForm
              invoice={invoice}
              amount={session.amount}
              currency={session.currency}
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
