'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { confirmPasswordReset } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Box,
  Text,
  Icon,
} from '@shopify/polaris';
import { AlertDiamondIcon, CheckCircleIcon } from '@shopify/polaris-icons';
import { useToast } from '@/components/notifications/ToastProvider';

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('oobCode');
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordRequirements = [
    { label: '8+ chars', met: password.length >= 8 },
    { label: 'Mayúscula', met: /[A-Z]/.test(password) },
    { label: 'Minúscula', met: /[a-z]/.test(password) },
    { label: 'Número', met: /\d/.test(password) },
  ];

  const isPasswordValid = passwordRequirements.every(req => req.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast.showError('La contraseña no cumple los requisitos');
      return;
    }

    if (!passwordsMatch) {
      toast.showError('Las contraseñas no coinciden');
      return;
    }

    if (!token) {
      toast.showError('Enlace de recuperación inválido');
      return;
    }

    setIsLoading(true);
    try {
      await confirmPasswordReset(auth, token, password);
      setSuccess(true);
      toast.showSuccess('Contraseña actualizada correctamente');
    } catch (error: any) {
      const errorMessage = error?.code === 'auth/invalid-action-code'
        ? 'El enlace ha expirado o ya ha sido utilizado'
        : 'Error al restablecer la contraseña';
      toast.showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [password, isPasswordValid, passwordsMatch, token, toast]);

  // Invalid token
  if (!token) {
    return (
      <Box width="100%" maxWidth="440px">
        <Card>
          <BlockStack gap="600">
            <BlockStack gap="400" align="center">
              <div style={{
                backgroundColor: 'var(--p-color-bg-surface-critical-secondary)',
                padding: '16px',
                borderRadius: '50%',
                width: '64px',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
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
              <div style={{
                backgroundColor: 'var(--p-color-bg-surface-success-secondary)',
                padding: '16px',
                borderRadius: '50%',
                width: '64px',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
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
            <div style={{
              padding: '16px 0',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img src="/logo_for_kiosko_login.svg" alt="Consola Admin Logo" style={{ width: '120px', height: 'auto' }} />
            </div>
            <BlockStack gap="100" align="center">
              <Text as="h1" variant="headingLg">
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
                type="password"
                autoComplete="new-password"
                disabled={isLoading}
                placeholder="••••••••"
              />

              {password && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {passwordRequirements.map((req, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: req.met ? '#e6fff1' : '#f1f1f1',
                        color: req.met ? '#008060' : '#6d7175',
                        border: `1px solid ${req.met ? '#bbe5b3' : '#e1e3e5'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {req.met ? '✓' : '○'} {req.label}
                    </div>
                  ))}
                </div>
              )}

              <TextField
                label="Confirmar contraseña"
                value={confirmPassword}
                onChange={setConfirmPassword}
                type="password"
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
