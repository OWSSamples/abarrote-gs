'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banner, Modal, BlockStack, Text, Button, Box, InlineStack } from '@shopify/polaris';
import { checkMfaEnforcementAction, type MfaEnforcementStatus } from '@/app/actions/mfa-enforcement-actions';
import { useRouter } from 'next/navigation';

const MFA_BANNER_SESSION_KEY = 'kiosko:mfa-enforcement-banner-dismissed';

/**
 * MFA Enforcement Banner + Blocker.
 * - Within grace period: shows a warning banner with days remaining.
 * - After grace period expires: shows a blocking modal forcing MFA setup.
 */
export function MfaEnforcementBanner() {
  const router = useRouter();
  const [status, setStatus] = useState<MfaEnforcementStatus | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(MFA_BANNER_SESSION_KEY) === '1';
  });

  const dismissBanner = useCallback(() => {
    setDismissed(true);
    window.sessionStorage.setItem(MFA_BANNER_SESSION_KEY, '1');
  }, []);

  useEffect(() => {
    checkMfaEnforcementAction().then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!status || status.mfaEnabled || status.graceExpired || dismissed) return;
    const timer = window.setTimeout(dismissBanner, 5000);
    return () => window.clearTimeout(timer);
  }, [dismissBanner, dismissed, status]);

  if (!status || status.mfaEnabled || dismissed) return null;

  const { daysRemaining, graceExpired } = status;

  // Grace period expired — full blocking modal
  if (graceExpired) {
    return (
      <Modal
        open
        title="Configuración de MFA obligatoria"
        onClose={() => {}} // Cannot dismiss
        primaryAction={{
          content: 'Configurar MFA ahora',
          onAction: () => {
            router.push('/dashboard/profile/security');
          },
        }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Banner tone="critical">
              <Text as="p" variant="bodyMd">
                Tu período de gracia de 15 días ha expirado. Debes configurar la autenticación
                de dos factores (MFA) para continuar usando el sistema.
              </Text>
            </Banner>
            <Text as="p" variant="bodyMd">
              Al hacer clic en &ldquo;Configurar MFA ahora&rdquo; serás redirigido a los ajustes de
              seguridad de tu perfil para vincular tu app autenticadora (Google Authenticator, Authy, etc.).
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Si necesitas ayuda, contacta al administrador del sistema.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // Within grace period — dismissable warning banner
  return (
    <Box paddingInline="400" paddingBlockStart="200">
      <Box maxWidth="760px">
        <Banner
          tone={daysRemaining !== null && daysRemaining <= 3 ? 'critical' : 'warning'}
          title="Activa MFA"
          onDismiss={dismissBanner}
        >
          <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
            <Text as="p" variant="bodySm">
              {daysRemaining !== null
                ? `Configura la verificación en 2 pasos. Quedan ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}.`
                : 'Configura la verificación en 2 pasos para proteger tu cuenta.'}
            </Text>
            <Button
              variant="primary"
              size="slim"
              onClick={() => {
                dismissBanner();
                router.push('/dashboard/profile/security');
              }}
            >
              Configurar
            </Button>
          </InlineStack>
        </Banner>
      </Box>
    </Box>
  );
}
