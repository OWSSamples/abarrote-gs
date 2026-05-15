'use client';

import { useState, useCallback } from 'react';
import NextLink from 'next/link';
import { resetPassword } from '@/lib/cognito';
import { logAuthEvent } from '@/lib/auth/auth-logger';
import { checkAuthRateLimit } from '@/app/actions/auth-rate-limit';
import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { Text } from '@cloudflare/kumo/components/text';
import { Link } from '@cloudflare/kumo/components/link';
import { useToast } from '@/components/notifications/ToastProvider';
import { EnvelopeSimple } from '@phosphor-icons/react';

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

  if (emailSent) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-kumo-info-tint/30">
            <EnvelopeSimple size={24} className="text-kumo-info" />
          </div>
          <Text variant="heading2" as="h1" DANGEROUS_className="text-center">
            Revisa tu correo
          </Text>
          <Text variant="secondary" as="p" DANGEROUS_className="text-center">
            Hemos enviado un enlace de recuperación a:{' '}
            <Text as="span" bold>{email}</Text>
          </Text>
        </div>
        <Button variant="primary" className="w-full justify-center" size="lg" onClick={handleResend} loading={isLoading}>
          Reenviar correo
        </Button>
        <div className="pt-2 text-center">
          <Link href="/auth/login" variant="plain" render={<NextLink href="/auth/login" />}>
            <Text variant="secondary" size="sm">← Volver al inicio de sesión</Text>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <Text variant="heading2" as="h1" DANGEROUS_className="text-center">
          ¿Olvidaste tu contraseña?
        </Text>
        <Text variant="secondary" as="p" DANGEROUS_className="text-center">
          No te preocupes, te enviaremos instrucciones para restablecerla.
        </Text>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          type="email"
          disabled={isLoading}
          placeholder="tu@empresa.com"
        />
        <Button variant="primary" type="submit" className="w-full justify-center" size="lg" loading={isLoading}>
          Enviar instrucciones
        </Button>
      </form>
      <div className="pt-2 text-center">
        <Link href="/auth/login" variant="plain" render={<NextLink href="/auth/login" />}>
          <Text variant="secondary" size="sm">← Volver al inicio de sesión</Text>
        </Link>
      </div>
    </div>
  );
}
