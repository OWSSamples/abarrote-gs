'use client';

import { useEffect } from 'react';
import { Page, Banner, Button, BlockStack, Text, InlineStack, Box } from '@shopify/polaris';

/**
 * Dashboard layout error boundary.
 * 
 * Catches errors in all dashboard sub-routes while preserving
 * the navigation shell. More contextual than the root error.tsx.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      // eslint-disable-next-line no-console
      console.error(`[DashboardError] digest=${error.digest}`);
    }
  }, [error.digest]);

  const isNetworkError = /fetch|network|timeout|econnrefused/i.test(error.message ?? '');

  return (
    <Page title="Error en Dashboard" fullWidth>
      <BlockStack gap="400">
        <Banner
          tone={isNetworkError ? 'warning' : 'critical'}
          title={isNetworkError ? 'Error de conexión' : 'Error al cargar sección'}
        >
          <p>
            {isNetworkError
              ? 'No se pudo conectar al servidor. Verifica tu conexión e intenta de nuevo.'
              : 'Ocurrió un error al cargar esta sección. El equipo técnico ha sido notificado.'}
          </p>
        </Banner>

        {error.digest && (
          <Box paddingInlineStart="400">
            <Text as="p" variant="bodySm" tone="subdued">
              Referencia: {error.digest}
            </Text>
          </Box>
        )}

        <InlineStack gap="200">
          <Button onClick={reset}>Reintentar</Button>
          <Button url="/dashboard" variant="plain">Volver al inicio</Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
