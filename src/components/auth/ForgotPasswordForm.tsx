'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { resetPassword } from '@/lib/cognito';
import { logAuthEvent } from '@/lib/auth/auth-logger';
import { checkAuthRateLimit } from '@/app/actions/auth-rate-limit';
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Divider,
  Icon,
  InlineStack,
  Link,
  Text,
  TextField,
} from '@shopify/polaris';
import { ArrowLeftIcon, CheckCircleIcon, EmailIcon, LockIcon, RefreshIcon } from '@shopify/polaris-icons';
import { useToast } from '@/components/notifications/ToastProvider';

export function ForgotPasswordForm() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const normalizedEmail = email.trim();

      if (!normalizedEmail) {
        toast.showError('Ingresa tu correo electrónico');
        return;
      }

      setIsLoading(true);
      void logAuthEvent({ event: 'password_reset_request', email: normalizedEmail });
      try {
        const limit = await checkAuthRateLimit('password_reset', normalizedEmail);
        if (!limit.allowed) {
          toast.showError(
            `Demasiados intentos. Vuelve a intentar en ${limit.retryAfterSeconds} segundos.`,
          );
          return;
        }
        await resetPassword({ username: normalizedEmail });
        setEmail(normalizedEmail);
        void logAuthEvent({ event: 'password_reset_success', email: normalizedEmail });
        setEmailSent(true);
        toast.showSuccess('Correo de recuperación enviado');
      } catch (err) {
        void logAuthEvent({
          event: 'password_reset_failure',
          email: normalizedEmail,
          errorCode: (err as { name?: string }).name,
        });
        toast.showError('Error al enviar el correo. Verifica que la dirección sea correcta.');
      } finally {
        setIsLoading(false);
      }
    },
    [email, toast],
  );

  const handleResend = useCallback(async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.showError('Ingresa tu correo electrónico');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword({ username: normalizedEmail });
      setEmail(normalizedEmail);
      toast.showSuccess('Correo reenviado exitosamente');
    } catch {
      toast.showError('Error al reenviar el correo');
    } finally {
      setIsLoading(false);
    }
  }, [email, toast]);

  if (emailSent) {
    return (
      <BlockStack gap="500">
        <AuthPanelHeader
          tone="success"
          icon={CheckCircleIcon}
          badge="Solicitud enviada"
          title="Revisa tu correo"
          description="Enviamos un enlace seguro para restablecer tu contraseña. Puede tardar unos minutos en llegar."
        />

        <Box background="bg-fill-success-secondary" borderColor="border-success" borderRadius="300" borderWidth="025" padding="400">
          <BlockStack gap="200">
            <Text as="p" variant="bodySm" tone="subdued">
              Enviado a
            </Text>
            <InlineStack gap="200" blockAlign="center" wrap={false}>
              <Icon source={EmailIcon} tone="success" />
              <Text as="p" variant="bodyMd" fontWeight="bold" breakWord>
                {email}
              </Text>
            </InlineStack>
          </BlockStack>
        </Box>

        <BlockStack gap="300">
          <Button variant="primary" size="large" fullWidth icon={RefreshIcon} onClick={handleResend} loading={isLoading}>
            Reenviar correo
          </Button>
        </BlockStack>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="500">
      <AuthPanelHeader
        tone="info"
        icon={LockIcon}
        badge="Recuperación segura"
        title="¿Olvidaste tu contraseña?"
        description="Te enviaremos un enlace temporal al correo asociado a tu cuenta para que puedas crear una nueva contraseña."
      />

      <Box background="bg-surface-secondary" borderColor="border" borderRadius="300" borderWidth="025" padding="400">
        <BlockStack gap="300">
          <RecoveryStep icon={EmailIcon} title="Verificamos tu correo" description="Usa el correo con el que inicias sesión en Kiosko." />
          <Divider />
          <RecoveryStep icon={LockIcon} title="Enlace privado" description="El enlace se genera en Cognito y expira por seguridad." />
        </BlockStack>
      </Box>

      <form onSubmit={handleSubmit}>
        <BlockStack gap="400">
          <TextField
            label="Correo electrónico"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            type="email"
            disabled={isLoading}
            placeholder="GlobalID@Company.com"
            prefix={<Icon source={EmailIcon} tone="subdued" />}
            helpText="No compartiremos si el correo existe; esto protege las cuentas del negocio."
          />
          <Button variant="primary" submit size="large" fullWidth loading={isLoading}>
            Enviar instrucciones
          </Button>
        </BlockStack>
      </form>

      <Divider />

      <InlineStack align="center">
        <Link url="/auth/login" monochrome>
          <InlineStack gap="100" blockAlign="center" wrap={false}>
            <Icon source={ArrowLeftIcon} tone="subdued" />
            <Text as="span" variant="bodySm" tone="subdued">
              Volver al inicio de sesión
            </Text>
          </InlineStack>
        </Link>
      </InlineStack>
    </BlockStack>
  );
}

type HeaderTone = 'info' | 'success';

function AuthPanelHeader({
  tone,
  icon,
  badge,
  title,
  description,
}: {
  tone: HeaderTone;
  icon: typeof LockIcon;
  badge: string;
  title: string;
  description: string;
}) {
  const iconTone = tone === 'success' ? 'success' : 'info';
  const iconBackground = tone === 'success' ? 'bg-fill-success-secondary' : 'bg-fill-info-secondary';
  const iconBorder = tone === 'success' ? 'border-success' : 'border-info';

  return (
    <BlockStack gap="300" inlineAlign="center">
      <Box background={iconBackground} borderColor={iconBorder} borderRadius="500" borderWidth="025" padding="300">
        <Icon source={icon} tone={iconTone} />
      </Box>
      <BlockStack gap="200" inlineAlign="center">
        <Badge tone={tone}>{badge}</Badge>
        <Text as="h1" variant="headingLg" fontWeight="bold" alignment="center">
          {title}
        </Text>
        <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
          {description}
        </Text>
      </BlockStack>
    </BlockStack>
  );
}

function RecoveryStep({ icon, title, description }: { icon: typeof EmailIcon; title: string; description: ReactNode }) {
  return (
    <InlineStack gap="300" blockAlign="start" wrap={false}>
      <Box background="bg-surface" borderColor="border" borderRadius="200" borderWidth="025" padding="200">
        <Icon source={icon} tone="subdued" />
      </Box>
      <BlockStack gap="050">
        <Text as="p" variant="bodySm" fontWeight="semibold">
          {title}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {description}
        </Text>
      </BlockStack>
    </InlineStack>
  );
}
