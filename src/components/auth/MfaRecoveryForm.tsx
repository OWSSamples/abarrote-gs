'use client';

import { useState, useCallback } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { logAuthEvent } from '@/lib/auth/auth-logger';
import { verifyRecoveryCodeAction } from '@/app/actions/mfa-recovery-actions';
import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Text } from '@cloudflare/kumo/components/text';
import { Link } from '@cloudflare/kumo/components/link';
import { useToast } from '@/components/notifications/ToastProvider';
import { CheckmarkCircle24Filled, ShieldKeyhole24Filled } from '@fluentui/react-icons';

/**
 * MFA Recovery Form.
 *
 * Solo aplica para usuarios con MFA TOTP (app autenticadora) que
 * guardaron sus códigos de recuperación al activarla.
 *
 * Flujo:
 *  1. Usuario ingresa email + código.
 *  2. Server action valida el hash y, si es válido, deshabilita TOTP
 *     en Cognito vía Admin API.
 *  3. Mostramos confirmación y redirigimos a /auth/login para que el
 *     usuario inicie sesión normalmente y vuelva a configurar MFA.
 */
export function MfaRecoveryForm() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedEmail = email.trim();
      const code = recoveryCode.trim();

      if (!trimmedEmail) {
        toast.showError('Ingresa tu correo electrónico.');
        return;
      }
      if (!code) {
        toast.showError('Ingresa un código de recuperación.');
        return;
      }

      setIsLoading(true);
      void logAuthEvent({ event: 'mfa_recovery_attempt', email: trimmedEmail });
      try {
        const result = await verifyRecoveryCodeAction(trimmedEmail, code);
        if (result.ok) {
          setSuccess(true);
          toast.showSuccess('Código aceptado. MFA deshabilitado temporalmente.');
          // Redirect to login after a short pause so the user reads the message.
          setTimeout(() => {
            router.push('/auth/login');
          }, 3000);
        } else {
          toast.showError(result.error ?? 'Código inválido o ya utilizado.');
        }
      } catch (err) {
        console.error('[MfaRecoveryForm] verifyRecoveryCodeAction failed', err);
        toast.showError('Error al validar el código. Inténtalo de nuevo.');
      } finally {
        setIsLoading(false);
      }
    },
    [email, recoveryCode, router, toast],
  );

  if (success) {
    return (
      <>
        <LayerCard.Secondary>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-kumo-success-tint/70">
              <CheckmarkCircle24Filled className="text-kumo-success" />
            </div>
            <Text variant="heading2" as="h1" DANGEROUS_className="text-center">
              Cuenta recuperada
            </Text>
            <Text variant="secondary" size="sm" as="p" DANGEROUS_className="text-center">
              Hemos deshabilitado MFA temporalmente. Inicia sesión con tu correo
              y contraseña — se te pedirá <b>volver a configurar la
              autenticación de dos factores</b> de inmediato.
            </Text>
            <Text variant="secondary" size="xs" as="p" DANGEROUS_className="text-center">
              Te redirigiremos al inicio de sesión en unos segundos…
            </Text>
          </div>
        </LayerCard.Secondary>
        <LayerCard.Primary>
          <Button
            variant="primary"
            className="w-full justify-center"
            size="lg"
            onClick={() => router.push('/auth/login')}
          >
            Ir a iniciar sesión
          </Button>
        </LayerCard.Primary>
      </>
    );
  }

  return (
    <>
      <LayerCard.Secondary>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-kumo-recessed">
            <ShieldKeyhole24Filled className="text-kumo-secondary" />
          </div>
          <Text variant="heading2" as="h1" DANGEROUS_className="text-center">
            Recupera tu cuenta
          </Text>
          <Text variant="secondary" size="sm" as="p" DANGEROUS_className="text-center">
            Usa uno de los códigos de recuperación que guardaste al activar la
            autenticación de doble factor para verificar tu identidad y acceder
            a tu cuenta.
          </Text>
        </div>
      </LayerCard.Secondary>

      <LayerCard.Primary className="gap-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            type="email"
            disabled={isLoading}
            placeholder="GlobalID@Company.com"
            autoFocus
          />
          <Input
            label="Código de recuperación"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            autoComplete="one-time-code"
            type="text"
            disabled={isLoading}
            placeholder="XXXX-XXXX-XXXX"
          />
          <Button
            variant="primary"
            type="submit"
            className="w-full justify-center"
            size="lg"
            loading={isLoading}
          >
            Verificar
          </Button>
        </form>

        <div className="text-center">
          <Text variant="secondary" size="sm" as="span">
            ¿Ya tienes cuenta?{' '}
          </Text>
          <Link href="/auth/login" variant="plain" render={<NextLink href="/auth/login" />}>
            <Text as="span" size="sm" bold>Iniciar sesión</Text>
          </Link>
        </div>

        <div className="h-px w-full bg-kumo-hairline" />

        <div className="text-center">
          <Text variant="secondary" size="sm" as="span">
            ¿No encuentras tu código de recuperación?{' '}
          </Text>
          <Link
            href="/auth/forgot-password"
            variant="plain"
            render={<NextLink href="/auth/forgot-password" />}
          >
            <Text as="span" size="sm" bold>Iniciar recuperación de cuenta</Text>
          </Link>
        </div>
      </LayerCard.Primary>
    </>
  );
}
