'use client';

import { useEffect } from 'react';
import { Button } from '@cloudflare/kumo/components/button';

interface BillingActionDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function BillingActionDialog({
  title,
  description,
  confirmLabel,
  destructive = false,
  loading,
  error,
  onConfirm,
  onClose,
}: BillingActionDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-kumo-base/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-action-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-kumo-line bg-kumo-elevated p-6 shadow-sm">
        <h2
          id="billing-action-title"
          className="text-xl font-bold text-kumo-default"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-kumo-subtle">
          {description}
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            disabled={loading}
            onClick={onClose}
          >
            Volver
          </Button>
          <Button
            variant={destructive ? 'secondary-destructive' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
