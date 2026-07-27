'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  UnstyledButton,
} from '@shopify/polaris';
import {
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LockIcon,
  CreditCardIcon,
  GiftCardIcon,
  SettingsIcon,
  WalletIcon,
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
import { Badge as KumoBadge } from '@cloudflare/kumo/components/badge';
import { Button as KumoButton } from '@cloudflare/kumo/components/button';
import { Dialog } from '@cloudflare/kumo/components/dialog';
import { Input as KumoInput } from '@cloudflare/kumo/components/input';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Radio } from '@cloudflare/kumo/components/radio';
import { Text as KumoText } from '@cloudflare/kumo/components/text';
import './PaymentsSection.css';

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
  hasApiKey: boolean;
  serialNumber: string | null;
}

const EXTERNAL_PAYMENT_PROVIDERS = [
  // Norteamérica
  { name: 'Stripe', description: 'Estados Unidos y Canadá · Tarjetas, wallets y suscripciones', networks: ['Visa', 'Mastercard', 'American Express', 'Discover', 'Apple Pay', 'Google Pay'] },
  { name: 'PayPal', description: 'Norteamérica y Latinoamérica · PayPal y tarjetas', networks: ['Visa', 'Mastercard', 'American Express', 'PayPal'] },
  { name: 'Braintree', description: 'Estados Unidos y Canadá · Tarjetas, PayPal y wallets', networks: ['Visa', 'Mastercard', 'American Express', 'Discover', 'PayPal'] },
  { name: 'Authorize.net', description: 'Estados Unidos y Canadá · Gateway para tarjetas y eChecks', networks: ['Visa', 'Mastercard', 'American Express', 'Discover', 'JCB', 'Apple Pay'] },
  { name: 'Square', description: 'Estados Unidos y Canadá · Cobros presenciales y online', networks: ['Visa', 'Mastercard', 'American Express', 'Discover', 'Apple Pay', 'Google Pay'] },
  { name: 'Moneris', description: 'Canadá · Pagos presenciales y comercio electrónico', networks: ['Visa', 'Mastercard', 'American Express', 'Discover'] },

  // México
  { name: 'Mercado Pago', description: 'México y Latinoamérica · Tarjetas, SPEI, OXXO y wallet', networks: ['Visa', 'Mastercard', 'American Express', 'OXXO', 'Mercado Pago'] },
  { name: 'Conekta', description: 'México · Tarjetas, SPEI y efectivo', networks: ['Visa', 'Mastercard', 'American Express', 'OXXO'] },
  { name: 'Clip', description: 'México · Terminales, links de pago y tarjetas', networks: ['Visa', 'Mastercard', 'American Express', 'Clip'] },
  { name: 'Openpay', description: 'México y Latinoamérica · Tarjetas, transferencias y efectivo', networks: ['Visa', 'Mastercard', 'American Express', 'OXXO'] },

  // Latinoamérica regional
  { name: 'Kushki', description: 'Chile, Colombia, Ecuador, México y Perú · Adquirencia local', networks: ['Visa', 'Mastercard', 'American Express', 'Discover'] },
  { name: 'dLocal', description: 'Uruguay y mercados emergentes de Latinoamérica · Métodos locales', networks: ['Visa', 'Mastercard', 'American Express', 'Mercado Pago'] },
  { name: 'PayU Latam', description: 'Argentina, Brasil, Chile, Colombia, México, Panamá y Perú', networks: ['Visa', 'Mastercard', 'American Express', 'Efectivo'] },
  { name: 'EBANX', description: 'Brasil, México, Chile, Colombia, Perú y Argentina · Métodos locales', networks: ['Visa', 'Mastercard', 'American Express', 'Efectivo'] },
  { name: 'PagSeguro', description: 'Brasil · Tarjetas, Pix, boleto y wallets', networks: ['Visa', 'Mastercard', 'American Express', 'Elo'] },
  { name: 'PagBrasil', description: 'Brasil · Tarjetas, Pix y métodos locales', networks: ['Visa', 'Mastercard', 'American Express', 'Elo'] },
  { name: 'Transbank Webpay', description: 'Chile · Tarjetas y transferencias locales', networks: ['Visa', 'Mastercard', 'American Express'] },
  { name: 'PagoEfectivo', description: 'Perú · Efectivo, transferencias y tarjetas', networks: ['Visa', 'Mastercard', 'Efectivo'] },
  { name: 'Paymentez', description: 'Ecuador y Latinoamérica · Tarjetas y pagos locales', networks: ['Visa', 'Mastercard', 'American Express'] },
  { name: 'Tilopay', description: 'Centroamérica y Caribe · Tarjetas y pagos online', networks: ['Visa', 'Mastercard', 'American Express'] },
  { name: 'BAC Credomatic', description: 'Centroamérica · Tarjetas, links y cobros online', networks: ['Visa', 'Mastercard', 'American Express'] },
  { name: 'Klarna', description: 'Estados Unidos y Latinoamérica seleccionada · Compra ahora y paga después', networks: ['Visa', 'Mastercard'] },
] as const;

type PaymentCaptureMethod = NonNullable<StoreConfig['paymentCaptureMethod']>;
type ManualPaymentMethodId = 'spei' | 'codi' | 'terminal' | 'paypal';

const PAYMENT_CAPTURE_OPTIONS: Array<{
  value: PaymentCaptureMethod;
  label: string;
  description: string;
}> = [
  {
    value: 'payment_screen',
    label: 'Automáticamente en la pantalla de pago',
    description: 'Autoriza y captura el pago cuando el cajero confirma el cobro.',
  },
  {
    value: 'order_prepared',
    label: 'Automáticamente cuando se prepara el pedido',
    description: 'Autoriza primero y captura cuando todo el pedido queda preparado.',
  },
  {
    value: 'manual',
    label: 'Manualmente',
    description: 'El cajero autoriza y captura manualmente desde el flujo de venta.',
  },
];

const MANUAL_PAYMENT_METHODS: Array<{
  id: ManualPaymentMethodId;
  title: string;
  description: string;
  status: 'configured' | 'available';
}> = [
  {
    id: 'spei',
    title: 'SPEI',
    description: 'CLABE bancaria para transferencias verificadas manualmente.',
    status: 'available',
  },
  {
    id: 'codi',
    title: 'CoDi',
    description: 'QR bancario para cobros móviles con confirmación del cajero.',
    status: 'available',
  },
  {
    id: 'terminal',
    title: 'Terminal manual',
    description: 'Registra cobros hechos en una terminal externa sin proveedor integrado.',
    status: 'available',
  },
  {
    id: 'paypal',
    title: 'PayPal',
    description: 'QR o usuario PayPal para cobrar fuera del proveedor principal.',
    status: 'available',
  },
];

interface PaymentsSectionProps {
  config: StoreConfig;
  updateField: <K extends keyof StoreConfig>(field: K, value: StoreConfig[K]) => void;
  mpTesting: boolean;
  mpTestResult: { success: boolean; message: string } | null;
  mpDevices: { id: string; operating_mode: string }[];
  handleMPTest: () => void;
  clabeNumberField: Field<string>;
  paymentCaptureMethodField: Field<string>;
  paypalUsernameField: Field<string>;
  paypalQrUrlField: Field<string>;
  cobrarQrUrlField: Field<string>;
  savePatch: (patch: Partial<StoreConfig>) => Promise<void>;
  saving: boolean;
  showExternalProviders: boolean;
  showManualPaymentMethods: boolean;
  onExternalProvidersChange: (open: boolean) => void;
  onManualPaymentMethodsChange: (open: boolean) => void;
  onExternalProviderNameChange: (name: string | null) => void;
  onSubsectionTitleChange: (title: string | null) => void;
}

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
  paymentCaptureMethodField,
  paypalUsernameField,
  paypalQrUrlField,
  cobrarQrUrlField,
  savePatch,
  saving,
  showExternalProviders,
  showManualPaymentMethods,
  onExternalProvidersChange,
  onManualPaymentMethodsChange,
  onExternalProviderNameChange,
  onSubsectionTitleChange,
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

  useEffect(() => {
    if (!showExternalProviders) {
      setSelectedExternalProvider(null);
      onExternalProviderNameChange(null);
    }
  }, [showExternalProviders, onExternalProviderNameChange]);

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
    },
    {
      name: 'Clip',
      connected: clipStatus?.connected ?? false,
      methods: 'Checkout link · Terminal PinPad',
      type: 'API Keys' as const,
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
          hasApiKey: true,
          serialNumber: clipSerialNumber || null,
        });
        updateField('clipEnabled', true);
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
      setClipStatus({ connected: false, environment: null, hasApiKey: false, serialNumber: null });
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
  const [providerSearch, setProviderSearch] = useState('');
  const [activeManualMethod, setActiveManualMethod] = useState<ManualPaymentMethodId>('spei');
  const [manualPaymentError, setManualPaymentError] = useState<string | null>(null);
  const currentCaptureMethod = (paymentCaptureMethodField.value || 'payment_screen') as PaymentCaptureMethod;
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const [draftCaptureMethod, setDraftCaptureMethod] = useState<PaymentCaptureMethod>(currentCaptureMethod);
  const [selectedExternalProvider, setSelectedExternalProvider] = useState<(typeof EXTERNAL_PAYMENT_PROVIDERS)[number] | null>(null);
  const paypalQrInputRef = useRef<HTMLInputElement | null>(null);
  const cobrarQrInputRef = useRef<HTMLInputElement | null>(null);
  const toggleSection = useCallback(
    (id: string) => setExpandedSection((prev) => (prev === id ? null : id)),
    [],
  );

  useEffect(() => {
    setDraftCaptureMethod(currentCaptureMethod);
  }, [currentCaptureMethod]);

  // ── Health score ──
  const healthScore = useMemo(() => {
    const maxScore = providers.length + manualMethods.length;
    const currentScore = connectedCount + configuredManualCount;
    return { current: currentScore, max: maxScore, percent: Math.round((currentScore / maxScore) * 100) };
  }, [providers.length, manualMethods.length, connectedCount, configuredManualCount]);

  const revealAdvancedDetails = useCallback((section: string, targetId?: string) => {
    setExpandedSection(section);
    if (targetId) {
      window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }, []);

  const openManualMethods = useCallback(() => {
    onManualPaymentMethodsChange(true);
    onSubsectionTitleChange('Formas de pago manuales');
    onExternalProvidersChange(false);
  }, [onExternalProvidersChange, onManualPaymentMethodsChange, onSubsectionTitleChange]);

  const closeManualMethods = useCallback(() => {
    onManualPaymentMethodsChange(false);
    onSubsectionTitleChange(null);
  }, [onManualPaymentMethodsChange, onSubsectionTitleChange]);

  const saveCaptureMethod = useCallback(async () => {
    paymentCaptureMethodField.onChange(draftCaptureMethod);
    updateField('paymentCaptureMethod', draftCaptureMethod);
    await savePatch({ paymentCaptureMethod: draftCaptureMethod });
    setCaptureDialogOpen(false);
  }, [draftCaptureMethod, paymentCaptureMethodField, savePatch, updateField]);

  const saveManualPaymentMethods = useCallback(async () => {
    setManualPaymentError(null);
    try {
      await savePatch({
        clabeNumber: clabeNumberField.value,
        paypalUsername: paypalUsernameField.value,
        paypalQrUrl: paypalQrUrlField.value,
        cobrarQrUrl: cobrarQrUrlField.value,
      });
    } catch {
      setManualPaymentError('No fue posible guardar la configuración de pagos manuales.');
    }
  }, [
    clabeNumberField.value,
    cobrarQrUrlField.value,
    paypalQrUrlField.value,
    paypalUsernameField.value,
    savePatch,
  ]);

  const uploadPaymentQr = useCallback(async (target: 'paypal' | 'codi', file: File | null) => {
    if (!file) return;
    setManualPaymentError(null);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `logos/payments/${target}-qr-${Date.now()}.${extension}`;
      const url = await uploadFile(file, path);
      if (target === 'paypal') {
        paypalQrUrlField.onChange(url);
        await savePatch({ paypalQrUrl: url });
        return;
      }
      cobrarQrUrlField.onChange(url);
      await savePatch({ cobrarQrUrl: url });
    } catch {
      setManualPaymentError('No fue posible subir el QR. Intenta de nuevo.');
    }
  }, [cobrarQrUrlField, paypalQrUrlField, savePatch]);

  const removePaymentQr = useCallback(async (target: 'paypal' | 'codi') => {
    setManualPaymentError(null);
    try {
      if (target === 'paypal') {
        if (paypalQrUrlField.value) await deleteFileFromUrl(paypalQrUrlField.value);
        paypalQrUrlField.onChange('');
        await savePatch({ paypalQrUrl: '' });
        return;
      }
      if (cobrarQrUrlField.value) await deleteFileFromUrl(cobrarQrUrlField.value);
      cobrarQrUrlField.onChange('');
      await savePatch({ cobrarQrUrl: '' });
    } catch {
      setManualPaymentError('No fue posible quitar el QR. Intenta de nuevo.');
    }
  }, [cobrarQrUrlField, paypalQrUrlField, savePatch]);

  const visibleExternalProviders = useMemo(() => {
    const query = providerSearch.trim().toLocaleLowerCase('es-MX');
    if (!query) return EXTERNAL_PAYMENT_PROVIDERS;
    return EXTERNAL_PAYMENT_PROVIDERS.filter((provider) =>
      `${provider.name} ${provider.description}`.toLocaleLowerCase('es-MX').includes(query),
    );
  }, [providerSearch]);

  const providerDetail = selectedExternalProvider
    ? {
        coverage: selectedExternalProvider.description.split(' · ')[0] || 'América y Latinoamérica',
        summary: selectedExternalProvider.description.split(' · ').slice(1).join(' · ') || 'Procesamiento de pagos para comercios.',
        methods: selectedExternalProvider.networks.length > 0
          ? selectedExternalProvider.networks.join(', ')
          : 'Configuración del proveedor pendiente',
      }
    : null;

  if (showManualPaymentMethods) {
    const bank = getBankFromClabe(clabeNumberField.value || '');
    const isPaypalConfigured = Boolean(paypalUsernameField.value || paypalQrUrlField.value);
    const isCodiConfigured = Boolean(cobrarQrUrlField.value);
    const isSpeiConfigured = Boolean(clabeNumberField.value && clabeNumberField.value.length === 18);

    const manualMethodStatus: Record<ManualPaymentMethodId, boolean> = {
      spei: isSpeiConfigured,
      codi: isCodiConfigured,
      terminal: true,
      paypal: isPaypalConfigured,
    };

    const manualPanel = (() => {
      switch (activeManualMethod) {
        case 'spei':
          return (
            <div className="payments-manual-panel-content">
              <div className="payments-manual-panel-header">
                <div>
                  <KumoText bold as="h3">Transferencia SPEI</KumoText>
                  <KumoText variant="secondary" size="sm" as="p">
                    Guarda la CLABE de recepción para mostrarla al confirmar ventas por transferencia.
                  </KumoText>
                </div>
                <KumoBadge variant={isSpeiConfigured ? 'success' : 'warning'}>
                  {isSpeiConfigured ? 'Configurado' : 'Pendiente'}
                </KumoBadge>
              </div>
              <KumoInput
                label="CLABE interbancaria"
                value={clabeNumberField.value}
                onChange={(event) => clabeNumberField.onChange(event.currentTarget.value.replace(/\D/g, '').slice(0, 18))}
                inputMode="numeric"
                maxLength={18}
                placeholder="18 dígitos"
                description={bank ? `Banco detectado: ${bank.name}` : 'Se valida el banco cuando captures los primeros 3 dígitos.'}
              />
              <div className="payments-manual-actions">
                <KumoButton variant="primary" size="sm" onClick={saveManualPaymentMethods} loading={saving}>
                  Guardar SPEI
                </KumoButton>
              </div>
            </div>
          );
        case 'codi':
          return (
            <div className="payments-manual-panel-content">
              <div className="payments-manual-panel-header">
                <div>
                  <KumoText bold as="h3">CoDi</KumoText>
                  <KumoText variant="secondary" size="sm" as="p">
                    Sube el QR bancario que usará el cajero para cobrar con confirmación manual.
                  </KumoText>
                </div>
                <KumoBadge variant={isCodiConfigured ? 'success' : 'warning'}>
                  {isCodiConfigured ? 'Configurado' : 'Pendiente'}
                </KumoBadge>
              </div>
              <input
                ref={cobrarQrInputRef}
                className="payments-hidden-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => void uploadPaymentQr('codi', event.currentTarget.files?.[0] ?? null)}
              />
              <div className="payments-qr-box">
                {cobrarQrUrlField.value ? (
                  <img src={cobrarQrUrlField.value} alt="QR CoDi configurado" />
                ) : (
                  <KumoText variant="secondary" size="sm" as="p">Sin QR configurado</KumoText>
                )}
              </div>
              <div className="payments-manual-actions">
                <KumoButton variant="secondary" size="sm" onClick={() => cobrarQrInputRef.current?.click()}>
                  Subir QR CoDi
                </KumoButton>
                {cobrarQrUrlField.value && (
                  <KumoButton variant="secondary-destructive" size="sm" onClick={() => void removePaymentQr('codi')} loading={saving}>
                    Quitar QR
                  </KumoButton>
                )}
              </div>
            </div>
          );
        case 'terminal':
          return (
            <div className="payments-manual-panel-content">
              <div className="payments-manual-panel-header">
                <div>
                  <KumoText bold as="h3">Terminal manual</KumoText>
                  <KumoText variant="secondary" size="sm" as="p">
                    Permite registrar pagos hechos en una terminal externa y conciliarlos dentro de la venta.
                  </KumoText>
                </div>
                <KumoBadge variant="success">Disponible</KumoBadge>
              </div>
              <div className="payments-method-note">
                <KumoText bold as="p">Operación controlada desde caja</KumoText>
                <KumoText variant="secondary" size="sm" as="p">
                  El cajero selecciona tarjeta manual, captura referencia o últimos dígitos y el pago queda auditado en el ticket.
                </KumoText>
              </div>
            </div>
          );
        case 'paypal':
          return (
            <div className="payments-manual-panel-content">
              <div className="payments-manual-panel-header">
                <div>
                  <KumoText bold as="h3">PayPal QR</KumoText>
                  <KumoText variant="secondary" size="sm" as="p">
                    Configura el usuario o QR de PayPal para cobros manuales fuera del proveedor principal.
                  </KumoText>
                </div>
                <KumoBadge variant={isPaypalConfigured ? 'success' : 'warning'}>
                  {isPaypalConfigured ? 'Configurado' : 'Pendiente'}
                </KumoBadge>
              </div>
              <KumoInput
                label="Usuario o correo de PayPal"
                value={paypalUsernameField.value}
                onChange={(event) => paypalUsernameField.onChange(event.currentTarget.value.trim())}
                placeholder="pagos@negocio.com"
              />
              <input
                ref={paypalQrInputRef}
                className="payments-hidden-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => void uploadPaymentQr('paypal', event.currentTarget.files?.[0] ?? null)}
              />
              <div className="payments-qr-box">
                {paypalQrUrlField.value ? (
                  <img src={paypalQrUrlField.value} alt="QR PayPal configurado" />
                ) : (
                  <KumoText variant="secondary" size="sm" as="p">Sin QR configurado</KumoText>
                )}
              </div>
              <div className="payments-manual-actions">
                <KumoButton variant="primary" size="sm" onClick={saveManualPaymentMethods} loading={saving}>
                  Guardar PayPal
                </KumoButton>
                <KumoButton variant="secondary" size="sm" onClick={() => paypalQrInputRef.current?.click()}>
                  Subir QR PayPal
                </KumoButton>
                {paypalQrUrlField.value && (
                  <KumoButton variant="secondary-destructive" size="sm" onClick={() => void removePaymentQr('paypal')} loading={saving}>
                    Quitar QR
                  </KumoButton>
                )}
              </div>
            </div>
          );
      }
    })();

    return (
      <div className="payments-manual-view">
        <LayerCard className="payments-manual-card">
          <LayerCard.Secondary className="payments-manual-card-header">
            <div>
              <KumoText bold as="h2">Formas de pago manuales</KumoText>
              <KumoText variant="secondary" size="sm" as="p">
                Configura métodos que se cobran fuera de un proveedor integrado y se verifican dentro de caja.
              </KumoText>
            </div>
            <KumoButton variant="ghost" size="sm" onClick={closeManualMethods}>
              Volver
            </KumoButton>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            {manualPaymentError && (
              <div className="payments-manual-error" role="alert">
                <KumoText as="p">{manualPaymentError}</KumoText>
              </div>
            )}
            <div className="payments-manual-grid">
              <div className="payments-manual-nav" role="list" aria-label="Métodos manuales disponibles">
                {MANUAL_PAYMENT_METHODS.map((method) => (
                  <KumoButton
                    key={method.id}
                    variant="ghost"
                    className={`payments-manual-option${activeManualMethod === method.id ? ' payments-manual-option--active' : ''}`}
                    onClick={() => setActiveManualMethod(method.id)}
                    aria-current={activeManualMethod === method.id ? 'page' : undefined}
                  >
                    <span>
                      <strong>{method.title}</strong>
                      <small>{method.description}</small>
                    </span>
                    <KumoBadge variant={manualMethodStatus[method.id] ? 'success' : 'secondary'}>
                      {manualMethodStatus[method.id] ? 'Listo' : 'Configurar'}
                    </KumoBadge>
                  </KumoButton>
                ))}
              </div>
              <div className="payments-manual-panel">{manualPanel}</div>
            </div>
          </LayerCard.Primary>
        </LayerCard>
      </div>
    );
  }

  if (showExternalProviders) {
    if (selectedExternalProvider && providerDetail) {
      return (
        <div className="payments-external-providers payments-external-providers--detail">
          <div className="payments-provider-detail-view">
            <div className="payments-provider-detail-header">
              <div className="payments-provider-detail-titlebar">
                <nav className="payments-provider-breadcrumb" aria-label="Ruta del proveedor de pago">
                  <Icon source={CreditCardIcon} tone="subdued" />
                  <span className="payments-provider-breadcrumb-separator" aria-hidden="true">›</span>
                  <UnstyledButton
                    className="payments-provider-breadcrumb-link"
                    onClick={() => {
                      setSelectedExternalProvider(null);
                      onExternalProviderNameChange(null);
                    }}
                  >
                    Proveedores
                  </UnstyledButton>
                  <span className="payments-provider-breadcrumb-separator" aria-hidden="true">›</span>
                  <Text as="h2" variant="headingMd" fontWeight="semibold">
                    {selectedExternalProvider.name}
                  </Text>
                </nav>

                <div className="payments-provider-detail-actions">
                  <KumoButton variant="outline" size="sm" disabled>
                    Contactar al proveedor
                  </KumoButton>
                  <KumoButton variant="primary" size="sm" disabled>
                    Instalar
                  </KumoButton>
                </div>
              </div>
              <KumoText variant="secondary" size="sm" as="p">Compatible con 3DS</KumoText>
            </div>

            <LayerCard className="payments-provider-detail-card payments-provider-about-card">
              <div className="payments-provider-about-header">
                <KumoText bold as="h2">Acerca de {selectedExternalProvider.name}</KumoText>
                <Icon source={ChevronUpIcon} tone="subdued" />
              </div>
              <KumoText as="p">
                {selectedExternalProvider.name} permite aceptar pagos para comercios de {providerDetail.coverage.toLowerCase()}.
                Procesa {providerDetail.methods} y mantiene el control del flujo de pago dentro de la operación del negocio.
                La disponibilidad final depende del país, cuenta y validación del proveedor.
              </KumoText>
            </LayerCard>
          </div>
        </div>
      );
    }

    return (
      <div className="payments-external-providers">
        <LayerCard className="payments-external-list-card">
          <div className="payments-external-toolbar">
            <KumoInput
              size="sm"
              value={providerSearch}
              onChange={(event) => setProviderSearch(event.currentTarget.value)}
              placeholder="Filtrar proveedores de pagos externos"
              aria-label="Filtrar proveedores de pagos externos"
              className="payments-external-input"
            />
            <KumoButton
              variant="outline"
              size="sm"
              className="payments-external-filter"
              aria-label="Filtrar proveedores"
              title="Filtrar proveedores"
            >
              Filtros
            </KumoButton>
          </div>

          <div className="payments-external-list" role="list">
            {visibleExternalProviders.map((provider) => (
              <div key={provider.name} role="listitem" className="payments-external-list-item">
                <KumoButton
                  variant="ghost"
                  className="payments-external-row"
                  aria-label={`Ver detalles de ${provider.name}`}
                  onClick={() => {
                    setSelectedExternalProvider(provider);
                    onExternalProviderNameChange(provider.name);
                  }}
                >
                  <span className="payments-external-row-content">
                    <span className="payments-external-row-copy">
                      <strong>{provider.name}</strong>
                      {provider.description && <small>{provider.description}</small>}
                    </span>
                    <span className="payments-external-row-footer">
                      <span className="payments-network-list" aria-hidden="true">
                        {provider.networks.map((network) => <BrandLogo key={network} name={network} size={24} />)}
                      </span>
                      <span className="payments-external-row-chevron" aria-hidden="true">
                        ›
                      </span>
                    </span>
                  </span>
                </KumoButton>
              </div>
            ))}
            {visibleExternalProviders.length === 0 && (
              <div className="payments-external-empty">
                <KumoText variant="secondary" size="sm" as="p">
                  No se encontraron proveedores.
                </KumoText>
              </div>
            )}
          </div>
        </LayerCard>
      </div>
    );
  }

  return (
    <BlockStack gap="600">
      <div className="payments-reference-layout">
        <LayerCard className="payments-kumo-card payments-primary-provider-card">
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center" wrap={false}>
              <BlockStack gap="050">
                <KumoText bold as="h2">Procesamiento integrado</KumoText>
                <KumoText variant="secondary" size="sm" as="p">Sin cargos adicionales por transacción</KumoText>
                <KumoText variant="secondary" size="sm" as="p">Tarifas del proveedor según el método de pago</KumoText>
              </BlockStack>
              <InlineStack gap="200" blockAlign="center" wrap={false}>
                <KumoButton variant="outline" size="sm" onClick={() => revealAdvancedDetails('mp', 'payments-mercado-pago')}>
                  Más información
                </KumoButton>
                <KumoButton variant="primary" size="sm" onClick={() => revealAdvancedDetails('mp', 'payments-mercado-pago')}>
                  Completar configuración
                </KumoButton>
              </InlineStack>
            </InlineStack>

            <div className="payments-primary-benefits">
              <KumoText bold as="p">Configura tu proveedor de pagos para empezar a cobrar</KumoText>
              <KumoText variant="secondary" size="sm" as="p">Acepta tarjetas, transferencias y pagos con terminal desde el mismo flujo de venta.</KumoText>
              <ul>
                <li>Conecta una cuenta autorizada</li>
                <li>Consulta el estado de tus terminales</li>
                <li>Gestiona reembolsos desde la operación</li>
              </ul>
            </div>

            <InlineStack align="space-between" blockAlign="center" wrap>
              <InlineStack gap="200" blockAlign="center">
                <Icon source={CreditCardIcon} tone="subdued" />
                <KumoText bold as="span">Formas de pago disponibles</KumoText>
              </InlineStack>
              <InlineStack gap="200" blockAlign="center" wrap={false}>
                <BrandLogo name="Visa" size={30} />
                <BrandLogo name="Mastercard" size={30} />
                <BrandLogo name="Apple Pay" size={30} />
                <BrandLogo name="Google Pay" size={30} />
                <BrandLogo name="PayPal" size={30} />
              </InlineStack>
            </InlineStack>
          </BlockStack>
          <div className="payments-provider-footer">
            <KumoButton variant="ghost" size="sm" onClick={() => onExternalProvidersChange(true)}>
              Ver todos los demás proveedores
            </KumoButton>
          </div>
        </LayerCard>

        <LayerCard className="payments-kumo-card">
          <BlockStack gap="300">
            <BlockStack gap="100">
              <KumoText variant="heading3" as="h2">Proveedores de pago</KumoText>
              <KumoText variant="secondary" size="sm" as="p">
                Conecta y administra los servicios que usarás para recibir pagos.
              </KumoText>
            </BlockStack>

            <Box padding="300" borderWidth="025" borderColor="border" borderRadius="200">
              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <InlineStack gap="200" blockAlign="center" wrap={false}>
                  <BrandLogo name="Mercado Pago" size={30} />
                  <BlockStack gap="050">
                    <KumoText bold as="p">Mercado Pago</KumoText>
                    <KumoText variant="secondary" size="sm" as="p">Terminal Point, tarjeta web y QR.</KumoText>
                  </BlockStack>
                </InlineStack>
                <InlineStack gap="200" blockAlign="center" wrap={false}>
                  <KumoBadge variant={isConnected ? 'success' : 'warning'}>{isConnected ? 'Conectado' : 'Sin configurar'}</KumoBadge>
                  <KumoButton variant="ghost" size="sm" onClick={() => revealAdvancedDetails('mp', 'payments-mercado-pago')}>
                    Configurar
                  </KumoButton>
                </InlineStack>
              </InlineStack>
            </Box>

            <Box padding="300" borderWidth="025" borderColor="border" borderRadius="200">
              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <InlineStack gap="200" blockAlign="center" wrap={false}>
                  <BrandLogo name="PayPal" size={30} />
                  <BlockStack gap="050">
                    <KumoText bold as="p">PayPal</KumoText>
                    <KumoText variant="secondary" size="sm" as="p">Cobros mediante enlace y QR configurado por negocio.</KumoText>
                  </BlockStack>
                </InlineStack>
                <InlineStack gap="200" blockAlign="center" wrap={false}>
                  <KumoBadge variant={paypalQrUrlField.value || paypalUsernameField.value ? 'success' : 'info'}>
                    {paypalQrUrlField.value || paypalUsernameField.value ? 'Configurado' : 'Configuración incompleta'}
                  </KumoBadge>
                  <KumoButton variant="ghost" size="sm" onClick={openManualMethods} aria-label="Configurar PayPal">
                    Ver
                  </KumoButton>
                </InlineStack>
              </InlineStack>
              {!paypalQrUrlField.value && !paypalUsernameField.value && (
                <div className="payments-kumo-info" role="status">
                  <Icon source={CreditCardIcon} tone="subdued" />
                  <KumoText variant="secondary" size="sm" as="p">Completa los datos de PayPal para empezar a recibir pagos.</KumoText>
                </div>
              )}
            </Box>

            <KumoButton variant="ghost" size="sm" onClick={() => revealAdvancedDetails('clip', 'payments-clip')}>
              + Agregar proveedor de pagos
            </KumoButton>
          </BlockStack>
        </LayerCard>

        <LayerCard className="payments-settings-card">
          <LayerCard.Secondary>Configuración de pagos</LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="payments-settings-list">
              <KumoButton
                variant="ghost"
                className="payments-settings-row"
                onClick={() => setCaptureDialogOpen(true)}
              >
                <span className="payments-settings-row-icon" aria-hidden="true">
                  <Icon source={CreditCardIcon} tone="subdued" />
                </span>
                <span className="payments-settings-row-copy">
                  <strong>Método de captura de pago</strong>
                  <small>{PAYMENT_CAPTURE_OPTIONS.find((option) => option.value === currentCaptureMethod)?.label}</small>
                </span>
                <span className="payments-settings-row-action" aria-hidden="true">›</span>
              </KumoButton>

              <KumoButton
                variant="ghost"
                className="payments-settings-row"
                onClick={openManualMethods}
              >
                <span className="payments-settings-row-icon" aria-hidden="true">
                  <Icon source={CreditCardIcon} tone="subdued" />
                </span>
                <span className="payments-settings-row-copy">
                  <strong>Formas de pago manuales</strong>
                  <small>SPEI, CoDi, terminal externa y PayPal QR</small>
                </span>
                <span className="payments-settings-row-action" aria-hidden="true">›</span>
              </KumoButton>

              <KumoButton
                variant="ghost"
                className="payments-settings-row"
                onClick={openManualMethods}
              >
                <span className="payments-settings-row-icon" aria-hidden="true">
                  <Icon source={SettingsIcon} tone="subdued" />
                </span>
                <span className="payments-settings-row-copy">
                  <strong>Personalizaciones de las formas de pago</strong>
                  <small>Define cómo se muestran los métodos en caja</small>
                </span>
                <span className="payments-settings-row-action" aria-hidden="true">›</span>
              </KumoButton>

              <div className="payments-settings-row payments-settings-row--disabled" aria-disabled="true">
                <span className="payments-settings-row-icon" aria-hidden="true">
                  <Icon source={GiftCardIcon} tone="subdued" />
                </span>
                <span className="payments-settings-row-copy">
                  <strong>Vencimiento de la tarjeta de regalo</strong>
                  <small>Disponible en una fase posterior</small>
                </span>
                <KumoBadge variant="secondary">Próximamente</KumoBadge>
              </div>

              <div className="payments-settings-row payments-settings-row--disabled" aria-disabled="true">
                <span className="payments-settings-row-icon" aria-hidden="true">
                  <Icon source={WalletIcon} tone="subdued" />
                </span>
                <span className="payments-settings-row-copy">
                  <strong>Pases de Apple Wallet</strong>
                  <small>Disponible en una fase posterior</small>
                </span>
                <KumoBadge variant="secondary">Próximamente</KumoBadge>
              </div>
            </div>
          </LayerCard.Primary>
        </LayerCard>
      </div>

      <Dialog.Root open={captureDialogOpen} onOpenChange={setCaptureDialogOpen}>
        <Dialog size="lg" className="payments-capture-dialog">
          <div className="payments-dialog-header">
            <Dialog.Title>Método de captura de pago</Dialog.Title>
            <KumoButton
              variant="ghost"
              size="sm"
              onClick={() => setCaptureDialogOpen(false)}
              aria-label="Cerrar método de captura de pago"
            >
              Cerrar
            </KumoButton>
          </div>
          <Dialog.Description className="payments-dialog-description">
            Los pagos se autorizan cuando se realiza una venta. Selecciona cuándo se capturan para mantener el flujo de caja controlado.
          </Dialog.Description>
          <Radio.Group<PaymentCaptureMethod>
            legend="Opciones de captura"
            appearance="card"
            value={draftCaptureMethod}
            onValueChange={(value) => setDraftCaptureMethod(value)}
            className="payments-capture-options"
          >
            {PAYMENT_CAPTURE_OPTIONS.map((option) => (
              <Radio.Item<PaymentCaptureMethod>
                key={option.value}
                value={option.value}
                label={option.label}
                description={option.description}
              />
            ))}
          </Radio.Group>
          <div className="payments-dialog-actions">
            <KumoButton variant="secondary" size="sm" onClick={() => setCaptureDialogOpen(false)}>
              Cancelar
            </KumoButton>
            <KumoButton
              variant="primary"
              size="sm"
              onClick={() => void saveCaptureMethod()}
              loading={saving}
              disabled={saving || draftCaptureMethod === currentCaptureMethod}
            >
              Guardar
            </KumoButton>
          </div>
        </Dialog>
      </Dialog.Root>

      {expandedSection && (
        <div className="payments-advanced-details">
      {/* ═══════════════════════════════════════════════════════
          SECTION A — Payment Operations Command Center
          Top-level KPI bar + health indicator
          ═══════════════════════════════════════════════════════ */}
      <Card className="payments-command-card">
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
      <Card id="payments-mercado-pago">
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
      <Card id="payments-clip">
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
                        {clipStatus.hasApiKey && (
                          <InlineStack align="space-between">
                            <Text variant="bodySm" as="span" tone="subdued">API Key</Text>
                            <Text variant="bodySm" as="span" tone="subdued">Configurada</Text>
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
      <Card id="payments-manual-methods">
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

        </div>
      )}

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
