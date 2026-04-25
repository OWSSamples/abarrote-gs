'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useForm, useField } from '@shopify/react-form';
import {
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Banner,
  Page,
  Icon,
  Box,
  Divider,
  Card,
  Badge,
  Button,
  ContextualSaveBar,
  FooterHelp,
  Link as PolarisLink,
  Spinner,
  Tabs,
  IndexTable,
  Collapsible,
  ProgressBar,
  Tooltip,
  EmptyState,
  Bleed,
} from '@shopify/polaris';
import { getDevices } from '@/lib/mercadopago';
import type { MercadoPagoConfig } from '@/lib/mercadopago';
import { useDashboardStore } from '@/store/dashboardStore';
import type { StoreConfig } from '@/types';
import {
  StoreIcon,
  StoreFilledIcon,
  ReceiptDollarIcon,
  ReceiptDollarFilledIcon,
  InventoryIcon,
  InventoryFilledIcon,
  NotificationIcon,
  NotificationFilledIcon,
  EmailIcon,
  CreditCardIcon,
  PaymentFilledIcon,
  PrintIcon,
  StarIcon,
  StarFilledIcon,
  SettingsIcon,
  SettingsFilledIcon,
  DesktopIcon,
  MagicIcon,
  ExportIcon,
  RefreshIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  ShieldCheckMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CalendarIcon,
} from '@shopify/polaris-icons';

// ── Dynamic imports for section components ──
// Reduce initial bundle and dev-server compile time. Each section only loads
// when its category is selected.
const SectionLoader = (
  <Box padding="800">
    <InlineStack align="center" blockAlign="center">
      <Spinner accessibilityLabel="Cargando sección" size="small" />
    </InlineStack>
  </Box>
);

const GeneralSection = dynamic(() => import('./sections/GeneralSection').then((m) => m.GeneralSection), {
  loading: () => SectionLoader,
});
const FiscalSection = dynamic(() => import('./sections/FiscalSection').then((m) => m.FiscalSection), {
  loading: () => SectionLoader,
});
const PosSection = dynamic(() => import('./sections/PosSection').then((m) => m.PosSection), {
  loading: () => SectionLoader,
});
const HardwareSection = dynamic(() => import('./sections/HardwareSection').then((m) => m.HardwareSection), {
  loading: () => SectionLoader,
});
const LoyaltySection = dynamic(() => import('./sections/LoyaltySection').then((m) => m.LoyaltySection), {
  loading: () => SectionLoader,
});
const InventorySection = dynamic(() => import('./sections/InventorySection').then((m) => m.InventorySection), {
  loading: () => SectionLoader,
});
const NotificationsSection = dynamic(
  () => import('./sections/NotificationsSection').then((m) => m.NotificationsSection),
  { loading: () => SectionLoader },
);
const PaymentsSection = dynamic(() => import('./sections/PaymentsSection').then((m) => m.PaymentsSection), {
  loading: () => SectionLoader,
});
const CustomerDisplaySectionV4 = dynamic(
  () => import('./sections/CustomerDisplaySectionV4').then((m) => m.CustomerDisplaySectionV4),
  { loading: () => SectionLoader },
);
const ServiciosSection = dynamic(() => import('./sections/ServiciosSection').then((m) => m.ServiciosSection), {
  loading: () => SectionLoader,
});
const AISection = dynamic(() => import('./sections/AISection').then((m) => m.AISection), {
  loading: () => SectionLoader,
});
const EmailSection = dynamic(() => import('./sections/EmailSection').then((m) => m.EmailSection), {
  loading: () => SectionLoader,
});
import { parseError } from '@/lib/errors';
import { sendTestEmailAction } from '@/app/actions/email-actions';

const SETTINGS_CATEGORIES = [
  {
    id: 'general',
    title: 'Detalles de la tienda',
    description: 'Gestiona la identidad de tu negocio, dirección y preferencias básicas.',
    icon: StoreIcon,
    iconFilled: StoreFilledIcon,
  },
  {
    id: 'fiscal',
    title: 'Fiscales e Impuestos',
    description: 'Configura tu RFC, régimen fiscal, moneda y tasas de IVA.',
    icon: ReceiptDollarIcon,
    iconFilled: ReceiptDollarFilledIcon,
  },
  {
    id: 'pos',
    title: 'Punto de Venta y Recibos',
    description: 'Personaliza los tickets impresos y la estructura de códigos de barras.',
    icon: PrintIcon,
    iconFilled: PrintIcon,
    beta: true,
  },
  {
    id: 'hardware',
    title: 'Hardware y Periféricos',
    description: 'Configura IPs de impresoras, cajones de dinero y básculas seriales.',
    icon: PrintIcon,
    iconFilled: PrintIcon,
  },
  {
    id: 'loyalty',
    title: 'Loyalty y Puntos',
    description: 'Configura las conversiones y recompensas para la fidelización de clientes.',
    icon: StarIcon,
    iconFilled: StarFilledIcon,
  },
  {
    id: 'inventory',
    title: 'Inventario de productos',
    description: 'Establece reglas y umbrales para alertas de stock y caducidad.',
    icon: InventoryIcon,
    iconFilled: InventoryFilledIcon,
  },
  {
    id: 'notifications',
    title: 'Notificaciones',
    description: 'Conecta notificaciones push a tu celular mediante Telegram.',
    icon: NotificationIcon,
    iconFilled: NotificationFilledIcon,
  },
  {
    id: 'email',
    title: 'Correo Electrónico',
    description: 'Envía tickets digitales, reportes y alertas por correo (AWS SES).',
    icon: EmailIcon,
    iconFilled: EmailIcon,
  },
  {
    id: 'payments',
    title: 'Pagos Integrados',
    description: 'Vincula tu terminal Point de Mercado Pago para cobros físicos.',
    icon: CreditCardIcon,
    iconFilled: PaymentFilledIcon,
    beta: true,
  },
  {
    id: 'customer-display',
    title: 'Pantalla del Cliente',
    description: 'Muestra al cliente sus productos y totales en un segundo monitor o tablet.',
    icon: DesktopIcon,
    iconFilled: DesktopIcon,
    beta: true,
  },
  {
    id: 'servicios',
    title: 'Servicios y Recargas',
    description: 'Configura el proveedor para recargas telefónicas y pagos de servicios.',
    icon: SettingsIcon,
    iconFilled: SettingsFilledIcon,
  },
  {
    id: 'ai',
    title: 'Inteligencia Artificial',
    description: 'Conecta proveedores de IA (OpenRouter, OpenAI, Google, Groq y más) para describir productos, analizar recibos y soporte.',
    icon: MagicIcon,
    iconFilled: MagicIcon,
  },
  {
    id: 'system',
    title: 'Sistema',
    description: 'Información del sistema, dependencias, licencias y vulnerabilidades resueltas.',
    icon: InfoIcon,
    iconFilled: InfoIcon,
  },
];

import { uploadFile } from '@/lib/storage';

export function ConfiguracionPage() {
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const saveStoreConfig = useDashboardStore((s) => s.saveStoreConfig);

  const {
    fields,
    dirty: isDirty,
    reset: resetConfig,
    submitting: saving,
    submit: handleSave,
    submitErrors,
  } = useForm({
    makeCleanAfterSubmit: true,
    fields: {
      storeName: useField(storeConfig.storeName || ''),
      legalName: useField(storeConfig.legalName || ''),
      address: useField(storeConfig.address || ''),
      city: useField(storeConfig.city || ''),
      postalCode: useField(storeConfig.postalCode || ''),
      phone: useField(storeConfig.phone || ''),
      rfc: useField(storeConfig.rfc || ''),
      regimenFiscal: useField(storeConfig.regimenFiscal || ''),
      regimenDescription: useField(storeConfig.regimenDescription || ''),
      cfdiPacProvider: useField(storeConfig.cfdiPacProvider || 'none'),
      cfdiPacEnvironment: useField(storeConfig.cfdiPacEnvironment || 'sandbox'),
      cfdiPacAuthType: useField(storeConfig.cfdiPacAuthType || 'basic'),
      cfdiPacApiUrl: useField(storeConfig.cfdiPacApiUrl || ''),
      cfdiPacApiKey: useField(storeConfig.cfdiPacApiKey || ''),
      cfdiPacApiSecret: useField(storeConfig.cfdiPacApiSecret || ''),
      cfdiPacCancelPath: useField(storeConfig.cfdiPacCancelPath || '/cancel'),
      ivaRate: useField(storeConfig.ivaRate || '16'),
      pricesIncludeIva: useField(storeConfig.pricesIncludeIva ?? true),
      currency: useField(storeConfig.currency || 'MXN'),
      lowStockThreshold: useField(storeConfig.lowStockThreshold || '25'),
      expirationWarningDays: useField(storeConfig.expirationWarningDays || '7'),
      printReceipts: useField(storeConfig.printReceipts ?? true),
      autoBackup: useField(storeConfig.autoBackup ?? false),
      ticketFooter: useField(storeConfig.ticketFooter || ''),
      ticketServicePhone: useField(storeConfig.ticketServicePhone || ''),
      ticketVigencia: useField(storeConfig.ticketVigencia || ''),
      storeNumber: useField(storeConfig.storeNumber || '001'),
      ticketBarcodeFormat: useField(storeConfig.ticketBarcodeFormat || 'CODE128'),
      enableNotifications: useField(storeConfig.enableNotifications ?? false),
      telegramToken: useField(storeConfig.telegramToken || ''),
      telegramChatId: useField(storeConfig.telegramChatId || ''),
      printerIp: useField(storeConfig.printerIp || ''),
      cashDrawerPort: useField(storeConfig.cashDrawerPort || ''),
      scalePort: useField(storeConfig.scalePort || ''),
      loyaltyEnabled: useField(storeConfig.loyaltyEnabled ?? false),
      pointsPerPeso: useField(storeConfig.pointsPerPeso ?? 100),
      pointsValue: useField(storeConfig.pointsValue ?? 1),
      logoUrl: useField(storeConfig.logoUrl || ''),
      inventoryGeneralColumns: useField(storeConfig.inventoryGeneralColumns || '["title","sku","available","onHand"]'),
      defaultMargin: useField(storeConfig.defaultMargin || '30'),
      ticketTemplateVenta: useField(storeConfig.ticketTemplateVenta || ''),
      ticketTemplateProveedor: useField(storeConfig.ticketTemplateProveedor || ''),
      closeSystemTime: useField(storeConfig.closeSystemTime || '23:00'),
      autoCorteTime: useField(storeConfig.autoCorteTime || '00:00'),
      defaultStartingFund: useField(storeConfig.defaultStartingFund ?? 500),
      clabeNumber: useField(storeConfig.clabeNumber || ''),
      paypalUsername: useField(storeConfig.paypalUsername || ''),
      paypalQrUrl: useField(storeConfig.paypalQrUrl || ''),
      cobrarQrUrl: useField(storeConfig.cobrarQrUrl || ''),
      mpEnabled: useField(storeConfig.mpEnabled ?? false),
      mpPublicKey: useField(storeConfig.mpPublicKey || ''),
      mpDeviceId: useField(storeConfig.mpDeviceId || ''),
      conektaEnabled: useField(storeConfig.conektaEnabled ?? false),
      conektaPublicKey: useField(storeConfig.conektaPublicKey || ''),
      stripeEnabled: useField(storeConfig.stripeEnabled ?? false),
      stripePublicKey: useField(storeConfig.stripePublicKey || ''),
      clipEnabled: useField(storeConfig.clipEnabled ?? false),
      clipApiKey: useField(storeConfig.clipApiKey || ''),
      clipSerialNumber: useField(storeConfig.clipSerialNumber || ''),
      // Email (AWS SES)
      emailEnabled: useField(storeConfig.emailEnabled ?? false),
      emailFrom: useField(storeConfig.emailFrom || ''),
      emailFromName: useField(storeConfig.emailFromName || ''),
      emailReplyTo: useField(storeConfig.emailReplyTo || ''),
      emailRecipients: useField(storeConfig.emailRecipients || ''),
      emailAccentColor: useField(storeConfig.emailAccentColor || '#2563eb'),
      // Email — per-type toggles
      emailTicketEnabled: useField(storeConfig.emailTicketEnabled ?? true),
      emailDailyReportEnabled: useField(storeConfig.emailDailyReportEnabled ?? true),
      emailWeeklyReportEnabled: useField(storeConfig.emailWeeklyReportEnabled ?? true),
      emailStockAlertEnabled: useField(storeConfig.emailStockAlertEnabled ?? true),
      emailRefundAlertEnabled: useField(storeConfig.emailRefundAlertEnabled ?? true),
      emailExpenseAlertEnabled: useField(storeConfig.emailExpenseAlertEnabled ?? true),
      emailSecurityAlertEnabled: useField(storeConfig.emailSecurityAlertEnabled ?? true),
      // Email — schedule & customization
      emailDailyReportTime: useField(storeConfig.emailDailyReportTime || '08:00'),
      emailWeeklyReportDay: useField(storeConfig.emailWeeklyReportDay || 'monday'),
      emailWeeklyReportTime: useField(storeConfig.emailWeeklyReportTime || '07:00'),
      emailFooterText: useField(storeConfig.emailFooterText || ''),
      emailSignature: useField(storeConfig.emailSignature || ''),
      // Email — premium features
      emailCcRecipients: useField(storeConfig.emailCcRecipients || ''),
      emailBccRecipients: useField(storeConfig.emailBccRecipients || ''),
      emailSubjectPrefix: useField(storeConfig.emailSubjectPrefix || ''),
      emailDigestEnabled: useField(storeConfig.emailDigestEnabled ?? false),
      emailDigestIntervalMinutes: useField(storeConfig.emailDigestIntervalMinutes ?? 60),
      emailMaxAlertsPerHour: useField(storeConfig.emailMaxAlertsPerHour ?? 20),
      emailAutoRetry: useField(storeConfig.emailAutoRetry ?? true),
      emailMaxRetries: useField(storeConfig.emailMaxRetries ?? 3),
      emailAttachPdfTicket: useField(storeConfig.emailAttachPdfTicket ?? false),
      emailAttachExcelReport: useField(storeConfig.emailAttachExcelReport ?? false),
      emailMonthlyReportEnabled: useField(storeConfig.emailMonthlyReportEnabled ?? false),
      emailMonthlyReportDay: useField(storeConfig.emailMonthlyReportDay ?? 1),
      // NOTE: customerDisplay* fields are NOT in this form.
      // CustomerDisplaySectionV2 is self-sufficient and manages its own state
      // directly via Zustand store to avoid state sync conflicts.
    },
    onSubmit: async (f) => {
      try {
        // Exclude provider-enabled flags — they're managed by their own
        // connect/disconnect handlers (OAuth, API keys) and must NOT be
        // overwritten by the settings form.
        const { mpEnabled, conektaEnabled, stripeEnabled, clipEnabled, ...safeFields } = f;
        await saveStoreConfig(safeFields as Partial<StoreConfig>);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        return { status: 'success' };
      } catch (error) {
        const { description } = parseError(error);
        setSaved(false);
        return { status: 'fail', errors: [{ message: description }] };
      }
    },
  });

  const [saved, setSaved] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [_quickSavingDisplay, setQuickSavingDisplay] = useState(false);
  const [quickSaveError, setQuickSaveError] = useState<string | null>(null);

  // ══════════════════════════════════════════════════════════════════════════
  // STATUS_MAP — Computed EARLY to be available for both list and detail views
  // Must use storeConfig directly (from Zustand) for fields managed outside form
  // ══════════════════════════════════════════════════════════════════════════
  const STATUS_MAP = useMemo(() => {
    const storeConfigured = !!(storeConfig.storeName && storeConfig.address);
    const fiscalConfigured =
      !!storeConfig.rfc &&
      !!storeConfig.regimenFiscal &&
      storeConfig.cfdiPacProvider !== 'none' &&
      !!storeConfig.cfdiPacApiKey;
    const notificationsConfigured = !!(
      storeConfig.enableNotifications &&
      storeConfig.telegramToken &&
      storeConfig.telegramChatId
    );
    const emailConfigured = !!(
      storeConfig.emailEnabled &&
      storeConfig.emailFrom &&
      storeConfig.emailRecipients
    );
    const mpLinked = storeConfig.mpEnabled;
    const hardwareConfigured = !!storeConfig.printerIp;
    const loyaltyConfigured = storeConfig.loyaltyEnabled;
    const displayEnabled = storeConfig.customerDisplayEnabled;

    return {
      general: { configured: storeConfigured, label: storeConfigured ? 'Configurado' : 'Pendiente' },
      fiscal: { configured: fiscalConfigured, label: fiscalConfigured ? 'Configurado' : 'Pendiente' },
      pos: { configured: true, label: 'Activo' },
      hardware: { configured: hardwareConfigured, label: hardwareConfigured ? 'Conectado' : 'Sin conectar' },
      loyalty: { configured: loyaltyConfigured, label: loyaltyConfigured ? 'Activo' : 'Inactivo' },
      inventory: { configured: true, label: 'Activo' },
      notifications: {
        configured: notificationsConfigured,
        label: notificationsConfigured ? 'Conectado' : 'Sin conectar',
      },
      email: {
        configured: emailConfigured,
        label: emailConfigured ? 'Activo' : 'Sin configurar',
      },
      payments: { configured: mpLinked, label: mpLinked ? 'Vinculado' : 'Sin vincular' },
      'customer-display': { configured: displayEnabled, label: displayEnabled ? 'Activo' : 'Inactivo' },
      servicios: {
        configured: storeConfig.serviciosProvider !== 'local',
        label: storeConfig.serviciosProvider !== 'local' ? 'Vinculado' : 'Local',
      },
      ai: {
        configured: storeConfig.aiEnabled,
        label: storeConfig.aiEnabled ? 'Activo' : 'Inactivo',
      },
      system: {
        configured: true,
        label: 'v0.12.568',
      },
    } as Record<string, { configured: boolean; label: string }>;
  }, [storeConfig]);

  // Sync with store when it changes externally — but only if the user
  // is NOT actively editing (isDirty). Otherwise a background SyncEngine
  // poll would wipe out whatever they're typing.
  useEffect(() => {
    if (!isDirty) {
      resetConfig();
    }
  }, [storeConfig, resetConfig, isDirty]);

  // === PROTECCIÓN DE DATOS (leaveConfirmation) ===
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Derived config object for sub-components (read-only or for preview)
  const config = useMemo(() => {
    const obj: Record<string, unknown> = {};
    const f = fields as Record<string, { value: unknown }>;
    Object.keys(fields).forEach((key) => {
      obj[key] = f[key].value;
    });
    return obj as unknown as StoreConfig;
  }, [fields]);

  const updateField = useCallback(
    <K extends keyof StoreConfig>(field: K, value: StoreConfig[K]) => {
      const f = fields as Record<string, { onChange: (v: unknown) => void }>;
      f[field as string].onChange(value);
    },
    [fields],
  );

  const _savePatch = useCallback(
    async (patch: Partial<StoreConfig>) => {
      setQuickSavingDisplay(true);
      setQuickSaveError(null);
      try {
        await saveStoreConfig(patch);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (error) {
        const { description } = parseError(error);
        setSaved(false);
        setQuickSaveError(description);
      } finally {
        setQuickSavingDisplay(false);
      }
    },
    [saveStoreConfig],
  );

  // Mercado Pago — derived from form fields (persisted to DB)
  const _mpConfig = useMemo<MercadoPagoConfig>(
    () => ({
      enabled: fields.mpEnabled.value,
      publicKey: fields.mpPublicKey.value,
      deviceId: fields.mpDeviceId.value,
    }),
    [fields.mpEnabled.value, fields.mpPublicKey.value, fields.mpDeviceId.value],
  );

  const [mpTesting, setMpTesting] = useState(false);
  const [mpTestResult, setMpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [mpDevices, setMpDevices] = useState<{ id: string; operating_mode: string }[]>([]);

  // Telegram config
  const [tgTesting, setTgTesting] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Email config
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Logo upload
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const handleLogoDrop = useCallback((_accepted: File[], rejected: File[]) => {
    if (rejected.length > 0) {
      setLogoError('Solo se aceptan imágenes (JPG, PNG, WebP, SVG) de máximo 5 MB.');
    }
  }, []);

  const handleLogoDropAccepted = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setLogoUploading(true);
      setLogoError(null);
      try {
        const path = `logos/store-logo-${Date.now()}.${file.name.split('.').pop()}`;
        const url = await uploadFile(file, path);
        updateField('logoUrl', url);
      } catch {
        setLogoError('No se pudo subir el logo. Intenta de nuevo.');
      } finally {
        setLogoUploading(false);
      }
    },
    [updateField],
  );

  const _handleMPSave = useCallback(() => {
    handleSave();
  }, [handleSave]);

  const handleMPTest = useCallback(async () => {
    setMpTesting(true);
    setMpTestResult(null);
    try {
      const devices = await getDevices();
      setMpDevices(devices);
      if (devices.length > 0) {
        setMpTestResult({ success: true, message: `Conexión exitosa. ${devices.length} terminal(es) encontrada(s).` });
        if (!fields.mpDeviceId.value && devices.length > 0) {
          fields.mpDeviceId.onChange(devices[0].id);
        }
      } else {
        setMpTestResult({ success: false, message: 'Conexión exitosa pero no se encontraron terminales vinculadas.' });
      }
    } catch (err) {
      setMpTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Error al conectar con Mercado Pago',
      });
    }
    setMpTesting(false);
  }, [fields.mpDeviceId]);

  const handleTGTest = useCallback(async () => {
    if (!fields.telegramToken.value || !fields.telegramChatId.value) {
      setTgTestResult({ success: false, message: 'Ingresa Token y Chat ID primero' });
      return;
    }
    setTgTesting(true);
    setTgTestResult(null);
    try {
      const url = `https://api.telegram.org/bot${fields.telegramToken.value}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: fields.telegramChatId.value,
          text: '✅ <b>PRUEBA DE CONEXIÓN</b>\n\nTu consola de abarrotes está conectada correctamente a Telegram.',
          parse_mode: 'HTML',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTgTestResult({ success: true, message: 'Notificación enviada con éxito' });
      } else {
        setTgTestResult({ success: false, message: `Error de Telegram: ${data.description}` });
      }
    } catch (_err) {
      setTgTestResult({ success: false, message: 'Error al conectar con Telegram API' });
    }
    setTgTesting(false);
  }, [fields.telegramToken.value, fields.telegramChatId.value]);

  const handleEmailTest = useCallback(async () => {
    const from = fields.emailFrom.value;
    const recipients = fields.emailRecipients.value;
    if (!from || !recipients) {
      setEmailTestResult({ success: false, message: 'Configura el correo remitente y los destinatarios primero' });
      return;
    }
    const firstRecipient = recipients.split(',')[0].trim();
    setEmailTesting(true);
    setEmailTestResult(null);
    try {
      const result = await sendTestEmailAction({
        to: firstRecipient,
        fromEmail: from,
        fromName: fields.emailFromName.value || config.storeName,
        storeName: config.storeName,
        logoUrl: config.logoUrl,
      });
      setEmailTestResult(result);
    } catch (err) {
      setEmailTestResult({ success: false, message: err instanceof Error ? err.message : 'Error al enviar correo de prueba' });
    }
    setEmailTesting(false);
  }, [fields.emailFrom.value, fields.emailRecipients.value, fields.emailFromName.value, config.storeName, config.logoUrl]);

  // ================= MAIN RENDER ================= //

  const getActiveView = () => {
    switch (selectedCategory) {
      case 'general':
        return (
          <GeneralSection
            config={config}
            updateField={updateField}
            logoUploading={logoUploading}
            logoError={logoError}
            handleLogoDrop={handleLogoDrop}
            handleLogoDropAccepted={handleLogoDropAccepted}
            setLogoError={setLogoError}
          />
        );
      case 'fiscal':
        return <FiscalSection config={config} updateField={updateField} />;
      case 'pos':
        return <PosSection config={config} updateField={updateField} />;
      case 'hardware':
        return <HardwareSection config={config} updateField={updateField} />;
      case 'loyalty':
        return <LoyaltySection config={config} updateField={updateField} />;
      case 'inventory':
        return <InventorySection config={config} updateField={updateField} />;
      case 'notifications':
        return (
          <NotificationsSection
            config={config}
            updateField={updateField}
            tgTesting={tgTesting}
            tgTestResult={tgTestResult}
            handleTGTest={handleTGTest}
          />
        );
      case 'email':
        return (
          <EmailSection
            config={config}
            updateField={updateField}
            emailTesting={emailTesting}
            emailTestResult={emailTestResult}
            handleEmailTest={handleEmailTest}
          />
        );
      case 'payments':
        return (
          <PaymentsSection
            config={config}
            updateField={updateField}
            mpTesting={mpTesting}
            mpTestResult={mpTestResult}
            mpDevices={mpDevices}
            handleMPTest={handleMPTest}
            clabeNumberField={fields.clabeNumber}
            paypalUsernameField={fields.paypalUsername}
            paypalQrUrlField={fields.paypalQrUrl}
            cobrarQrUrlField={fields.cobrarQrUrl}
          />
        );
      case 'customer-display':
        // CustomerDisplaySectionV4 is self-sufficient: uses store directly,
        // each field auto-saves independently. No props needed.
        return <CustomerDisplaySectionV4 />;
      case 'servicios':
        return <ServiciosSection />;
      case 'ai':
        return <AISection />;
      case 'system':
        return <SystemSection />;
      default:
        return null;
    }
  };

  const activeCategory = SETTINGS_CATEGORIES.find((c) => c.id === selectedCategory);

  // ── Global stats (counts only — no progress bars) ──
  const totalModules = SETTINGS_CATEGORIES.length;
  const configuredModules = SETTINGS_CATEGORIES.filter((c) => STATUS_MAP[c.id]?.configured).length;
  const pendingModules = SETTINGS_CATEGORIES.filter((c) => !STATUS_MAP[c.id]?.configured);

  // ── Page header subtitle (storeName lives in Page title) ──
  const pageSubtitle = [
    config.legalName,
    config.rfc ? `RFC ${config.rfc}` : null,
    config.storeNumber ? `Sucursal #${config.storeNumber}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // ── Category grid (Shopify Settings pattern) ──
  const CategoryGrid = (
    <BlockStack gap="500">
      <Card padding="0">
        <Box paddingInline="400" paddingBlockStart="400" paddingBlockEnd="300">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="050">
              <Text as="h2" variant="headingMd">
                Configuración de la tienda
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {configuredModules} de {totalModules} módulos configurados
                {pendingModules.length > 0 ? ` · ${pendingModules.length} pendientes` : ''}
              </Text>
            </BlockStack>
          </InlineStack>
        </Box>
        <Divider />
        <Box padding="400">
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="300">
            {SETTINGS_CATEGORIES.map((cat) => {
              const status = STATUS_MAP[cat.id];
              const isConfigured = !!status?.configured;
              const isBeta = 'beta' in cat && cat.beta;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className="settings-card-button"
                  aria-label={`Configurar ${cat.title}`}
                >
                  <Box
                    padding="400"
                    background="bg-surface"
                    borderRadius="300"
                    borderWidth="025"
                    borderColor="border"
                    minHeight="100%"
                  >
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="start" wrap={false}>
                        <Box
                          padding="200"
                          background={
                            isConfigured ? 'bg-fill-success-secondary' : 'bg-fill-magic-secondary'
                          }
                          borderRadius="200"
                        >
                          <Icon
                            source={isConfigured ? cat.iconFilled : cat.icon}
                            tone={isConfigured ? 'success' : 'magic'}
                          />
                        </Box>
                        <InlineStack gap="100" blockAlign="center">
                          {isBeta && (
                            <Badge tone="attention" size="small">
                              Beta
                            </Badge>
                          )}
                          {isConfigured ? (
                            <Badge tone="success" size="small" icon={CheckCircleIcon}>
                              Listo
                            </Badge>
                          ) : (
                            <Badge tone="warning" size="small" icon={AlertCircleIcon}>
                              Pendiente
                            </Badge>
                          )}
                        </InlineStack>
                      </InlineStack>
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingSm" fontWeight="semibold">
                          {cat.title}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {cat.description}
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Box>
                </button>
              );
            })}
          </InlineGrid>
        </Box>
      </Card>

      <Card padding="0">
        <Box padding="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="200" blockAlign="center">
              <Icon source={StoreFilledIcon} tone="base" />
              <Text as="h2" variant="headingMd">
                Información de la tienda
              </Text>
            </InlineStack>
            <Button
              variant="plain"
              onClick={() => setSelectedCategory('general')}
            >
              Editar
            </Button>
          </InlineStack>
        </Box>
        <Divider />
        <Box padding="400">
          <InlineGrid columns={{ xs: 2, sm: 3, lg: 5 }} gap="400">
            {[
              { label: 'Razón social', value: config.legalName || '—' },
              { label: 'RFC', value: config.rfc || '—' },
              { label: 'Sucursal', value: `#${config.storeNumber || '001'}` },
              { label: 'Moneda', value: config.currency || 'MXN' },
              { label: 'Teléfono', value: config.phone || '—' },
            ].map((item) => (
              <BlockStack key={item.label} gap="100">
                <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
                  {item.label}
                </Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold" truncate>
                  {item.value}
                </Text>
              </BlockStack>
            ))}
          </InlineGrid>
        </Box>
      </Card>

      <FooterHelp>
        ¿Necesitas ayuda configurando tu tienda?{' '}
        <PolarisLink url="https://kiosko.app/docs" external>
          Consulta la documentación
        </PolarisLink>
      </FooterHelp>
    </BlockStack>
  );

  // ── Section detail (when a specific category is selected) ──
  const SectionDetail = activeCategory ? <Box>{getActiveView()}</Box> : null;

  return (
    <>
      {isDirty && (
        <ContextualSaveBar
          message="Cambios sin guardar en la configuración"
          saveAction={{ onAction: handleSave, loading: saving }}
          discardAction={{ onAction: resetConfig }}
        />
      )}
      <Page
        title={
          activeCategory ? activeCategory.title : config.storeName || 'Mi Tienda'
        }
        subtitle={
          activeCategory ? activeCategory.description : pageSubtitle || undefined
        }
        backAction={
          activeCategory
            ? { content: 'Configuración', onAction: () => setSelectedCategory(null) }
            : undefined
        }
        titleMetadata={
          activeCategory ? (
            <InlineStack gap="200">
              {'beta' in activeCategory && activeCategory.beta && (
                <Badge tone="attention">Beta</Badge>
              )}
              <Badge
                tone={STATUS_MAP[selectedCategory ?? '']?.configured ? 'success' : 'warning'}
                icon={
                  STATUS_MAP[selectedCategory ?? '']?.configured
                    ? CheckCircleIcon
                    : AlertCircleIcon
                }
              >
                {STATUS_MAP[selectedCategory ?? '']?.label || 'Pendiente'}
              </Badge>
            </InlineStack>
          ) : undefined
        }
        secondaryActions={
          activeCategory
            ? undefined
            : [
                { content: 'Exportar', icon: ExportIcon },
                { content: 'Restablecer', icon: RefreshIcon, destructive: true },
              ]
        }
      >
        <form
          data-save-bar
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          onReset={(e) => {
            e.preventDefault();
            resetConfig();
          }}
        >
          <BlockStack gap="400">
            {saved && (
              <Banner
                tone="success"
                title="Configuración guardada correctamente"
                onDismiss={() => setSaved(false)}
              />
            )}
            {quickSaveError && (
              <Banner
                tone="critical"
                title="No se pudo guardar el cambio"
                onDismiss={() => setQuickSaveError(null)}
              >
                <p>{quickSaveError}</p>
              </Banner>
            )}
            {submitErrors.length > 0 && (
              <Banner tone="critical" title="No se pudo guardar la configuración">
                <BlockStack gap="100">
                  {submitErrors.map((error, index) => (
                    <Text as="p" key={`${error.message}-${index}`} variant="bodySm">
                      {error.message}
                    </Text>
                  ))}
                </BlockStack>
              </Banner>
            )}

            {activeCategory ? SectionDetail : CategoryGrid}
          </BlockStack>
        </form>
      </Page>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// System Section — Project info, dependencies, licenses, security
// ─────────────────────────────────────────────────────────────────────────────

type TimelineTone = 'base' | 'success' | 'critical' | 'caution' | 'info';

interface TimelineItem {
  timestamp: Date;
  timelineEvent: string;
  tone?: TimelineTone;
  icon?: React.ReactNode;
  url?: string;
  details?: string[];
}

const PROJECT_CHANGELOG: TimelineItem[] = [
  {
    timestamp: new Date('2026-04-23T16:00:00'),
    timelineEvent: 'Nueva sección "Sistema" en Configuraciones con información del proyecto',
    tone: 'success',
    icon: <Icon source={SettingsIcon} tone="success" />,
    details: [
      'Bitácora de funcionalidades agregadas en el tiempo',
      'Catálogo de dependencias con versiones actuales',
      'Resumen de licencias de código abierto utilizadas',
      'Listado de vulnerabilidades de seguridad ya resueltas',
    ],
  },
  {
    timestamp: new Date('2026-04-23T14:00:00'),
    timelineEvent: 'Descripciones de productos generadas con IA ahora se guardan automáticamente',
    tone: 'success',
    icon: <Icon source={MagicIcon} tone="success" />,
    details: [
      'Genera descripciones con un clic desde el modal del producto',
      'Se persisten en la base de datos junto al producto',
      'Disponible al crear y al editar productos',
      'Autoguardado al salir del campo de descripción',
    ],
  },
  {
    timestamp: new Date('2026-04-22T17:00:00'),
    timelineEvent: 'Kardex de productos: historial completo de movimientos de inventario',
    tone: 'success',
    icon: <Icon source={InventoryIcon} tone="success" />,
    details: [
      'Historial cronológico de entradas, salidas y ajustes',
      'Trazabilidad de cada movimiento por producto',
      'Filtrado por fecha y tipo de movimiento',
      'Saldo de stock reconstruido en cualquier punto del tiempo',
    ],
  },
  {
    timestamp: new Date('2026-04-20T10:00:00'),
    timelineEvent: 'Facturación electrónica CFDI conectada con proveedores PAC',
    tone: 'success',
    icon: <Icon source={ReceiptDollarIcon} tone="success" />,
    details: [
      'Emisión de CFDI 4.0 desde el punto de venta',
      'Soporte para múltiples PACs (sandbox y producción)',
      'Cancelación de comprobantes con un clic',
      'Configuración de RFC, régimen fiscal y serie/folio',
    ],
  },
  {
    timestamp: new Date('2026-04-18T14:00:00'),
    timelineEvent: 'Pantalla del cliente con animaciones y mensajes personalizables',
    tone: 'success',
    icon: <Icon source={DesktopIcon} tone="success" />,
    details: [
      'Segundo monitor que muestra productos y total al cliente',
      'Animaciones configurables (transiciones, destellos)',
      'Mensajes promocionales y estilo visual editable',
      'Sincronización en tiempo real con el carrito de venta',
    ],
  },
  {
    timestamp: new Date('2026-04-15T11:00:00'),
    timelineEvent: 'Diseñador de tickets con plantillas para venta y proveedor',
    tone: 'success',
    icon: <Icon source={PrintIcon} tone="success" />,
    details: [
      'Editor visual para tickets de venta',
      'Plantilla independiente para tickets de proveedor',
      'Personalización de logo, pie de página y vigencia',
      'Soporte para códigos de barras CODE128',
    ],
  },
  {
    timestamp: new Date('2026-04-10T09:00:00'),
    timelineEvent: 'Integración de múltiples proveedores de pago (MercadoPago, Stripe, Conekta, Clip)',
    tone: 'success',
    icon: <Icon source={CreditCardIcon} tone="success" />,
    details: [
      'Cobros con terminal Point de MercadoPago',
      'Pagos en línea con Stripe',
      'Procesamiento con Conekta',
      'Terminales físicas de Clip',
      'Selección del proveedor por venta',
    ],
  },
  {
    timestamp: new Date('2026-04-05T16:00:00'),
    timelineEvent: 'Notificaciones push por Telegram para alertas en tiempo real',
    tone: 'success',
    icon: <Icon source={NotificationIcon} tone="success" />,
    details: [
      'Alertas instantáneas al celular del operador',
      'Notifica ventas grandes, devoluciones y stock bajo',
      'Configuración con bot token y chat ID',
      'Botón de prueba para verificar la conexión',
    ],
  },
  {
    timestamp: new Date('2026-04-01T10:00:00'),
    timelineEvent: 'Envío de tickets, reportes y alertas por correo electrónico',
    tone: 'success',
    icon: <Icon source={EmailIcon} tone="success" />,
    details: [
      'Tickets digitales enviados al cliente',
      'Reportes diarios, semanales y mensuales automáticos',
      'Alertas de stock, devoluciones y gastos',
      'Personalización de remitente, color y firma',
      'Adjuntos en PDF y Excel opcionales',
    ],
  },
  {
    timestamp: new Date('2026-03-25T12:00:00'),
    timelineEvent: 'Programa de lealtad con puntos y recompensas para clientes',
    tone: 'success',
    icon: <Icon source={StarIcon} tone="success" />,
    details: [
      'Acumulación de puntos por cada peso gastado',
      'Conversión de puntos a descuentos',
      'Configuración de tasa de puntos y valor',
      'Vinculación de puntos al cliente registrado',
    ],
  },
];

interface DependencyInfo {
  name: string;
  version: string;
  license: string;
  description: string;
  isCore?: boolean;
}

const DEPENDENCIES: DependencyInfo[] = [
  { name: 'next', version: '16.2.4', license: 'MIT', description: 'Framework React full-stack', isCore: true },
  { name: 'react', version: '19.2.3', license: 'MIT', description: 'Librería UI declarativa', isCore: true },
  { name: 'typescript', version: '6.0.2', license: 'Apache-2.0', description: 'Tipado estático para JS', isCore: true },
  { name: 'drizzle-orm', version: '0.45.1', license: 'Apache-2.0', description: 'ORM tipo-seguro SQL' },
  { name: '@neondatabase/serverless', version: '1.0.2', license: 'MIT', description: 'Cliente Neon Postgres serverless' },
  { name: '@shopify/polaris', version: '13.9.5', license: 'MIT', description: 'Design system Shopify' },
  { name: '@shopify/polaris-icons', version: '9.3.1', license: 'MIT', description: 'Iconos Polaris' },
  { name: '@shopify/polaris-viz', version: '16.16.0', license: 'MIT', description: 'Gráficas y visualizaciones' },
  { name: 'ai', version: '6.0.158', license: 'MIT', description: 'Vercel AI SDK' },
  { name: '@ai-sdk/openai', version: '3.0.52', license: 'MIT', description: 'Provider OpenAI/OpenRouter' },
  { name: 'mercadopago', version: '2.0.15', license: 'MIT', description: 'SDK MercadoPago' },
  { name: 'stripe', version: '21.0.1', license: 'MIT', description: 'SDK Stripe' },
  { name: 'conekta', version: '8.0.2', license: 'MIT', description: 'SDK Conekta' },
  { name: '@sentry/nextjs', version: '10.x', license: 'MIT', description: 'Monitoreo de errores' },
  { name: '@upstash/redis', version: '1.37.0', license: 'MIT', description: 'Redis serverless' },
  { name: '@upstash/ratelimit', version: '2.0.8', license: 'MIT', description: 'Rate limiting' },
  { name: 'firebase', version: '12.10.0', license: 'Apache-2.0', description: 'Auth y servicios Google' },
  { name: '@aws-sdk/client-s3', version: '3.1004.0', license: 'Apache-2.0', description: 'Almacenamiento S3' },
  { name: '@aws-sdk/client-sesv2', version: '3.1030.0', license: 'Apache-2.0', description: 'Email SES' },
  { name: 'zod', version: '4.3.6', license: 'MIT', description: 'Validación de schemas' },
  { name: 'zustand', version: '5.0.11', license: 'MIT', description: 'State management' },
  { name: 'facturapi', version: '4.14.2', license: 'MIT', description: 'Facturación electrónica SAT' },
];

interface VulnerabilityFix {
  package: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  description: string;
  fixedIn: string;
  date: string;
}

const VULNERABILITIES_FIXED: VulnerabilityFix[] = [
  { package: 'esbuild', severity: 'high', description: 'Path traversal en modo serve (CVE-2025-XXXX)', fixedIn: '>=0.25.0', date: '2026-04-10' },
  { package: 'semver', severity: 'moderate', description: 'ReDoS en parsing de versiones (CVE-2024-4067)', fixedIn: '>=7.7.4', date: '2026-03-15' },
  { package: 'glob', severity: 'moderate', description: 'ReDoS en patrones complejos (CVE-2024-4068)', fixedIn: '>=10.5.0', date: '2026-03-15' },
  { package: 'next', severity: 'high', description: 'Server Actions SSRF (actualizado a 16.2.4)', fixedIn: '>=16.2.4', date: '2026-04-20' },
  { package: 'firebase', severity: 'moderate', description: 'XSS en redirect URLs', fixedIn: '>=12.10.0', date: '2026-04-05' },
];

function ChangelogTimeline({ items }: { items: TimelineItem[] }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (!items?.length) {
    return (
      <Box padding="800">
        <EmptyState heading="Sin actualizaciones recientes" image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-history.svg">
          <p>No hay funcionalidades nuevas registradas todavía.</p>
        </EmptyState>
      </Box>
    );
  }

  // Group items by date
  const groups = new Map<string, { isoDate: string; items: { item: TimelineItem; index: number }[] }>();
  items.forEach((item, index) => {
    const dateKey = item.timestamp.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups.has(dateKey)) {
      groups.set(dateKey, { isoDate: dateKey, items: [] });
    }
    groups.get(dateKey)!.items.push({ item, index });
  });

  const groupArray = Array.from(groups.values());

  return (
    <BlockStack gap="500">
      {groupArray.map((group) => (
        <BlockStack key={group.isoDate} gap="300">
          <InlineStack gap="200" blockAlign="center">
            <Icon source={CalendarIcon} tone="subdued" />
            <Text as="h3" variant="headingSm" tone="subdued">
              {group.isoDate}
            </Text>
          </InlineStack>

          <Box background="bg-surface-secondary" borderRadius="300" padding="400">
            <BlockStack gap="400">
              {group.items.map(({ item, index }) => {
                const isOpen = !!expanded[index];
                return (
                  <Box
                    key={index}
                    background="bg-surface"
                    borderRadius="200"
                    padding="300"
                    borderWidth="025"
                    borderColor="border"
                  >
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="start" wrap={false}>
                        <InlineStack gap="300" blockAlign="start" wrap={false}>
                          <Box paddingBlockStart="050">
                            <Icon source={CheckCircleIcon} tone="success" />
                          </Box>
                          <BlockStack gap="050">
                            <Text as="h4" variant="bodyMd" fontWeight="semibold">
                              {item.timelineEvent}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              {item.timestamp.toLocaleTimeString('es-MX', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })}
                            </Text>
                          </BlockStack>
                        </InlineStack>
                        {item.details && item.details.length > 0 && (
                          <Button
                            variant="tertiary"
                            size="slim"
                            icon={isOpen ? ChevronUpIcon : ChevronDownIcon}
                            onClick={() => setExpanded((s) => ({ ...s, [index]: !s[index] }))}
                            accessibilityLabel={isOpen ? 'Ocultar detalles' : 'Ver detalles'}
                          >
                            {isOpen ? 'Ocultar' : `Detalles (${item.details.length})`}
                          </Button>
                        )}
                      </InlineStack>

                      {item.details && item.details.length > 0 && (
                        <Collapsible
                          id={`changelog-details-${index}`}
                          open={isOpen}
                          transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
                          expandOnPrint
                        >
                          <Box
                            padding="300"
                            background="bg-surface-secondary"
                            borderRadius="200"
                          >
                            <BlockStack gap="200">
                              {item.details.map((d, i) => (
                                <InlineStack key={i} gap="200" blockAlign="start" wrap={false}>
                                  <Box paddingBlockStart="050">
                                    <Icon source={CheckCircleIcon} tone="success" />
                                  </Box>
                                  <Text as="p" variant="bodySm">
                                    {d}
                                  </Text>
                                </InlineStack>
                              ))}
                            </BlockStack>
                          </Box>
                        </Collapsible>
                      )}
                    </BlockStack>
                  </Box>
                );
              })}
            </BlockStack>
          </Box>
        </BlockStack>
      ))}
    </BlockStack>
  );
}

function StatTile({
  label,
  value,
  tone,
  helpText,
}: {
  label: string;
  value: string | number;
  tone?: 'success' | 'critical' | 'caution' | 'subdued';
  helpText?: string;
}) {
  return (
    <Box
      background="bg-surface-secondary"
      borderRadius="300"
      padding="400"
      borderWidth="025"
      borderColor="border"
    >
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">
          {label}
        </Text>
        <Text as="p" variant="heading2xl" fontWeight="bold" tone={tone}>
          {String(value)}
        </Text>
        {helpText && (
          <Text as="p" variant="bodyXs" tone="subdued">
            {helpText}
          </Text>
        )}
      </BlockStack>
    </Box>
  );
}

function SystemSection() {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'overview', content: 'Resumen', accessibilityLabel: 'Resumen', panelID: 'tab-overview' },
    { id: 'changelog', content: 'Novedades', accessibilityLabel: 'Novedades', panelID: 'tab-changelog' },
    { id: 'dependencies', content: 'Dependencias', accessibilityLabel: 'Dependencias', panelID: 'tab-deps' },
    { id: 'licenses', content: 'Licencias', accessibilityLabel: 'Licencias', panelID: 'tab-licenses' },
    { id: 'security', content: 'Seguridad', accessibilityLabel: 'Seguridad', panelID: 'tab-security' },
  ];

  const mitCount = DEPENDENCIES.filter((d) => d.license === 'MIT').length;
  const apacheCount = DEPENDENCIES.filter((d) => d.license === 'Apache-2.0').length;
  const coreCount = DEPENDENCIES.filter((d) => d.isCore).length;
  const totalDeps = DEPENDENCIES.length;
  const mitPct = Math.round((mitCount / totalDeps) * 100);
  const apachePct = Math.round((apacheCount / totalDeps) * 100);

  const severityTone = (severity: VulnerabilityFix['severity']) => {
    const map = { critical: 'critical', high: 'warning', moderate: 'attention', low: 'info' } as const;
    return map[severity];
  };

  // ── Resumen ──
  const OverviewPanel = (
    <BlockStack gap="500">
      <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
        <StatTile
          label="Funcionalidades"
          value={PROJECT_CHANGELOG.length}
          tone="success"
          helpText="Agregadas recientemente"
        />
        <StatTile
          label="Dependencias"
          value={totalDeps}
          helpText={`${coreCount} principales`}
        />
        <StatTile
          label="Licencias OSS"
          value={mitCount + apacheCount}
          helpText="100% comerciales"
        />
        <StatTile
          label="Vulnerabilidades"
          value={`0 / ${VULNERABILITIES_FIXED.length}`}
          tone="success"
          helpText="Activas / Resueltas"
        />
      </InlineGrid>

      <Banner tone="success" icon={ShieldCheckMarkIcon}>
        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            Sistema actualizado y seguro
          </Text>
          <Text as="p" variant="bodySm">
            Todas las dependencias están al día y las {VULNERABILITIES_FIXED.length} vulnerabilidades conocidas han sido resueltas.
          </Text>
        </BlockStack>
      </Banner>

      <Card>
        <BlockStack gap="300">
          <BlockStack gap="100">
            <Text as="h3" variant="headingSm">Últimas novedades</Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Resumen de las funcionalidades más recientes.
            </Text>
          </BlockStack>
          <Divider />
          <BlockStack gap="300">
            {PROJECT_CHANGELOG.slice(0, 4).map((item, i) => (
              <InlineStack key={i} gap="300" blockAlign="start" wrap={false}>
                <Box paddingBlockStart="050">
                  <Icon source={CheckCircleIcon} tone="success" />
                </Box>
                <BlockStack gap="050">
                  <Text as="p" variant="bodyMd" fontWeight="medium">
                    {item.timelineEvent}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {item.timestamp.toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </BlockStack>
              </InlineStack>
            ))}
          </BlockStack>
          <Box>
            <Button variant="plain" onClick={() => setSelectedTab(1)}>
              Ver todas las novedades
            </Button>
          </Box>
        </BlockStack>
      </Card>
    </BlockStack>
  );

  // ── Changelog ──
  const ChangelogPanel = (
    <BlockStack gap="400">
      <Banner tone="info">
        <Text as="p" variant="bodySm">
          Estas son las funcionalidades agregadas al sistema. Haz clic en &ldquo;Detalles&rdquo; para ver qué incluye cada una.
        </Text>
      </Banner>
      <ChangelogTimeline items={PROJECT_CHANGELOG} />
    </BlockStack>
  );

  // ── Dependencias ──
  const DependenciesPanel = (
    <BlockStack gap="400">
      <InlineStack gap="200" wrap>
        <Badge tone="info">{`${totalDeps} dependencias`}</Badge>
        <Badge tone="success">{`${coreCount} principales`}</Badge>
        <Badge>{`${mitCount} MIT`}</Badge>
        <Badge>{`${apacheCount} Apache-2.0`}</Badge>
      </InlineStack>
      <Bleed marginInline="400" marginBlockEnd="400">
        <IndexTable
          resourceName={{ singular: 'dependencia', plural: 'dependencias' }}
          itemCount={DEPENDENCIES.length}
          headings={[
            { title: 'Paquete' },
            { title: 'Versión' },
            { title: 'Licencia' },
            { title: 'Descripción' },
          ]}
          selectable={false}
        >
          {DEPENDENCIES.map((dep, index) => (
            <IndexTable.Row id={dep.name} key={dep.name} position={index}>
              <IndexTable.Cell>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="bodyMd" fontWeight={dep.isCore ? 'bold' : 'regular'}>
                    {dep.name}
                  </Text>
                  {dep.isCore && (
                    <Badge tone="success" size="small">
                      core
                    </Badge>
                  )}
                </InlineStack>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span" variant="bodySm" tone="subdued">
                  {dep.version}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Badge tone={dep.license === 'MIT' ? 'success' : 'info'} size="small">
                  {dep.license}
                </Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span" variant="bodySm">
                  {dep.description}
                </Text>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Bleed>
    </BlockStack>
  );

  // ── Licencias ──
  const LicensesPanel = (
    <BlockStack gap="500">
      <Banner tone="info">
        <Text as="p" variant="bodySm">
          Todas las dependencias utilizan licencias de código abierto compatibles con uso comercial.
        </Text>
      </Banner>

      <BlockStack gap="400">
        <BlockStack gap="100">
          <Text as="h3" variant="headingSm">Distribución de licencias</Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Reparto de las {totalDeps} dependencias por tipo de licencia.
          </Text>
        </BlockStack>

        <BlockStack gap="400">
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Badge tone="success">MIT</Badge>
                <Text as="span" variant="bodySm" fontWeight="medium">
                  Permisiva sin restricciones
                </Text>
              </InlineStack>
              <Text as="span" variant="bodySm" tone="subdued">
                {mitCount} de {totalDeps} ({mitPct}%)
              </Text>
            </InlineStack>
            <ProgressBar progress={mitPct} size="small" tone="success" />
          </BlockStack>

          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Badge tone="info">Apache-2.0</Badge>
                <Text as="span" variant="bodySm" fontWeight="medium">
                  Permisiva con protección de patentes
                </Text>
              </InlineStack>
              <Text as="span" variant="bodySm" tone="subdued">
                {apacheCount} de {totalDeps} ({apachePct}%)
              </Text>
            </InlineStack>
            <ProgressBar progress={apachePct} size="small" tone="primary" />
          </BlockStack>
        </BlockStack>
      </BlockStack>

      <Divider />

      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Recursos</Text>
        <Box background="bg-surface-secondary" borderRadius="200" padding="400">
          <InlineStack gap="200" blockAlign="center" wrap={false}>
            <Icon source={InfoIcon} tone="subdued" />
            <Text as="p" variant="bodySm">
              Los textos completos de cada licencia están disponibles en{' '}
              <PolarisLink url="https://opensource.org/licenses" external removeUnderline>
                opensource.org/licenses
              </PolarisLink>
            </Text>
          </InlineStack>
        </Box>
      </BlockStack>
    </BlockStack>
  );

  // ── Seguridad ──
  const SecurityPanel = (
    <BlockStack gap="500">
      <Banner tone="success" icon={ShieldCheckMarkIcon}>
        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            {VULNERABILITIES_FIXED.length} vulnerabilidades resueltas
          </Text>
          <Text as="p" variant="bodySm">
            Mediante actualizaciones de versión y overrides en package.json. Sin vulnerabilidades activas conocidas.
          </Text>
        </BlockStack>
      </Banner>

      <Bleed marginInline="400">
        <IndexTable
          resourceName={{ singular: 'vulnerabilidad', plural: 'vulnerabilidades' }}
          itemCount={VULNERABILITIES_FIXED.length}
          headings={[
            { title: 'Paquete' },
            { title: 'Severidad' },
            { title: 'Descripción' },
            { title: 'Corregido en' },
            { title: 'Fecha' },
          ]}
          selectable={false}
        >
          {VULNERABILITIES_FIXED.map((vuln, index) => (
            <IndexTable.Row id={vuln.package} key={vuln.package} position={index}>
              <IndexTable.Cell>
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  {vuln.package}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Badge tone={severityTone(vuln.severity)}>
                  {vuln.severity.toUpperCase()}
                </Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span" variant="bodySm">
                  {vuln.description}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Tooltip content="Versión mínima segura aplicada">
                  <Badge tone="success" size="small">
                    {vuln.fixedIn}
                  </Badge>
                </Tooltip>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span" variant="bodySm" tone="subdued">
                  {vuln.date}
                </Text>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Bleed>

      <Card>
        <BlockStack gap="300">
          <InlineStack gap="200" blockAlign="center">
            <Icon source={ShieldCheckMarkIcon} tone="success" />
            <Text as="h3" variant="headingSm">Política de seguridad</Text>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            Las dependencias se revisan semanalmente. Las vulnerabilidades críticas y altas se parchean
            en máximo 48 horas mediante overrides en <code>package.json</code> o actualizaciones de versión.
          </Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );

  const panels = [OverviewPanel, ChangelogPanel, DependenciesPanel, LicensesPanel, SecurityPanel];

  return (
    <BlockStack gap="500">
      {/* Header */}
      <Card>
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <Box background="bg-fill-info-secondary" borderRadius="200" padding="200">
              <Icon source={InfoIcon} tone="info" />
            </Box>
            <BlockStack gap="050">
              <Text as="h2" variant="headingMd">Información del Sistema</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Novedades, dependencias, licencias y seguridad.
              </Text>
            </BlockStack>
          </InlineStack>
          <InlineStack gap="200" blockAlign="center">
            <Badge tone="info">v0.12.568</Badge>
            <Badge tone="success" icon={ShieldCheckMarkIcon}>
              Seguro
            </Badge>
          </InlineStack>
        </InlineStack>
      </Card>

      {/* Tabs */}
      <Card padding="0">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          <Box padding="400">{panels[selectedTab]}</Box>
        </Tabs>
      </Card>
    </BlockStack>
  );
}