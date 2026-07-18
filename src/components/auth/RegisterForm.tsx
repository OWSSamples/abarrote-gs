'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import {
  confirmSignUp,
  resendSignUpCode,
  signIn,
  signOut,
  signUp,
} from '@/lib/cognito';
import {
  checkRegistrationPreflight,
  getCurrentTenantRegistrationStatus,
  preparePendingSignupVerification,
  provisionAdditionalTenant,
  provisionRegisteredTenant,
} from '@/app/actions/register-tenant-actions';
import { evaluatePassword } from '@/lib/auth/password-policy';
import { synchronizeServerSession } from '@/lib/auth/session-client';
import { useToast } from '@/components/notifications/ToastProvider';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { Button } from '@cloudflare/kumo/components/button';
import { Banner } from '@cloudflare/kumo/components/banner';
import { Input } from '@cloudflare/kumo/components/input';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { SensitiveInput } from '@cloudflare/kumo/components/sensitive-input';
import { Text } from '@cloudflare/kumo/components/text';
import { Link } from '@cloudflare/kumo/components/link';
import { Select as PolarisSelect } from '@shopify/polaris';
import {
  ArrowClockwise16Filled,
  ArrowLeft16Filled,
  BuildingShop24Filled,
  Checkmark16Filled,
  CheckmarkCircle24Filled,
  Mail20Filled,
  MailCheckmark24Filled,
} from '@fluentui/react-icons';

type RegisterStep = 'details' | 'confirm';
type BusinessType = 'miscelania' | 'abarrotes' | 'ropa' | 'comida_rapida' | 'otro_retail';
type RegisterField =
  | 'tenantName'
  | 'businessTypeOther'
  | 'displayName'
  | 'phone'
  | 'contactEmail'
  | 'email'
  | 'taxId'
  | 'taxRegime'
  | 'estimatedUsers'
  | 'password'
  | 'confirmPassword'
  | 'confirmationCode';

type RegisterFieldErrors = Partial<Record<RegisterField, string>>;
const PENDING_SIGNUP_EMAIL_STORAGE_KEY = 'opendex.pendingSignupEmail';

const COUNTRIES = [
  { value: 'MX', label: 'México' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CL', label: 'Chile' },
  { value: 'PE', label: 'Perú' },
  { value: 'AR', label: 'Argentina' },
  { value: 'ZZ', label: 'Otro país' },
] as const;

const BUSINESS_TYPES: Array<{ value: BusinessType; label: string }> = [
  { value: 'abarrotes', label: 'Abarrotes' },
  { value: 'miscelania', label: 'Miscelánea' },
  { value: 'ropa', label: 'Tienda de ropa' },
  { value: 'comida_rapida', label: 'Comida rápida / mostrador' },
  { value: 'otro_retail', label: 'Otro retail sin reservas' },
];

async function ensureSessionCookie(): Promise<void> {
  const syncStatus = await synchronizeServerSession(false);
  if (syncStatus !== 'established') throw new Error('No fue posible establecer la sesión segura.');
}

function getAuthErrorMessage(error: unknown): string {
  const err = error as { name?: string; message?: string; code?: string };
  if (err.name === 'UsernameExistsException') return 'Ya existe una cuenta con este correo.';
  if (err.name === 'AliasExistsException') return 'Este correo ya está asociado a otra cuenta.';
  if (err.name === 'InvalidPasswordException') return 'La contraseña no cumple la política de seguridad.';
  if (err.name === 'InvalidParameterException') {
    if (err.message?.toLowerCase().includes('phone')) return 'Ingresa el teléfono con lada internacional. Ejemplo: +525512345678.';
    return 'Revisa los datos capturados.';
  }
  if (err.name === 'CodeMismatchException') return 'El código no coincide. Usa el último código de registro recibido o solicita uno nuevo.';
  if (err.name === 'ExpiredCodeException') return 'El código de registro expiró. Solicita uno nuevo.';
  if (err.name === 'LimitExceededException') return 'Demasiados intentos. Espera unos minutos.';
  if (err.name === 'NetworkError' || err.message?.toLowerCase().includes('network')) {
    return 'No fue posible conectar con el servicio de identidad. Revisa tu conexión e intenta de nuevo.';
  }
  if (err.code === 'VALIDATION_ERROR' && err.message) return err.message;
  if (err.message === 'No fue posible establecer la sesión segura.') return err.message;
  if (err.message?.startsWith('La cuenta fue confirmada, pero')) return err.message;
  return 'No fue posible completar el registro. Intenta de nuevo.';
}

function createCognitoUsername(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

function getConfirmationMessage(
  delivery: { deliveryMedium?: string; destination?: string } | undefined,
  fallbackEmail: string,
): string {
  const destination = delivery?.destination || fallbackEmail;

  if (delivery?.deliveryMedium === 'EMAIL') {
    return `Ingresa el código de registro más reciente que enviamos por correo a ${destination}.`;
  }
  if (delivery?.deliveryMedium === 'SMS' || delivery?.deliveryMedium === 'PHONE') {
    return `Ingresa el código de registro más reciente que enviamos por SMS a ${destination}.`;
  }

  return `Ingresa el código de registro más reciente enviado a ${destination}.`;
}

function getRegistrationCodeIssuedAt(): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

function normalizeInternationalPhone(value: string): string {
  const trimmed = value.trim();
  const phone = trimmed.startsWith('+')
    ? `+${trimmed.slice(1).replace(/\D/g, '')}`
    : `+${trimmed.replace(/\D/g, '')}`;

  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : '';
}

function normalizeEmailForAuth(value: string): string {
  return value
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase();
}

export function RegisterForm() {
  const router = useRouter();
  const toast = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<RegisterStep>('details');
  const [isAdditionalTenant, setIsAdditionalTenant] = useState(false);
  const [isPendingVerificationResume, setIsPendingVerificationResume] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [country, setCountry] = useState('MX');
  const [businessType, setBusinessType] = useState<BusinessType>('abarrotes');
  const [businessTypeOther, setBusinessTypeOther] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [taxId, setTaxId] = useState('');
  const [taxRegime, setTaxRegime] = useState('');
  const [taxRegimeDescription, setTaxRegimeDescription] = useState('');
  const [estimatedUsers, setEstimatedUsers] = useState('1');
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [logoFileName, setLogoFileName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [cognitoUsername, setCognitoUsername] = useState('');
  const [isCognitoConfirmed, setIsCognitoConfirmed] = useState(false);
  const [canUseAuthenticatedSession, setCanUseAuthenticatedSession] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [lastRegistrationCodeSentAt, setLastRegistrationCodeSentAt] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const clearFieldError = useCallback((field: RegisterField) => {
    setFormError('');
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const setFieldError = useCallback((field: RegisterField, message: string) => {
    setFormError('');
    setFieldErrors({ [field]: message });
    toast.showError(message);
  }, [toast]);

  const setFormLevelError = useCallback((message: string, description?: string) => {
    setFieldErrors({});
    setFormError(description ? `${message} ${description}` : message);
    toast.showError(description ? { title: message, description } : message);
  }, [toast]);

  const setCognitoFieldError = useCallback((error: unknown) => {
    const err = error as { name?: string; message?: string };
    const message = getAuthErrorMessage(error);
    const rawMessage = err.message ?? '';
    const lowerMessage = rawMessage.toLowerCase();

    if (err.name === 'UsernameExistsException') {
      setFieldError('email', message);
      return;
    }
    if (err.name === 'AliasExistsException') {
      setFieldError('email', message);
      return;
    }
    if (err.name === 'InvalidPasswordException') {
      setFieldError('password', message);
      return;
    }
    if (err.name === 'InvalidParameterException') {
      if (lowerMessage.includes('secret_hash') || lowerMessage.includes('client secret') || lowerMessage.includes('configured with secret')) {
        setFormLevelError(
          'Cognito está rechazando el registro por configuración.',
          'El App Client usado por el frontend no debe tener client secret habilitado. Crea o usa un App Client público sin secreto.',
        );
        return;
      }
      if (
        lowerMessage.includes('username cannot be of email format') ||
        lowerMessage.includes('configured for email alias')
      ) {
        setFormLevelError(
          'La configuración de identidad rechazó el registro.',
          'La aplicación debe usar un identificador interno y conservar el correo como alias de acceso.',
        );
        return;
      }
      if (lowerMessage.includes('phone')) {
        setFieldError('phone', 'Ingresa el teléfono con lada internacional. Ejemplo: +525512345678.');
        return;
      }
      if (
        lowerMessage.includes('email') &&
        (lowerMessage.includes('format') ||
          lowerMessage.includes('valid') ||
          lowerMessage.includes('invalid') ||
          lowerMessage.includes('failed to satisfy constraint'))
      ) {
        setFieldError('email', 'Ingresa un email válido para iniciar sesión.');
        return;
      }
      if (lowerMessage.includes('name')) {
        setFieldError('displayName', 'Captura el nombre del propietario como nombre completo.');
        return;
      }

      setFormLevelError(
        'Cognito rechazó el registro.',
        'Revisa que el App Client permita escribir los atributos email y name requeridos por el User Pool.',
      );
      return;
    }

    setFormLevelError('No fue posible completar el registro.', message);
  }, [setFieldError, setFormLevelError]);

  const startPendingVerification = useCallback(
    async (rawEmail: string, options?: { resendCode?: boolean }) => {
      const normalizedEmail = normalizeEmailForAuth(rawEmail);
      setFieldErrors({});
      setFormError('');

      if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setFieldError('email', 'Ingresa el email con el que iniciaste el registro.');
        return;
      }

      setEmail(normalizedEmail);
      setContactEmail((current) => current || normalizedEmail);
      window.sessionStorage.setItem(PENDING_SIGNUP_EMAIL_STORAGE_KEY, normalizedEmail);
      setIsLoading(true);

      try {
        const pending = await preparePendingSignupVerification({ email: normalizedEmail });
        if (pending.status === 'rate_limited') {
          setFormLevelError(
            'Demasiadas solicitudes de verificación.',
            `Espera ${pending.retryAfterSeconds ?? 60} segundos antes de intentar de nuevo.`,
          );
          return;
        }
        if (pending.status === 'confirmed') {
          const sessionSync = await synchronizeServerSession(false);
          if (sessionSync === 'established') {
            try {
              const tenantStatus = await getCurrentTenantRegistrationStatus();
              setCanUseAuthenticatedSession(
                !tenantStatus.hasTenant &&
                  normalizeEmailForAuth(tenantStatus.email) === normalizedEmail,
              );
            } catch {
              setCanUseAuthenticatedSession(false);
            }
          } else {
            setCanUseAuthenticatedSession(false);
          }
          setCognitoUsername(normalizedEmail);
          setIsCognitoConfirmed(true);
          setLastRegistrationCodeSentAt('');
          setConfirmationMessage('Tu correo ya está confirmado. Completa los datos del negocio para crear el tenant.');
          setStep('details');
          toast.showSuccess('Correo confirmado. Completa los datos del negocio.');
          return;
        }
        if (pending.status === 'disabled') {
          setFormLevelError(
            'La cuenta está deshabilitada.',
            'Contacta al administrador para reactivar el acceso antes de continuar.',
          );
          return;
        }
        if (pending.status !== 'pending' || !pending.username) {
          setFieldError('email', 'No encontramos una verificación pendiente para ese correo.');
          return;
        }

        setCognitoUsername(pending.username);
        if (options?.resendCode ?? true) {
          setConfirmationCode('');
          const delivery = await resendSignUpCode({ username: pending.username });
          const issuedAt = getRegistrationCodeIssuedAt();
          setLastRegistrationCodeSentAt(issuedAt);
          setConfirmationMessage(getConfirmationMessage(delivery, normalizedEmail));
          toast.showSuccess(`Te enviamos un código de registro nuevo a las ${issuedAt}.`);
        } else {
          setLastRegistrationCodeSentAt('');
          setConfirmationMessage(`Ingresa el código de registro que enviamos por correo a ${normalizedEmail}.`);
        }
      } catch (error) {
        setFormLevelError('No fue posible preparar la verificación.', getAuthErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    [setFieldError, setFormLevelError, toast],
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get('mode');
    if (mode === 'additional') {
      setIsAdditionalTenant(true);
      setIsLoading(true);
      void getCurrentTenantRegistrationStatus()
        .then((status) => {
          const sessionEmail = normalizeEmailForAuth(status.email);
          setEmail(sessionEmail);
          setContactEmail((current) => current || sessionEmail);
          setCanUseAuthenticatedSession(true);
        })
        .catch(() => {
          setCanUseAuthenticatedSession(false);
          setFormLevelError(
            'La sesión no está disponible.',
            'Vuelve al panel, inicia sesión nuevamente e intenta crear el negocio.',
          );
        })
        .finally(() => setIsLoading(false));
      return;
    }
    if (mode !== 'verify') return;

    setIsPendingVerificationResume(true);
    setStep('confirm');
    setConfirmationMessage('Ingresa el correo con el que iniciaste el registro para recibir un código de registro.');
    const pendingEmail = normalizeEmailForAuth(
      window.sessionStorage.getItem(PENDING_SIGNUP_EMAIL_STORAGE_KEY) ?? '',
    );

    if (pendingEmail) {
      setEmail((current) => current || pendingEmail);
      setContactEmail((current) => current || pendingEmail);
      void startPendingVerification(pendingEmail, { resendCode: false });
    }
  }, [setFormLevelError, startPendingVerification]);

  const handleLogoChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        setLogoDataUrl(undefined);
        setLogoFileName('');
        return;
      }

      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.showError('El logo debe ser PNG, JPG o WebP.');
        event.target.value = '';
        setLogoFileName('');
        return;
      }

      if (file.size > 200 * 1024) {
        toast.showError('El logo debe pesar menos de 200 KB.');
        event.target.value = '';
        setLogoFileName('');
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('No fue posible leer el logo.'));
        reader.readAsDataURL(file);
      });

      setLogoDataUrl(dataUrl);
      setLogoFileName(file.name);
    },
    [toast],
  );

  const completeProvisioning = useCallback(async (authUsername: string) => {
    if (!authUsername) {
      throw new Error('No fue posible recuperar el identificador seguro del registro.');
    }

    if (isAdditionalTenant) {
      if (!canUseAuthenticatedSession) {
        throw new Error('La sesión segura no está disponible para crear otro negocio.');
      }
      const tenantStatus = await getCurrentTenantRegistrationStatus();
      if (normalizeEmailForAuth(tenantStatus.email) !== normalizeEmailForAuth(email)) {
        throw new Error('La sesión activa no corresponde a la identidad propietaria.');
      }
      await provisionAdditionalTenant({
        tenantName,
        country,
        businessType,
        businessTypeOther,
        contactEmail: contactEmail || email,
        phone,
        taxId,
        taxRegime,
        taxRegimeDescription,
        estimatedUsers: Number.parseInt(estimatedUsers, 10),
        logoDataUrl,
      });
      return;
    }

    if (canUseAuthenticatedSession) {
      const syncStatus = await synchronizeServerSession(false);
      if (syncStatus !== 'established') {
        throw new Error('No fue posible establecer la sesión segura.');
      }
      const tenantStatus = await getCurrentTenantRegistrationStatus();
      if (normalizeEmailForAuth(tenantStatus.email) !== normalizeEmailForAuth(email)) {
        throw new Error('La sesión activa no corresponde al correo del registro.');
      }

      await provisionRegisteredTenant({
        tenantName,
        country,
        businessType,
        businessTypeOther,
        contactEmail: contactEmail || email,
        phone,
        taxId,
        taxRegime,
        taxRegimeDescription,
        estimatedUsers: Number.parseInt(estimatedUsers, 10),
        logoDataUrl,
      });
      return;
    }

    try {
      await signOut();
    } catch {
      // No active session.
    }

    const signInResult = await signIn({
      username: authUsername,
      password,
      options: { authFlowType: 'USER_SRP_AUTH' },
    });
    if (!signInResult.isSignedIn) {
      throw new Error('La cuenta fue confirmada, pero requiere un paso adicional de inicio de sesión.');
    }

    await ensureSessionCookie();
    await provisionRegisteredTenant({
      tenantName,
      country,
      businessType,
      businessTypeOther,
      contactEmail: contactEmail || email,
      phone,
      taxId,
      taxRegime,
      taxRegimeDescription,
      estimatedUsers: Number.parseInt(estimatedUsers, 10),
      logoDataUrl,
    });
  }, [businessType, businessTypeOther, canUseAuthenticatedSession, contactEmail, country, email, estimatedUsers, isAdditionalTenant, logoDataUrl, password, phone, taxId, taxRegime, taxRegimeDescription, tenantName]);

  const handleRegister = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      const normalizedEmail = normalizeEmailForAuth(email);
      const normalizedTenant = tenantName.trim().replace(/\s+/g, ' ');
      const normalizedName = displayName.trim().replace(/\s+/g, ' ');
      const normalizedPhone = phone.trim();
      const internationalPhone = normalizeInternationalPhone(normalizedPhone);
      const normalizedContactEmail = normalizeEmailForAuth(contactEmail || normalizedEmail);
      const normalizedTaxId = taxId.trim().toUpperCase();
      const normalizedTaxRegime = taxRegime.trim();
      const normalizedEstimatedUsers = Number.parseInt(estimatedUsers, 10);
      setFieldErrors({});
      setFormError('');

      if (!normalizedTenant) {
        setFieldError('tenantName', 'Captura el nombre del negocio.');
        return;
      }
      if (!isAdditionalTenant && !normalizedName) {
        setFieldError('displayName', 'Captura el nombre del propietario.');
        return;
      }
      if (!normalizedEmail) {
        setFieldError('email', 'Captura el email para iniciar sesión.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setFieldError('email', 'Ingresa un email válido para iniciar sesión.');
        return;
      }
      if (!normalizedPhone) {
        setFieldError('phone', 'Captura el teléfono de contacto.');
        return;
      }
      if (!isAdditionalTenant && !canUseAuthenticatedSession && !password) {
        setFieldError('password', 'Captura una contraseña.');
        return;
      }
      if (!internationalPhone) {
        setFieldError('phone', 'Ingresa el teléfono con lada internacional. Ejemplo: +525512345678.');
        return;
      }
      if (businessType === 'otro_retail' && businessTypeOther.trim().length < 3) {
        setFieldError('businessTypeOther', 'Describe el tipo de negocio.');
        return;
      }
      if (!Number.isFinite(normalizedEstimatedUsers) || normalizedEstimatedUsers < 1 || normalizedEstimatedUsers > 500) {
        setFieldError('estimatedUsers', 'El número de usuarios debe estar entre 1 y 500.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContactEmail)) {
        setFieldError('contactEmail', 'Ingresa un correo de contacto válido.');
        return;
      }
      if (country === 'MX') {
        if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(normalizedTaxId)) {
          setFieldError('taxId', 'Ingresa un RFC válido.');
          return;
        }
        if (!normalizedTaxRegime) {
          setFieldError('taxRegime', 'Captura el régimen fiscal.');
          return;
        }
      } else if (!normalizedTaxId || !normalizedTaxRegime) {
        setFieldError(!normalizedTaxId ? 'taxId' : 'taxRegime', 'Captura el identificador fiscal y régimen tributario.');
        return;
      }

      if (!isAdditionalTenant && !canUseAuthenticatedSession && password !== confirmPassword) {
        setFieldError('confirmPassword', 'Las contraseñas no coinciden.');
        return;
      }

      if (!isAdditionalTenant && !canUseAuthenticatedSession) {
        const evaluation = evaluatePassword(password);
        if (!evaluation.isValid) {
          setFieldError('password', 'La contraseña no cumple los requisitos de seguridad.');
          return;
        }
      }

      setEmail(normalizedEmail);
      setTenantName(normalizedTenant);
      setDisplayName(normalizedName);
      setPhone(normalizedPhone);
      setContactEmail(normalizedContactEmail);
      setTaxId(normalizedTaxId);
      setTaxRegime(normalizedTaxRegime);
      setEstimatedUsers(String(normalizedEstimatedUsers));

      setIsLoading(true);
      try {
        const preflight = await checkRegistrationPreflight({
          tenantName: normalizedTenant,
          email: normalizedEmail,
        });
        if (!preflight.allowed) {
          const retryMinutes = Math.max(1, Math.ceil((preflight.retryAfterSeconds ?? 60) / 60));
          setFormLevelError(
            'Demasiados intentos de registro.',
            `Espera aproximadamente ${retryMinutes} minuto${retryMinutes === 1 ? '' : 's'} antes de intentar de nuevo.`,
          );
          return;
        }
        if (!preflight.tenantNameAvailable) {
          setFieldError('tenantName', 'Ese nombre de tienda ya está registrado. Elige otro nombre.');
          return;
        }

        if (isAdditionalTenant) {
          await completeProvisioning(normalizedEmail);
          toast.showSuccess('Negocio creado y seleccionado correctamente.');
          router.refresh();
          router.push('/');
          return;
        }

        if (isPendingVerificationResume && isCognitoConfirmed) {
          const authUsername = cognitoUsername || normalizedEmail;
          setCognitoUsername(authUsername);
          await completeProvisioning(authUsername);
          toast.showSuccess('Cuenta y tenant creados correctamente.');
          window.sessionStorage.removeItem(PENDING_SIGNUP_EMAIL_STORAGE_KEY);
          router.refresh();
          router.push('/');
          return;
        }

        if (isPendingVerificationResume) {
          const pending = await preparePendingSignupVerification({ email: normalizedEmail });
          if (pending.status === 'rate_limited') {
            setFormLevelError(
              'Demasiadas solicitudes de verificación.',
              `Espera ${pending.retryAfterSeconds ?? 60} segundos antes de intentar de nuevo.`,
            );
            return;
          }
          if (pending.status === 'confirmed') {
            const authUsername = normalizedEmail;
            setCognitoUsername(authUsername);
            setIsCognitoConfirmed(true);
            await completeProvisioning(authUsername);
            toast.showSuccess('Cuenta y tenant creados correctamente.');
            window.sessionStorage.removeItem(PENDING_SIGNUP_EMAIL_STORAGE_KEY);
            router.refresh();
            router.push('/');
            return;
          }
          if (pending.status !== 'pending' || !pending.username) {
            setFieldError('email', 'No encontramos una verificación pendiente para ese correo.');
            return;
          }

          setCognitoUsername(pending.username);
          setConfirmationCode('');
          const delivery = await resendSignUpCode({ username: pending.username });
          const issuedAt = getRegistrationCodeIssuedAt();
          setLastRegistrationCodeSentAt(issuedAt);
          setConfirmationMessage(getConfirmationMessage(delivery, normalizedEmail));
          setStep('confirm');
          toast.showSuccess(`Te enviamos un código de registro nuevo a las ${issuedAt}.`);
          return;
        }

        const authUsername = createCognitoUsername();
        setCognitoUsername(authUsername);
        const result = await signUp({
          username: authUsername,
          password,
          options: {
            userAttributes: {
              email: normalizedEmail,
              name: normalizedName,
            },
          },
        });

        if (result.nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
          const issuedAt = getRegistrationCodeIssuedAt();
          const message = getConfirmationMessage(result.nextStep.codeDeliveryDetails, normalizedEmail);
          setConfirmationCode('');
          setLastRegistrationCodeSentAt(issuedAt);
          setConfirmationMessage(message);
          setStep('confirm');
          toast.showSuccess(`Te enviamos un código de registro a las ${issuedAt}.`);
          return;
        }

        setIsCognitoConfirmed(true);
        setStep('confirm');
        await completeProvisioning(authUsername);
        toast.showSuccess('Cuenta y tenant creados correctamente.');
        window.sessionStorage.removeItem(PENDING_SIGNUP_EMAIL_STORAGE_KEY);
        router.refresh();
        router.push('/');
      } catch (error) {
        const err = error as { name?: string };
        if (err.name === 'LimitExceededException') {
          setConfirmationMessage(
            'La cuenta fue creada, pero AWS limitó temporalmente el envío. Espera unos minutos y usa Reenviar código de registro.',
          );
          setFormError('AWS limitó temporalmente el envío del código de confirmación.');
          setStep('confirm');
          toast.showError('Espera unos minutos antes de reenviar el código.');
          return;
        }
        if (err.name === 'UsernameExistsException' || err.name === 'AliasExistsException') {
          let pendingUsername = '';
          try {
            const pending = await preparePendingSignupVerification({ email: normalizedEmail });
            if (pending.status === 'confirmed') {
              setFieldError('email', 'Ya existe una cuenta confirmada con este correo. Inicia sesión.');
              return;
            }
            if (pending.status !== 'pending' || !pending.username) {
              setFieldError('email', 'Ya existe una cuenta con este correo, pero no encontramos una verificación pendiente.');
              return;
            }

            pendingUsername = pending.username;
            setConfirmationCode('');
            const delivery = await resendSignUpCode({ username: pending.username });
            const issuedAt = getRegistrationCodeIssuedAt();
            setIsPendingVerificationResume(true);
            setCognitoUsername(pending.username);
            setLastRegistrationCodeSentAt(issuedAt);
            setConfirmationMessage(getConfirmationMessage(delivery, normalizedEmail));
            setStep('confirm');
            toast.showSuccess(`Este correo tiene una verificación pendiente. Te reenviamos un código de registro a las ${issuedAt}.`);
            return;
          } catch (resendError) {
            const resendName = (resendError as { name?: string }).name;
            if (resendName === 'LimitExceededException' || resendName === 'TooManyRequestsException') {
              setIsPendingVerificationResume(true);
              setCognitoUsername(pendingUsername);
              setConfirmationMessage(
                'Ya existe una verificación pendiente. Usa el último código de registro recibido o espera unos minutos para reenviar.',
              );
              setStep('confirm');
              toast.showError('AWS limitó temporalmente el reenvío del código.');
              return;
            }
          }
        }
        setCognitoFieldError(error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      businessType,
      businessTypeOther,
      canUseAuthenticatedSession,
      confirmPassword,
      contactEmail,
      country,
      completeProvisioning,
      displayName,
      email,
      estimatedUsers,
      cognitoUsername,
      isCognitoConfirmed,
      isAdditionalTenant,
      isPendingVerificationResume,
      password,
      phone,
      router,
      setCognitoFieldError,
      setFieldError,
      setFormLevelError,
      taxId,
      taxRegime,
      tenantName,
      toast,
    ],
  );

  const handleConfirm = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      const normalizedConfirmationCode = confirmationCode.replace(/\D/g, '');

      if (!isCognitoConfirmed && !normalizedConfirmationCode) {
        setFieldError('confirmationCode', 'Ingresa el código de confirmación.');
        return;
      }
      if (!isCognitoConfirmed && !/^\d{6}$/.test(normalizedConfirmationCode)) {
        setFieldError('confirmationCode', 'Ingresa el código de registro de 6 dígitos.');
        return;
      }
      if (!cognitoUsername) {
        setFormLevelError(
          'No encontramos el registro pendiente.',
          'Vuelve a iniciar el registro para generar un nuevo código de registro.',
        );
        return;
      }

      setIsLoading(true);
      try {
        if (!isCognitoConfirmed) {
          const result = await confirmSignUp({
            username: cognitoUsername,
            confirmationCode: normalizedConfirmationCode,
            options: { forceAliasCreation: false },
          });
          if (!result.isSignUpComplete && result.nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
            setFieldError('confirmationCode', 'Cognito todavía requiere confirmar el código de registro.');
            return;
          }
          setIsCognitoConfirmed(true);
          setLastRegistrationCodeSentAt('');
        }

        const needsTenantDetails =
          isPendingVerificationResume &&
          (!tenantName.trim() ||
            !displayName.trim() ||
            !phone.trim() ||
            !password ||
            !taxId.trim() ||
            (country === 'MX' && !taxRegime.trim()));

        if (needsTenantDetails) {
          setStep('details');
          setConfirmationCode('');
          setConfirmationMessage('Tu correo ya está confirmado. Completa los datos del negocio para crear el tenant.');
          toast.showSuccess('Correo confirmado. Completa los datos del negocio.');
          return;
        }

        await completeProvisioning(cognitoUsername);
        toast.showSuccess('Cuenta y tenant creados correctamente.');
        window.sessionStorage.removeItem(PENDING_SIGNUP_EMAIL_STORAGE_KEY);
        router.refresh();
        router.push('/');
      } catch (error) {
        const err = error as { name?: string; code?: string; message?: string };
        const message = getAuthErrorMessage(error);
        if (
          err.code === 'VALIDATION_ERROR' &&
          (err.message?.toLowerCase().includes('nombre') || err.message?.toLowerCase().includes('tienda'))
        ) {
          setFieldError('tenantName', message);
        } else if (err.name === 'CodeMismatchException' || err.name === 'ExpiredCodeException') {
          setFieldError('confirmationCode', message);
        } else if (err.name === 'AliasExistsException') {
          setFormLevelError(
            'Este correo ya pertenece a otra cuenta.',
            'Inicia sesión con ese correo o utiliza una dirección diferente.',
          );
        } else {
          setFormLevelError('No fue posible confirmar y crear la cuenta.', message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      cognitoUsername,
      completeProvisioning,
      confirmationCode,
      country,
      displayName,
      isCognitoConfirmed,
      isPendingVerificationResume,
      password,
      phone,
      router,
      setFieldError,
      setFormLevelError,
      taxId,
      taxRegime,
      tenantName,
      toast,
    ],
  );

  const handleResendCode = useCallback(async () => {
    if (!cognitoUsername) {
      await startPendingVerification(email, { resendCode: true });
      return;
    }
    setIsLoading(true);
    try {
      setConfirmationCode('');
      const delivery = await resendSignUpCode({ username: cognitoUsername });
      const issuedAt = getRegistrationCodeIssuedAt();
      setLastRegistrationCodeSentAt(issuedAt);
      setConfirmationMessage(getConfirmationMessage(delivery, email));
      setFormError('');
      setFieldErrors({});
      toast.showSuccess(`Código de registro reenviado a las ${issuedAt}.`);
    } catch (error) {
      setFormLevelError('No fue posible reenviar el código.', getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [cognitoUsername, email, setFormLevelError, startPendingVerification, toast]);

  return (
    <>
      {step === 'details' ? (
        <>
          <LayerCard.Secondary>
            <div className="min-w-0">
              <Text variant="heading2" as="h1">
                {isAdditionalTenant ? 'Crear otro negocio' : 'Crear cuenta'}
              </Text>
              <Text variant="secondary" size="sm">
                {isAdditionalTenant
                  ? 'Agrega un espacio de trabajo independiente con la misma identidad.'
                  : 'Registra tu negocio y crea tu espacio de trabajo.'}
              </Text>
            </div>
          </LayerCard.Secondary>

          <LayerCard.Primary className="gap-5">
            {formError && (
              <div className="rounded-lg border border-kumo-danger/40 bg-kumo-danger-tint/50 px-3 py-2">
                <Text variant="secondary" size="sm" as="p" DANGEROUS_className="text-kumo-danger">
                  {formError}
                </Text>
              </div>
            )}
            {isPendingVerificationResume && (
              <Banner
                variant="secondary"
                icon={isCognitoConfirmed ? <CheckmarkCircle24Filled /> : <Mail20Filled />}
                title={isCognitoConfirmed ? 'Correo confirmado' : 'Verificación pendiente'}
                description={
                  isCognitoConfirmed
                    ? canUseAuthenticatedSession
                      ? 'Completa los datos del negocio para crear el tenant con tu sesión verificada.'
                      : 'Completa los datos del negocio y tu contraseña para crear el tenant.'
                    : 'Este registro necesita confirmar el código enviado por Cognito. Completa los datos del negocio y tu contraseña para terminar la creación del tenant.'
                }
              />
            )}
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <Input
                    label="Nombre del negocio"
                    value={tenantName}
                    onChange={(event) => {
                      setTenantName(event.target.value);
                      clearFieldError('tenantName');
                    }}
                    autoComplete="organization"
                    disabled={isLoading}
                    placeholder="Abarrotes La Esquina"
                    error={fieldErrors.tenantName}
                    autoFocus
                  />
                </div>
                <div className="lg:col-span-3">
                  <PolarisSelect
                    label="País"
                    value={country}
                    onChange={(value) => setCountry(value)}
                    disabled={isLoading}
                    options={COUNTRIES.map((item) => ({ label: item.label, value: item.value }))}
                  />
                </div>
                <div className="lg:col-span-4">
                  <PolarisSelect
                    label="Tipo de negocio"
                    value={businessType}
                    onChange={(value) => setBusinessType(value as BusinessType)}
                    disabled={isLoading}
                    options={BUSINESS_TYPES.map((item) => ({ label: item.label, value: item.value }))}
                  />
                </div>
                {businessType === 'otro_retail' && (
                  <div className="lg:col-span-12">
                    <Input
                      label="Describe el giro"
                      value={businessTypeOther}
                      onChange={(event) => {
                        setBusinessTypeOther(event.target.value);
                        clearFieldError('businessTypeOther');
                      }}
                      disabled={isLoading}
                      placeholder="Ej. papelería, ferretería, tienda de regalos"
                      error={fieldErrors.businessTypeOther}
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {!isAdditionalTenant && (
                  <Input
                    label="Nombre del propietario"
                    value={displayName}
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      clearFieldError('displayName');
                    }}
                    autoComplete="name"
                    disabled={isLoading}
                    placeholder="Nombre completo"
                    error={fieldErrors.displayName}
                  />
                )}
                <Input
                  label="Teléfono de contacto"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    clearFieldError('phone');
                  }}
                  type="tel"
                  autoComplete="tel"
                  disabled={isLoading}
                  placeholder="+52 55 1234 5678"
                  error={fieldErrors.phone}
                />
                <Input
                  label="Correo de contacto del negocio"
                  value={contactEmail}
                  onChange={(event) => {
                    setContactEmail(event.target.value);
                    clearFieldError('contactEmail');
                  }}
                  type="email"
                  autoComplete="email"
                  disabled={isLoading}
                  placeholder="contacto@negocio.com"
                  error={fieldErrors.contactEmail}
                />
                {!isAdditionalTenant && (
                  <Input
                    label="Email para iniciar sesión"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearFieldError('email');
                    }}
                    type="email"
                    autoComplete="email"
                    disabled={isLoading}
                    placeholder="propietario@company.com"
                    error={fieldErrors.email}
                  />
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <Input
                    label={country === 'MX' ? 'RFC' : 'Identificador fiscal'}
                    value={taxId}
                    onChange={(event) => {
                      setTaxId(event.target.value.toUpperCase());
                      clearFieldError('taxId');
                    }}
                    disabled={isLoading}
                    placeholder={country === 'MX' ? 'XAXX010101000' : 'Tax ID'}
                    error={fieldErrors.taxId}
                  />
                </div>
                <div className="lg:col-span-4">
                  <Input
                    label={country === 'MX' ? 'Régimen fiscal' : 'Régimen tributario'}
                    value={taxRegime}
                    onChange={(event) => {
                      setTaxRegime(event.target.value);
                      clearFieldError('taxRegime');
                    }}
                    disabled={isLoading}
                    placeholder={country === 'MX' ? '612' : 'General'}
                    error={fieldErrors.taxRegime}
                  />
                </div>
                <div className="lg:col-span-4">
                  <Input
                    label="Usuarios que usarán el sistema"
                    value={estimatedUsers}
                    onChange={(event) => {
                      setEstimatedUsers(event.target.value);
                      clearFieldError('estimatedUsers');
                    }}
                    type="number"
                    min={1}
                    max={500}
                    disabled={isLoading}
                    placeholder="1"
                    error={fieldErrors.estimatedUsers}
                  />
                  <Text variant="secondary" size="xs" as="p">
                    Incluye al propietario. Si capturas 1, no podrás agregar colaboradores activos.
                  </Text>
                </div>
                <div className="lg:col-span-12">
                  <Input
                    label="Descripción del régimen"
                    value={taxRegimeDescription}
                    onChange={(event) => setTaxRegimeDescription(event.target.value)}
                    disabled={isLoading}
                    placeholder={country === 'MX' ? 'Personas físicas con actividades empresariales' : 'Descripción tributaria'}
                  />
                </div>
              </div>

              <div
                className={`grid items-start gap-4 ${
                  canUseAuthenticatedSession
                    ? ''
                    : 'lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]'
                }`}
              >
                <div className="space-y-2">
                  <Text variant="secondary" size="sm" as="p">
                    Logo de la tienda
                  </Text>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoChange}
                    disabled={isLoading}
                    className="sr-only"
                    aria-label="Logo de la tienda"
                  />
                  <div className="flex flex-col gap-3 rounded-lg border border-kumo-line bg-kumo-recessed/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <Text variant="body" size="sm" as="p" DANGEROUS_className="truncate">
                        {logoFileName || 'Sin logo adjunto'}
                      </Text>
                      <Text variant="secondary" size="xs" as="p">
                        PNG, JPG o WebP. Máximo 200 KB.
                      </Text>
                    </div>
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={isLoading}
                      onClick={() => logoInputRef.current?.click()}
                      className="w-full justify-center sm:w-auto"
                    >
                      Adjuntar logo
                    </Button>
                  </div>
                  {logoDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoDataUrl} alt="Vista previa del logo" className="h-14 max-w-32 rounded-md object-contain" />
                  )}
                </div>

                {!isAdditionalTenant && !canUseAuthenticatedSession && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SensitiveInput
                      label="Contraseña"
                      value={password}
                      onValueChange={(value) => {
                        setPassword(value);
                        clearFieldError('password');
                      }}
                      autoComplete="new-password"
                      disabled={isLoading}
                      error={fieldErrors.password}
                    />
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
                    <div className="sm:col-span-2">
                      <PasswordStrengthMeter password={password} />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end border-t border-kumo-hairline pt-4">
                <Button variant="primary" type="submit" className="w-full justify-center sm:w-auto sm:min-w-44" loading={isLoading}>
                  {isAdditionalTenant
                    ? 'Crear negocio'
                    : isPendingVerificationResume
                      ? isCognitoConfirmed ? 'Crear tenant' : 'Continuar verificación'
                      : 'Crear cuenta'}
                </Button>
              </div>
            </form>

            <Text variant="secondary" size="sm" as="p" DANGEROUS_className="text-center">
              {isAdditionalTenant ? '¿Prefieres conservar solo tus negocios actuales? ' : '¿Ya tienes cuenta? '}
              <Link
                href={isAdditionalTenant ? '/' : '/auth/login'}
                variant="inline"
                render={<NextLink href={isAdditionalTenant ? '/' : '/auth/login'} />}
              >
                {isAdditionalTenant ? 'Volver al panel' : 'Inicia sesión'}
              </Link>
            </Text>
          </LayerCard.Primary>
        </>
      ) : (
        <>
          <LayerCard.Secondary data-auth-layout="compact">
            <div className="flex flex-col items-center gap-3 text-center">
              <div
                className={`flex size-12 items-center justify-center rounded-full ${
                  isCognitoConfirmed ? 'bg-kumo-success-tint/70' : 'bg-kumo-recessed'
                }`}
              >
                {isCognitoConfirmed ? (
                  <CheckmarkCircle24Filled className="text-kumo-success" />
                ) : (
                  <MailCheckmark24Filled className="text-kumo-secondary" />
                )}
              </div>
              <div className="space-y-1">
                <Text variant="heading2" as="h1" DANGEROUS_className="text-center">
                  {isCognitoConfirmed ? 'Identidad confirmada' : 'Confirma tu correo'}
                </Text>
                <Text variant="secondary" size="sm" as="p" DANGEROUS_className="text-center">
                  {isCognitoConfirmed
                    ? 'Completa la creación de tu espacio de trabajo.'
                    : 'Usa el código de registro enviado por Amazon Cognito.'}
                </Text>
              </div>
            </div>
          </LayerCard.Secondary>

          <LayerCard.Primary className="gap-4">
            {formError && (
              <Banner variant="error" description={formError} />
            )}

            <Banner
              variant="secondary"
              icon={isCognitoConfirmed ? <BuildingShop24Filled /> : <Mail20Filled />}
              title={isCognitoConfirmed ? 'Espacio de trabajo' : cognitoUsername ? 'Código de registro enviado' : 'Verificación pendiente'}
              description={
                isCognitoConfirmed
                  ? `El nombre del negocio se reservará como ${tenantName}.`
                  : confirmationMessage || 'Ingresa el correo de la cuenta para enviar el código de registro.'
              }
            />

            <form
              onSubmit={
                !cognitoUsername && !isCognitoConfirmed
                  ? (event) => {
                      event.preventDefault();
                      void startPendingVerification(email, { resendCode: true });
                    }
                  : handleConfirm
              }
              className="space-y-4"
            >
              {!cognitoUsername && !isCognitoConfirmed ? (
                <>
                  <Input
                    label="Email del registro pendiente"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearFieldError('email');
                    }}
                    type="email"
                    autoComplete="email"
                    disabled={isLoading}
                    placeholder="propietario@company.com"
                    error={fieldErrors.email}
                    autoFocus
                  />
                  <Button
                    variant="primary"
                    type="button"
                    className="w-full justify-center"
                    size="lg"
                    loading={isLoading}
                    icon={<MailCheckmark24Filled />}
                    onClick={() => void startPendingVerification(email, { resendCode: true })}
                  >
                    Enviar código de registro
                  </Button>
                </>
              ) : isCognitoConfirmed ? (
                <Input
                  label="Nombre del negocio"
                  value={tenantName}
                  onChange={(event) => {
                    setTenantName(event.target.value);
                    clearFieldError('tenantName');
                  }}
                  autoComplete="organization"
                  disabled={isLoading}
                  error={fieldErrors.tenantName}
                  autoFocus
                />
              ) : (
                <Input
                  label="Código de registro"
                  value={confirmationCode}
                  onChange={(event) => {
                    setConfirmationCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                    clearFieldError('confirmationCode');
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={isLoading}
                  placeholder="123456"
                  maxLength={6}
                  error={fieldErrors.confirmationCode}
                  autoFocus
                />
              )}
              {!isCognitoConfirmed && cognitoUsername && lastRegistrationCodeSentAt && (
                <Text variant="secondary" size="xs" as="p">
                  Usa el código de registro enviado a las {lastRegistrationCodeSentAt}. Los códigos de recuperación de contraseña no sirven en esta pantalla.
                </Text>
              )}
              {(cognitoUsername || isCognitoConfirmed) && (
                <Button
                  variant="primary"
                  type="submit"
                  className="w-full justify-center"
                  size="lg"
                  loading={isLoading}
                  icon={<Checkmark16Filled />}
                >
                  {isCognitoConfirmed ? 'Crear espacio de trabajo' : 'Confirmar código'}
                </Button>
              )}
              {!isCognitoConfirmed && cognitoUsername && (
                <Button
                  variant="secondary"
                  type="button"
                  className="w-full justify-center"
                  disabled={isLoading}
                  onClick={handleResendCode}
                  icon={<ArrowClockwise16Filled />}
                >
                  Reenviar código de registro
                </Button>
              )}
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
      )}
    </>
  );
}
