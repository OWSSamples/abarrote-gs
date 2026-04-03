'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useForm, useField } from '@shopify/react-form';
import {
  Text,
  BlockStack,
  InlineStack,
  Button,
  Banner,
  Page,
  Icon,
  Box,
  Divider,
  Card,
  Badge,
  ContextualSaveBar,
} from '@shopify/polaris';
import {
  getDevices,
  getMPConfigFromStore,
} from '@/lib/mercadopago';
import type { MercadoPagoConfig } from '@/lib/mercadopago';
import { useDashboardStore } from '@/store/dashboardStore';
import type { StoreConfig } from '@/types';
import {
  ChevronRightIcon,
  StoreIcon,
  ReceiptIcon,
  InventoryIcon,
  ChatIcon,
  CreditCardIcon,
  NoteIcon,
  PrintIcon,
  StarFilledIcon,
  SettingsFilledIcon,
  ViewIcon,
} from '@shopify/polaris-icons';

import { GeneralSection } from './sections/GeneralSection';
import { FiscalSection } from './sections/FiscalSection';
import { PosSection } from './sections/PosSection';
import { HardwareSection } from './sections/HardwareSection';
import { LoyaltySection } from './sections/LoyaltySection';
import { InventorySection } from './sections/InventorySection';
import { NotificationsSection } from './sections/NotificationsSection';
import { PaymentsSection } from './sections/PaymentsSection';
import { CustomerDisplaySection } from './sections/CustomerDisplaySection';

const SETTINGS_CATEGORIES = [
  { id: 'general', title: 'Detalles de la tienda', description: 'Gestiona la identidad de tu negocio, dirección y preferencias básicas.', icon: StoreIcon },
  { id: 'fiscal', title: 'Fiscales e Impuestos', description: 'Configura tu RFC, régimen fiscal, moneda y tasas de IVA.', icon: NoteIcon },
  { id: 'pos', title: 'Punto de Venta y Recibos', description: 'Personaliza los tickets impresos y la estructura de códigos de barras.', icon: ReceiptIcon },
  { id: 'hardware', title: 'Hardware y Periféricos', description: 'Configura IPs de impresoras, cajones de dinero y básculas seriales.', icon: PrintIcon },
  { id: 'loyalty', title: 'Loyalty y Puntos', description: 'Configura las conversiones y recompensas para la fidelización de clientes.', icon: StarFilledIcon },
  { id: 'inventory', title: 'Inventario de productos', description: 'Establece reglas y umbrales para alertas de stock y caducidad.', icon: InventoryIcon },
  { id: 'notifications', title: 'Notificaciones', description: 'Conecta notificaciones push a tu celular mediante Telegram.', icon: ChatIcon },
  { id: 'payments', title: 'Pagos Integrados', description: 'Vincula tu terminal Point de Mercado Pago para cobros físicos.', icon: CreditCardIcon },
  { id: 'customer-display', title: 'Pantalla del Cliente', description: 'Muestra al cliente sus productos y totales en un segundo monitor o tablet.', icon: ViewIcon },
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
  } = useForm({
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
      customerDisplayEnabled: useField(storeConfig.customerDisplayEnabled ?? false),
      customerDisplayWelcome: useField(storeConfig.customerDisplayWelcome || ''),
      customerDisplayFarewell: useField(storeConfig.customerDisplayFarewell || ''),
      customerDisplayPromoText: useField(storeConfig.customerDisplayPromoText || ''),
      customerDisplayPromoImage: useField(storeConfig.customerDisplayPromoImage || ''),
    },
    onSubmit: async (f) => {
      await saveStoreConfig(f as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      return { status: 'success' };
    },
  });

  const [saved, setSaved] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Sync with store when it changes externally
  useEffect(() => {
    resetConfig();
  }, [storeConfig, resetConfig]);

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
    const obj: any = {};
    Object.keys(fields).forEach(key => {
      obj[key] = (fields as any)[key].value;
    });
    return obj as StoreConfig;
  }, [fields]);

  const updateField = useCallback(<K extends keyof StoreConfig>(field: K, value: StoreConfig[K]) => {
    (fields as any)[field].onChange(value);
  }, [fields]);


  // Mercado Pago — derived from form fields (persisted to DB)
  const mpConfig = useMemo<MercadoPagoConfig>(() => ({
    enabled: fields.mpEnabled.value,
    publicKey: fields.mpPublicKey.value,
    deviceId: fields.mpDeviceId.value,
  }), [fields.mpEnabled.value, fields.mpPublicKey.value, fields.mpDeviceId.value]);

  const [mpTesting, setMpTesting] = useState(false);
  const [mpTestResult, setMpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [mpDevices, setMpDevices] = useState<{ id: string; operating_mode: string }[]>([]);

  // Telegram config
  const [tgTesting, setTgTesting] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Logo upload
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const handleLogoDrop = useCallback((_accepted: File[], rejected: File[]) => {
    if (rejected.length > 0) {
      setLogoError('Solo se aceptan imágenes (JPG, PNG, WebP, SVG) de máximo 5 MB.');
    }
  }, []);

  const handleLogoDropAccepted = useCallback(async (files: File[]) => {
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
  }, [updateField]);

  const handleMPSave = useCallback(() => {
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
      setMpTestResult({ success: false, message: err instanceof Error ? err.message : 'Error al conectar con Mercado Pago' });
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
    } catch (err) {
      setTgTestResult({ success: false, message: 'Error al conectar con Telegram API' });
    }
    setTgTesting(false);
  }, [fields.telegramToken.value, fields.telegramChatId.value]);

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
            cobrarQrUrlField={fields.cobrarQrUrl}
          />
        );
      case 'customer-display':
        return <CustomerDisplaySection config={config} updateField={updateField} />;
      default:
        return null;
    }
  };

  const activeCategory = SETTINGS_CATEGORIES.find(c => c.id === selectedCategory);

  // ── Detail view when a category is selected ──
  if (selectedCategory !== null) {
    return (
      <>
        {isDirty && (
          <ContextualSaveBar
            message="Cambios sin guardar en la configuración"
            saveAction={{
              onAction: handleSave,
              loading: saving,
            }}
            discardAction={{
              onAction: resetConfig,
            }}
          />
        )}
        <Page
          backAction={{ content: 'Configuración', onAction: () => setSelectedCategory(null) }}
          title={activeCategory?.title || 'Configuración'}
          subtitle={activeCategory?.description}
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
            <Box paddingBlockEnd="1200">
              {getActiveView()}
            </Box>
          </form>
        </Page>
      </>
    );
  }

  // ── Computed status badges ──
  const storeConfigured = !!(config.storeName && config.address);
  const fiscalConfigured = !!(config.rfc && config.regimenFiscal);
  const notificationsConfigured = !!(config.enableNotifications && config.telegramToken && config.telegramChatId);
  const mpLinked = config.mpEnabled;
  const hardwareConfigured = !!(config.printerIp);
  const loyaltyConfigured = config.loyaltyEnabled;

  const STATUS_MAP: Record<string, { configured: boolean; label: string }> = {
    general: { configured: storeConfigured, label: storeConfigured ? 'Configurado' : 'Pendiente' },
    fiscal: { configured: fiscalConfigured, label: fiscalConfigured ? 'Configurado' : 'Pendiente' },
    pos: { configured: true, label: 'Activo' },
    hardware: { configured: hardwareConfigured, label: hardwareConfigured ? 'Conectado' : 'Sin conectar' },
    loyalty: { configured: loyaltyConfigured, label: loyaltyConfigured ? 'Activo' : 'Inactivo' },
    inventory: { configured: true, label: 'Activo' },
    notifications: { configured: notificationsConfigured, label: notificationsConfigured ? 'Conectado' : 'Sin conectar' },
    payments: { configured: mpLinked, label: mpLinked ? 'Vinculado' : 'Sin vincular' },    'customer-display': { configured: config.customerDisplayEnabled, label: config.customerDisplayEnabled ? 'Activo' : 'Inactivo' },  };

  // Group categories
  const GROUPS = [
    {
      title: 'Negocio',
      description: 'Identidad, datos fiscales y configuración operativa de tu tienda.',
      items: SETTINGS_CATEGORIES.filter(c => ['general', 'fiscal'].includes(c.id)),
    },
    {
      title: 'Punto de Venta',
      description: 'Tickets, periféricos y configuración del mostrador.',
      items: SETTINGS_CATEGORIES.filter(c => ['pos', 'hardware', 'customer-display'].includes(c.id)),
    },
    {
      title: 'Comercial',
      description: 'Programas de lealtad y reglas de inventario.',
      items: SETTINGS_CATEGORIES.filter(c => ['loyalty', 'inventory'].includes(c.id)),
    },
    {
      title: 'Integraciones',
      description: 'Servicios externos y canales de comunicación.',
      items: SETTINGS_CATEGORIES.filter(c => ['notifications', 'payments'].includes(c.id)),
    },
  ];

  return (
    <>
      {isDirty && (
        <ContextualSaveBar
          message="Cambios sin guardar en la configuración"
          saveAction={{
            onAction: handleSave,
            loading: saving,
          }}
          discardAction={{
            onAction: resetConfig,
          }}
        />
      )}
      <Page
        title="Configuración"
        subtitle={`${config.storeName || 'Mi Tienda'} — Administra las políticas operativas de tu negocio`}
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
          <BlockStack gap="800">
            {saved && (
              <Banner tone="success" title="Configuración guardada correctamente" onDismiss={() => setSaved(false)} />
            )}

            {/* Settings groups */}
            {GROUPS.map((group) => (
              <BlockStack gap="400" key={group.title}>
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h2">{group.title}</Text>
                  <Text variant="bodySm" as="p" tone="subdued">{group.description}</Text>
                </BlockStack>

                <Box borderStyle="solid" borderWidth="025" borderColor="border" borderRadius="300" overflowX="hidden">
                  <BlockStack gap="0">
                    {group.items.map((cat, idx) => {
                      const status = STATUS_MAP[cat.id];
                      return (
                        <div key={cat.id}>
                          {idx > 0 && <Divider />}
                          <div
                            className="settings-row"
                            onClick={() => setSelectedCategory(cat.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') setSelectedCategory(cat.id); }}
                          >
                            <Box padding="400">
                              <InlineStack align="space-between" blockAlign="center" gap="400">
                                <InlineStack gap="400" blockAlign="center">
                                  <Box
                                    padding="300"
                                    background={status?.configured ? 'bg-fill-success-secondary' : 'bg-surface-secondary'}
                                    borderRadius="200"
                                  >
                                    <Icon source={cat.icon} tone={status?.configured ? 'success' : 'subdued'} />
                                  </Box>
                                  <BlockStack gap="050">
                                    <Text variant="bodyMd" fontWeight="semibold" as="span">{cat.title}</Text>
                                    <Text variant="bodySm" as="span" tone="subdued">{cat.description}</Text>
                                  </BlockStack>
                                </InlineStack>

                                <InlineStack gap="300" blockAlign="center">
                                  <Badge tone={status?.configured ? 'success' : undefined}>
                                    {status?.label ?? 'Pendiente'}
                                  </Badge>
                                  <Icon source={ChevronRightIcon} tone="subdued" />
                                </InlineStack>
                              </InlineStack>
                            </Box>
                          </div>
                        </div>
                      );
                    })}
                  </BlockStack>
                </Box>
              </BlockStack>
            ))}

            {/* Tools section */}
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">Herramientas</Text>
                <Text variant="bodySm" as="p" tone="subdued">Mantenimiento y respaldo de la configuración del sistema.</Text>
              </BlockStack>

              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center" wrap={false}>
                    <BlockStack gap="100">
                      <Text variant="bodyMd" fontWeight="semibold" as="span">Respaldo de configuración</Text>
                      <Text variant="bodySm" as="span" tone="subdued">Descarga un archivo JSON con toda la configuración del POS.</Text>
                    </BlockStack>
                    <Button>Exportar</Button>
                  </InlineStack>
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center" wrap={false}>
                    <BlockStack gap="100">
                      <Text variant="bodyMd" fontWeight="semibold" as="span">Restablecer valores de fábrica</Text>
                      <Text variant="bodySm" as="span" tone="subdued">Restablece IPs, folios y parámetros a sus valores originales.</Text>
                    </BlockStack>
                    <Button tone="critical">Resetear</Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </BlockStack>

            {/* Footer */}
            <Box paddingBlock="400">
              <BlockStack align="center" gap="200">
                <div style={{ textAlign: 'center' }}>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Versión del sistema: <Text as="span" fontWeight="semibold">v0.12.568</Text> · Última actualización: {new Date().toLocaleDateString('es-MX')}
                  </Text>
                </div>
              </BlockStack>
            </Box>
          </BlockStack>
        </form>

        <style>{`
          .settings-row {
            cursor: pointer;
            transition: background 0.15s ease;
          }
          .settings-row:hover {
            background: var(--p-color-bg-surface-hover);
          }
          .settings-row:focus-visible {
            outline: 2px solid var(--p-color-border-focus);
            outline-offset: -2px;
            border-radius: var(--p-border-radius-300);
          }
        `}</style>
      </Page>
    </>
  );
}
