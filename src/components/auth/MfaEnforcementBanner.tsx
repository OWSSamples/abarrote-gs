'use client';

import { useEffect, useState } from 'react';
import { Banner, Modal, BlockStack, Text, Button, Box, ProgressBar } from '@shopify/polaris';
import { checkMfaEnforcementAction, type MfaEnforcementStatus } from '@/app/actions/mfa-enforcement-actions';
import { useRouter } from 'next/navigation';

/**
 * MFA Enforcement Banner + Blocker.
 * - Within grace period: shows a warning banner with days remaining.
 * - After grace period expires: shows a blocking modal forcing MFA setup.
 */
export function MfaEnforcementBanner() {
  const router = useRouter();
  const [status, setStatus] = useState<MfaEnforcementStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkMfaEnforcementAction().then(setStatus).catch(() => {});
  }, []);

  if (!status || status.mfaEnabled || dismissed) return null;

  const { daysRemaining, graceExpired } = status;
  const progress = daysRemaining !== null ? ((15 - daysRemaining) / 15) * 100 : 0;

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
            router.push('/dashboard/settings/security');
          },
        }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Banner tone="critical">
              <p>
                Tu período de gracia de 15 días ha expirado. Debes configurar la autenticación
                de dos factores (MFA) para continuar usando el sistema.
              </p>
            </Banner>
            <Text as="p" variant="bodyMd">
              Al hacer clic en &ldquo;Configurar MFA ahora&rdquo; serás redirigido a la sección de
              seguridad donde podrás vincular tu app autenticadora (Google Authenticator, Authy, etc.).
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
    <Banner
      tone={daysRemaining !== null && daysRemaining <= 3 ? 'critical' : 'warning'}
      title="Activa la autenticación de dos factores (MFA)"
      onDismiss={() => setDismissed(true)}
    >
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd">
          Tu cuenta no tiene MFA activado. Por seguridad, es obligatorio configurarlo.
          {daysRemaining !== null && (
            <> Tienes <strong>{daysRemaining} día{daysRemaining !== 1 ? 's' : ''}</strong> restantes para activarlo.</>
          )}
        </Text>
        <Box maxWidth="300px">
          <ProgressBar progress={progress} size="small" tone={daysRemaining !== null && daysRemaining <= 3 ? 'critical' : 'highlight'} />
        </Box>
        <div>
          <Button
            variant="primary"
            size="slim"
            onClick={() => {
              router.push('/dashboard/settings/security');
            }}
          >
            Configurar MFA ahora
          </Button>
        </div>
      </BlockStack>
    </Banner>
  );
}
