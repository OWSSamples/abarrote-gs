'use client';

import { useEffect } from 'react';
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Icon,
  Badge,
  Divider,
  List,
} from '@shopify/polaris';
import {
  AlertTriangleIcon,
  WifiIcon,
  RefreshIcon,
  HomeIcon,
  ChatIcon,
} from '@shopify/polaris-icons';

/**
 * Dashboard layout error boundary — enterprise-style empty state.
 *
 * Catches errors in dashboard sub-routes while preserving the navigation shell.
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
      console.error(`[DashboardError] digest=${error.digest}`);
    }
  }, [error.digest]);

  const isNetworkError = /fetch|network|timeout|econnrefused/i.test(error.message ?? '');
  const tone = isNetworkError ? 'warning' : 'critical';
  const accentColor = isNetworkError
    ? 'var(--p-color-bg-surface-caution, #fff5ea)'
    : 'var(--p-color-bg-surface-critical, #fee9e8)';
  const accentBorder = isNetworkError
    ? 'var(--p-color-border-caution, #ffd79d)'
    : 'var(--p-color-border-critical, #fdb9b5)';
  const iconTone: 'caution' | 'critical' = isNetworkError ? 'caution' : 'critical';
  const iconSource = isNetworkError ? WifiIcon : AlertTriangleIcon;

  const title = isNetworkError ? 'Error de conexión' : 'No pudimos cargar esta sección';
  const description = isNetworkError
    ? 'Detectamos un problema al comunicarnos con nuestros servidores. Verifica tu conexión a internet e inténtalo nuevamente.'
    : 'Algo inesperado ocurrió al procesar esta vista. Nuestro equipo técnico fue notificado y trabajamos en solucionarlo.';

  const suggestions = isNetworkError
    ? ['Verifica tu conexión a internet', 'Asegúrate de que tu VPN o firewall no bloquee el acceso', 'Intenta recargar la página']
    : ['Intenta refrescar la página', 'Vuelve al dashboard y abre la sección nuevamente', 'Si el problema persiste, contacta a soporte con la referencia inferior'];

  return (
    <Page fullWidth>
      <div style={{ maxWidth: '720px', margin: '40px auto 0' }}>
        <Card padding="800">
          <BlockStack gap="600">
            {/* Header: Icon + Badge */}
            <InlineStack gap="400" blockAlign="center" wrap={false}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '14px',
                  background: accentColor,
                  border: `1px solid ${accentBorder}`,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                <div style={{ width: '24px', height: '24px' }}>
                  <Icon source={iconSource} tone={iconTone} />
                </div>
              </div>

              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone={tone}>{isNetworkError ? 'Conexión interrumpida' : 'Error inesperado'}</Badge>
                </InlineStack>
                <Text as="h1" variant="headingLg">
                  {title}
                </Text>
              </BlockStack>
            </InlineStack>

            {/* Description */}
            <Text as="p" variant="bodyMd" tone="subdued">
              {description}
            </Text>

            <Divider />

            {/* Suggestions */}
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">
                Qué puedes intentar
              </Text>
              <List type="bullet" gap="extraTight">
                {suggestions.map((tip) => (
                  <List.Item key={tip}>
                    <Text as="span" variant="bodyMd" tone="subdued">
                      {tip}
                    </Text>
                  </List.Item>
                ))}
              </List>
            </BlockStack>

            {/* Reference */}
            {error.digest && (
              <>
                <Divider />
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="bodySm" tone="subdued">
                    Código de referencia:
                  </Text>
                  <code
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'var(--p-color-bg-surface-secondary, #f6f6f7)',
                      color: 'var(--p-color-text-subdued, #6d7175)',
                      border: '1px solid var(--p-color-border-secondary, #e1e3e5)',
                    }}
                  >
                    {error.digest}
                  </code>
                </InlineStack>
              </>
            )}

            <Divider />

            {/* Actions */}
            <InlineStack gap="200" align="start">
              <Button variant="primary" size="large" icon={RefreshIcon} onClick={reset}>
                Reintentar
              </Button>
              <Button size="large" icon={HomeIcon} url="/dashboard">
                Volver al inicio
              </Button>
              <Button size="large" variant="tertiary" icon={ChatIcon} url="/dashboard/help">
                Contactar soporte
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Footer */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <InlineStack align="center" gap="150" blockAlign="center">
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--p-color-bg-fill-success, #00a47c)',
              }}
              aria-hidden="true"
            />
            <Text as="span" variant="bodySm" tone="subdued">
              Sistema operativo · Tus datos están seguros
            </Text>
          </InlineStack>
        </div>
      </div>
    </Page>
  );
}
