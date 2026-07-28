'use client';

import { useEffect } from 'react';
import { Text }   from '@cloudflare/kumo/components/text';
import { Button } from '@cloudflare/kumo/components/button';
import { Banner } from '@cloudflare/kumo/components/banner';
import { SessionExpiredScreen } from '@/components/auth/SessionExpiredScreen';
import {
  ArrowClockwise24Regular,
  Home24Regular,
} from '@fluentui/react-icons';

/**
 * Root error boundary — catches unhandled errors in all routes.
 *
 * - Categorizes errors for user-friendly messages
 * - Logs error digest for server-side correlation
 * - Provides actionable recovery (retry, go home)
 * - Never exposes stack traces or internal details
 */

interface ErrorInfo {
  tone: 'critical' | 'warning';
  title: string;
  message: string;
  recoverable: boolean;
}

function categorizeError(error: Error & { digest?: string }): ErrorInfo {
  const msg = error.message?.toLowerCase() ?? '';

  // Network / connectivity
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('econnrefused') || msg.includes('timeout')) {
    return {
      tone: 'warning',
      title: 'Error de conexión',
      message: 'No se pudo conectar al servidor. Verifica tu conexión a internet e intenta de nuevo.',
      recoverable: true,
    };
  }

  // Authentication
  if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('auth') || msg.includes('sesión')) {
    return {
      tone: 'warning',
      title: 'Sesión expirada',
      message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
      recoverable: false,
    };
  }

  // Permission
  if (msg.includes('forbidden') || msg.includes('403') || msg.includes('permiso')) {
    return {
      tone: 'critical',
      title: 'Sin permisos',
      message: 'No tienes permisos para realizar esta acción. Contacta al administrador.',
      recoverable: false,
    };
  }

  // Not found
  if (msg.includes('not found') || msg.includes('404')) {
    return {
      tone: 'warning',
      title: 'No encontrado',
      message: 'El recurso que buscas no existe o fue eliminado.',
      recoverable: false,
    };
  }

  // Generic
  return {
    tone: 'critical',
    title: 'Error inesperado',
    message: 'Algo salió mal. El equipo técnico ha sido notificado. Intenta de nuevo en unos momentos.',
    recoverable: true,
  };
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const info = categorizeError(error);

  useEffect(() => {
    if (error.digest) {
      console.error(`[ErrorBoundary] digest=${error.digest}`);
    }
  }, [error.digest]);

  if (info.title === 'Sesión expirada') {
    return <SessionExpiredScreen reference={error.digest} />;
  }

  return (
    <div className="gerr-shell">
      <div className="gerr-card">
        <Banner variant={info.tone === 'critical' ? 'error' : 'warning'}>
          <Text as="span">{info.title}</Text>
        </Banner>

        <div className="gerr-body">
          <Text as="p" className="gerr-message">{info.message}</Text>

          {error.digest && (
            <Text as="p" className="gerr-ref">
              Referencia: <code className="gerr-code">{error.digest}</code>
            </Text>
          )}

          <div className="gerr-actions">
            {info.recoverable && (
              <Button type="button" variant="primary" icon={<ArrowClockwise24Regular />} onClick={reset}>
                Reintentar
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              icon={<Home24Regular />}
              onClick={() => { window.location.href = '/dashboard'; }}
            >
              Ir al Dashboard
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        .gerr-shell { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px; background:#f9fafb; }
        .gerr-card  { width:100%; max-width:520px; background:#fff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.06); }
        .gerr-body  { padding:24px 28px 28px; display:flex; flex-direction:column; gap:16px; }
        .gerr-message { font-size:14px !important; color:#4b5563 !important; line-height:1.6 !important; margin:0 !important; }
        .gerr-ref   { font-size:13px !important; color:#9ca3af !important; margin:0 !important; }
        .gerr-code  { font-family:ui-monospace,monospace; font-size:12px; padding:2px 8px; border-radius:4px; background:#f3f4f6; color:#6b7280; border:1px solid #e5e7eb; }
        .gerr-actions { display:flex; gap:8px; flex-wrap:wrap; }
      `}</style>
    </div>
  );
}
