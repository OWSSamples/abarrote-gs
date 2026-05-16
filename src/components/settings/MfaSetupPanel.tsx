'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Page,
  Card,
  BlockStack,
  Text,
  TextField,
  Button,
  Banner,
  Box,
  InlineStack,
  Spinner,
  Icon,
  Divider,
  Badge,
  Checkbox,
  ChoiceList,
  InlineGrid,
} from '@shopify/polaris';
import { LockIcon, ShieldCheckMarkIcon } from '@shopify/polaris-icons';
import QRCode from 'qrcode';
import { setUpTOTP, verifyTOTPSetup, updateMFAPreference, fetchMFAPreference, fetchAuthSession } from '@/lib/cognito';
import {
  generateRecoveryCodesAction,
  getMfaOptionsStatusAction,
  getRecoveryCodesStatusAction,
  sendMfaActivationReminderAction,
  type MfaActivationReminderResult,
  type MfaOptionsStatusResult,
  type RecoveryCodesStatusResult,
} from '@/app/actions/mfa-recovery-actions';

type SetupStep = 'loading' | 'choose' | 'scan' | 'verify' | 'success' | 'already-enabled' | 'error';
type RecoveryCodesMode = 'activation' | 'rotation';
type TwoFactorMethod = 'totp' | 'recovery' | 'sms' | 'passkeys';

interface MfaSetupPanelProps {
  backContent?: string;
  backUrl?: string;
  completionUrl?: string;
}

function formatCodesAsTxt(codes: string[], mode: RecoveryCodesMode): string {
  return [
    'Códigos de recuperación MFA — Kiosko POS',
    `Tipo: ${mode === 'activation' ? 'Activación inicial de MFA' : 'Rotación manual de códigos'}`,
    `Generados: ${new Date().toISOString()}`,
    '',
    'IMPORTANTE:',
    '- Cada código solo puede usarse UNA vez.',
    '- Guarda este archivo en un lugar seguro.',
    '- Si pierdes tu app autenticadora, estos códigos permiten recuperar acceso.',
    '- Si generas códigos nuevos, los anteriores quedan reemplazados.',
    '',
    ...codes,
    '',
  ].join('\n');
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function MfaSetupPanel({
  backContent = 'Mi perfil',
  backUrl = '/dashboard',
  completionUrl = '/dashboard',
}: MfaSetupPanelProps) {
  const router = useRouter();
  const backAction = { content: backContent, url: backUrl };
  const [step, setStep] = useState<SetupStep>('loading');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesMode, setCodesMode] = useState<RecoveryCodesMode>('activation');
  const [codesAcknowledged, setCodesAcknowledged] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryCodesStatusResult>({ total: 0, unused: 0 });
  const [mfaOptions, setMfaOptions] = useState<MfaOptionsStatusResult | null>(null);
  const [emailReminder, setEmailReminder] = useState<MfaActivationReminderResult | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<TwoFactorMethod>('totp');
  const [statusLoading, setStatusLoading] = useState(false);
  const setupRequestId = useRef(0);

  const codesText = useMemo(() => formatCodesAsTxt(recoveryCodes, codesMode), [codesMode, recoveryCodes]);
  const recoveryHealthTone = recoveryStatus.unused === 0 ? 'critical' : recoveryStatus.unused <= 2 ? 'warning' : 'success';

  const loadMfaOptions = useCallback(async () => {
    const options = await getMfaOptionsStatusAction();
    setMfaOptions(options);
    setRecoveryStatus({ total: options.recoveryCodes.total, unused: options.recoveryCodes.unused });
    return options;
  }, []);

  const loadRecoveryStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const status = await getRecoveryCodesStatusAction();
      setRecoveryStatus(status);
      await loadMfaOptions();
    } catch (err) {
      console.error('[MfaSetupPanel] failed to load recovery code status', err);
    } finally {
      setStatusLoading(false);
    }
  }, [loadMfaOptions]);

  const startSetup = useCallback(async () => {
    const requestId = setupRequestId.current + 1;
    setupRequestId.current = requestId;
    setLoading(true);
    setError('');
    setQrDataUrl('');
    setSecretKey('');

    try {
      const output = await setUpTOTP();
      const secret = output.sharedSecret;
      const uri = output.getSetupUri('KioskoPos').toString();
      const dataUrl = await QRCode.toDataURL(uri, { width: 420, margin: 2, errorCorrectionLevel: 'M' });

      if (setupRequestId.current !== requestId) return;
      setSecretKey(secret);
      setQrDataUrl(dataUrl);
      setStep('scan');
    } catch (err) {
      if (setupRequestId.current === requestId) {
        setStep('error');
        setError(err instanceof Error ? err.message : 'Error al generar la configuración TOTP.');
      }
    } finally {
      if (setupRequestId.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkMfaStatus() {
      try {
        await loadMfaOptions();
        const mfaPref = await fetchMFAPreference();
        if (cancelled) return;
        if (mfaPref.preferred === 'TOTP') {
          setStep('already-enabled');
          await loadRecoveryStatus();
          return;
        }
        setStep('choose');
      } catch {
        if (!cancelled) {
          setStep('error');
          setError('No se pudo verificar el estado de MFA. Asegúrate de estar autenticado.');
        }
      }
    }

    checkMfaStatus();
    return () => {
      cancelled = true;
    };
  }, [loadMfaOptions, loadRecoveryStatus, startSetup]);

  const handleMethodSelection = useCallback((selection: string[]) => {
    const nextMethod = selection[0] as TwoFactorMethod | undefined;
    if (nextMethod) setSelectedMethod(nextMethod);
  }, []);

  const handleGenerateRecoveryCodes = useCallback(
    async (mode: RecoveryCodesMode) => {
      setLoading(true);
      setError('');
      setCodesMode(mode);
      setCodesAcknowledged(false);
      try {
        const result = await generateRecoveryCodesAction();
        if (!result.ok || !result.codes) {
          setError(result.error ?? 'No se pudieron generar los códigos de recuperación.');
          return false;
        }
        setRecoveryCodes(result.codes);
        await loadRecoveryStatus();
        return true;
      } catch (err) {
        console.error('[MfaSetupPanel] failed to generate recovery codes', err);
        setError('No se pudieron generar los códigos de recuperación.');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadRecoveryStatus],
  );

  const handleContinueSelectedMethod = useCallback(async () => {
    setError('');

    if (selectedMethod === 'totp') {
      await startSetup();
      return;
    }

    if (selectedMethod === 'recovery') {
      if (!mfaOptions?.authenticator.enabled) {
        setError('Los recovery codes requieren activar primero la app autenticadora. Selecciona App autenticadora para continuar.');
        return;
      }
      setStep('already-enabled');
      await handleGenerateRecoveryCodes('rotation');
      return;
    }

    if (selectedMethod === 'sms') {
      setError(mfaOptions?.sms.reason ?? 'SMS no está disponible todavía en esta instalación.');
      return;
    }

    setError(mfaOptions?.passkeys.reason ?? 'Passkeys todavía no está disponible en esta instalación.');
  }, [handleGenerateRecoveryCodes, mfaOptions, selectedMethod, startSetup]);

  const handleVerify = useCallback(async () => {
    if (verifyCode.length !== 6) {
      setError('El código debe ser de 6 dígitos.');
      return;
    }

    setLoading(true);
    setError('');
    setEmailReminder(null);

    try {
      await verifyTOTPSetup({ code: verifyCode });

      const setPreferenceWithRetry = async (retries = 3, delayMs = 1500) => {
        for (let i = 0; i < retries; i++) {
          await new Promise((r) => setTimeout(r, delayMs));
          try {
            await updateMFAPreference({ totp: 'PREFERRED' });
            return;
          } catch (e) {
            const msg = e instanceof Error ? e.message : '';
            if (msg.includes('one request') && i < retries - 1) continue;
            throw e;
          }
        }
      };
      await setPreferenceWithRetry();
      await fetchAuthSession({ forceRefresh: true });
      const generated = await handleGenerateRecoveryCodes('activation');
      if (!generated) return;
      try {
        const reminder = await sendMfaActivationReminderAction();
        setEmailReminder(reminder);
      } catch (emailErr) {
        console.error('[MfaSetupPanel] failed to send MFA activation reminder', emailErr);
        setEmailReminder({ ok: false, error: 'No se pudo enviar el recordatorio por correo.' });
      }
      setStep('success');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Código inválido. Verifica que tu app autenticadora esté sincronizada.',
      );
    } finally {
      setLoading(false);
    }
  }, [handleGenerateRecoveryCodes, verifyCode]);

  const handleCopyCodes = useCallback(() => {
    navigator.clipboard?.writeText(codesText).catch(() => {});
  }, [codesText]);

  const handleDownloadCodes = useCallback(() => {
    downloadTextFile(`kioskopos-recovery-codes-${Date.now()}.txt`, codesText);
  }, [codesText]);

  if (step === 'loading') {
    return (
      <Page title="Seguridad del perfil" backAction={backAction}>
        <Card>
          <Box padding="800">
            <InlineStack align="center">
              <Spinner size="large" />
            </InlineStack>
          </Box>
        </Card>
      </Page>
    );
  }

  if (step === 'error' && !secretKey) {
    return (
      <Page title="Seguridad del perfil" backAction={backAction}>
        <Card>
          <BlockStack gap="400">
            <Banner tone="critical" title="Error de configuración">
              <Text as="p" variant="bodyMd">{error}</Text>
            </Banner>
            <Button onClick={() => router.push(backUrl)}>Volver al perfil</Button>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  if (step === 'already-enabled') {
    return (
      <Page title="Seguridad del perfil" backAction={backAction}>
        <BlockStack gap="500">
          {error && (
            <Banner tone="critical" onDismiss={() => setError('')}>
              <Text as="p" variant="bodyMd">{error}</Text>
            </Banner>
          )}

          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="start">
                <InlineStack gap="300" blockAlign="center">
                  <SecurityIcon tone="success" />
                  <BlockStack gap="100">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="h2" variant="headingLg">Verificación en 2 pasos</Text>
                      <Badge tone="success">Activo</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Método principal: app autenticadora (TOTP).
                    </Text>
                  </BlockStack>
                </InlineStack>
                <Button onClick={() => loadRecoveryStatus()} loading={statusLoading}>Actualizar estado</Button>
              </InlineStack>

              <Divider />

              <InlineStack gap="300" wrap>
                <SecurityMetric label="Método activo" value="App MFA" subvalue="TOTP · 6 dígitos" tone="success" />
                <SecurityMetric
                  label="Recovery codes"
                  value={`${recoveryStatus.unused}/${recoveryStatus.total}`}
                  subvalue={recoveryStatus.total === 0 ? 'No generados' : 'disponibles'}
                  tone={recoveryHealthTone}
                />
              </InlineStack>

              <Banner tone={recoveryStatus.unused === 0 ? 'critical' : recoveryStatus.unused <= 2 ? 'warning' : 'success'}>
                <Text as="p" variant="bodyMd">
                  {recoveryStatus.unused === 0
                    ? 'No tienes códigos de recuperación disponibles. Genera una nueva bóveda antes de cerrar sesión.'
                    : recoveryStatus.unused <= 2
                      ? 'Te quedan pocos códigos de recuperación. Recomendado: generar una nueva bóveda.'
                      : 'Tu cuenta tiene códigos de recuperación disponibles para pérdida de dispositivo MFA.'}
                </Text>
              </Banner>
            </BlockStack>
          </Card>

          <MfaMethodsCard options={mfaOptions} />

          <RecoveryCodesVault
            codes={recoveryCodes}
            mode={codesMode}
            acknowledged={codesAcknowledged}
            loading={loading}
            onAcknowledge={setCodesAcknowledged}
            onCopy={handleCopyCodes}
            onDownload={handleDownloadCodes}
            onGenerate={() => handleGenerateRecoveryCodes('rotation')}
          />
        </BlockStack>
      </Page>
    );
  }

  if (step === 'success') {
    return (
      <Page title="MFA activado" backAction={backAction}>
        <BlockStack gap="500">
          <Card>
            <BlockStack gap="500">
              <InlineStack gap="300" blockAlign="center">
                <SecurityIcon tone="success" />
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">MFA configurado exitosamente</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Tu cuenta ahora requiere app autenticadora y cuenta con códigos de recuperación.
                  </Text>
                </BlockStack>
              </InlineStack>
              <Banner tone="warning" title="Descarga tus recovery codes antes de continuar">
                <Text as="p" variant="bodyMd">
                  No volveremos a mostrar estos códigos. Descárgalos en formato .txt y guárdalos en un gestor de contraseñas o lugar seguro.
                </Text>
              </Banner>
              {emailReminder && (
                <Banner
                  tone={emailReminder.ok ? 'success' : 'warning'}
                  title={emailReminder.ok ? 'Recordatorio enviado por correo' : 'Recordatorio por correo pendiente'}
                >
                  <Text as="p" variant="bodyMd">
                    {emailReminder.ok
                      ? `Enviamos un aviso de activación MFA al correo de tu perfil: ${emailReminder.email}.`
                      : emailReminder.error ?? 'No se pudo enviar el recordatorio al correo de tu perfil.'}
                  </Text>
                </Banner>
              )}
              <RecoveryCodesVault
                codes={recoveryCodes}
                mode="activation"
                acknowledged={codesAcknowledged}
                loading={loading}
                onAcknowledge={setCodesAcknowledged}
                onCopy={handleCopyCodes}
                onDownload={handleDownloadCodes}
                onGenerate={() => handleGenerateRecoveryCodes('activation')}
              />
              <InlineStack align="end">
                <Button variant="primary" disabled={!codesAcknowledged} onClick={() => router.push(completionUrl)}>
                  Ya guardé mis códigos · Continuar
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    );
  }

  if (step === 'choose') {
    return (
      <Page title="Seguridad del perfil" backAction={backAction}>
        <BlockStack gap="500">
          {error && (
            <Banner tone="warning" onDismiss={() => setError('')}>
              <Text as="p" variant="bodyMd">{error}</Text>
            </Banner>
          )}

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingLg">Elige qué verificación quieres activar</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                El correo verificado ya está activo por defecto como factor base de tu perfil. Aquí solo eliges un método adicional para reforzar tu cuenta.
              </Text>
            </BlockStack>
          </Card>

          <MfaMethodsCard
            options={mfaOptions}
            selectedMethod={selectedMethod}
            onSelect={handleMethodSelection}
            onContinue={handleContinueSelectedMethod}
            loading={loading}
          />
        </BlockStack>
      </Page>
    );
  }

  return (
    <Page title="Seguridad del perfil" backAction={backAction}>
      <BlockStack gap="500">
        <MfaMethodsCard options={mfaOptions} />

        <Card>
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="center">
              <SecurityIcon tone="warning" />
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">Activar verificación en 2 pasos</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Vincula una app autenticadora y genera códigos de recuperación descargables en formato .txt.
                </Text>
              </BlockStack>
            </InlineStack>
            <InlineStack gap="200" wrap>
              <StepPill index={1} title="Escanear QR" active />
              <StepPill index={2} title="Verificar código" active={verifyCode.length > 0} />
              <StepPill index={3} title="Guardar recovery codes" active={false} />
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack gap="200" blockAlign="center">
              <StepBubble>1</StepBubble>
              <Text as="h3" variant="headingMd">Vincula tu app autenticadora</Text>
            </InlineStack>
            <Text as="p" variant="bodyMd">
              Abre tu app autenticadora y escanea el QR. Si no puedes escanear, registra la clave manual.
            </Text>
            <Box padding="400" background="bg-surface-secondary" borderRadius="300">
              <InlineStack align="center">
                {qrDataUrl ? (
                  <QrCodePreview source={qrDataUrl} />
                ) : (
                  <Box padding="800">
                    <Spinner size="large" />
                  </Box>
                )}
              </InlineStack>
            </Box>
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">Clave manual</Text>
                <Text as="p" variant="bodyMd" fontWeight="bold" breakWord>
                  {secretKey}
                </Text>
              </BlockStack>
            </Box>
            <Text as="p" variant="bodySm" tone="subdued" alignment="center">
              El QR se genera una vez al presionar Continuar y no se reemplaza solo. Si no alcanzas a escanearlo, usa la clave manual.
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack gap="200" blockAlign="center">
              <StepBubble>2</StepBubble>
              <Text as="h3" variant="headingMd">Verifica y activa</Text>
            </InlineStack>
            <Text as="p" variant="bodyMd">
              Ingresa el código de 6 dígitos que muestra tu app. Al activar MFA generaremos automáticamente 10 recovery codes.
            </Text>
            {error && (
              <Banner tone="critical" onDismiss={() => setError('')}>
                <Text as="p" variant="bodyMd">{error}</Text>
              </Banner>
            )}
            <Box maxWidth="320px">
              <TextField
                label="Código de verificación"
                value={verifyCode}
                onChange={setVerifyCode}
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                monospaced
              />
            </Box>
            <InlineStack align="start">
              <Button variant="primary" onClick={handleVerify} loading={loading} disabled={verifyCode.length !== 6} size="large">
                Verificar, activar MFA y generar códigos
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

function QrCodePreview({ source }: { source: string }) {
  return (
    <Box padding="400" background="bg-surface" borderRadius="300" shadow="300" borderColor="border" borderWidth="025">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={source}
        alt="Código QR para configurar TOTP"
        width={340}
        height={340}
        style={{ display: 'block', width: 'min(340px, 78vw)', height: 'auto' }}
      />
    </Box>
  );
}

function MfaMethodsCard({
  options,
  selectedMethod,
  onSelect,
  onContinue,
  loading,
}: {
  options: MfaOptionsStatusResult | null;
  selectedMethod?: TwoFactorMethod;
  onSelect?: (selection: string[]) => void;
  onContinue?: () => void;
  loading?: boolean;
}) {
  const canContinue = Boolean(
    selectedMethod === 'totp' ||
      (selectedMethod === 'recovery' && options?.authenticator.enabled),
  );

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">Opciones de verificación en 2 pasos</Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Los métodos activos dependen de lo que esté habilitado en AWS Cognito y de los códigos guardados en la base de datos.
          </Text>
        </BlockStack>

        {!options ? (
          <InlineStack align="center">
            <Spinner size="small" />
          </InlineStack>
        ) : (
          <BlockStack gap="400">
            {selectedMethod && onSelect && (
              <ChoiceList
                title="Método adicional a activar"
                choices={[
                  {
                    label: 'App autenticadora',
                    value: 'totp',
                    helpText: 'Activa TOTP con una app autenticadora. Es el método recomendado.',
                  },
                  {
                    label: 'Recovery codes',
                    value: 'recovery',
                    helpText: options.authenticator.enabled
                      ? 'Regenera códigos de recuperación de un solo uso.'
                      : 'Primero activa app autenticadora para generar recovery codes.',
                    disabled: !options.authenticator.enabled,
                  },
                  {
                    label: 'SMS',
                    value: 'sms',
                    helpText: options.sms.reason,
                    disabled: true,
                  },
                  {
                    label: 'Passkeys / llave de seguridad',
                    value: 'passkeys',
                    helpText: options.passkeys.reason,
                    disabled: true,
                  },
                ]}
                selected={[selectedMethod]}
                onChange={onSelect}
              />
            )}

            <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
              <MfaMethodOption
                title="Correo electrónico"
                description={options.email.address ? `Factor base automático con ${options.email.address}` : 'Se activa automáticamente al verificar el correo en Cognito.'}
                source={options.email.source}
                status={options.email.enabled ? 'Activo por defecto' : options.email.available ? 'Disponible' : 'No configurado'}
                tone={options.email.enabled ? 'success' : options.email.available ? 'warning' : 'critical'}
              />
              <MfaMethodOption
                title="App autenticadora"
                description="Código TOTP de 6 dígitos con Google Authenticator, Microsoft Authenticator, Authy o similar."
                source={options.authenticator.source}
                status={options.authenticator.enabled ? 'Activo' : 'Disponible'}
                tone={options.authenticator.enabled ? 'success' : 'info'}
              />
              <MfaMethodOption
                title="Recovery codes"
                description={options.recoveryCodes.enabled
                  ? `${options.recoveryCodes.unused} de ${options.recoveryCodes.total} códigos disponibles.`
                  : 'Se generan al activar app autenticadora y se guardan hasheados.'}
                source={options.recoveryCodes.source}
                status={options.recoveryCodes.enabled ? 'Activo' : options.recoveryCodes.available ? 'Generar' : 'Requiere app MFA'}
                tone={options.recoveryCodes.enabled ? 'success' : 'warning'}
              />
              <MfaMethodOption
                title="SMS"
                description={options.sms.reason}
                source={options.sms.source}
                status="No disponible"
                tone="warning"
              />
              <MfaMethodOption
                title="Passkeys / llave de seguridad"
                description={options.passkeys.reason}
                source={options.passkeys.source}
                status="Próximamente"
                tone="info"
              />
            </InlineGrid>

            {onContinue && (
              <InlineStack align="end">
                <Button variant="primary" onClick={onContinue} loading={loading} disabled={!canContinue}>
                  Continuar
                </Button>
              </InlineStack>
            )}
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}

function MfaMethodOption({
  title,
  description,
  source,
  status,
  tone,
}: {
  title: string;
  description: string;
  source: string;
  status: string;
  tone: 'success' | 'warning' | 'critical' | 'info';
}) {
  return (
    <Box padding="300" background="bg-surface-secondary" borderRadius="200" borderColor="border" borderWidth="025">
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="start" gap="200">
          <Text as="h3" variant="headingSm">{title}</Text>
          <Badge tone={tone}>{status}</Badge>
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">{description}</Text>
        <Text as="p" variant="bodyXs" tone="subdued">{source}</Text>
      </BlockStack>
    </Box>
  );
}

function SecurityIcon({ tone }: { tone: 'success' | 'warning' }) {
  return (
    <Box padding="300" background={tone === 'success' ? 'bg-fill-success-secondary' : 'bg-fill-warning-secondary'} borderRadius="300">
      <Icon source={tone === 'success' ? ShieldCheckMarkIcon : LockIcon} tone={tone === 'success' ? 'success' : 'base'} />
    </Box>
  );
}

function SecurityMetric({
  label,
  value,
  subvalue,
  tone,
}: {
  label: string;
  value: string;
  subvalue: string;
  tone: 'success' | 'warning' | 'critical';
}) {
  return (
    <Box padding="300" background="bg-surface-secondary" borderRadius="300" minWidth="180px">
      <BlockStack gap="100">
        <Text as="p" variant="bodyXs" tone="subdued">{label}</Text>
        <InlineStack gap="200" blockAlign="center">
          <Text as="p" variant="headingMd" fontWeight="bold">{value}</Text>
          <Badge tone={tone}>{tone === 'success' ? 'OK' : tone === 'warning' ? 'Revisar' : 'Crítico'}</Badge>
        </InlineStack>
        <Text as="p" variant="bodyXs" tone="subdued">{subvalue}</Text>
      </BlockStack>
    </Box>
  );
}

function RecoveryCodesVault({
  codes,
  mode,
  acknowledged,
  loading,
  onAcknowledge,
  onCopy,
  onDownload,
  onGenerate,
}: {
  codes: string[];
  mode: RecoveryCodesMode;
  acknowledged: boolean;
  loading: boolean;
  onAcknowledge: (value: boolean) => void;
  onCopy: () => void;
  onDownload: () => void;
  onGenerate: () => void;
}) {
  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="start">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">Bóveda de recovery codes</Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Genera 10 códigos de un solo uso. Solo se muestran una vez; en base de datos guardamos hashes.
            </Text>
          </BlockStack>
          <Button onClick={onGenerate} loading={loading}>
            {codes.length > 0 ? 'Regenerar códigos' : 'Generar códigos'}
          </Button>
        </InlineStack>

        {codes.length === 0 ? (
          <Banner tone="warning" title="No hay códigos visibles en esta sesión">
            <Text as="p" variant="bodyMd">
              Por seguridad, los códigos existentes no se pueden consultar nuevamente. Genera una nueva bóveda si necesitas descargar un .txt.
            </Text>
          </Banner>
        ) : (
          <>
            <Banner tone="warning" title={mode === 'activation' ? 'Guárdalos antes de continuar' : 'Nueva bóveda generada'}>
              <Text as="p" variant="bodyMd">
                Descarga el archivo .txt o cópialos ahora. Cualquier código anterior fue reemplazado por esta nueva bóveda.
              </Text>
            </Banner>
            <Box padding="400" background="bg-surface-secondary" borderRadius="300">
              <InlineGrid columns={{ xs: 1, sm: 2, md: 2 }} gap="300">
                {codes.map((code) => (
                  <Box key={code} padding="300" background="bg-surface" borderRadius="200" borderColor="border" borderWidth="025">
                    <Text as="p" variant="bodyMd" alignment="center" fontWeight="bold">
                      {code}
                    </Text>
                  </Box>
                ))}
              </InlineGrid>
            </Box>
            <InlineStack gap="200" wrap>
              <Button onClick={onCopy}>Copiar</Button>
              <Button variant="primary" onClick={onDownload}>Descargar .txt</Button>
            </InlineStack>
            <Checkbox
              label="Confirmo que guardé los códigos en un lugar seguro."
              checked={acknowledged}
              onChange={onAcknowledge}
            />
          </>
        )}
      </BlockStack>
    </Card>
  );
}

function StepPill({ index, title, active }: { index: number; title: string; active: boolean }) {
  return (
    <Badge tone={active ? 'info' : undefined}>{`${index}. ${title}`}</Badge>
  );
}

function StepBubble({ children }: { children: string }) {
  return <Badge tone="info">{`Paso ${children}`}</Badge>;
}
