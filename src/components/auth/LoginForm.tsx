'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import QRCode from 'qrcode';
import { signIn, signOut, signInWithRedirect, confirmSignIn, resendSignUpCode } from '@/lib/cognito';
import { evaluatePassword } from '@/lib/auth/password-policy';
import { logAuthEvent } from '@/lib/auth/auth-logger';
import { checkAuthRateLimit } from '@/app/actions/auth-rate-limit';
import {
  getCurrentTenantRegistrationStatus,
  preparePendingSignupVerification,
} from '@/app/actions/register-tenant-actions';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { Button } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { SensitiveInput } from '@cloudflare/kumo/components/sensitive-input';
import { Text } from '@cloudflare/kumo/components/text';
import { Link } from '@cloudflare/kumo/components/link';
import { useToast } from '@/components/notifications/ToastProvider';
import { synchronizeServerSession } from '@/lib/auth/session-client';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { normalizeEmailAddress } from '@/lib/security/redaction';
import { ShieldKeyhole24Filled } from '@fluentui/react-icons';

async function ensureSessionCookie(): Promise<void> {
  const syncStatus = await synchronizeServerSession(false);
  if (syncStatus !== 'established') throw new Error('No fue posible establecer la sesión segura.');
}

const PENDING_SIGNUP_EMAIL_STORAGE_KEY = 'opendex.pendingSignupEmail';
const AUTH_RETURN_TO_STORAGE_KEY = 'opendex.authReturnTo';

function getSafeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

function getLoginErrorMessage(error: unknown): string {
  const err = error as { name?: string; message?: string };
  const message = (err.message ?? '').toLowerCase();
  const diagnostic = err.name ? ` Código: ${err.name}.` : '';

  if (
    err.name === 'LimitExceededException' ||
    err.name === 'TooManyRequestsException' ||
    message.includes('password attempts exceeded')
  ) {
    return 'El acceso está bloqueado temporalmente por varios intentos. Espera unos minutos antes de volver a intentarlo.';
  }

  if (err.name === 'PasswordResetRequiredException') {
    return 'Debes restablecer tu contraseña antes de iniciar sesión.';
  }

  if (message.includes('user is disabled')) {
    return 'Tu cuenta está desactivada. Contacta al administrador del negocio.';
  }

  if (
    message.includes('secret_hash') ||
    message.includes('configured with secret') ||
    (message.includes('auth flow') && message.includes('not enabled'))
  ) {
    return 'La configuración del inicio de sesión no es válida. Contacta al administrador de la plataforma.';
  }

  if (err.name === 'NetworkError' || message.includes('network')) {
    return 'No fue posible conectar con el servicio de identidad. Revisa tu conexión e intenta de nuevo.';
  }

  if (message.includes('verificar la seguridad') || message.includes('solicitud no pudo ser verificada')) {
    return 'No fue posible verificar la seguridad de la solicitud. Recarga la página e intenta de nuevo.';
  }

  if (message.includes('sesión segura') || message.includes('establecer la sesión')) {
    return 'El acceso fue validado, pero no fue posible crear la sesión del servidor. Intenta de nuevo en unos segundos.';
  }

  if (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException') {
    return 'No pudimos validar el acceso. Verifica el correo y la contraseña o restablece tu contraseña.';
  }

  if (process.env.NODE_ENV !== 'production') {
    return `No fue posible iniciar sesión.${diagnostic}${err.message ? ` Detalle: ${err.message}` : ''}`;
  }

  return `No fue posible iniciar sesión.${diagnostic} Inténtalo de nuevo o contacta al administrador.`;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'));
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
      if (returnTo) window.sessionStorage.setItem(AUTH_RETURN_TO_STORAGE_KEY, returnTo);
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
  }, [returnTo, toast]);

  const continuePendingRegistration = useCallback(
    async (rawEmail: string) => {
      const normalizedEmail = normalizeEmailAddress(rawEmail);
      window.sessionStorage.setItem(PENDING_SIGNUP_EMAIL_STORAGE_KEY, normalizedEmail);

      try {
        const pending = await preparePendingSignupVerification({ email: normalizedEmail });
        if (pending.status === 'pending' && pending.username) {
          await resendSignUpCode({ username: pending.username });
          toast.showSuccess('Te reenviamos el código para completar tu registro.');
        } else if (pending.status === 'rate_limited') {
          toast.showError(`Demasiadas solicitudes. Intenta de nuevo en ${pending.retryAfterSeconds ?? 60} segundos.`);
        } else {
          toast.showError('Completa la verificación pendiente para poder ingresar.');
        }
      } catch (error) {
        const err = error as { name?: string };
        if (err.name === 'LimitExceededException' || err.name === 'TooManyRequestsException') {
          toast.showError('AWS limitó temporalmente el reenvío. Continúa con el último código recibido o espera unos minutos.');
        } else {
          toast.showError('Completa la verificación pendiente para poder ingresar.');
        }
      }

      router.push('/auth/register?mode=verify');
    },
    [router, toast],
  );

  const finishAuthenticatedLogin = useCallback(
    async (rawEmail: string, successMessage: string): Promise<void> => {
      const normalizedEmail = normalizeEmailAddress(rawEmail);
      await ensureSessionCookie();
      if (returnTo?.startsWith('/auth/accept-invitation?')) {
        void logAuthEvent({ event: 'sign_in_success', email: normalizedEmail });
        toast.showSuccess(successMessage);
        router.push(returnTo);
        return;
      }
      const tenantStatus = await getCurrentTenantRegistrationStatus();

      if (!tenantStatus.hasTenant) {
        window.sessionStorage.setItem(
          PENDING_SIGNUP_EMAIL_STORAGE_KEY,
          normalizeEmailAddress(tenantStatus.email || normalizedEmail),
        );
        void logAuthEvent({
          event: 'sign_in_challenge',
          email: normalizedEmail,
          reason: 'TENANT_PROVISIONING_REQUIRED',
        });
        router.push('/auth/register?mode=verify');
        return;
      }

      void logAuthEvent({ event: 'sign_in_success', email: normalizedEmail });
      toast.showSuccess(successMessage);
      router.refresh();
      router.push(returnTo ?? '/');
    },
    [returnTo, router, toast],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const normalizedEmail = normalizeEmailAddress(email);

      if (!normalizedEmail || !password) {
        toast.showError('Por favor completa todos los campos');
        return;
      }

      setIsLoading(true);
      void logAuthEvent({ event: 'sign_in_attempt', email: normalizedEmail });
      try {
        const limit = await checkAuthRateLimit('login', normalizedEmail);
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
        const result = await signIn({
          username: normalizedEmail,
          password,
          options: { authFlowType: 'USER_SRP_AUTH' },
        });
        if (result.isSignedIn) {
          await finishAuthenticatedLogin(normalizedEmail, 'Bienvenido al sistema');
        } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
          void logAuthEvent({ event: 'sign_in_challenge', email: normalizedEmail, reason: 'CONFIRM_SIGN_UP' });
          await continuePendingRegistration(normalizedEmail);
        } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
          void logAuthEvent({ event: 'force_password_change', email: normalizedEmail });
          setRequiresNewPassword(true);
        } else if (result.nextStep?.signInStep === 'CONTINUE_SIGN_IN_WITH_MFA_SETUP_SELECTION') {
          // Seleccionar TOTP como método MFA
          void logAuthEvent({ event: 'sign_in_challenge', email: normalizedEmail, reason: 'MFA_SETUP_TOTP' });
          try {
            const totpResult = await confirmSignIn({ challengeResponse: 'TOTP' });
            if (totpResult.nextStep?.signInStep === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP') {
              const setupDetails = totpResult.nextStep.totpSetupDetails;
              const secretCode = setupDetails.sharedSecret;
              const qrUri = setupDetails.getSetupUri('AbarroteGS', normalizedEmail).toString();
              setTotpSetup({ secretCode, qrUri });
              setRequiresMfa(true);
            }
          } catch {
            toast.showError('Error al iniciar configuración MFA. Inténtalo de nuevo.');
          }
        } else if (result.nextStep?.signInStep === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP') {
          // Directo a TOTP setup (sin paso de selección)
          void logAuthEvent({ event: 'sign_in_challenge', email: normalizedEmail, reason: 'TOTP_SETUP_DIRECT' });
          const setupDetails = result.nextStep.totpSetupDetails;
          const secretCode = setupDetails.sharedSecret;
          const qrUri = setupDetails.getSetupUri('Opendex Kiosko Workspaces', normalizedEmail).toString();
          setTotpSetup({ secretCode, qrUri });
          setRequiresMfa(true);
        } else if (
          result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE' ||
          result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_SMS_CODE' ||
          result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE'
        ) {
          void logAuthEvent({ event: 'sign_in_challenge', email: normalizedEmail, reason: result.nextStep.signInStep });
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
          void logAuthEvent({ event: 'sign_in_challenge', email: normalizedEmail, reason: result.nextStep?.signInStep });
          toast.showError(`Paso de autenticación no soportado: ${result.nextStep?.signInStep ?? 'desconocido'}. Contacta al administrador.`);
        }
      } catch (error: unknown) {
        const err = error as { name?: string; message?: string };
        console.warn('[LoginForm] signIn failed:', err.name ?? 'UnknownAuthError', err.message ?? '');
        void logAuthEvent({ event: 'sign_in_failure', email: normalizedEmail, errorCode: err.name });
        if (err.name === 'UserNotConfirmedException') {
          await continuePendingRegistration(normalizedEmail);
          return;
        }
        toast.showError(getLoginErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [continuePendingRegistration, email, finishAuthenticatedLogin, password, toast],
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
          await finishAuthenticatedLogin(email, 'Contraseña actualizada. Bienvenido al sistema.');
        }
      } catch (error: unknown) {
        console.error('confirmSignIn error:', error);
        const err = error as { name?: string; message?: string };
        toast.showError(err.message || 'Error al cambiar la contraseña.');
      } finally {
        setIsLoading(false);
      }
    },
    [confirmNewPassword, email, finishAuthenticatedLogin, newPassword, toast],
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
          await finishAuthenticatedLogin(
            email,
            totpSetup ? 'MFA configurado exitosamente. Bienvenido.' : 'Bienvenido al sistema',
          );
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
    [email, finishAuthenticatedLogin, mfaCode, toast, totpSetup],
  );

  return (
    <>
      {requiresMfa ? (
        <>
          {totpSetup ? (
            <LayerCard.Secondary>
              <div className="space-y-1">
                <Text variant="heading2" as="h1">
                  Configuración de Seguridad
                </Text>
                <Text variant="secondary" size="sm">
                  Escanea el código QR con tu app autenticadora.
                </Text>
              </div>
            </LayerCard.Secondary>
          ) : (
            <LayerCard.Secondary>
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex size-18 shrink-0 items-center justify-center rounded-full bg-kumo-recessed">
                  <ShieldKeyhole24Filled className="text-kumo-secondary" />
                </div>
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
            </LayerCard.Secondary>
          )}

          <LayerCard.Primary className="gap-4">
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
          </LayerCard.Primary>
        </>
      ) : requiresNewPassword ? (
        <>
          <LayerCard.Secondary>
            <div className="space-y-1">
              <Text variant="heading2" as="h1">
                Establece tu contraseña
              </Text>
              <Text variant="secondary" size="sm">
                Crea una contraseña segura para tu cuenta.
              </Text>
            </div>
          </LayerCard.Secondary>

          <LayerCard.Primary className="gap-4">
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
          </LayerCard.Primary>
        </>
      ) : (
        <>
          <LayerCard.Secondary>
            <div className="space-y-0.5">
              <Text variant="heading2" as="h1">
                Iniciar sesión
              </Text>
              <Text variant="secondary" size="sm">
                Ingresa tus credenciales para acceder a OKW.
              </Text>
            </div>
          </LayerCard.Secondary>

          <LayerCard.Primary className="gap-4">
            <div className="space-y-2">
              <Button variant="secondary" className="w-full justify-center" disabled onClick={handleMicrosoftLogin} icon={<BrandLogo name="Microsoft" size={16} />}>
                Microsoft
              </Button>
              <Button variant="secondary" className="w-full justify-center" disabled icon={<BrandLogo name="AWS" size={16} />}>
                AWS
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-kumo-hairline" />
              <Text variant="secondary" size="sm" as="span">o</Text>
              <div className="h-px flex-1 bg-kumo-hairline" />
            </div>

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

            <Text variant="secondary" size="sm" as="p" DANGEROUS_className="text-center">
              ¿No tienes cuenta?{' '}
              <Link href="/auth/register" variant="inline" render={<NextLink href="/auth/register" />}>
                Crear cuenta
              </Link>
            </Text>
          </LayerCard.Primary>
        </>
      )}
    </>
  );
}
