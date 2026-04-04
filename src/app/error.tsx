'use client';

import { useEffect } from 'react';
import { Page, Banner, Button, BlockStack, Text, InlineStack, Box } from '@shopify/polaris';

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

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const info = categorizeError(error);

  useEffect(() => {
    // Log error digest for server-side correlation
    // In production, this could send to an observability platform
    if (error.digest) {
      // eslint-disable-next-line no-console
      console.error(`[ErrorBoundary] digest=${error.digest}`);
    }
  }, [error.digest]);

  return (
    <Page title="Error" fullWidth>
      <BlockStack gap="400">
        <Banner tone={info.tone} title={info.title}>
          <p>{info.message}</p>
        </Banner>

        {error.digest && (
          <Box paddingInlineStart="400">
            <Text as="p" variant="bodySm" tone="subdued">
              Referencia: {error.digest}
            </Text>
          </Box>
        )}

        <InlineStack gap="200">
          {info.recoverable && (
            <Button onClick={reset}>Reintentar</Button>
          )}
          <Button url="/dashboard" variant="plain">
            Ir al Dashboard
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
