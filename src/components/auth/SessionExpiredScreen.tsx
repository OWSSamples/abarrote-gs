'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Icon,
  Box,
  Badge,
  ProgressBar,
  Divider,
} from '@shopify/polaris';
import { LockIcon, ArrowRightIcon } from '@shopify/polaris-icons';

interface SessionExpiredScreenProps {
  loginPath?: string;
  reference?: string;
  /** Auto-redirect countdown in seconds. 0 disables. Defaults to 10. */
  autoRedirectSeconds?: number;
}

/**
 * Premium session-expired screen built entirely with Polaris primitives.
 *
 * - Centered card on full-viewport surface
 * - Animated lock icon with caution tone
 * - Countdown ProgressBar with auto-redirect to login
 * - Accessible: role=alertdialog, aria-live, autofocus
 */
export function SessionExpiredScreen({
  loginPath = '/auth',
  reference,
  autoRedirectSeconds = 10,
}: SessionExpiredScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(autoRedirectSeconds);

  useEffect(() => {
    if (autoRedirectSeconds <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          window.location.href = loginPath;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRedirectSeconds, loginPath]);

  const progress =
    autoRedirectSeconds > 0 ? ((autoRedirectSeconds - secondsLeft) / autoRedirectSeconds) * 100 : 0;

  return (
    <div
      role="alertdialog"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-desc"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--p-space-400)',
        background: 'var(--p-color-bg-surface-secondary)',
        zIndex: 9999,
        overflow: 'auto',
      }}
    >
      <div style={{ maxWidth: '460px', width: '100%' }}>
        <Card padding="600">
          <BlockStack gap="500" align="center" inlineAlign="center">
            {/* Animated icon */}
            <Box
              padding="400"
              background="bg-surface-caution"
              borderRadius="full"
              borderWidth="025"
              borderColor="border-caution"
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'se-pulse 2s ease-in-out infinite',
                }}
              >
                <Icon source={LockIcon} tone="caution" />
              </div>
            </Box>

            <Badge tone="warning">Sesión finalizada</Badge>

            <BlockStack gap="200" align="center" inlineAlign="center">
              <Text as="h1" variant="headingXl" alignment="center" id="session-expired-title">
                Tu sesión expiró
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                <span id="session-expired-desc">
                  Por seguridad, cerramos tu sesión después de un periodo de inactividad. Inicia
                  sesión nuevamente para continuar.
                </span>
              </Text>
            </BlockStack>

            {/* Countdown */}
            {autoRedirectSeconds > 0 && secondsLeft > 0 && (
              <Box width="100%">
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Redirigiendo automáticamente
                    </Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      {secondsLeft}s
                    </Text>
                  </InlineStack>
                  <ProgressBar progress={progress} size="small" tone="primary" />
                </BlockStack>
              </Box>
            )}

            {/* Actions */}
            <Box width="100%">
              <BlockStack gap="200">
                <Button variant="primary" size="large" fullWidth url={loginPath} icon={ArrowRightIcon}>
                  Iniciar sesión
                </Button>
                <Button variant="tertiary" size="large" fullWidth url="/dashboard">
                  Ir al inicio
                </Button>
              </BlockStack>
            </Box>

            {reference && (
              <>
                <Divider />
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="bodySm" tone="subdued">
                    Referencia
                  </Text>
                  <Box
                    background="bg-surface-secondary"
                    paddingInline="200"
                    paddingBlock="050"
                    borderRadius="100"
                  >
                    <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
                      {reference}
                    </Text>
                  </Box>
                </InlineStack>
              </>
            )}
          </BlockStack>
        </Card>

        <Box paddingBlockStart="400">
          <InlineStack align="center" gap="150" blockAlign="center">
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--p-color-bg-fill-success)',
              }}
              aria-hidden="true"
            />
            <Text as="span" variant="bodySm" tone="subdued">
              Sistema seguro · Conexión cifrada
            </Text>
          </InlineStack>
        </Box>
      </div>

      <style>{`
        @keyframes se-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
