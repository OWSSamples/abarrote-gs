'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { confirmResetPassword } from '@/lib/cognito';
import { evaluatePassword } from '@/lib/auth/password-policy';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { Card, FormLayout, TextField, Button, BlockStack, Box, Text, Icon } from '@shopify/polaris';
import { AlertDiamondIcon, CheckCircleIcon, HideIcon, ViewIcon } from '@shopify/polaris-icons';
import { useToast } from '@/components/notifications/ToastProvider';

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('code');
  const username = searchParams.get('username') || '';
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isPasswordValid = evaluatePassword(password).isValid;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isPasswordValid) {
        toast.showError('La contraseña no cumple los requisitos');
        return;
      }

      if (!passwordsMatch) {
        toast.showError('Las contraseñas no coinciden');
        return;
      }

      if (!token || !username) {
        toast.showError('Enlace de recuperación inválido');
        return;
      }

      setIsLoading(true);
      try {
        await confirmResetPassword({ username, confirmationCode: token, newPassword: password });
        setSuccess(true);
        toast.showSuccess('Contraseña actualizada correctamente');
      } catch (error: unknown) {
        const err = error as { name?: string };
        const errorMessage =
          err.name === 'ExpiredCodeException' || err.name === 'CodeMismatchException'
            ? 'El código ha expirado o es inválido'
            : 'Error al restablecer la contraseña';
        toast.showError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [password, isPasswordValid, passwordsMatch, token, username, toast],
  );

  // Invalid token
  if (!token || !username) {
    return (
      <Box width="100%" maxWidth="440px">
        <Card>
          <BlockStack gap="600">
            <BlockStack gap="400" align="center">
              <div
                style={{
                  backgroundColor: 'var(--p-color-bg-surface-critical-secondary)',
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
                  <Icon source={AlertDiamondIcon} tone="critical" />
                </div>
              </div>
              <BlockStack gap="200" align="center">
                <Text as="h1" variant="headingLg">
                  Enlace inválido
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Este enlace de recuperación ha expirado o es incorrecto
                </Text>
              </BlockStack>
            </BlockStack>
            <Link href="/auth/forgot-password" style={{ textDecoration: 'none' }}>
              <Button variant="primary" fullWidth size="large">
                Solicitar nuevo enlace
              </Button>
            </Link>
          </BlockStack>
        </Card>
      </Box>
    );
  }

  // Success
  if (success) {
    return (
      <Box width="100%" maxWidth="440px">
        <Card>
          <BlockStack gap="600">
            <BlockStack gap="400" align="center">
              <div
                style={{
                  backgroundColor: 'var(--p-color-bg-surface-success-secondary)',
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
                  <Icon source={CheckCircleIcon} tone="success" />
                </div>
              </div>
              <BlockStack gap="200" align="center">
                <Text as="h1" variant="headingLg">
                  Contraseña actualizada
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Tu contraseña ha sido restablecida con éxito
                </Text>
              </BlockStack>
            </BlockStack>
            <Link href="/auth/login" style={{ textDecoration: 'none' }}>
              <Button variant="primary" fullWidth size="large">
                Ir al inicio de sesión
              </Button>
            </Link>
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
                Nueva Contraseña
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Ingresa tu nueva contraseña a continuación
              </Text>
            </BlockStack>
          </BlockStack>

          <form onSubmit={handleSubmit}>
            <FormLayout>
              <TextField
                label="Nueva contraseña"
                value={password}
                onChange={setPassword}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={isLoading}
                placeholder="••••••••"
                suffix={
                  <div
                    onClick={() => setShowPassword((v) => !v)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px' }}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <Icon source={showPassword ? HideIcon : ViewIcon} tone="subdued" />
                  </div>
                }
              />

              <PasswordStrengthMeter password={password} />

              <TextField
                label="Confirmar contraseña"
                value={confirmPassword}
                onChange={setConfirmPassword}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={isLoading}
                placeholder="••••••••"
                error={confirmPassword && !passwordsMatch ? 'Las contraseñas no coinciden' : undefined}
              />

              <Box paddingBlockStart="300">
                <Button
                  variant="primary"
                  submit
                  fullWidth
                  loading={isLoading}
                  size="large"
                  disabled={isLoading || !isPasswordValid || !passwordsMatch}
                >
                  Restablecer Contraseña
                </Button>
              </Box>
            </FormLayout>
          </form>
        </BlockStack>
      </Card>
    </Box>
  );
}
