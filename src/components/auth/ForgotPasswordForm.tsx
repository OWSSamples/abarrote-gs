'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { resetPassword } from '@/lib/cognito';
import { logAuthEvent } from '@/lib/auth/auth-logger';
import { checkAuthRateLimit } from '@/app/actions/auth-rate-limit';
import { Card, FormLayout, TextField, Button, BlockStack, Box, Text, Icon } from '@shopify/polaris';
import { ArrowLeftIcon, EmailIcon } from '@shopify/polaris-icons';
import { useToast } from '@/components/notifications/ToastProvider';

export function ForgotPasswordForm() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!email) {
        toast.showError('Ingresa tu correo electrónico');
        return;
      }

      setIsLoading(true);
      void logAuthEvent({ event: 'password_reset_request', email });
      try {
        const limit = await checkAuthRateLimit('password_reset', email);
        if (!limit.allowed) {
          toast.showError(
            `Demasiados intentos. Vuelve a intentar en ${limit.retryAfterSeconds} segundos.`,
          );
          return;
        }
        await resetPassword({ username: email });
        void logAuthEvent({ event: 'password_reset_success', email });
        setEmailSent(true);
        toast.showSuccess('Correo de recuperación enviado');
      } catch (err) {
        void logAuthEvent({
          event: 'password_reset_failure',
          email,
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
    setIsLoading(true);
    try {
      await resetPassword({ username: email });
      toast.showSuccess('Correo reenviado exitosamente');
    } catch {
      toast.showError('Error al reenviar el correo');
    } finally {
      setIsLoading(false);
    }
  }, [email, toast]);

  const _containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.7)), url('/backgrounds/login_bg.png')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    padding: '24px',
  };

  if (emailSent) {
    return (
      <Box width="100%" maxWidth="440px">
        <Card>
          <BlockStack gap="600">
            <BlockStack gap="400" align="center">
              <div
                style={{
                  backgroundColor: 'var(--p-color-bg-surface-secondary)',
                  padding: '16px',
                  borderRadius: '50%',
                  width: '64px',
                  height: '64px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ width: '32px', height: '32px' }}>
                  <Icon source={EmailIcon} tone="primary" />
                </div>
              </div>
              <BlockStack gap="200" align="center">
                <Text as="h1" variant="headingLg">
                  Revisa tu correo
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Hemos enviado un enlace de recuperación a:
                  <br />
                  <Text as="span" variant="bodyMd" fontWeight="bold">
                    {email}
                  </Text>
                </Text>
              </BlockStack>
            </BlockStack>

            <BlockStack gap="200">
              <Button variant="primary" fullWidth onClick={handleResend} loading={isLoading} size="large">
                Reenviar correo
              </Button>
              <div style={{ textAlign: 'center' }}>
                <Link href="/auth/login" style={{ textDecoration: 'none' }}>
                  <Button variant="tertiary" fullWidth icon={ArrowLeftIcon}>
                    Volver al inicio de sesión
                  </Button>
                </Link>
              </div>
            </BlockStack>
          </BlockStack>
        </Card>
      </Box>
    );
  }

  return (
    <Box width="100%" maxWidth="440px">
      <Card>
        <BlockStack gap="600">
          <BlockStack gap="400" align="center">
            <div
              style={{
                padding: '24px 0 12px 0',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src="/login-brand.svg"
                alt="Logo"
                style={{
                  width: '200px',
                  height: 'auto',
                }}
              />
            </div>
            <BlockStack gap="100" align="center">
              <Text as="h1" variant="headingLg" fontWeight="bold">
                ¿Olvidaste tu contraseña?
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                No te preocupes, te enviaremos instrucciones para restablecerla
              </Text>
            </BlockStack>
          </BlockStack>

          <form onSubmit={handleSubmit}>
            <FormLayout>
              <TextField
                label="Correo electrónico"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                type="email"
                disabled={isLoading}
                placeholder="GlobalID@company.com"
              />

              <Box paddingBlockStart="300">
                <Button variant="primary" submit fullWidth loading={isLoading} size="large">
                  Enviar instrucciones
                </Button>
              </Box>
            </FormLayout>
          </form>

          <Box paddingBlockStart="400" borderBlockStartWidth="025" borderColor="border">
            <div style={{ textAlign: 'center' }}>
              <Link href="/auth/login" style={{ textDecoration: 'none' }}>
                <Button variant="tertiary" icon={ArrowLeftIcon}>
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          </Box>
        </BlockStack>
      </Card>
    </Box>
  );
}
