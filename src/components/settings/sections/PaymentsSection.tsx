'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Modal,
  Spinner,
  Collapsible,
  Icon,
  DropZone,
} from '@shopify/polaris';
import {
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LockIcon,
  CreditCardIcon,
} from '@shopify/polaris-icons';
import type { StoreConfig } from '@/types';
import type { Field } from '@shopify/react-form';
import { useDashboardStore } from '@/store/dashboardStore';
import { uploadFile, deleteFileFromUrl } from '@/lib/storage';
import { initiateMPOAuth, disconnectMPOAuth, getMPConnectionStatus } from '@/app/actions/oauth-actions';
import {
  connectClipAction,
  disconnectClipAction,
  getClipStatusAction,
} from '@/app/actions/payment-provider-actions';
import { BrandLogo } from '@/components/ui/BrandLogo';

interface MPConnectionStatus {
  connected: boolean;
  email: string | null;
  expiresAt: string | null;
  publicKey: string | null;
  status: string;
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
  paypalQrUrlField: Field<string>;
  cobrarQrUrlField: Field<string>;
}

/** S3-hosted brand logos for each payment provider */
const S3_BASE = 'https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/payments';
const PROVIDER_LOGOS: Record<string, string> = {
  mercadopago: `${S3_BASE}/mercadopago.png`,
  stripe: `${S3_BASE}/stripe.png`,
  conekta: `${S3_BASE}/conekta.png`,
  clip: `${S3_BASE}/clip.png`,
  paypal: `${S3_BASE}/paypal.png`,
  codi: `${S3_BASE}/codi.png`,
};

// ── CLABE Bank Code Lookup (Mexican interbank system) ──
const CLABE_BANKS: Record<string, { name: string; domain?: string }> = {
  '002': { name: 'Banamex', domain: 'banamex.com' },
  '006': { name: 'Bancomext', domain: 'bancomext.com' },
  '009': { name: 'Banobras', domain: 'banobras.gob.mx' },
  '012': { name: 'BBVA', domain: 'bbva.mx' },
  '014': { name: 'Santander', domain: 'santander.com.mx' },
  '021': { name: 'HSBC', domain: 'hsbc.com.mx' },
  '030': { name: 'Bajío', domain: 'bb.com.mx' },
  '032': { name: 'IXE', domain: 'ixe.com.mx' },
  '036': { name: 'Inbursa', domain: 'inbursa.com' },
  '037': { name: 'Interacciones', domain: 'interacciones.com' },
  '042': { name: 'Mifel', domain: 'bmifel.com.mx' },
  '044': { name: 'Scotiabank', domain: 'scotiabank.com.mx' },
  '058': { name: 'Banregio', domain: 'banregio.com' },
  '059': { name: 'Invex', domain: 'invex.com' },
  '060': { name: 'Bansi', domain: 'bansi.com.mx' },
  '062': { name: 'Afirme', domain: 'afirme.com' },
  '072': { name: 'Banorte', domain: 'banorte.com' },
  '102': { name: 'Royal Bank' },
  '106': { name: 'BAMSA' },
  '113': { name: 'Ve por Más', domain: 'bfrv.mx' },
  '127': { name: 'Azteca', domain: 'bancoazteca.com.mx' },
  '128': { name: 'Autofin' },
  '130': { name: 'Compartamos', domain: 'compartamos.com.mx' },
  '132': { name: 'Multiva', domain: 'multiva.com.mx' },
  '133': { name: 'Actinver', domain: 'actinver.com' },
  '134': { name: 'Walmart', domain: 'banbajio.com' },
  '137': { name: 'Bancoppel', domain: 'bancoppel.com' },
  '138': { name: 'ABC Capital', domain: 'abccapital.com.mx' },
  '140': { name: 'Consubanco', domain: 'consubanco.com' },
  '143': { name: 'CIBanco', domain: 'cibanco.com' },
  '145': { name: 'BBase', domain: 'bfrv.mx' },
  '147': { name: 'Bankaool', domain: 'bankaool.com' },
  '148': { name: 'Pagatodo', domain: 'pagatodo.com' },
  '155': { name: 'ICBC', domain: 'icbc.com.ar' },
  '156': { name: 'Sabadell', domain: 'sabadell.com' },
  '166': { name: 'Bansefi', domain: 'gob.mx' },
  '646': { name: 'STP', domain: 'stp.mx' },
  '659': { name: 'ASP Integra OPC' },
  '684': { name: 'Transfer' },
  '722': { name: 'Mercado Pago', domain: 'mercadopago.com.mx' },
};

function getBankFromClabe(clabe: string): { name: string } | null {
  if (clabe.length < 3) return null;
  const bank = CLABE_BANKS[clabe.substring(0, 3)];
  if (!bank) return null;
  return { name: bank.name };
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
  paypalQrUrlField,
  cobrarQrUrlField,
}: PaymentsSectionProps) {
  const [mpConnection, setMpConnection] = useState<MPConnectionStatus | null>(null);
  const [mpConnecting, setMpConnecting] = useState(false);
  const [mpDisconnecting, setMpDisconnecting] = useState(false);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

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
      const [mpStatus, clStatus] = await Promise.all([
        getMPConnectionStatus(),
        getClipStatusAction(),
      ]);
      setMpConnection(mpStatus);
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
      // Refresh Zustand storeConfig so POS dropdown picks up enabled providers
      useDashboardStore.getState().fetchDashboardData();
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

  // ── Derived state ──
  const isConnected = mpConnection?.connected === true;

  const providers = [
    {
      name: 'Mercado Pago',
      connected: isConnected,
      methods: 'Terminal Point · Tarjeta web',
      type: 'OAuth' as const,
      logo: PROVIDER_LOGOS.mercadopago,
    },
    {
      name: 'Clip',
      connected: clipStatus?.connected ?? false,
      methods: 'Checkout link · Terminal PinPad',
      type: 'API Keys' as const,
      logo: PROVIDER_LOGOS.clip,
    },
  ];

  const manualMethods = [
    { name: 'SPEI (CLABE)', configured: Boolean(clabeNumberField.value) },
    { name: 'PayPal', configured: Boolean(paypalQrUrlField.value || paypalUsernameField.value) },
    { name: 'QR de Cobro', configured: Boolean(cobrarQrUrlField.value) },
  ];

  const connectedCount = providers.filter((p) => p.connected).length;
  const configuredManualCount = manualMethods.filter((m) => m.configured).length;
  const totalActiveCount = connectedCount + configuredManualCount + 5; // +5 siempre disponibles

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
        setClipStatus({
          connected: true,
          environment: clipEnv,
          apiKey: clipApiKey,
          serialNumber: clipSerialNumber || null,
        });
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

  // ── Expanded sections state ──
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const toggleSection = useCallback(
    (id: string) => setExpandedSection((prev) => (prev === id ? null : id)),
    [],
  );

  // ── Health score ──
  const healthScore = useMemo(() => {
    const maxScore = providers.length + manualMethods.length;
    const currentScore = connectedCount + configuredManualCount;
    return { current: currentScore, max: maxScore, percent: Math.round((currentScore / maxScore) * 100) };
  }, [providers.length, manualMethods.length, connectedCount, configuredManualCount]);

  return (
    <BlockStack gap="600">
      {/* ═══════════════════════════════════════════════════════
          SECTION A — Payment Operations Command Center
          Top-level KPI bar + health indicator
          ═══════════════════════════════════════════════════════ */}
      <Card>
        <BlockStack gap="500">
          {/* Hero KPI Row */}
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <BlockStack gap="100">
              <Text variant="headingLg" as="h2">
                Centro de Pagos
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Gestiona proveedores, métodos y verificaciones de cobro
              </Text>
            </BlockStack>
            {loadingStatus ? (
              <Spinner size="small" />
            ) : (
              <InlineStack gap="300" blockAlign="center">
                <BlockStack gap="0">
                  <Text variant="headingXl" as="p" alignment="end">
                    {totalActiveCount}
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued" alignment="end">
                    métodos activos
                  </Text>
                </BlockStack>
                <Box
                  background={healthScore.percent >= 50 ? 'bg-fill-success' : 'bg-fill-caution'}
                  borderRadius="200"
                  padding="200"
                  minWidth="56px"
                >
                  <Text variant="headingSm" as="p" alignment="center" tone={healthScore.percent >= 50 ? 'text-inverse' : undefined}>
                    {healthScore.percent}%
                  </Text>
                </Box>
              </InlineStack>
            )}
          </InlineStack>

          <Divider />

          {/* Quick Status Matrix — All providers at a glance */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {providers.map((p) => (
              <Box
                key={p.name}
                padding="300"
                borderRadius="200"
                background={p.connected ? 'bg-surface-success' : 'bg-surface-secondary'}
                borderWidth="025"
                borderColor={p.connected ? 'border-success' : 'border'}
              >
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <BrandLogo name={p.name} size={24} />
                      <Text variant="bodySm" fontWeight="bold" as="span">
                        {p.name}
                      </Text>
                    </InlineStack>
                    <Icon source={p.connected ? CheckCircleIcon : XCircleIcon} tone={p.connected ? 'success' : 'subdued'} />
                  </InlineStack>
                  <Text variant="bodySm" as="span" tone="subdued">
                    {p.connected ? p.methods : 'Sin conectar'}
                  </Text>
                  <Badge size="small" tone={p.connected ? 'success' : undefined}>
                    {p.type}
                  </Badge>
                </BlockStack>
              </Box>
            ))}
          </div>

          <Divider />

          {/* Manual Methods Status Row */}
          <InlineStack gap="400" blockAlign="center" wrap>
            <InlineStack gap="100" blockAlign="center">
              <Icon source={CreditCardIcon} tone="subdued" />
              <Text variant="bodySm" fontWeight="semibold" as="span">
                Manuales:
              </Text>
            </InlineStack>
            {manualMethods.map((m) => (
              <Badge key={m.name} tone={m.configured ? 'success' : undefined} size="small">
                {`${m.name} ${m.configured ? '✓' : '—'}`}
              </Badge>
            ))}
            <Divider />
            <InlineStack gap="100" blockAlign="center">
              <Icon source={LockIcon} tone="subdued" />
              <Text variant="bodySm" as="span" tone="subdued">
                Siempre activos: Efectivo · Tarjeta manual · Transferencia · Fiado · Puntos
              </Text>
            </InlineStack>
          </InlineStack>
        </BlockStack>
      </Card>

      {/* ═══════════════════════════════════════════════════════
          SECTION B — Provider Integration Cards
          Collapsible cards with full connection flow
          ═══════════════════════════════════════════════════════ */}

      {/* ── B1: MercadoPago ── */}
      <Card>
        <BlockStack gap="400">
          <div
            onClick={() => toggleSection('mp')}
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSection('mp'); }}
          >
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="300" blockAlign="center">
                <BrandLogo name="Mercado Pago" size={28} />
                <BlockStack gap="0">
                  <Text variant="headingSm" as="h3">
                    Mercado Pago
                  </Text>
                  <Text variant="bodySm" as="span" tone="subdued">
                    OAuth 2.0 · Terminal Point · Tarjeta web · QR
                  </Text>
                </BlockStack>
              </InlineStack>
              <InlineStack gap="200" blockAlign="center">
                {loadingStatus ? (
                  <Spinner size="small" />
                ) : isConnected ? (
                  <Badge tone="success">Conectado</Badge>
                ) : mpConnection?.status === 'expired' ? (
                  <Badge tone="warning">Expirado</Badge>
                ) : (
                  <Badge>Pendiente</Badge>
                )}
                <Icon source={expandedSection === 'mp' ? ChevronUpIcon : ChevronDownIcon} tone="subdued" />
              </InlineStack>
            </InlineStack>
          </div>

          <Collapsible open={expandedSection === 'mp'} id="mp-collapsible">
            <Box paddingBlockStart="300">
              <BlockStack gap="400">
                <Divider />

                {oauthError && (
                  <Banner tone="critical" onDismiss={() => setOauthError(null)}>
                    <p>{oauthError}</p>
                  </Banner>
                )}

                {isConnected ? (
                  <BlockStack gap="400">
                    {/* Connection Details Card */}
                    <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <Text variant="bodySm" as="span" tone="subdued">Cuenta</Text>
                          <Text variant="bodyMd" fontWeight="semibold" as="span">
                            {mpConnection.email || 'Cuenta vinculada'}
                          </Text>
                        </InlineStack>
                        {mpConnection.expiresAt && (
                          <InlineStack align="space-between">
                            <Text variant="bodySm" as="span" tone="subdued">Tokens vigentes hasta</Text>
                            <Text variant="bodySm" as="span">{formatExpiryDate(mpConnection.expiresAt)}</Text>
                          </InlineStack>
                        )}
                        {mpConnection.publicKey && (
                          <InlineStack align="space-between">
                            <Text variant="bodySm" as="span" tone="subdued">Public Key</Text>
                            <Text variant="bodySm" as="span" tone="subdued">
                              {mpConnection.publicKey.slice(0, 20)}…
                            </Text>
                          </InlineStack>
                        )}
                      </BlockStack>
                    </Box>

                    <Checkbox
                      label="Procesar pagos con terminal Point"
                      checked={config.mpEnabled}
                      onChange={(v) => updateField('mpEnabled', v)}
                    />

                    {config.mpEnabled && (
                      <FormLayout>
                        <TextField
                          label="Device ID (Terminal física)"
                          value={config.mpDeviceId || ''}
                          onChange={(v) => updateField('mpDeviceId', v)}
                          autoComplete="off"
                          placeholder="Ej: PAX_A910__..."
                          helpText="ID del lector físico. Usa el botón descubrir para detectarlo."
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
                            <BlockStack gap="200">
                              <Text as="h3" variant="headingSm">Terminales detectadas:</Text>
                              {mpDevices.map((d) => (
                                <Box key={d.id} padding="200" background="bg-surface-secondary" borderRadius="200">
                                  <InlineStack align="space-between" blockAlign="center">
                                    <InlineStack gap="200" blockAlign="center">
                                      <Badge tone={d.id === (config.mpDeviceId || '') ? 'success' : 'info'} size="small">
                                        {d.id === (config.mpDeviceId || '') ? 'Enlazada' : 'Detectada'}
                                      </Badge>
                                      <Text as="p" variant="bodySm" fontWeight="medium">{d.id}</Text>
                                    </InlineStack>
                                    {d.id !== (config.mpDeviceId || '') && (
                                      <Button size="slim" onClick={() => updateField('mpDeviceId', d.id)}>
                                        Enlazar
                                      </Button>
                                    )}
                                  </InlineStack>
                                </Box>
                              ))}
                            </BlockStack>
                          </Box>
                        )}
                      </FormLayout>
                    )}

                    <Divider />
                    <Button tone="critical" variant="plain" onClick={() => setDisconnectModalOpen(true)}>
                      Desconectar cuenta
                    </Button>
                  </BlockStack>
                ) : mpConnection?.status === 'expired' ? (
                  <BlockStack gap="300">
                    <Banner tone="warning">
                      <p>Tu conexión con MercadoPago expiró. Reconecta para seguir procesando pagos.</p>
                    </Banner>
                    <Button variant="primary" onClick={handleConnect} loading={mpConnecting}>
                      Reconectar con MercadoPago
                    </Button>
                  </BlockStack>
                ) : (
                  <BlockStack gap="300">
                    <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                      <BlockStack gap="100">
                        <Text variant="bodySm" fontWeight="semibold" as="p">¿Qué se desbloquea?</Text>
                        <Text variant="bodySm" as="p" tone="subdued">
                          Terminal Point Smart (presencial) · Tarjeta web (e-commerce) · QR dinámico · Reembolsos automáticos
                        </Text>
                      </BlockStack>
                    </Box>
                    <Button variant="primary" onClick={handleConnect} loading={mpConnecting}>
                      Conectar con MercadoPago
                    </Button>
                  </BlockStack>
                )}
              </BlockStack>
            </Box>
          </Collapsible>
        </BlockStack>
      </Card>

      {/* ── B2: Clip ── */}
      <Card>
        <BlockStack gap="400">
          <div
            onClick={() => toggleSection('clip')}
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSection('clip'); }}
          >
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="300" blockAlign="center">
                <BrandLogo name="Clip" size={28} />
                <BlockStack gap="0">
                  <Text variant="headingSm" as="h3">
                    Clip
                  </Text>
                  <Text variant="bodySm" as="span" tone="subdued">
                    API Keys · Checkout link · Terminal PinPad
                  </Text>
                </BlockStack>
              </InlineStack>
              <InlineStack gap="200" blockAlign="center">
                {loadingStatus ? (
                  <Spinner size="small" />
                ) : clipStatus?.connected ? (
                  <Badge tone="success">{`Conectado (${clipStatus.environment ?? 'live'})`}</Badge>
                ) : (
                  <Badge>Pendiente</Badge>
                )}
                <Icon source={expandedSection === 'clip' ? ChevronUpIcon : ChevronDownIcon} tone="subdued" />
              </InlineStack>
            </InlineStack>
          </div>

          <Collapsible open={expandedSection === 'clip'} id="clip-collapsible">
            <Box paddingBlockStart="300">
              <BlockStack gap="400">
                <Divider />

                {clipError && (
                  <Banner tone="critical" onDismiss={() => setClipError(null)}>
                    <p>{clipError}</p>
                  </Banner>
                )}

                {clipStatus?.connected ? (
                  <BlockStack gap="300">
                    <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                      <BlockStack gap="200">
                        {clipStatus.apiKey && (
                          <InlineStack align="space-between">
                            <Text variant="bodySm" as="span" tone="subdued">API Key</Text>
                            <Text variant="bodySm" as="span" tone="subdued">{clipStatus.apiKey.slice(0, 12)}…</Text>
                          </InlineStack>
                        )}
                        {clipStatus.serialNumber && (
                          <InlineStack align="space-between">
                            <Text variant="bodySm" as="span" tone="subdued">Terminal</Text>
                            <Text variant="bodySm" as="span">{clipStatus.serialNumber}</Text>
                          </InlineStack>
                        )}
                      </BlockStack>
                    </Box>
                    <Divider />
                    <Button tone="critical" variant="plain" onClick={() => setClipDisconnectOpen(true)}>
                      Desconectar Clip
                    </Button>
                  </BlockStack>
                ) : (
                  <BlockStack gap="300">
                    <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                      <BlockStack gap="100">
                        <Text variant="bodySm" fontWeight="semibold" as="p">¿Qué se desbloquea?</Text>
                        <Text variant="bodySm" as="p" tone="subdued">
                          Link de pago Checkout (cobro remoto) · Terminal PinPad Total 3 (cobro presencial)
                        </Text>
                      </BlockStack>
                    </Box>
                    <FormLayout>
                      <InlineStack gap="300">
                        <Button size="slim" pressed={clipEnv === 'sandbox'} onClick={() => setClipEnv('sandbox')}>
                          Pruebas
                        </Button>
                        <Button size="slim" pressed={clipEnv === 'production'} onClick={() => setClipEnv('production')}>
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
                        helpText="Solo necesario para pagos presenciales con terminal PinPad."
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
            </Box>
          </Collapsible>
        </BlockStack>
      </Card>

      {/* ── Próximamente: Conekta & Stripe ── */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Próximamente</Text>
          <Text variant="bodySm" as="p" tone="subdued">
            Estamos trabajando en la integración completa de estos proveedores.
          </Text>
          <Divider />
          <InlineStack gap="400" wrap>
            <Box padding="300" borderRadius="200" background="bg-surface-secondary" minWidth="200px">
              <InlineStack gap="200" blockAlign="center">
                <div style={{ opacity: 0.5 }}><BrandLogo name="Conekta" size={24} /></div>
                <BlockStack gap="0">
                  <Text variant="bodySm" fontWeight="semibold" as="span">Conekta</Text>
                  <Text variant="bodySm" as="span" tone="subdued">SPEI automático · OXXO</Text>
                </BlockStack>
                <Badge size="small">Próximamente</Badge>
              </InlineStack>
            </Box>
            <Box padding="300" borderRadius="200" background="bg-surface-secondary" minWidth="200px">
              <InlineStack gap="200" blockAlign="center">
                <div style={{ opacity: 0.5 }}><BrandLogo name="Stripe" size={24} /></div>
                <BlockStack gap="0">
                  <Text variant="bodySm" fontWeight="semibold" as="span">Stripe México</Text>
                  <Text variant="bodySm" as="span" tone="subdued">SPEI automático · OXXO</Text>
                </BlockStack>
                <Badge size="small">Próximamente</Badge>
              </InlineStack>
            </Box>
          </InlineStack>
        </BlockStack>
      </Card>

      {/* ═══════════════════════════════════════════════════════
          SECTION C — Manual Payment Methods
          Compact annotated forms
          ═══════════════════════════════════════════════════════ */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Métodos Manuales
          </Text>
          <Text variant="bodySm" as="p" tone="subdued">
            Configura CLABE, PayPal o QR para mostrarlos al cajero durante el cobro.
            El cajero confirma el depósito manualmente.
          </Text>

          <Divider />

          {/* SPEI */}
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <BrandLogo name="SPEI" size={24} />
                <Text variant="headingSm" as="h3">SPEI (CLABE)</Text>
              </InlineStack>
              {clabeNumberField.value ? (
                <Badge tone="success" size="small">Configurado</Badge>
              ) : (
                <Badge size="small">Sin configurar</Badge>
              )}
            </InlineStack>
            <TextField
              label=""
              labelHidden
              value={clabeNumberField.value}
              onChange={clabeNumberField.onChange}
              error={clabeNumberField.error}
              autoComplete="off"
              placeholder="18 dígitos, ej: 012345678901234567"
              helpText="Se mostrará al cajero cuando seleccione SPEI."
              maxLength={18}
            />
            {(() => {
              const bank = getBankFromClabe(clabeNumberField.value);
              if (!bank) return null;
              return (
                <InlineStack gap="200" blockAlign="center">
                  <BrandLogo name={bank.name} size={20} />
                  <Badge tone="info" size="small">{bank.name}</Badge>
                </InlineStack>
              );
            })()}
          </BlockStack>

          <Divider />

          {/* PayPal */}
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <BrandLogo name="PayPal" size={24} />
                <Text variant="headingSm" as="h3">PayPal</Text>
              </InlineStack>
              {(paypalQrUrlField.value || paypalUsernameField.value) ? (
                <Badge tone="success" size="small">Configurado</Badge>
              ) : (
                <Badge size="small">Sin configurar</Badge>
              )}
            </InlineStack>

            {paypalQrUrlField.value ? (
              <Box padding="300" borderRadius="200" background="bg-surface-secondary">
                <InlineStack gap="400" blockAlign="center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={paypalQrUrlField.value}
                    alt="QR PayPal"
                    style={{ width: 100, height: 100, objectFit: 'contain', borderRadius: 8, border: '1px solid #e1e3e5' }}
                  />
                  <BlockStack gap="100">
                    <Badge tone="success" size="small">QR subido</Badge>
                    <Button
                      size="slim"
                      variant="plain"
                      tone="critical"
                      onClick={async () => {
                        await deleteFileFromUrl(paypalQrUrlField.value);
                        paypalQrUrlField.onChange('');
                      }}
                    >
                      Eliminar QR
                    </Button>
                  </BlockStack>
                </InlineStack>
              </Box>
            ) : (
              <DropZone
                accept="image/*"
                type="image"
                allowMultiple={false}
                variableHeight
                onDrop={async (_drop: File[], accepted: File[]) => {
                  const file = accepted[0];
                  if (!file) return;
                  try {
                    const path = `logos/payments/paypal-qr-${Date.now()}.${file.name.split('.').pop()}`;
                    const url = await uploadFile(file, path);
                    paypalQrUrlField.onChange(url);
                  } catch {
                    paypalQrUrlField.setError('Error al subir la imagen. Intenta de nuevo.');
                  }
                }}
              >
                <DropZone.FileUpload actionTitle="Subir QR de PayPal" actionHint="JPG o PNG (máx. 5MB)" />
              </DropZone>
            )}

            <TextField
              label="Usuario PayPal (opcional)"
              value={paypalUsernameField.value}
              onChange={paypalUsernameField.onChange}
              error={paypalUsernameField.error}
              autoComplete="off"
              placeholder="Ej: MiTienda"
              helpText="Se usará como respaldo para generar un enlace paypal.me/TuUsuario/monto."
              prefix="paypal.me/"
            />
          </BlockStack>

          <Divider />

          {/* QR de Cobro */}
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <BrandLogo name="CoDi" size={24} />
                <Text variant="headingSm" as="h3">QR de Cobro (CoDi / Banco)</Text>
              </InlineStack>
              {cobrarQrUrlField.value ? (
                <Badge tone="success" size="small">Configurado</Badge>
              ) : (
                <Badge size="small">Sin configurar</Badge>
              )}
            </InlineStack>

            {cobrarQrUrlField.value ? (
              <Box padding="300" borderRadius="200" background="bg-surface-secondary">
                <InlineStack gap="400" blockAlign="center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cobrarQrUrlField.value}
                    alt="QR de Cobro"
                    style={{ width: 100, height: 100, objectFit: 'contain', borderRadius: 8, border: '1px solid #e1e3e5' }}
                  />
                  <BlockStack gap="100">
                    <Badge tone="success" size="small">QR subido</Badge>
                    <Button
                      size="slim"
                      variant="plain"
                      tone="critical"
                      onClick={async () => {
                        await deleteFileFromUrl(cobrarQrUrlField.value);
                        cobrarQrUrlField.onChange('');
                      }}
                    >
                      Eliminar QR
                    </Button>
                  </BlockStack>
                </InlineStack>
              </Box>
            ) : (
              <DropZone
                accept="image/*"
                type="image"
                allowMultiple={false}
                variableHeight
                onDrop={async (_drop: File[], accepted: File[]) => {
                  const file = accepted[0];
                  if (!file) return;
                  try {
                    const path = `logos/payments/cobrar-qr-${Date.now()}.${file.name.split('.').pop()}`;
                    const url = await uploadFile(file, path);
                    cobrarQrUrlField.onChange(url);
                  } catch {
                    cobrarQrUrlField.setError('Error al subir la imagen. Intenta de nuevo.');
                  }
                }}
              >
                <DropZone.FileUpload actionTitle="Subir QR de Cobro" actionHint="JPG o PNG (máx. 5MB)" />
              </DropZone>
            )}
          </BlockStack>
        </BlockStack>
      </Card>

      {/* ═══════════════════════════════════════════════════════
          SECTION D — Disconnect Confirmation Modals
          ═══════════════════════════════════════════════════════ */}

      {/* MercadoPago Disconnect */}
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
        secondaryActions={[{ content: 'Cancelar', onAction: () => setDisconnectModalOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Banner tone="warning">
              <p>
                Se eliminarán los tokens de acceso. No podrás procesar pagos con MercadoPago hasta reconectar.
              </p>
            </Banner>
            {mpConnection?.email && (
              <Text variant="bodyMd" as="p">
                Cuenta: <Text as="span" fontWeight="semibold">{mpConnection.email}</Text>
              </Text>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Clip Disconnect */}
      <Modal
        open={clipDisconnectOpen}
        onClose={() => setClipDisconnectOpen(false)}
        title="Desconectar Clip"
        primaryAction={{ content: 'Desconectar', onAction: handleClipDisconnect, destructive: true }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setClipDisconnectOpen(false) }]}
      >
        <Modal.Section>
          <Banner tone="warning">
            <p>Se eliminarán las credenciales. Pagos con tarjeta vía Clip dejarán de funcionar.</p>
          </Banner>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
