'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Text,
  TextField,
  FormLayout,
  BlockStack,
  InlineStack,
  Button,
  Checkbox,
  Box,
  Banner,
  Badge,
  Divider,
  Layout,
  Modal,
  Spinner,
} from '@shopify/polaris';
import type { StoreConfig } from '@/types';
import type { Field } from '@shopify/react-form';
import {
  initiateMPOAuth,
  disconnectMPOAuth,
  getMPConnectionStatus,
} from '@/app/actions/oauth-actions';
import {
  connectConektaAction,
  disconnectConektaAction,
  getConektaStatusAction,
  connectStripeAction,
  disconnectStripeAction,
  getStripeStatusAction,
  connectClipAction,
  disconnectClipAction,
  getClipStatusAction,
} from '@/app/actions/payment-provider-actions';

interface MPConnectionStatus {
  connected: boolean;
  email: string | null;
  expiresAt: string | null;
  publicKey: string | null;
  status: string;
}

interface ConektaStatus {
  connected: boolean;
  environment: string | null;
  publicKey: string | null;
}

interface StripeStatus {
  connected: boolean;
  environment: string | null;
  publishableKey: string | null;
}

interface ClipStatus {
  connected: boolean;
  environment: string | null;
  apiKey: string | null;
  serialNumber: string | null;
}

interface PaymentsSectionProps {
  config: StoreConfig;
  updateField: <K extends keyof StoreConfig>(field: K, value: StoreConfig[K]) => void;
  mpTesting: boolean;
  mpTestResult: { success: boolean; message: string } | null;
  mpDevices: { id: string; operating_mode: string }[];
  handleMPTest: () => void;
  clabeNumberField: Field<string>;
  paypalUsernameField: Field<string>;
  cobrarQrUrlField: Field<string>;
}

export function PaymentsSection({
  config,
  updateField,
  mpTesting,
  mpTestResult,
  mpDevices,
  handleMPTest,
  clabeNumberField,
  paypalUsernameField,
  cobrarQrUrlField,
}: PaymentsSectionProps) {
  const [mpConnection, setMpConnection] = useState<MPConnectionStatus | null>(null);
  const [mpConnecting, setMpConnecting] = useState(false);
  const [mpDisconnecting, setMpDisconnecting] = useState(false);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // ── Conekta State ──
  const [conektaStatus, setConektaStatus] = useState<ConektaStatus | null>(null);
  const [conektaConnecting, setConektaConnecting] = useState(false);
  const [conektaError, setConektaError] = useState<string | null>(null);
  const [conektaPrivateKey, setConektaPrivateKey] = useState('');
  const [conektaPublicKey, setConektaPublicKey] = useState('');
  const [conektaEnv, setConektaEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [conektaDisconnectOpen, setConektaDisconnectOpen] = useState(false);

  // ── Stripe State ──
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [stripeEnv, setStripeEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [stripeDisconnectOpen, setStripeDisconnectOpen] = useState(false);

  // ── Clip State ──
  const [clipStatus, setClipStatus] = useState<ClipStatus | null>(null);
  const [clipConnecting, setClipConnecting] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const [clipApiKey, setClipApiKey] = useState('');
  const [clipSecretKey, setClipSecretKey] = useState('');
  const [clipSerialNumber, setClipSerialNumber] = useState('');
  const [clipEnv, setClipEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [clipDisconnectOpen, setClipDisconnectOpen] = useState(false);

  // Load OAuth connection status
  const loadConnectionStatus = useCallback(async () => {
    try {
      const [mpStatus, ckStatus, stStatus, clStatus] = await Promise.all([
        getMPConnectionStatus(),
        getConektaStatusAction(),
        getStripeStatusAction(),
        getClipStatusAction(),
      ]);
      setMpConnection(mpStatus);
      setConektaStatus(ckStatus);
      setStripeStatus(stStatus);
      setClipStatus(clStatus);
    } catch {
      setMpConnection(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadConnectionStatus();
  }, [loadConnectionStatus]);

  // Check URL params for OAuth callback result
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('oauth');
    if (oauthResult === 'success') {
      loadConnectionStatus();
      // Clean URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('oauth');
      url.searchParams.delete('provider');
      url.searchParams.delete('email');
      window.history.replaceState({}, '', url.toString());
    } else if (oauthResult === 'error') {
      setOauthError(params.get('msg') || 'Error al conectar con MercadoPago');
      const url = new URL(window.location.href);
      url.searchParams.delete('oauth');
      url.searchParams.delete('msg');
      window.history.replaceState({}, '', url.toString());
    } else if (oauthResult === 'denied') {
      setOauthError('Autorizaci\u00f3n denegada por el usuario');
      const url = new URL(window.location.href);
      url.searchParams.delete('oauth');
      window.history.replaceState({}, '', url.toString());
    }
  }, [loadConnectionStatus]);

  const handleConnect = useCallback(async () => {
    setMpConnecting(true);
    setOauthError(null);
    try {
      const { url } = await initiateMPOAuth();
      window.location.href = url;
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Error al iniciar conexi\u00f3n');
      setMpConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    setMpDisconnecting(true);
    try {
      await disconnectMPOAuth();
      setMpConnection({ connected: false, email: null, expiresAt: null, publicKey: null, status: 'disconnected' });
      updateField('mpEnabled', false);
      setDisconnectModalOpen(false);
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Error al desconectar');
    } finally {
      setMpDisconnecting(false);
    }
  }, [updateField]);

  const isConnected = mpConnection?.connected === true;

  // ── Conekta Handlers ──
  const handleConektaConnect = useCallback(async () => {
    setConektaConnecting(true);
    setConektaError(null);
    try {
      const result = await connectConektaAction({
        privateKey: conektaPrivateKey,
        publicKey: conektaPublicKey,
        environment: conektaEnv,
      });
      if (result.success) {
        setConektaStatus({ connected: true, environment: conektaEnv, publicKey: conektaPublicKey });
        updateField('conektaEnabled', true);
        updateField('conektaPublicKey', conektaPublicKey);
        setConektaPrivateKey('');
        setConektaPublicKey('');
      } else {
        setConektaError(result.message);
      }
    } catch (err) {
      setConektaError(err instanceof Error ? err.message : 'Error al conectar con Conekta');
    } finally {
      setConektaConnecting(false);
    }
  }, [conektaPrivateKey, conektaPublicKey, conektaEnv, updateField]);

  const handleConektaDisconnect = useCallback(async () => {
    try {
      await disconnectConektaAction();
      setConektaStatus({ connected: false, environment: null, publicKey: null });
      updateField('conektaEnabled', false);
      setConektaDisconnectOpen(false);
    } catch (err) {
      setConektaError(err instanceof Error ? err.message : 'Error');
    }
  }, [updateField]);

  // ── Stripe Handlers ──
  const handleStripeConnect = useCallback(async () => {
    setStripeConnecting(true);
    setStripeError(null);
    try {
      const result = await connectStripeAction({
        secretKey: stripeSecretKey,
        publishableKey: stripePublishableKey,
        webhookSecret: stripeWebhookSecret || undefined,
        environment: stripeEnv,
      });
      if (result.success) {
        setStripeStatus({ connected: true, environment: stripeEnv, publishableKey: stripePublishableKey });
        updateField('stripeEnabled', true);
        updateField('stripePublicKey', stripePublishableKey);
        setStripeSecretKey('');
        setStripePublishableKey('');
        setStripeWebhookSecret('');
      } else {
        setStripeError(result.message);
      }
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : 'Error al conectar con Stripe');
    } finally {
      setStripeConnecting(false);
    }
  }, [stripeSecretKey, stripePublishableKey, stripeWebhookSecret, stripeEnv, updateField]);

  const handleStripeDisconnect = useCallback(async () => {
    try {
      await disconnectStripeAction();
      setStripeStatus({ connected: false, environment: null, publishableKey: null });
      updateField('stripeEnabled', false);
      setStripeDisconnectOpen(false);
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : 'Error');
    }
  }, [updateField]);

  // ── Clip Handlers ──
  const handleClipConnect = useCallback(async () => {
    setClipConnecting(true);
    setClipError(null);
    try {
      const result = await connectClipAction({
        apiKey: clipApiKey,
        secretKey: clipSecretKey,
        serialNumber: clipSerialNumber || undefined,
        environment: clipEnv,
      });
      if (result.success) {
        setClipStatus({ connected: true, environment: clipEnv, apiKey: clipApiKey, serialNumber: clipSerialNumber || null });
        updateField('clipEnabled', true);
        updateField('clipApiKey', clipApiKey);
        if (clipSerialNumber) updateField('clipSerialNumber', clipSerialNumber);
        setClipApiKey('');
        setClipSecretKey('');
        setClipSerialNumber('');
      } else {
        setClipError(result.message);
      }
    } catch (err) {
      setClipError(err instanceof Error ? err.message : 'Error al conectar con Clip');
    } finally {
      setClipConnecting(false);
    }
  }, [clipApiKey, clipSecretKey, clipSerialNumber, clipEnv, updateField]);

  const handleClipDisconnect = useCallback(async () => {
    try {
      await disconnectClipAction();
      setClipStatus({ connected: false, environment: null, apiKey: null, serialNumber: null });
      updateField('clipEnabled', false);
      setClipDisconnectOpen(false);
    } catch (err) {
      setClipError(err instanceof Error ? err.message : 'Error');
    }
  }, [updateField]);

  const formatExpiryDate = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <BlockStack gap="500">
      {/* ── MercadoPago OAuth ── */}
      <Layout.AnnotatedSection
        title="Mercado Pago"
        description="Conecta tu cuenta de MercadoPago para procesar cobros con terminal Point, tarjetas web, QR y reembolsos — sin ingresar tokens manuales."
      >
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://http2.mlstatic.com/frontend-assets/ui-navigation/5.23.0/mercadopago/logo__small@2x.png"
                alt="Mercado Pago"
                width="30"
              />
              <Text variant="headingSm" as="h3">MercadoPago</Text>
              {loadingStatus ? (
                <Spinner size="small" />
              ) : isConnected ? (
                <Badge tone="success">Conectado</Badge>
              ) : mpConnection?.status === 'expired' ? (
                <Badge tone="warning">Expirado</Badge>
              ) : (
                <Badge>Sin conectar</Badge>
              )}
            </InlineStack>

            {oauthError && (
              <Banner tone="critical" onDismiss={() => setOauthError(null)}>
                <p>{oauthError}</p>
              </Banner>
            )}

            {isConnected ? (
              <BlockStack gap="300">
                <Card>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text variant="bodySm" as="span" tone="subdued">Cuenta conectada</Text>
                      <Text variant="bodyMd" fontWeight="semibold" as="span">
                        {mpConnection.email || 'Cuenta vinculada'}
                      </Text>
                    </InlineStack>
                    {mpConnection.expiresAt && (
                      <InlineStack align="space-between">
                        <Text variant="bodySm" as="span" tone="subdued">Tokens vigentes hasta</Text>
                        <Text variant="bodySm" as="span">
                          {formatExpiryDate(mpConnection.expiresAt)}
                        </Text>
                      </InlineStack>
                    )}
                    {mpConnection.publicKey && (
                      <InlineStack align="space-between">
                        <Text variant="bodySm" as="span" tone="subdued">Public Key</Text>
                        <Text variant="bodySm" as="span" tone="subdued">
                          {mpConnection.publicKey.slice(0, 20)}...
                        </Text>
                      </InlineStack>
                    )}
                  </BlockStack>
                </Card>

                <Banner tone="success">
                  <p>Tu cuenta de MercadoPago est\u00e1 conectada. Los tokens se renuevan autom\u00e1ticamente antes de expirar.</p>
                </Banner>

                <Divider />

                <Checkbox
                  label="Procesar transacciones con tarjeta v\u00eda Point"
                  checked={config.mpEnabled}
                  onChange={(v) => updateField('mpEnabled', v)}
                />

                {config.mpEnabled && (
                  <FormLayout>
                    <TextField
                      label="Device ID (Terminal f\u00edsica)"
                      value={config.mpDeviceId || ''}
                      onChange={(v) => updateField('mpDeviceId', v)}
                      autoComplete="off"
                      placeholder="Ej: PAX_A910__..."
                      helpText="ID del lector f\u00edsico. Usa el bot\u00f3n descubrir para detectarlo autom\u00e1ticamente."
                    />

                    <InlineStack gap="300" blockAlign="center">
                      <Button onClick={handleMPTest} loading={mpTesting}>
                        Descubrir Terminales
                      </Button>
                    </InlineStack>

                    {mpTestResult && (
                      <Banner tone={mpTestResult.success ? 'success' : 'critical'}>
                        <p>{mpTestResult.message}</p>
                      </Banner>
                    )}

                    {mpDevices.length > 0 && (
                      <Box paddingBlockStart="200">
                        <BlockStack gap="300">
                          <Text as="h3" variant="headingSm">Dispositivos detectados:</Text>
                          <Card>
                            <BlockStack gap="200">
                              {mpDevices.map((d) => (
                                <InlineStack key={d.id} gap="400" blockAlign="center" align="space-between">
                                  <InlineStack gap="300" blockAlign="center">
                                    <Badge tone={d.id === (config.mpDeviceId || '') ? 'success' : 'info'}>
                                      {d.id === (config.mpDeviceId || '') ? 'Enlazada' : 'Detectada'}
                                    </Badge>
                                    <Text as="p" variant="bodyMd" fontWeight="medium">{d.id}</Text>
                                  </InlineStack>
                                  {d.id !== (config.mpDeviceId || '') && (
                                    <Button size="slim" onClick={() => updateField('mpDeviceId', d.id)}>
                                      Enlazar
                                    </Button>
                                  )}
                                </InlineStack>
                              ))}
                            </BlockStack>
                          </Card>
                        </BlockStack>
                      </Box>
                    )}
                  </FormLayout>
                )}

                <Divider />
                <Button tone="critical" variant="plain" onClick={() => setDisconnectModalOpen(true)}>
                  Desconectar cuenta de MercadoPago
                </Button>
              </BlockStack>
            ) : mpConnection?.status === 'expired' ? (
              <BlockStack gap="300">
                <Banner tone="warning">
                  <p>Tu conexi\u00f3n con MercadoPago expir\u00f3. Reconecta tu cuenta para seguir procesando pagos.</p>
                </Banner>
                <Button
                  variant="primary"
                  onClick={handleConnect}
                  loading={mpConnecting}
                >
                  Reconectar con MercadoPago
                </Button>
              </BlockStack>
            ) : (
              <BlockStack gap="300">
                <Banner tone="info">
                  <p>Conecta tu cuenta de MercadoPago para procesar cobros. Ser\u00e1s redirigido a MercadoPago para autorizar el acceso de forma segura.</p>
                </Banner>
                <Button
                  variant="primary"
                  onClick={handleConnect}
                  loading={mpConnecting}
                >
                  Conectar con MercadoPago
                </Button>
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      {/* ── SPEI ── */}
      <Layout.AnnotatedSection
        title="SPEI (Transferencia bancaria)"
        description="Permite cobros mediante transferencia SPEI. El cajero muestra la CLABE al cliente y confirma el dep\u00f3sito manualmente."
      >
        <Card>
          <FormLayout>
            <TextField
              label="CLABE Interbancaria"
              value={clabeNumberField.value}
              onChange={clabeNumberField.onChange}
              error={clabeNumberField.error}
              autoComplete="off"
              placeholder="18 d\u00edgitos, ej: 012345678901234567"
              helpText="Se mostrar\u00e1 al cajero cuando seleccione SPEI como m\u00e9todo de pago."
              maxLength={18}
            />
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      {/* ── PayPal ── */}
      <Layout.AnnotatedSection
        title="PayPal"
        description="Genera un enlace PayPal.Me para que el cliente pague desde su m\u00f3vil. El cajero confirma el pago manualmente."
      >
        <Card>
          <FormLayout>
            <TextField
              label="Usuario PayPal.Me"
              value={paypalUsernameField.value}
              onChange={paypalUsernameField.onChange}
              error={paypalUsernameField.error}
              autoComplete="off"
              placeholder="Ej: MiTienda"
              helpText="Se usar\u00e1 para construir el enlace paypal.me/TuUsuario/monto al cobrar."
              prefix="paypal.me/"
            />
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      {/* ── QR de Cobro ── */}
      <Layout.AnnotatedSection
        title="QR de Cobro (CoDi / Banco)"
        description="Sube la URL de tu imagen QR de cobro (CoDi, BBVA, BBVA Wallet, etc.). Se mostrar\u00e1 al cajero para que el cliente escanee."
      >
        <Card>
          <FormLayout>
            <TextField
              label="URL de imagen QR"
              value={cobrarQrUrlField.value}
              onChange={cobrarQrUrlField.onChange}
              error={cobrarQrUrlField.error}
              autoComplete="off"
              placeholder="https://..."
              helpText="URL p\u00fablica de la imagen QR generada por tu banco o proveedor de pagos."
            />
            {cobrarQrUrlField.value && (
              <Box paddingBlockStart="200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cobrarQrUrlField.value}
                  alt="Vista previa QR"
                  style={{ width: 150, height: 150, objectFit: 'contain', border: '1px solid #e1e3e5', borderRadius: 8 }}
                />
              </Box>
            )}
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── Conekta (SPEI + OXXO automatizado) ── */}
      {/* ══════════════════════════════════════════════════════ */}
      <Layout.AnnotatedSection
        title="Conekta (SPEI + OXXO)"
        description="Conecta Conekta para cobrar con SPEI (confirmación automática vía webhook) y OXXO. Registra tu cuenta en panel.conekta.com."
      >
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="center">
              <Text variant="headingSm" as="h3">Conekta</Text>
              {loadingStatus ? (
                <Spinner size="small" />
              ) : conektaStatus?.connected ? (
                <Badge tone="success">Conectado ({conektaStatus.environment})</Badge>
              ) : (
                <Badge>Sin conectar</Badge>
              )}
            </InlineStack>

            {conektaError && (
              <Banner tone="critical" onDismiss={() => setConektaError(null)}>
                <p>{conektaError}</p>
              </Banner>
            )}

            {conektaStatus?.connected ? (
              <BlockStack gap="300">
                <Banner tone="success">
                  <p>Conekta conectado. SPEI y OXXO disponibles como métodos de pago automáticos.</p>
                </Banner>
                {conektaStatus.publicKey && (
                  <InlineStack align="space-between">
                    <Text variant="bodySm" as="span" tone="subdued">Public Key</Text>
                    <Text variant="bodySm" as="span" tone="subdued">
                      {conektaStatus.publicKey.slice(0, 20)}...
                    </Text>
                  </InlineStack>
                )}
                <Divider />
                <Button tone="critical" variant="plain" onClick={() => setConektaDisconnectOpen(true)}>
                  Desconectar Conekta
                </Button>
              </BlockStack>
            ) : (
              <BlockStack gap="300">
                <Banner tone="info">
                  <p>Ingresa tus API Keys de Conekta. Las encuentras en Panel → Desarrolladores → API Keys.</p>
                </Banner>
                <FormLayout>
                  <InlineStack gap="300">
                    <Button
                      size="slim"
                      pressed={conektaEnv === 'sandbox'}
                      onClick={() => setConektaEnv('sandbox')}
                    >
                      Sandbox
                    </Button>
                    <Button
                      size="slim"
                      pressed={conektaEnv === 'production'}
                      onClick={() => setConektaEnv('production')}
                    >
                      Producción
                    </Button>
                  </InlineStack>
                  <TextField
                    label="Private Key (API Key)"
                    value={conektaPrivateKey}
                    onChange={setConektaPrivateKey}
                    autoComplete="off"
                    placeholder="key_xxxxxxxxxxxxxxxxxxxxxxxx"
                    type="password"
                  />
                  <TextField
                    label="Public Key"
                    value={conektaPublicKey}
                    onChange={setConektaPublicKey}
                    autoComplete="off"
                    placeholder="key_xxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <Button
                    variant="primary"
                    onClick={handleConektaConnect}
                    loading={conektaConnecting}
                    disabled={!conektaPrivateKey || !conektaPublicKey}
                  >
                    Conectar Conekta
                  </Button>
                </FormLayout>
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── Stripe México (SPEI + OXXO) ── */}
      {/* ══════════════════════════════════════════════════════ */}
      <Layout.AnnotatedSection
        title="Stripe México (SPEI + OXXO)"
        description="Conecta Stripe para cobrar con SPEI y OXXO automáticamente. Requiere cuenta en dashboard.stripe.com con domicilio en México."
      >
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="center">
              <Text variant="headingSm" as="h3">Stripe</Text>
              {loadingStatus ? (
                <Spinner size="small" />
              ) : stripeStatus?.connected ? (
                <Badge tone="success">Conectado ({stripeStatus.environment})</Badge>
              ) : (
                <Badge>Sin conectar</Badge>
              )}
            </InlineStack>

            {stripeError && (
              <Banner tone="critical" onDismiss={() => setStripeError(null)}>
                <p>{stripeError}</p>
              </Banner>
            )}

            {stripeStatus?.connected ? (
              <BlockStack gap="300">
                <Banner tone="success">
                  <p>Stripe conectado. SPEI y OXXO disponibles como métodos de pago automáticos.</p>
                </Banner>
                {stripeStatus.publishableKey && (
                  <InlineStack align="space-between">
                    <Text variant="bodySm" as="span" tone="subdued">Publishable Key</Text>
                    <Text variant="bodySm" as="span" tone="subdued">
                      {stripeStatus.publishableKey.slice(0, 20)}...
                    </Text>
                  </InlineStack>
                )}
                <Divider />
                <Button tone="critical" variant="plain" onClick={() => setStripeDisconnectOpen(true)}>
                  Desconectar Stripe
                </Button>
              </BlockStack>
            ) : (
              <BlockStack gap="300">
                <Banner tone="info">
                  <p>Ingresa tus API Keys de Stripe. Las encuentras en Dashboard → Developers → API Keys.</p>
                </Banner>
                <FormLayout>
                  <InlineStack gap="300">
                    <Button
                      size="slim"
                      pressed={stripeEnv === 'sandbox'}
                      onClick={() => setStripeEnv('sandbox')}
                    >
                      Test
                    </Button>
                    <Button
                      size="slim"
                      pressed={stripeEnv === 'production'}
                      onClick={() => setStripeEnv('production')}
                    >
                      Producción
                    </Button>
                  </InlineStack>
                  <TextField
                    label="Secret Key"
                    value={stripeSecretKey}
                    onChange={setStripeSecretKey}
                    autoComplete="off"
                    placeholder={stripeEnv === 'production' ? 'sk_live_...' : 'sk_test_...'}
                    type="password"
                  />
                  <TextField
                    label="Publishable Key"
                    value={stripePublishableKey}
                    onChange={setStripePublishableKey}
                    autoComplete="off"
                    placeholder={stripeEnv === 'production' ? 'pk_live_...' : 'pk_test_...'}
                  />
                  <TextField
                    label="Webhook Secret (opcional)"
                    value={stripeWebhookSecret}
                    onChange={setStripeWebhookSecret}
                    autoComplete="off"
                    placeholder="whsec_..."
                    type="password"
                    helpText="Necesario para confirmar pagos SPEI/OXXO automáticamente."
                  />
                  <Button
                    variant="primary"
                    onClick={handleStripeConnect}
                    loading={stripeConnecting}
                    disabled={!stripeSecretKey || !stripePublishableKey}
                  >
                    Conectar Stripe
                  </Button>
                </FormLayout>
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── Clip (Checkout + Terminal PinPad) ── */}
      {/* ══════════════════════════════════════════════════════ */}
      <Layout.AnnotatedSection
        title="Clip (Checkout + Terminal)"
        description="Conecta Clip para aceptar pagos con tarjeta vía link de pago o terminal PinPad (Total 3). Requiere cuenta en dashboard.clip.mx."
      >
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="center">
              <Text variant="headingSm" as="h3">Clip</Text>
              {loadingStatus ? (
                <Spinner size="small" />
              ) : clipStatus?.connected ? (
                <Badge tone="success">Conectado ({clipStatus.environment})</Badge>
              ) : (
                <Badge>Sin conectar</Badge>
              )}
            </InlineStack>

            {clipError && (
              <Banner tone="critical" onDismiss={() => setClipError(null)}>
                <p>{clipError}</p>
              </Banner>
            )}

            {clipStatus?.connected ? (
              <BlockStack gap="300">
                <Banner tone="success">
                  <p>Clip conectado. Pagos con tarjeta vía Checkout y Terminal PinPad disponibles.</p>
                </Banner>
                {clipStatus.apiKey && (
                  <InlineStack align="space-between">
                    <Text variant="bodySm" as="span" tone="subdued">API Key</Text>
                    <Text variant="bodySm" as="span" tone="subdued">
                      {clipStatus.apiKey.slice(0, 12)}...
                    </Text>
                  </InlineStack>
                )}
                {clipStatus.serialNumber && (
                  <InlineStack align="space-between">
                    <Text variant="bodySm" as="span" tone="subdued">Terminal</Text>
                    <Text variant="bodySm" as="span" tone="subdued">
                      {clipStatus.serialNumber}
                    </Text>
                  </InlineStack>
                )}
                <Divider />
                <Button tone="critical" variant="plain" onClick={() => setClipDisconnectOpen(true)}>
                  Desconectar Clip
                </Button>
              </BlockStack>
            ) : (
              <BlockStack gap="300">
                <Banner tone="info">
                  <p>Ingresa tus credenciales de Clip. Las encuentras en Dashboard → Panel de Desarrollador → Credenciales.</p>
                </Banner>
                <FormLayout>
                  <InlineStack gap="300">
                    <Button
                      size="slim"
                      pressed={clipEnv === 'sandbox'}
                      onClick={() => setClipEnv('sandbox')}
                    >
                      Pruebas
                    </Button>
                    <Button
                      size="slim"
                      pressed={clipEnv === 'production'}
                      onClick={() => setClipEnv('production')}
                    >
                      Producción
                    </Button>
                  </InlineStack>
                  <TextField
                    label="API Key"
                    value={clipApiKey}
                    onChange={setClipApiKey}
                    autoComplete="off"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                  <TextField
                    label="Clave Secreta"
                    value={clipSecretKey}
                    onChange={setClipSecretKey}
                    autoComplete="off"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    type="password"
                  />
                  <TextField
                    label="Número de Serie del Lector (opcional)"
                    value={clipSerialNumber}
                    onChange={setClipSerialNumber}
                    autoComplete="off"
                    placeholder="P8220724000042"
                    helpText="Requerido para pagos presenciales con terminal PinPad (Clip Total 3)."
                  />
                  <Button
                    variant="primary"
                    onClick={handleClipConnect}
                    loading={clipConnecting}
                    disabled={!clipApiKey || !clipSecretKey}
                  >
                    Conectar Clip
                  </Button>
                </FormLayout>
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      {/* Disconnect Confirmation Modal — MercadoPago */}
      <Modal
        open={disconnectModalOpen}
        onClose={() => setDisconnectModalOpen(false)}
        title="Desconectar MercadoPago"
        primaryAction={{
          content: mpDisconnecting ? 'Desconectando...' : 'Desconectar',
          onAction: handleDisconnect,
          loading: mpDisconnecting,
          destructive: true,
        }}
        secondaryActions={[
          { content: 'Cancelar', onAction: () => setDisconnectModalOpen(false) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Banner tone="warning">
              <p>Al desconectar, se eliminar\u00e1n los tokens de acceso almacenados y no podr\u00e1s procesar pagos con MercadoPago hasta reconectar.</p>
            </Banner>
            {mpConnection?.email && (
              <Text variant="bodyMd" as="p">
                Cuenta: <Text as="span" fontWeight="semibold">{mpConnection.email}</Text>
              </Text>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Disconnect Confirmation Modal — Conekta */}
      <Modal
        open={conektaDisconnectOpen}
        onClose={() => setConektaDisconnectOpen(false)}
        title="Desconectar Conekta"
        primaryAction={{
          content: 'Desconectar',
          onAction: handleConektaDisconnect,
          destructive: true,
        }}
        secondaryActions={[
          { content: 'Cancelar', onAction: () => setConektaDisconnectOpen(false) },
        ]}
      >
        <Modal.Section>
          <Banner tone="warning">
            <p>Al desconectar, se eliminarán las API Keys almacenadas y los pagos SPEI/OXXO automáticos vía Conekta dejarán de funcionar.</p>
          </Banner>
        </Modal.Section>
      </Modal>

      {/* Disconnect Confirmation Modal — Stripe */}
      <Modal
        open={stripeDisconnectOpen}
        onClose={() => setStripeDisconnectOpen(false)}
        title="Desconectar Stripe"
        primaryAction={{
          content: 'Desconectar',
          onAction: handleStripeDisconnect,
          destructive: true,
        }}
        secondaryActions={[
          { content: 'Cancelar', onAction: () => setStripeDisconnectOpen(false) },
        ]}
      >
        <Modal.Section>
          <Banner tone="warning">
            <p>Al desconectar, se eliminarán las API Keys almacenadas y los pagos SPEI/OXXO automáticos vía Stripe dejarán de funcionar.</p>
          </Banner>
        </Modal.Section>
      </Modal>

      {/* Disconnect Confirmation Modal — Clip */}
      <Modal
        open={clipDisconnectOpen}
        onClose={() => setClipDisconnectOpen(false)}
        title="Desconectar Clip"
        primaryAction={{
          content: 'Desconectar',
          onAction: handleClipDisconnect,
          destructive: true,
        }}
        secondaryActions={[
          { content: 'Cancelar', onAction: () => setClipDisconnectOpen(false) },
        ]}
      >
        <Modal.Section>
          <Banner tone="warning">
            <p>Al desconectar, se eliminarán las credenciales almacenadas y los pagos con tarjeta vía Clip dejarán de funcionar.</p>
          </Banner>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
