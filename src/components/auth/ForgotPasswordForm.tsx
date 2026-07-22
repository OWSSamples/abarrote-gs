'use client';

import { useCallback, useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { confirmResetPassword, resetPassword, resendSignUpCode } from '@/lib/cognito';
import { logAuthEvent } from '@/lib/auth/auth-logger';
import { evaluatePassword } from '@/lib/auth/password-policy';
import { checkAuthRateLimit, verifyAuthHumanRequest } from '@/app/actions/auth-rate-limit';
import { preparePendingSignupVerification } from '@/app/actions/register-tenant-actions';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { useToast } from '@/components/notifications/ToastProvider';
import { isValidEmailAddress, normalizeEmailAddress } from '@/lib/security/redaction';
import { Banner } from '@cloudflare/kumo/components/banner';
import { Button, buttonVariants } from '@cloudflare/kumo/components/button';
import { Input } from '@cloudflare/kumo/components/input';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Link } from '@cloudflare/kumo/components/link';
import { SensitiveInput } from '@cloudflare/kumo/components/sensitive-input';
import { Text } from '@cloudflare/kumo/components/text';
import {
  ArrowClockwise16Filled,
  ArrowLeft16Filled,
  CheckmarkCircle24Filled,
  LockClosedKey24Filled,
  Mail20Filled,
} from '@fluentui/react-icons';

type RecoveryStep = 'request' | 'confirm' | 'success';
type RecoveryField = 'email' | 'confirmationCode' | 'password' | 'confirmPassword';
type RecoveryFieldErrors = Partial<Record<RecoveryField, string>>;

const RESEND_COOLDOWN_SECONDS = 45;
const PENDING_SIGNUP_EMAIL_STORAGE_KEY = 'opendex.pendingSignupEmail';

function isUnconfirmedSignUpError(error: unknown): boolean {
  const err = error as { name?: string; message?: string };
  const message = err.message?.toLowerCase() ?? '';
  return (
    err.name === 'UserNotConfirmedException' ||
    (err.name === 'InvalidParameterException' && message.includes('confirm')) ||
    message.includes('not confirmed')
  );
}

function getDeliveryMessage(delivery: { deliveryMedium?: string; destination?: string } | undefined): string {
  const destination = delivery?.destination;
  const recoveryHint =
    'Puede tardar unos minutos. Revisa la bandeja principal y correo no deseado antes de reenviar.';

  if (delivery?.deliveryMedium === 'EMAIL') {
    const message = destination
      ? `Si la cuenta existe y el correo está verificado, recibirás un código en ${destination}.`
      : 'Si la cuenta existe y el correo está verificado, recibirás un código de recuperación.';
    return `${message} ${recoveryHint}`;
  }

  if (delivery?.deliveryMedium === 'SMS' || delivery?.deliveryMedium === 'PHONE') {
    const message = destination
      ? `Si la cuenta existe y el teléfono está verificado, recibirás un código en ${destination}.`
      : 'Si la cuenta existe y el teléfono está verificado, recibirás un código de recuperación.';
    return `${message} ${recoveryHint}`;
  }

  return `Si la cuenta puede recuperarse, recibirás un código temporal en el medio verificado. ${recoveryHint}`;
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<RecoveryStep>('request');
  const [email, setEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RecoveryFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  const passwordEvaluation = evaluatePassword(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const resendCooldownSeconds = resendAvailableAt
    ? Math.max(0, Math.ceil((resendAvailableAt - clock) / 1000))
    : 0;

  useEffect(() => {
    if (!resendAvailableAt || resendAvailableAt <= clock) return;

    const timeoutId = window.setTimeout(() => {
      setClock(Date.now());
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [clock, resendAvailableAt]);

  const clearFieldError = useCallback((field: RecoveryField) => {
    setFormError('');
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const requestResetCode = useCallback(
    async (rawEmail: string, isResend = false) => {
      const normalizedEmail = normalizeEmailAddress(rawEmail);

      if (!isValidEmailAddress(normalizedEmail)) {
        setFieldErrors({ email: 'Ingresa un correo electrónico válido.' });
        setFormError('');
        return false;
      }

      setIsLoading(true);
      setFormError('');
      setFieldErrors({});
      void logAuthEvent({ event: 'password_reset_request', email: normalizedEmail });

      try {
        const limit = await checkAuthRateLimit('password_reset', normalizedEmail);
        if (!limit.allowed) {
          setFormError(`Demasiados intentos. Vuelve a intentar en ${limit.retryAfterSeconds ?? 60} segundos.`);
          return false;
        }

        const result = await resetPassword({ username: normalizedEmail });

        if (result.nextStep.resetPasswordStep !== 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
          setFormError('No fue posible iniciar la recuperación. Intenta de nuevo.');
          return false;
        }

        setEmail(normalizedEmail);
        setDeliveryMessage(getDeliveryMessage(result.nextStep.codeDeliveryDetails));
        const now = Date.now();
        setClock(now);
        setResendAvailableAt(now + RESEND_COOLDOWN_SECONDS * 1000);
        setStep('confirm');
        void logAuthEvent({ event: 'password_reset_request_accepted', email: normalizedEmail });
        toast.showSuccess(isResend ? 'Solicitud de reenvío procesada' : 'Solicitud de recuperación procesada');
        return true;
      } catch (error) {
        const errorName = (error as { name?: string }).name;
        void logAuthEvent({
          event: 'password_reset_failure',
          email: normalizedEmail,
          errorCode: errorName,
        });

        if (isUnconfirmedSignUpError(error)) {
          window.sessionStorage.setItem(PENDING_SIGNUP_EMAIL_STORAGE_KEY, normalizedEmail);
          try {
            const pending = await preparePendingSignupVerification({ email: normalizedEmail });
            if (pending.status === 'pending' && pending.username) {
              await resendSignUpCode({ username: pending.username });
              toast.showSuccess('Te reenviamos el código para completar tu registro.');
            } else if (pending.status === 'rate_limited') {
              toast.showError(`Demasiadas solicitudes. Intenta de nuevo en ${pending.retryAfterSeconds ?? 60} segundos.`);
            } else {
              toast.showError('Completa la verificación pendiente para poder recuperar tu cuenta.');
            }
          } catch (resendError) {
            const resendName = (resendError as { name?: string }).name;
            if (resendName === 'LimitExceededException' || resendName === 'TooManyRequestsException') {
              toast.showError('AWS limitó temporalmente el reenvío. Continúa con el último código recibido o espera unos minutos.');
            }
          }
          router.push('/auth/register?mode=verify');
          return false;
        }

        if (errorName === 'LimitExceededException' || errorName === 'TooManyRequestsException') {
          setFormError('Se alcanzó el límite de solicitudes. Espera unos minutos antes de intentar de nuevo.');
        } else {
          setFormError('No fue posible iniciar la recuperación. Espera unos minutos e intenta de nuevo.');
        }
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [router, toast],
  );

  const handleRequest = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      await requestResetCode(email);
    },
    [email, requestResetCode],
  );

  const handleConfirm = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      const normalizedCode = confirmationCode.trim();
      const errors: RecoveryFieldErrors = {};

      if (!/^\d{6}$/.test(normalizedCode)) {
        errors.confirmationCode = 'Ingresa el código de 6 dígitos que recibiste.';
      }
      if (!passwordEvaluation.isValid) {
        errors.password = 'La contraseña no cumple la política de seguridad.';
      }
      if (!passwordsMatch) {
        errors.confirmPassword = 'Las contraseñas no coinciden.';
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setFormError('');
        return;
      }

      setIsLoading(true);
      setFormError('');
      setFieldErrors({});

      try {
        await verifyAuthHumanRequest();
        await confirmResetPassword({
          username: email,
          confirmationCode: normalizedCode,
          newPassword: password,
        });
        setStep('success');
        void logAuthEvent({ event: 'password_reset_success', email });
        toast.showSuccess('Contraseña actualizada correctamente');
      } catch (error) {
        const errorName = (error as { name?: string }).name;
        void logAuthEvent({
          event: 'password_reset_failure',
          email,
          errorCode: errorName,
        });

        if (errorName === 'CodeMismatchException') {
          setFieldErrors({ confirmationCode: 'El código de recuperación no coincide. Verifícalo e intenta de nuevo.' });
        } else if (errorName === 'ExpiredCodeException') {
          setFieldErrors({ confirmationCode: 'El código expiró. Solicita uno nuevo.' });
        } else if (errorName === 'InvalidPasswordException') {
          setFieldErrors({ password: 'La contraseña no cumple la política configurada en Cognito.' });
        } else if (errorName === 'LimitExceededException' || errorName === 'TooManyFailedAttemptsException') {
          setFormError('Se alcanzó el límite de intentos. Espera unos minutos antes de volver a intentarlo.');
        } else {
          setFormError('No fue posible validar el código. Solicita uno nuevo e intenta otra vez.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [confirmationCode, email, password, passwordEvaluation.isValid, passwordsMatch, toast],
  );

  const handleResend = useCallback(async () => {
    if (resendCooldownSeconds > 0) {
      setFormError(`Espera ${resendCooldownSeconds} segundos antes de reenviar el código.`);
      return;
    }

    const sent = await requestResetCode(email, true);
    if (sent) {
      setConfirmationCode('');
      setFieldErrors({});
    }
  }, [email, requestResetCode, resendCooldownSeconds]);

  const handleChangeEmail = useCallback(() => {
    setStep('request');
    setConfirmationCode('');
    setPassword('');
    setConfirmPassword('');
    setDeliveryMessage('');
    setResendAvailableAt(null);
    setFieldErrors({});
    setFormError('');
  }, []);

  if (step === 'success') {
    return (
      <>
        <LayerCard.Secondary data-auth-layout="compact">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-kumo-success-tint/70">
              <CheckmarkCircle24Filled className="text-kumo-success" />
            </div>
            <div className="space-y-1">
              <Text variant="heading2" as="h1" DANGEROUS_className="text-center">
                Contraseña actualizada
              </Text>
              <Text variant="secondary" size="sm" as="p" DANGEROUS_className="text-center">
                Ya puedes iniciar sesión con tu nueva contraseña.
              </Text>
            </div>
          </div>
        </LayerCard.Secondary>

        <LayerCard.Primary>
          <NextLink
            href="/auth/login"
            className={`${buttonVariants({ variant: 'primary', size: 'lg' })} w-full justify-center`}
          >
            Ir al inicio de sesión
          </NextLink>
        </LayerCard.Primary>
      </>
    );
  }

  if (step === 'confirm') {
    return (
      <>
        <LayerCard.Secondary data-auth-layout="compact">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-kumo-recessed">
              <LockClosedKey24Filled className="text-kumo-secondary" />
            </div>
            <div className="space-y-1">
              <Text variant="heading2" as="h1" DANGEROUS_className="text-center">
                Crea una nueva contraseña
              </Text>
              <Text variant="secondary" size="sm" as="p" DANGEROUS_className="text-center">
                Confirma tu identidad con el código temporal que recibiste.
              </Text>
            </div>
          </div>
        </LayerCard.Secondary>

        <LayerCard.Primary className="gap-4">
          <div aria-live="polite" className="sr-only">
            {isLoading ? 'Procesando solicitud de recuperación' : deliveryMessage}
          </div>

          {formError && <Banner variant="error" description={formError} />}

          <Banner
            variant="secondary"
            icon={<Mail20Filled />}
            title="Código de recuperación"
            description={deliveryMessage}
          />

          <form onSubmit={handleConfirm} className="space-y-4">
            <Input
              label="Código de confirmación"
              value={confirmationCode}
              onChange={(event) => {
                setConfirmationCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                clearFieldError('confirmationCode');
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={isLoading}
              error={fieldErrors.confirmationCode}
              placeholder="123456"
              autoFocus
            />

            <SensitiveInput
              label="Nueva contraseña"
              value={password}
              onValueChange={(value) => {
                setPassword(value);
                clearFieldError('password');
              }}
              autoComplete="new-password"
              disabled={isLoading}
              error={fieldErrors.password}
            />
            <PasswordStrengthMeter password={password} />
            <SensitiveInput
              label="Confirmar contraseña"
              value={confirmPassword}
              onValueChange={(value) => {
                setConfirmPassword(value);
                clearFieldError('confirmPassword');
              }}
              autoComplete="new-password"
              disabled={isLoading}
              error={fieldErrors.confirmPassword}
            />

            <Button variant="primary" type="submit" className="w-full justify-center" size="lg" loading={isLoading}>
              Restablecer contraseña
            </Button>
            <Button
              variant="secondary"
              type="button"
              className="w-full justify-center"
              icon={<ArrowClockwise16Filled />}
              loading={isLoading}
              onClick={handleResend}
              disabled={isLoading || resendCooldownSeconds > 0}
            >
              {resendCooldownSeconds > 0 ? `Reenviar en ${resendCooldownSeconds}s` : 'Reenviar código'}
            </Button>
          </form>

          <div className="h-px w-full bg-kumo-hairline" />
          <div className="text-center">
            <Button variant="ghost" type="button" size="sm" onClick={handleChangeEmail} disabled={isLoading}>
              Usar otro correo
            </Button>
          </div>
        </LayerCard.Primary>
      </>
    );
  }

  return (
    <>
      <LayerCard.Secondary data-auth-layout="compact">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-kumo-recessed">
            <LockClosedKey24Filled className="text-kumo-secondary" />
          </div>
          <div className="space-y-1">
            <Text variant="heading2" as="h1" DANGEROUS_className="text-center">
              Recuperar contraseña
            </Text>
            <Text variant="secondary" size="sm" as="p" DANGEROUS_className="text-center">
              Solicita un código para recuperar el acceso a tu cuenta.
            </Text>
          </div>
        </div>
      </LayerCard.Secondary>

      <LayerCard.Primary className="gap-4">
        {formError && <Banner variant="error" description={formError} />}

        <Banner
          variant="secondary"
          icon={<Mail20Filled />}
          title="Recuperación segura"
          description="Si la cuenta está registrada, enviaremos un código al correo o teléfono verificado. Revisa cuidadosamente el dato antes de continuar."
        />

        <form onSubmit={handleRequest} className="space-y-4">
          <Input
            label="Correo electrónico"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFieldError('email');
            }}
            type="email"
            autoComplete="email"
            disabled={isLoading}
            error={fieldErrors.email}
            placeholder="propietario@negocio.com"
            autoFocus
          />
          <Button variant="primary" type="submit" className="w-full justify-center" size="lg" loading={isLoading}>
            Enviar código
          </Button>
        </form>

        <div className="h-px w-full bg-kumo-hairline" />
        <div className="text-center">
          <Link href="/auth/login" variant="plain" render={<NextLink href="/auth/login" />}>
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeft16Filled />
              <Text variant="secondary" size="sm" as="span">
                Volver al inicio de sesión
              </Text>
            </span>
          </Link>
        </div>
      </LayerCard.Primary>
    </>
  );
}
