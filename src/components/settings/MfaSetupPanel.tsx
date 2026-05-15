'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Page,
  Layout,
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
} from '@shopify/polaris';
import { LockIcon, CheckIcon, ShieldCheckMarkIcon } from '@shopify/polaris-icons';
import QRCode from 'qrcode';
import { setUpTOTP, verifyTOTPSetup, updateMFAPreference, fetchMFAPreference, fetchAuthSession } from '@/lib/cognito';

type SetupStep = 'loading' | 'scan' | 'verify' | 'success' | 'already-enabled' | 'error';

export function MfaSetupPanel() {
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>('loading');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const qrGenerated = useRef(false);

  useEffect(() => {
    async function checkMfaStatus() {
      try {
        // Use Cognito GetUser API via Amplify — reliable MFA detection.
        // Token claims (cognito:preferred_mfa_setting) are NOT included
        // in standard Cognito ID tokens without a pre-token-generation Lambda.
        const mfaPref = await fetchMFAPreference();
        if (mfaPref.preferred === 'TOTP') {
          setStep('already-enabled');
          return;
        }
        await startSetup();
      } catch {
        setStep('error');
        setError('No se pudo verificar el estado de MFA. Asegúrate de estar autenticado.');
      }
    }
    checkMfaStatus();
  }, []);

  const startSetup = useCallback(async () => {
    try {
      const output = await setUpTOTP();
      const secret = output.sharedSecret;
      const uri = output.getSetupUri('KioskoPos').toString();

      setSecretKey(secret);
      setStep('scan');

      if (!qrGenerated.current) {
        qrGenerated.current = true;
        const dataUrl = await QRCode.toDataURL(uri, { width: 220, margin: 2 });
        setQrDataUrl(dataUrl);
      }
    } catch (err) {
      setStep('error');
      setError(
        err instanceof Error ? err.message : 'Error al generar la configuración TOTP.',
      );
    }
  }, []);

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      setError('El código debe ser de 6 dígitos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await verifyTOTPSetup({ code: verifyCode });

      // Cognito needs time between VerifySoftwareToken and SetUserMFAPreference
      // to avoid ConcurrentModificationException:
      // "Only one request to update user MFA settings can be processed at a time"
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
  };

  if (step === 'loading') {
    return (
      <Page title="Seguridad" backAction={{ content: 'Configuración', url: '/dashboard/settings' }}>
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

  if (step === 'already-enabled') {
    return (
      <Page title="Seguridad" backAction={{ content: 'Configuración', url: '/dashboard/settings' }}>
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="300" align="start" blockAlign="center">
                  <div style={{ background: '#e3f1df', borderRadius: '50%', padding: 8, display: 'flex' }}>
                    <Icon source={ShieldCheckMarkIcon} tone="success" />
                  </div>
                  <BlockStack gap="100">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="h2" variant="headingMd">Autenticación de Dos Factores</Text>
                      <Badge tone="success">Activo</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Tu cuenta está protegida con verificación TOTP
                    </Text>
                  </BlockStack>
                </InlineStack>
                <Divider />
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    La autenticación multifactor (MFA) está habilitada en tu cuenta. Cada vez que inicies sesión,
                    se te solicitará un código de tu app autenticadora.
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Método: App Autenticadora (TOTP) — Google Authenticator, Microsoft Authenticator, Authy
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Apps compatibles</Text>
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm">• Google Authenticator</Text>
                  <Text as="p" variant="bodySm">• Microsoft Authenticator</Text>
                  <Text as="p" variant="bodySm">• Authy</Text>
                  <Text as="p" variant="bodySm">• 1Password</Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (step === 'error' && !secretKey) {
    return (
      <Page title="Seguridad" backAction={{ content: 'Configuración', url: '/dashboard/settings' }}>
        <Card>
          <BlockStack gap="400">
            <Banner tone="critical" title="Error de configuración">
              <p>{error}</p>
            </Banner>
            <Button onClick={() => router.push('/dashboard/settings')}>
              Volver a Configuración
            </Button>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  if (step === 'success') {
    return (
      <Page title="Seguridad" backAction={{ content: 'Configuración', url: '/dashboard/settings' }}>
        <Card>
          <BlockStack gap="500">
            <InlineStack gap="300" align="start" blockAlign="center">
              <div style={{ background: '#e3f1df', borderRadius: '50%', padding: 10, display: 'flex' }}>
                <Icon source={CheckIcon} tone="success" />
              </div>
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">MFA configurado exitosamente</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Tu cuenta ahora está protegida con verificación de dos factores
                </Text>
              </BlockStack>
            </InlineStack>
            <Divider />
            <Banner tone="success">
              <p>
                A partir de ahora, cada inicio de sesión requerirá un código de 6 dígitos
                de tu app autenticadora. Asegúrate de no desinstalar la app ni perder acceso al dispositivo.
              </p>
            </Banner>
            <InlineStack align="end">
              <Button variant="primary" onClick={() => router.push('/dashboard')}>
                Continuar al Dashboard
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  // Main setup flow — scan + verify
  return (
    <Page title="Seguridad" backAction={{ content: 'Configuración', url: '/dashboard/settings' }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Header */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="300" align="start" blockAlign="center">
                  <div style={{ background: '#f4f6f8', borderRadius: '50%', padding: 10, display: 'flex' }}>
                    <Icon source={LockIcon} tone="base" />
                  </div>
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingLg">Configurar Autenticación de Dos Factores</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Añade una capa adicional de seguridad a tu cuenta empresarial
                    </Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Step 1: Scan QR */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <div style={{
                    background: '#2c6ecb', color: '#fff', borderRadius: '50%',
                    width: 28, height: 28, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 14, fontWeight: 600,
                  }}>
                    1
                  </div>
                  <Text as="h3" variant="headingMd">Vincula tu app autenticadora</Text>
                </InlineStack>
                <Text as="p" variant="bodyMd">
                  Abre tu aplicación autenticadora y escanea el siguiente código QR para agregar tu cuenta.
                </Text>
                <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                  <InlineStack align="center">
                    {qrDataUrl ? (
                      <div style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <img
                          src={qrDataUrl}
                          alt="Código QR para configurar TOTP"
                          width={220}
                          height={220}
                          style={{ display: 'block' }}
                        />
                      </div>
                    ) : (
                      <Box padding="800">
                        <Spinner size="large" />
                      </Box>
                    )}
                  </InlineStack>
                </Box>
                <Divider />
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    ¿No puedes escanear el código? Ingresa esta clave manualmente en tu app:
                  </Text>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <Text as="p" variant="bodyMd" fontWeight="bold" breakWord>
                      <code style={{ fontSize: 14, letterSpacing: '1px', wordBreak: 'break-all' }}>
                        {secretKey}
                      </code>
                    </Text>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Step 2: Verify */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <div style={{
                    background: '#2c6ecb', color: '#fff', borderRadius: '50%',
                    width: 28, height: 28, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 14, fontWeight: 600,
                  }}>
                    2
                  </div>
                  <Text as="h3" variant="headingMd">Verifica la configuración</Text>
                </InlineStack>
                <Text as="p" variant="bodyMd">
                  Ingresa el código de 6 dígitos que muestra tu app autenticadora para confirmar que la vinculación es correcta.
                </Text>
                {error && (
                  <Banner tone="critical" onDismiss={() => setError('')}>
                    <p>{error}</p>
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
                    placeholder="000 000"
                    monospaced
                  />
                </Box>
                <InlineStack align="start">
                  <Button
                    variant="primary"
                    onClick={handleVerify}
                    loading={loading}
                    disabled={verifyCode.length !== 6}
                    size="large"
                  >
                    Verificar y activar MFA
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* Sidebar */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">¿Qué es MFA?</Text>
                <Text as="p" variant="bodySm">
                  La autenticación multifactor (MFA) protege tu cuenta requiriendo
                  un segundo método de verificación además de tu contraseña.
                </Text>
                <Divider />
                <Text as="h3" variant="headingSm">Apps compatibles</Text>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm">• Google Authenticator</Text>
                  <Text as="p" variant="bodySm">• Microsoft Authenticator</Text>
                  <Text as="p" variant="bodySm">• Authy</Text>
                  <Text as="p" variant="bodySm">• 1Password</Text>
                </BlockStack>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">¿Necesitas ayuda?</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Si tienes problemas configurando MFA, contacta al equipo de TI
                  o al administrador del sistema.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
