'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Box,
  Badge,
  ProgressBar,
  Divider,
} from '@shopify/polaris';
import { ArrowRight24Filled, LockClosedKey24Filled } from '@fluentui/react-icons';

interface SessionExpiredScreenProps {
  loginPath?: string;
  reference?: string;
  autoRedirectSeconds?: number;
}

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
    autoRedirectSeconds > 0
      ? ((autoRedirectSeconds - secondsLeft) / autoRedirectSeconds) * 100
      : 0;

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
        padding: '24px',
        background: 'var(--p-color-bg-surface-secondary, #f6f6f7)',
        zIndex: 9999,
        overflow: 'auto',
      }}
    >
      <div style={{ maxWidth: '460px', width: '100%' }}>
        <Card padding="600">
          <BlockStack gap="500" inlineAlign="center">
            <div
              style={{
                width: '64px',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'var(--p-color-bg-surface-caution, #fff5ea)',
                border: '1px solid var(--p-color-border-caution, #ffd79d)',
                animation: 'se-pulse 2s ease-in-out infinite',
              }}
              aria-hidden="true"
            >
              <div style={{ width: '28px', height: '28px' }}>
                <LockClosedKey24Filled style={{ color: 'var(--p-color-icon-caution, #8a6116)' }} />
              </div>
            </div>

            <Badge tone="warning">Sesión finalizada</Badge>

            <BlockStack gap="200" inlineAlign="center">
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

            {autoRedirectSeconds > 0 && secondsLeft > 0 && (
              <div style={{ width: '100%' }}>
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Redirigiendo automáticamente
                    </Text>
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      {secondsLeft}s
                    </Text>
                  </InlineStack>
                  <ProgressBar progress={progress} size="small" />
                </BlockStack>
              </div>
            )}

            <div style={{ width: '100%' }}>
              <BlockStack gap="200">
<Button variant="primary" size="large" fullWidth url={loginPath} icon={ArrowRight24Filled}>
                   Iniciar sesión
                 </Button>
                <Button variant="tertiary" size="large" fullWidth url="/dashboard">
                  Ir al inicio
                </Button>
              </BlockStack>
            </div>

            {reference && (
              <div style={{ width: '100%' }}>
                <BlockStack gap="200">
                  <Divider />
                  <InlineStack gap="200" blockAlign="center" align="center">
                    <Text as="span" variant="bodySm" tone="subdued">Referencia:</Text>
                    <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">{reference}</Text>
                  </InlineStack>
                </BlockStack>
              </div>
            )}
          </BlockStack>
        </Card>

        <Box paddingBlockStart="400">
          <InlineStack align="center" gap="150" blockAlign="center">
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--p-color-bg-fill-success, #00a47c)' }} aria-hidden="true" />
            <Text as="span" variant="bodySm" tone="subdued">Sistema seguro · Conexión cifrada</Text>
          </InlineStack>
        </Box>
      </div>

      <style>{`@keyframes se-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }`}</style>
    </div>
  );
}
