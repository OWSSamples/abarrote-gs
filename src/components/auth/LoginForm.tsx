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
  const [mfaDelivery, setMfaDelivery] = useState<'email' | 'sms' | 'totp' | null>(null);
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
          const step = result.nextStep.signInStep;
          if (step === 'CONFIRM_SIGN_IN_WITH_SMS_CODE') {
            // SMS no está disponible aún en este entorno.
            toast.showError('La verificación por SMS no está disponible todavía. Contacta al administrador.');
            return;
          }
          setMfaDelivery(step === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE' ? 'totp' : 'email');
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
          {/* ── MFA Header (icon + title + description) ── */}
          {totpSetup ? (
            <div className="space-y-1">
              <Text variant="heading2" as="h1">
                Configuración de Seguridad
              </Text>
              <Text variant="secondary" size="sm">
                Escanea el código QR con tu app autenticadora.
              </Text>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/device-mfa.svg"
                alt=""
                width={72}
                height={72}
                aria-hidden="true"
                className="block h-18 w-18 shrink-0"
              />
              <Text variant="heading2" as="h1" DANGEROUS_className="text-center">
                {mfaDelivery === 'totp'
                  ? 'Verifica con tu app autenticadora'
                  : mfaDelivery === 'sms'
                    ? 'Verifica con tu teléfono'
                    : 'Verifica con tu correo electrónico'}
              </Text>
              <Text variant="secondary" size="sm" as="p" DANGEROUS_className="text-center">
                {mfaDelivery === 'totp'
                  ? 'Ingresa el código de 6 dígitos generado por tu app autenticadora (Google Authenticator, Authy, 1Password, etc.).'
                  : mfaDelivery === 'sms'
                    ? 'Ingresa el código que enviamos por SMS a tu teléfono.'
                    : `Ingresa el código que enviamos a ${email || 'tu correo electrónico'}.`}
              </Text>
            </div>
          )}

          <form onSubmit={handleMfaCode} className="space-y-4">
            {totpSetup && (
              <div className="flex flex-col items-center gap-4 rounded-lg bg-kumo-recessed p-3">
                <div className="rounded-md bg-kumo-base p-4 shadow-xs">
                  {qrDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={qrDataUrl} alt="Código QR para autenticador" width={180} height={180} className="block" />
                  ) : (
                    <div className="flex h-45 w-45 items-center justify-center">
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

          {!totpSetup && (
            <>
              <div className="h-px w-full bg-kumo-hairline" />
              <div className="text-center">
                <Text variant="secondary" size="sm" as="span">
                  ¿Perdiste tus dispositivos 2FA y códigos de respaldo?{' '}
                </Text>
                <Link href="/auth/mfa-recovery" variant="plain" render={<NextLink href="/auth/mfa-recovery" />}>
                  <Text as="span" size="sm" bold>Intenta recuperación</Text>
                </Link>
              </div>
            </>
          )}
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
              Microsoft
            </Button>
            <Button variant="secondary" className="w-full justify-center" disabled icon={
              <svg width="20" height="12" viewBox="0 0 109 64" fill="none">
                <path fill="#252F3E" d="M30.63 23.243c0 1.317.144 2.385.398 3.168.289.783.65 1.637 1.156 2.563.18.284.253.569.253.818 0 .356-.217.712-.687 1.068l-2.277 1.495c-.325.214-.65.32-.94.32-.361 0-.723-.178-1.084-.498a11 11 0 0 1-1.301-1.673 27 27 0 0 1-1.12-2.1q-4.23 4.912-10.627 4.912c-3.037 0-5.458-.854-7.23-2.563-1.77-1.708-2.674-3.986-2.674-6.834 0-3.025 1.084-5.481 3.29-7.332 2.204-1.851 5.132-2.777 8.855-2.777 1.229 0 2.494.107 3.831.285s2.71.463 4.157.783V12.28c0-2.705-.579-4.592-1.7-5.695-1.156-1.104-3.108-1.638-5.89-1.638-1.266 0-2.567.143-3.904.463-1.338.32-2.64.712-3.904 1.21a10 10 0 0 1-1.265.463c-.253.071-.434.107-.579.107-.506 0-.759-.356-.759-1.104V4.342c0-.57.073-.996.253-1.246.181-.249.506-.498 1.012-.747q1.899-.96 4.555-1.602c1.77-.462 3.65-.676 5.638-.676 4.302 0 7.446.961 9.47 2.883 1.989 1.922 3 4.84 3 8.756v11.533zm-14.675 5.41c1.193 0 2.422-.213 3.723-.64s2.458-1.21 3.434-2.279c.578-.676 1.012-1.423 1.229-2.278a12.6 12.6 0 0 0 .361-3.096v-1.495a31 31 0 0 0-3.325-.605 28 28 0 0 0-3.398-.214c-2.422 0-4.193.463-5.386 1.424-1.192.96-1.77 2.313-1.77 4.093 0 1.673.433 2.919 1.337 3.773.867.89 2.132 1.317 3.795 1.317m29.024 3.844c-.65 0-1.084-.106-1.373-.356-.29-.213-.542-.711-.759-1.388L34.353 3.24c-.217-.712-.325-1.175-.325-1.424 0-.57.289-.89.867-.89h3.542c.687 0 1.157.107 1.41.356.29.214.506.712.723 1.388l6.072 23.564L52.281 2.67c.18-.712.398-1.174.687-1.388s.795-.356 1.445-.356h2.892c.687 0 1.157.107 1.446.356.289.214.542.712.687 1.388l5.71 23.849L71.402 2.67c.217-.712.47-1.174.723-1.388.289-.213.759-.356 1.41-.356h3.36c.58 0 .904.285.904.89 0 .178-.036.356-.072.57a5 5 0 0 1-.253.89l-8.71 27.514q-.326 1.067-.76 1.388c-.29.214-.759.356-1.374.356h-3.108c-.687 0-1.157-.107-1.446-.356-.289-.25-.542-.712-.687-1.424L55.787 7.795l-5.566 22.923c-.181.712-.398 1.174-.687 1.423s-.795.356-1.446.356zm46.447.961c-1.88 0-3.759-.213-5.566-.64s-3.217-.89-4.157-1.424c-.578-.32-.976-.676-1.12-.997a2.5 2.5 0 0 1-.217-.996v-1.816c0-.747.289-1.103.831-1.103q.326 0 .65.107c.218.07.543.213.904.356 1.23.534 2.567.96 3.976 1.245a22 22 0 0 0 4.302.427c2.277 0 4.048-.391 5.277-1.174s1.88-1.922 1.88-3.382c0-.996-.326-1.815-.977-2.491-.65-.676-1.88-1.282-3.65-1.851l-5.241-1.602c-2.639-.818-4.59-2.029-5.784-3.63-1.192-1.566-1.807-3.31-1.807-5.162q0-2.242.976-3.95a9.2 9.2 0 0 1 2.603-2.92c1.084-.818 2.313-1.423 3.759-1.85S91.029 0 92.619 0c.795 0 1.627.035 2.422.142.831.107 1.59.25 2.35.392.722.178 1.409.356 2.06.57q.975.32 1.518.64c.506.285.867.57 1.084.89q.325.427.325 1.174v1.673c0 .748-.289 1.14-.831 1.14-.289 0-.759-.143-1.374-.428q-3.09-1.388-6.94-1.388c-2.06 0-3.686.32-4.807.997-1.12.676-1.699 1.708-1.699 3.168 0 .996.362 1.85 1.085 2.527.723.676 2.06 1.352 3.976 1.957l5.132 1.602c2.603.819 4.482 1.958 5.603 3.417 1.12 1.46 1.662 3.133 1.662 4.983 0 1.53-.325 2.92-.939 4.13-.651 1.21-1.518 2.277-2.639 3.132-1.12.89-2.458 1.53-4.012 1.993-1.627.498-3.325.747-5.169.747"/>
                <path fill="#FF9900" d="M98.254 50.76C86.363 59.408 69.085 64 54.23 64 33.41 64 14.65 56.42.481 43.82c-1.12-.997-.108-2.35 1.23-1.567 15.325 8.756 34.229 14.06 53.784 14.06 13.193 0 27.687-2.705 41.024-8.258 1.988-.89 3.687 1.282 1.735 2.705"/>
                <path fill="#FF9900" d="M103.199 45.204c-1.519-1.922-10.049-.925-13.916-.463-1.157.143-1.338-.854-.29-1.601 6.796-4.699 17.965-3.346 19.266-1.78 1.301 1.602-.362 12.6-6.723 17.868-.976.819-1.916.392-1.482-.676 1.446-3.524 4.663-11.461 3.145-13.348"/>
              </svg>
            }>
              AWS
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
              placeholder="GlobalID@Company.com"
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
