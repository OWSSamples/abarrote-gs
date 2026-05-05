'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, signInWithRedirect, confirmSignIn, fetchAuthSession } from '@/lib/cognito';
import { evaluatePassword } from '@/lib/auth/password-policy';
import { logAuthEvent } from '@/lib/auth/auth-logger';
import { checkAuthRateLimit } from '@/app/actions/auth-rate-limit';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { Card, FormLayout, TextField, Button, BlockStack, Box, Text, InlineStack, Icon } from '@shopify/polaris';
import { HideIcon, ViewIcon } from '@shopify/polaris-icons';
import { useToast } from '@/components/notifications/ToastProvider';
import { BrandLogo } from '@/components/ui/BrandLogo';

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
  const [showPassword, setShowPassword] = useState(false);
  const [requiresNewPassword, setRequiresNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaDelivery, setMfaDelivery] = useState<'email' | 'sms' | null>(null);

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
          // MFA opcional — omitir configuración de MFA automáticamente
          void logAuthEvent({ event: 'sign_in_challenge', email, reason: 'MFA_SETUP_SELECTION_SKIPPED' });
          try {
            const mfaResult = await confirmSignIn({ challengeResponse: 'NOMFA' });
            if (mfaResult.isSignedIn) {
              await ensureSessionCookie();
              void logAuthEvent({ event: 'sign_in_success', email });
              toast.showSuccess('Bienvenido al sistema');
              router.refresh();
              router.push('/');
            }
          } catch {
            toast.showError('Error al completar el inicio de sesión. Inténtalo de nuevo.');
          }
        } else if (
          result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_EMAIL_OTP' ||
          result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE' ||
          result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_SMS_MFA_CODE' ||
          result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_SMS_CODE'
        ) {
          void logAuthEvent({ event: 'sign_in_challenge', email, reason: result.nextStep.signInStep });
          const isSms = result.nextStep.signInStep.includes('SMS');
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
          toast.showSuccess('Bienvenido al sistema');
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
        }
      } finally {
        setIsLoading(false);
      }
    },
    [mfaCode, email, router, toast],
  );

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
            <BlockStack gap="200" align="center">
              <Text as="h1" variant="headingLg" fontWeight="bold">
                {requiresNewPassword
                  ? 'Establece tu contraseña'
                  : requiresMfa
                    ? 'Verificación de identidad'
                    : 'Consola de Administración'}
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                {requiresNewPassword
                  ? 'Tu cuenta requiere que establezcas una nueva contraseña para continuar.'
                  : requiresMfa
                    ? `Ingresa el código de verificación enviado a tu ${mfaDelivery === 'email' ? 'correo electrónico' : 'teléfono'}.`
                    : 'Ingresa tus credenciales para acceder al panel'}
              </Text>
            </BlockStack>
          </BlockStack>

          {requiresMfa ? (
            <form onSubmit={handleMfaCode}>
              <FormLayout>
                <TextField
                  label="Código de verificación"
                  value={mfaCode}
                  onChange={setMfaCode}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={isLoading}
                  placeholder="Ej. 123456"
                  maxLength={8}
                />
                <Box paddingBlockStart="300">
                  <Button variant="primary" submit fullWidth loading={isLoading} size="large">
                    Verificar código
                  </Button>
                </Box>
              </FormLayout>
            </form>
          ) : requiresNewPassword ? (
            <form onSubmit={handleNewPassword}>
              <FormLayout>
                <TextField
                  label="Nueva contraseña"
                  value={newPassword}
                  onChange={setNewPassword}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={isLoading}
                  placeholder="Mínimo 8 caracteres"
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
                <PasswordStrengthMeter password={newPassword} />
                <TextField
                  label="Confirmar contraseña"
                  value={confirmNewPassword}
                  onChange={setConfirmNewPassword}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={isLoading}
                  placeholder="Repite la contraseña"
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
                <Box paddingBlockStart="300">
                  <Button
                    variant="primary"
                    submit
                    fullWidth
                    loading={isLoading}
                    size="large"
                  >
                    Establecer contraseña
                  </Button>
                </Box>
              </FormLayout>
            </form>
          ) : (
            <>
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
                  <BlockStack gap="200">
                    <TextField
                      label="Contraseña"
                      value={password}
                      onChange={setPassword}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      disabled={isLoading}
                      placeholder=""
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
                    <InlineStack align="end">
                      <Link
                        href="/auth/forgot-password"
                        style={{
                          fontSize: '13px',
                          color: '#0518d2',
                          textDecoration: 'none',
                          fontWeight: '500',
                        }}
                      >
                        ¿Olvidaste tu contraseña?
                      </Link>
                    </InlineStack>
                  </BlockStack>

                  <Box paddingBlockStart="300">
                    <Button
                      variant="primary"
                      submit
                      fullWidth
                      loading={isLoading}
                      disabled={isMicrosoftLoading}
                      size="large"
                    >
                      Iniciar Sesión
                    </Button>
                  </Box>
                </FormLayout>
              </form>

              <Box>
                <BlockStack gap="300">
                  <div style={{ textAlign: 'center' }}>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      — o —
                    </Text>
                  </div>
                  <Button
                    onClick={handleMicrosoftLogin}
                    fullWidth
                    loading={isMicrosoftLoading}
                    disabled={isLoading}
                    size="large"
                  >
                    Iniciar sesión con Microsoft
                  </Button>
                </BlockStack>
              </Box>

              <Box paddingBlockStart="300" borderBlockStartWidth="025" borderColor="border">
                <div style={{ textAlign: 'center' }}>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    ¿No tienes una cuenta?{' '}
                    <Link
                      href="/auth/register"
                      style={{
                        color: '#0518d2',
                        fontWeight: '600',
                        textDecoration: 'none',
                      }}
                    >
                      Contacta a TI para ayuda
                    </Link>
                  </Text>
                </div>
              </Box>
            </>
          )}
        </BlockStack>
      </Card>
    </Box>
  );
}
