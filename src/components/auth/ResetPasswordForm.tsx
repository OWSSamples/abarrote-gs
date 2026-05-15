'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import { confirmResetPassword } from '@/lib/cognito';
import { evaluatePassword } from '@/lib/auth/password-policy';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { Button } from '@cloudflare/kumo/components/button';
import { SensitiveInput } from '@cloudflare/kumo/components/sensitive-input';
import { Text } from '@cloudflare/kumo/components/text';
import { Link } from '@cloudflare/kumo/components/link';
import { useToast } from '@/components/notifications/ToastProvider';
import { WarningDiamond, CheckCircle } from '@phosphor-icons/react';

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('code');
  const username = searchParams.get('username') || '';
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-kumo-danger-tint/60">
            <WarningDiamond size={24} className="text-kumo-danger" />
          </div>
          <Text variant="heading2" as="h1" DANGEROUS_className="text-center">
            Enlace inválido
          </Text>
          <Text variant="secondary" as="p" DANGEROUS_className="text-center">
            Este enlace de recuperación ha expirado o es incorrecto.
          </Text>
        </div>
        <NextLink href="/auth/forgot-password" className="block">
          <Button variant="primary" className="w-full justify-center" size="lg">
            Solicitar nuevo enlace
          </Button>
        </NextLink>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-kumo-success-tint/70">
            <CheckCircle size={24} className="text-kumo-success" />
          </div>
          <Text variant="heading2" as="h1" DANGEROUS_className="text-center">
            Contraseña actualizada
          </Text>
          <Text variant="secondary" as="p" DANGEROUS_className="text-center">
            Tu contraseña ha sido restablecida con éxito.
          </Text>
        </div>
        <NextLink href="/auth/login" className="block">
          <Button variant="primary" className="w-full justify-center" size="lg">
            Ir al inicio de sesión
          </Button>
        </NextLink>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <Text variant="heading2" as="h1" DANGEROUS_className="text-center">
          Nueva Contraseña
        </Text>
        <Text variant="secondary" as="p" DANGEROUS_className="text-center">
          Ingresa tu nueva contraseña a continuación.
        </Text>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <SensitiveInput
          label="Nueva contraseña"
          value={password}
          onValueChange={setPassword}
          autoComplete="new-password"
          disabled={isLoading}
          placeholder="••••••••"
        />
        <PasswordStrengthMeter password={password} />
        <SensitiveInput
          label="Confirmar contraseña"
          value={confirmPassword}
          onValueChange={setConfirmPassword}
          autoComplete="new-password"
          disabled={isLoading}
          placeholder="••••••••"
          error={confirmPassword && !passwordsMatch ? 'Las contraseñas no coinciden' : undefined}
        />
        <Button
          variant="primary"
          type="submit"
          className="w-full justify-center"
          size="lg"
          loading={isLoading}
          disabled={!isPasswordValid || !passwordsMatch}
        >
          Restablecer Contraseña
        </Button>
      </form>
    </div>
  );
}
