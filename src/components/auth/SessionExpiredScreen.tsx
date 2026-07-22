'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@cloudflare/kumo/components/button';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import {
  ArrowRight24Filled,
  LockClosedKey24Filled,
  ShieldCheckmark24Filled,
} from '@fluentui/react-icons';

interface SessionExpiredScreenProps {
  reference?: string;
  loading?: boolean;
  onReauthenticate?: () => void;
}

export function SessionExpiredScreen({
  reference,
  loading = false,
  onReauthenticate,
}: SessionExpiredScreenProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleReauthentication = () => {
    if (onReauthenticate) {
      onReauthenticate();
      return;
    }

    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    const primaryAction = dialog?.querySelector<HTMLButtonElement>('button');
    primaryAction?.focus();

    const keepFocusInDialog = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      primaryAction?.focus();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', keepFocusInDialog);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keepFocusInDialog);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/35 px-4 py-8 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        aria-describedby="session-expired-description"
        className="w-full max-w-[440px]"
      >
        <LayerCard className="shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <LayerCard.Secondary className="justify-between">
            <span className="flex min-w-0 items-center gap-2 text-kumo-default">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-kumo-tint text-kumo-subtle ring ring-kumo-line">
                <LockClosedKey24Filled aria-hidden="true" />
              </span>
              Sesión protegida
            </span>
            <ShieldCheckmark24Filled className="shrink-0 text-kumo-success" aria-hidden="true" />
          </LayerCard.Secondary>

          <LayerCard.Primary className="gap-5 p-5 sm:p-6">
            <div className="space-y-2">
              <h2 id="session-expired-title" className="text-lg font-semibold text-kumo-strong">
                Inicia sesión de nuevo
              </h2>
              <p id="session-expired-description" className="text-sm leading-6 text-kumo-subtle">
                Tu sesión terminó después de un periodo sin actividad. Vuelve a identificarte para
                continuar en el mismo punto de forma segura.
              </p>
            </div>

            <Button
              type="button"
              size="lg"
              variant="primary"
              className="w-full justify-center"
              icon={<ArrowRight24Filled />}
              loading={loading}
              disabled={loading}
              onClick={handleReauthentication}
            >
              Iniciar sesión de nuevo
            </Button>

            {reference ? (
              <p className="border-t border-kumo-line pt-3 text-xs text-kumo-subtle">
                Referencia de soporte: {reference}
              </p>
            ) : null}
          </LayerCard.Primary>
        </LayerCard>
      </div>
    </div>
  );
}
