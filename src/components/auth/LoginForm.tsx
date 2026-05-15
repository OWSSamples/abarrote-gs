'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import QRCode from 'qrcode';
import { signIn, signOut, signInWithRedirect, confirmSignIn, fetchAuthSession } from '@/lib/cognito';
import { evaluatePassword } from '@/lib/auth/password-policy';
import { logAuthEvent } from '@/lib/auth/auth-logger';
import { checkAuthRateLimit } from '@/app/actions/auth-rate-limit';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { SensitiveInput } from '@cloudflare/kumo/components/sensitive-input';
import { Text } from '@cloudflare/kumo/components/text';
import { Link } from '@cloudflare/kumo/components/link';
import { useToast } from '@/components/notifications/ToastProvider';

function writeSessionCookie(token: string): void {
  const isHttps = window.location.protocol === 'https:';
  document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Strict${isHttps ? '; Secure' : ''}`;
}

async function ensureSessionCookie(): Promise<void> {
  const session = await fetchAuthSession({ forceRefresh: true });
  const idToken = session.tokens?.idToken?.toString();
  if (idToken) {
    writeSessionCookie(idToken);
  }
}

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [requiresNewPassword, setRequiresNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaDelivery, setMfaDelivery] = useState<'email' | 'sms' | null>(null);
  const [totpSetup, setTotpSetup] = useState<{ secretCode: string; qrUri: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const qrGenerated = useRef(false);

  useEffect(() => {
    if (totpSetup && !qrGenerated.current) {
      qrGenerated.current = true;
      QRCode.toDataURL(totpSetup.qrUri, { width: 200, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    }
    if (!totpSetup) {
      qrGenerated.current = false;
      setQrDataUrl(null);
    }
  }, [totpSetup]);

  const handleMicrosoftLogin = useCallback(async () => {
    setIsMicrosoftLoading(true);
    void logAuthEvent({ event: 'oauth_redirect', provider: 'microsoft' });
    try {
      // Cognito federated sign-in redirects to Microsoft via Hosted UI
      await signInWithRedirect({ provider: { custom: 'Microsoft' } });
      // The redirect will happen — callback handled by /auth/callback page
    } catch (error: unknown) {
      console.error('Microsoft SignIn error:', error);
      void logAuthEvent({
        event: 'oauth_callback_failure',
        provider: 'microsoft',
        errorCode: (error as { name?: string }).name,
      });
      toast.showError('Error al conectarse a Microsoft. Contacta al administrador.');
    } finally {
      setIsMicrosoftLoading(false);
    }
  }, [toast]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!email || !password) {
        toast.showError('Por favor completa todos los campos');
        return;
      }

      setIsLoading(true);
      void logAuthEvent({ event: 'sign_in_attempt', email });
      try {
        const limit = await checkAuthRateLimit('login', email);
        if (!limit.allowed) {
          toast.showError(
            `Demasiados intentos. Vuelve a intentar en ${limit.retryAfterSeconds} segundos.`,
          );
          return;
        }
        // Defensive: clear any leftover Cognito session from a previous
        // partial sign-in attempt (e.g. abandoned MFA challenge). Without
        // this, signIn() throws UserAlreadyAuthenticatedException.
        try {
          await signOut();
        } catch {
          // No active session — expected on a fresh login.
        }
        const result = await signIn({ username: email, password });
        if (result.isSignedIn) {
          await ensureSessionCookie();
          void logAuthEvent({ event: 'sign_in_success', email });
          toast.showSuccess('Bienvenido al sistema');
          router.refresh();
          router.push('/');
        } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
          void logAuthEvent({ event: 'sign_in_challenge', email, reason: 'CONFIRM_SIGN_UP' });
          toast.showError('Confirma tu cuenta primero. Revisa tu correo.');
        } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
          void logAuthEvent({ event: 'force_password_change', email });
          setRequiresNewPassword(true);
        } else if (result.nextStep?.signInStep === 'CONTINUE_SIGN_IN_WITH_MFA_SETUP_SELECTION') {
          // Seleccionar TOTP como método MFA
          void logAuthEvent({ event: 'sign_in_challenge', email, reason: 'MFA_SETUP_TOTP' });
          try {
            const totpResult = await confirmSignIn({ challengeResponse: 'TOTP' });
            if (totpResult.nextStep?.signInStep === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP') {
              const setupDetails = totpResult.nextStep.totpSetupDetails;
              const secretCode = setupDetails.sharedSecret;
              const qrUri = setupDetails.getSetupUri('AbarroteGS', email).toString();
              setTotpSetup({ secretCode, qrUri });
              setRequiresMfa(true);
            }
          } catch {
            toast.showError('Error al iniciar configuración MFA. Inténtalo de nuevo.');
          }
        } else if (result.nextStep?.signInStep === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP') {
          // Directo a TOTP setup (sin paso de selección)
          void logAuthEvent({ event: 'sign_in_challenge', email, reason: 'TOTP_SETUP_DIRECT' });
          const setupDetails = result.nextStep.totpSetupDetails;
          const secretCode = setupDetails.sharedSecret;
          const qrUri = setupDetails.getSetupUri('AbarroteGS', email).toString();
          setTotpSetup({ secretCode, qrUri });
          setRequiresMfa(true);
        } else if (
          result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE' ||
          result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_SMS_CODE' ||
          result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE'
        ) {
          void logAuthEvent({ event: 'sign_in_challenge', email, reason: result.nextStep.signInStep });
          const isSms = result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_SMS_CODE';
          setMfaDelivery(isSms ? 'sms' : 'email');
          setRequiresMfa(true);
        } else {
          console.error('[LoginForm] Unhandled signInStep:', result.nextStep?.signInStep, result);
          void logAuthEvent({ event: 'sign_in_challenge', email, reason: result.nextStep?.signInStep });
          toast.showError(`Paso de autenticación no soportado: ${result.nextStep?.signInStep ?? 'desconocido'}. Contacta al administrador.`);
        }
      } catch (error: unknown) {
        console.error('SignIn error:', error);
        const err = error as { name?: string };
        void logAuthEvent({ event: 'sign_in_failure', email, errorCode: err.name });
        const errorMessage =
          err.name === 'NotAuthorizedException'
            ? 'Correo o contraseña incorrectos'
            : err.name === 'UserNotFoundException'
              ? 'Correo o contraseña incorrectos'
              : 'Error al iniciar sesión. Inténtalo de nuevo.';
        toast.showError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, router, toast],
  );

  const handleNewPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword !== confirmNewPassword) {
        toast.showError('Las contraseñas no coinciden.');
        return;
      }
      const evaluation = evaluatePassword(newPassword);
      if (!evaluation.isValid) {
        toast.showError('La contraseña no cumple los requisitos de seguridad.');
        return;
      }
      setIsLoading(true);
      try {
        const result = await confirmSignIn({ challengeResponse: newPassword });
        if (result.isSignedIn) {
          await ensureSessionCookie();
          toast.showSuccess('Contraseña actualizada. Bienvenido al sistema.');
          router.refresh();
          router.push('/');
        }
      } catch (error: unknown) {
        console.error('confirmSignIn error:', error);
        const err = error as { name?: string; message?: string };
        toast.showError(err.message || 'Error al cambiar la contraseña.');
      } finally {
        setIsLoading(false);
      }
    },
    [newPassword, confirmNewPassword, router, toast],
  );

  const handleMfaCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!mfaCode.trim()) {
        toast.showError('Ingresa el código de verificación.');
        return;
      }
      setIsLoading(true);
      try {
        const result = await confirmSignIn({ challengeResponse: mfaCode.trim() });
        if (result.isSignedIn) {
          await ensureSessionCookie();
          void logAuthEvent({ event: 'sign_in_success', email });
          toast.showSuccess(totpSetup ? 'MFA configurado exitosamente. Bienvenido.' : 'Bienvenido al sistema');
          router.refresh();
          router.push('/');
        } else {
          toast.showError('Código incorrecto. Inténtalo de nuevo.');
        }
      } catch (error: unknown) {
        const err = error as { name?: string; message?: string };
        console.warn('[LoginForm] MFA confirmSignIn failed:', err.name);
        void logAuthEvent({ event: 'sign_in_failure', email, errorCode: err.name });
        const msg =
          err.name === 'CodeMismatchException'
            ? 'Código incorrecto. Verifica e inténtalo de nuevo.'
            : err.name === 'ExpiredCodeException'
              ? 'El código expiró. Solicita uno nuevo iniciando sesión otra vez.'
              : err.name === 'NotAuthorizedException'
                ? 'La sesión expiró. Vuelve a iniciar sesión.'
                : err.name === 'LimitExceededException'
                  ? 'Demasiados intentos. Espera unos minutos antes de reintentar.'
                  : err.message || 'Error al verificar el código.';
        toast.showError(msg);
        // Si la sesión se invalidó, regresar al formulario de login
        if (err.name === 'NotAuthorizedException') {
          setRequiresMfa(false);
          setMfaCode('');
          setTotpSetup(null);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [mfaCode, email, router, toast, totpSetup],
  );

  return (
    <div className="space-y-4">
      {requiresMfa ? (
        <>
          {/* ── MFA Title ── */}
          <div className="space-y-1">
            <Text variant="heading2" as="h1">
              {totpSetup ? 'Configuración de Seguridad' : 'Verificación de Identidad'}
            </Text>
            <Text variant="secondary" size="sm">
              {totpSetup
                ? 'Escanea el código QR con tu app autenticadora.'
                : mfaDelivery === 'sms'
                  ? 'Ingresa el código enviado a tu teléfono.'
                  : 'Ingresa el código de verificación.'}
            </Text>
          </div>

          <form onSubmit={handleMfaCode} className="space-y-4">
            {totpSetup && (
              <div className="flex flex-col items-center gap-4 rounded-lg bg-kumo-recessed p-3">
                <div className="rounded-md bg-kumo-base p-4 shadow-xs">
                  {qrDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={qrDataUrl} alt="Código QR para autenticador" width={180} height={180} className="block" />
                  ) : (
                    <div className="flex h-[180px] w-[180px] items-center justify-center">
                      <Text variant="secondary" size="sm">Generando QR...</Text>
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-center">
                  <Text variant="secondary" size="xs" as="p" DANGEROUS_className="text-center">
                    ¿No puedes escanear? Usa esta clave manual:
                  </Text>
                  <div className="rounded-md bg-kumo-recessed px-3 py-2">
                    <Text variant="mono" as="p" DANGEROUS_className="text-center break-all text-sm">
                      {totpSetup.secretCode}
                    </Text>
                  </div>
                </div>
              </div>
            )}
            <Input
              label={totpSetup ? 'Código de tu app autenticadora' : 'Código de verificación'}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={isLoading}
              placeholder="123456"
              maxLength={8}
              autoFocus
            />
            <Button variant="primary" type="submit" className="w-full justify-center" loading={isLoading}>
              Verificar
            </Button>
          </form>
        </>
      ) : requiresNewPassword ? (
        <>
          {/* ── New Password Title ── */}
          <div className="space-y-1">
            <Text variant="heading2" as="h1">
              Establece tu contraseña
            </Text>
            <Text variant="secondary" size="sm">
              Crea una contraseña segura para tu cuenta.
            </Text>
          </div>

          <form onSubmit={handleNewPassword} className="space-y-4">
            <SensitiveInput
              label="Nueva contraseña"
              value={newPassword}
              onValueChange={setNewPassword}
              autoComplete="new-password"
              disabled={isLoading}
            />
            <PasswordStrengthMeter password={newPassword} />
            <SensitiveInput
              label="Confirmar contraseña"
              value={confirmNewPassword}
              onValueChange={setConfirmNewPassword}
              autoComplete="new-password"
              disabled={isLoading}
            />
            <Button variant="primary" type="submit" className="w-full justify-center" loading={isLoading}>
              Guardar contraseña
            </Button>
          </form>
        </>
      ) : (
        <>
          {/* ── Login Title ── */}
          <div className="space-y-0.5">
            <Text variant="heading2" as="h1">
              Iniciar sesión
            </Text>
            <Text variant="secondary" size="sm">
              Ingresa tus credenciales para acceder a Kiosko.
            </Text>
          </div>

          {/* ── SSO ── */}
          <div className="space-y-2">
            <Button variant="secondary" className="w-full justify-center" disabled onClick={handleMicrosoftLogin} icon={
              <svg width="16" height="16" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
            }>
              Microsoft SSO
            </Button>
            <Button variant="secondary" className="w-full justify-center" disabled icon={
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src="/icon/aws.svg" alt="" className="h-3.5 w-6 object-contain" />
            }>
              AWS SSO
            </Button>
          </div>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-kumo-hairline" />
            <Text variant="secondary" size="sm" as="span">o</Text>
            <div className="h-px flex-1 bg-kumo-hairline" />
          </div>

          {/* ── Credentials ── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              disabled={isLoading}
              placeholder="tu@empresa.com"
              autoFocus
            />
            <SensitiveInput
              label="Contraseña"
              value={password}
              onValueChange={setPassword}
              autoComplete="current-password"
              disabled={isLoading}
            />
            <div className="flex justify-end">
              <Link href="/auth/forgot-password" variant="plain" render={<NextLink href="/auth/forgot-password" />}>
                <Text variant="secondary" size="xs">¿Olvidaste tu contraseña?</Text>
              </Link>
            </div>
            <Button variant="primary" type="submit" className="w-full justify-center" loading={isLoading} disabled={isMicrosoftLoading}>
              Iniciar sesión
            </Button>
          </form>

          {/* ── Register link ── */}
          <Text variant="secondary" size="sm" as="p" DANGEROUS_className="text-center">
            ¿No tienes cuenta?{' '}
            <Link href="/auth/register" variant="inline" render={<NextLink href="/auth/register" />}>
              Contacta a TI
            </Link>
          </Text>
        </>
      )}
    </div>
  );
}
