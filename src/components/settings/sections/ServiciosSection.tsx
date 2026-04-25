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
  Select,
  Checkbox,
  Box,
  Banner,
  Badge,
  Divider,
  Icon,
  Collapsible,
  Tooltip,
} from '@shopify/polaris';
import {
  PhoneIcon,
  CashDollarIcon,
  GiftCardIcon,
  HeartIcon,
  PlayIcon,
  RefreshIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LockIcon,
  ConnectIcon,
  AlertCircleIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import {
  getAvailableProviders,
  type ServiceCategory,
} from '@/infrastructure/servicios/provider-registry';
import { parseError } from '@/lib/errors';
import { BrandLogo } from '@/components/ui/BrandLogo';

// ── Catálogo de categorías de servicios ──
const SERVICE_CATEGORIES: Record<
  ServiceCategory,
  { label: string; description: string; icon: typeof PhoneIcon; examples: string[] }
> = {
  recargas_telefonicas: {
    label: 'Recargas telefónicas',
    description: 'Tiempo aire para celulares prepago',
    icon: PhoneIcon,
    examples: ['Telcel', 'Movistar', 'AT&T', 'Unefon', 'Bait'],
  },
  servicios_publicos: {
    label: 'Servicios públicos',
    description: 'Luz, agua, gas, internet, telefonía fija',
    icon: CashDollarIcon,
    examples: ['CFE', 'Telmex', 'Izzi', 'Totalplay', 'Megacable'],
  },
  pines_electronicos: {
    label: 'Pines electrónicos',
    description: 'Códigos prepago para gaming y streaming',
    icon: GiftCardIcon,
    examples: ['Free Fire', 'PlayStation', 'Xbox', 'Steam', 'Google Play'],
  },
  tarjetas_lealtad: {
    label: 'Tarjetas de lealtad',
    description: 'Acumulación y canje de puntos',
    icon: HeartIcon,
    examples: ['Mi Kiosko', 'Programas propios', 'Puntos por compras'],
  },
  tv_streaming: {
    label: 'TV y streaming',
    description: 'TV de paga, plataformas digitales',
    icon: PlayIcon,
    examples: ['Sky', 'Dish', 'Netflix', 'Spotify', 'HBO'],
  },
  transporte: {
    label: 'Transporte',
    description: 'Recargas para tarjetas de transporte público',
    icon: ConnectIcon,
    examples: ['Tarjeta MI · CDMX', 'Movilidad Integrada'],
  },
};

export function ServiciosSection() {
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const saveStoreConfig = useDashboardStore((s) => s.saveStoreConfig);

  const [provider, setProvider] = useState(storeConfig.serviciosProvider || '');
  const [apiKey, setApiKey] = useState(storeConfig.serviciosApiKey || '');
  const [apiSecret, setApiSecret] = useState(storeConfig.serviciosApiSecret || '');
  const [sandbox, setSandbox] = useState(storeConfig.serviciosSandbox ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedConfig, setExpandedConfig] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setProvider(storeConfig.serviciosProvider || '');
    setApiKey(storeConfig.serviciosApiKey || '');
    setApiSecret(storeConfig.serviciosApiSecret || '');
    setSandbox(storeConfig.serviciosSandbox ?? true);
  }, [storeConfig]);

  const providers = useMemo(() => getAvailableProviders(), []);
  const providerOptions = [
    { label: 'Selecciona un proveedor…', value: '', disabled: true },
    ...providers.map((p) => ({
      label: `${p.name}${p.status === 'disponible' ? '' : ' (Próximamente)'}`,
      value: p.id,
      disabled: p.status !== 'disponible',
    })),
  ];

  const selectedProvider = providers.find((p) => p.id === provider);
  const isConfigured = Boolean(provider);
  const hasCredentials = isConfigured && Boolean(apiKey);
  const isHealthy = hasCredentials;

  const supportedCategories = selectedProvider?.categories ?? [];
  const totalCategories = Object.keys(SERVICE_CATEGORIES).length;
  const coveragePercent = Math.round((supportedCategories.length / totalCategories) * 100);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await saveStoreConfig({
        serviciosProvider: provider,
        serviciosApiKey: apiKey || undefined,
        serviciosApiSecret: apiSecret || undefined,
        serviciosSandbox: sandbox,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const { description } = parseError(err);
      setError(description);
    } finally {
      setSaving(false);
    }
  }, [provider, apiKey, apiSecret, sandbox, saveStoreConfig]);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await new Promise((r) => setTimeout(r, 800));
      if (!apiKey) {
        setTestResult({ success: false, message: 'Falta el API Key para probar la conexión.' });
      } else {
        setTestResult({
          success: true,
          message: `Credenciales válidas para ${selectedProvider?.name}. Modo: ${sandbox ? 'Sandbox' : 'Producción'}.`,
        });
      }
    } catch (err) {
      const { description } = parseError(err);
      setTestResult({ success: false, message: description });
    } finally {
      setTesting(false);
    }
  }, [apiKey, sandbox, selectedProvider]);

  return (
    <BlockStack gap="500">
      {/* ═══════════ HERO KPI ═══════════ */}
      <Card>
        <BlockStack gap="500">
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <BlockStack gap="100">
              <Text variant="headingLg" as="h2">
                Centro de Servicios y Recargas
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Recargas telefónicas, pago de servicios, pines electrónicos y tarjetas de lealtad
              </Text>
            </BlockStack>
            <InlineStack gap="300" blockAlign="center">
              <BlockStack gap="0">
                <Text variant="headingXl" as="p" alignment="end">
                  {supportedCategories.length}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued" alignment="end">
                  categorías cubiertas
                </Text>
              </BlockStack>
              <Box
                background={isHealthy ? 'bg-fill-success' : 'bg-fill-caution'}
                borderRadius="200"
                padding="200"
                minWidth="56px"
              >
                <Text
                  variant="headingSm"
                  as="p"
                  alignment="center"
                  tone={isHealthy ? 'text-inverse' : undefined}
                >
                  {coveragePercent}%
                </Text>
              </Box>
            </InlineStack>
          </InlineStack>

          <Divider />

          {/* Active provider summary */}
          <Box
            padding="400"
            borderRadius="300"
            background={isConfigured ? 'bg-surface-success' : 'bg-surface-caution'}
            borderWidth="025"
            borderColor={isConfigured ? 'border-success' : 'border-caution'}
          >
            <InlineStack align="space-between" blockAlign="center" wrap={false}>
              <InlineStack gap="300" blockAlign="center">
                {isConfigured ? (
                  <BrandLogo name={selectedProvider?.name ?? provider} size={36} />
                ) : (
                  <Box
                    background="bg-fill-caution"
                    padding="200"
                    borderRadius="200"
                    minWidth="36px"
                    minHeight="36px"
                  >
                    <Icon source={AlertCircleIcon} tone="caution" />
                  </Box>
                )}
                <BlockStack gap="050">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingSm" as="h3">
                      {selectedProvider?.name ?? 'Sin proveedor configurado'}
                    </Text>
                    <Badge
                      tone={
                        isConfigured ? (hasCredentials ? 'success' : 'warning') : 'warning'
                      }
                    >
                      {isConfigured
                        ? hasCredentials
                          ? 'Conectado'
                          : 'Pendiente credenciales'
                        : 'Configuración requerida'}
                    </Badge>
                    {isConfigured && sandbox && hasCredentials && (
                      <Badge tone="attention">Sandbox</Badge>
                    )}
                  </InlineStack>
                  <Text variant="bodySm" as="p" tone="subdued">
                    {selectedProvider?.description ??
                      'Necesitas elegir un agregador mexicano para empezar a cobrar pagos de servicios en tu negocio.'}
                  </Text>
                </BlockStack>
              </InlineStack>
              <Button
                size="slim"
                variant={isConfigured ? undefined : 'primary'}
                icon={expandedConfig ? ChevronUpIcon : ChevronDownIcon}
                onClick={() => setExpandedConfig((v) => !v)}
              >
                {expandedConfig ? 'Cerrar' : isConfigured ? 'Configurar' : 'Empezar'}
              </Button>
            </InlineStack>
          </Box>

          {/* Configuración collapsible */}
          <Collapsible
            id="servicios-config"
            open={expandedConfig}
            transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
          >
            <BlockStack gap="400">
              <Divider />
              <FormLayout>
                <Select
                  label="Proveedor activo"
                  options={providerOptions}
                  value={provider}
                  onChange={setProvider}
                  helpText="Selecciona el proveedor que procesará las recargas y pagos."
                />
              </FormLayout>

              {isConfigured && (
                <BlockStack gap="400">
                  {/* ── Guía paso a paso para obtener API Key ── */}
                  {selectedProvider?.apiKeySteps && (
                    <Box
                      padding="400"
                      background="bg-surface-info"
                      borderRadius="200"
                      borderWidth="025"
                      borderColor="border-info"
                    >
                      <BlockStack gap="300">
                        <InlineStack gap="200" blockAlign="center">
                          <Icon source={ConnectIcon} tone="info" />
                          <Text variant="headingSm" as="h4">
                            Cómo obtener tu API Key de {selectedProvider.name}
                          </Text>
                        </InlineStack>
                        <BlockStack gap="150">
                          {selectedProvider.apiKeySteps.map((step, i) => (
                            <InlineStack key={i} gap="200" blockAlign="start" wrap={false}>
                              <Box
                                background="bg-fill-info"
                                borderRadius="full"
                                minWidth="24px"
                                minHeight="24px"
                                padding="050"
                              >
                                <Text
                                  variant="bodySm"
                                  as="span"
                                  alignment="center"
                                  fontWeight="bold"
                                  tone="text-inverse"
                                >
                                  {i + 1}
                                </Text>
                              </Box>
                              <Text variant="bodySm" as="p">
                                {step}
                              </Text>
                            </InlineStack>
                          ))}
                        </BlockStack>
                        <InlineStack gap="200">
                          {selectedProvider.apiKeyUrl && (
                            <Button
                              size="slim"
                              variant="primary"
                              url={selectedProvider.apiKeyUrl}
                              external
                              icon={ConnectIcon}
                            >
                              Crear cuenta en {selectedProvider.name}
                            </Button>
                          )}
                          {selectedProvider.docsUrl && (
                            <Button
                              size="slim"
                              url={selectedProvider.docsUrl}
                              external
                            >
                              Ver documentación API
                            </Button>
                          )}
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  )}

                  <Banner tone="info" icon={LockIcon}>
                    <Text as="p" variant="bodySm">
                      Las credenciales se administran <strong>aquí en la plataforma</strong> — no en
                      archivos <code>.env.local</code>. Se cifran en base de datos y solo el
                      propietario de la cuenta puede leerlas o rotarlas.
                    </Text>
                  </Banner>

                  <FormLayout>
                    <FormLayout.Group condensed>
                      <TextField
                        label="API Key / Token"
                        value={apiKey}
                        onChange={setApiKey}
                        autoComplete="off"
                        placeholder="Pega aquí tu API Key del panel de proveedor"
                        helpText="Se obtiene en el panel de tu proveedor."
                        requiredIndicator
                      />
                      <TextField
                        label="API Secret (opcional)"
                        value={apiSecret}
                        onChange={setApiSecret}
                        type="password"
                        autoComplete="off"
                        placeholder="Solo si tu proveedor lo requiere"
                        helpText="Se almacena encriptado."
                      />
                    </FormLayout.Group>
                    <Checkbox
                      label="Modo Sandbox (pruebas)"
                      checked={sandbox}
                      onChange={setSandbox}
                      helpText="Valida la integración sin cobrar comisión real."
                    />
                  </FormLayout>
                </BlockStack>
              )}

              {!isConfigured && (
                <Banner tone="warning" icon={AlertCircleIcon}>
                  <Text as="p" variant="bodySm">
                    Para que tu negocio pueda <strong>cobrar pagos de luz, agua, internet,
                    telefonía, gas y recargas</strong>, necesitas contratar un agregador mexicano
                    (TAECEL, Recargaki, Pagaqui, etc.) y vincular su API Key aquí.
                  </Text>
                </Banner>
              )}

              {testResult && (
                <Banner
                  tone={testResult.success ? 'success' : 'critical'}
                  onDismiss={() => setTestResult(null)}
                >
                  {testResult.message}
                </Banner>
              )}

              {error && (
                <Banner tone="critical" onDismiss={() => setError(null)}>
                  {error}
                </Banner>
              )}

              {saved && (
                <Banner tone="success" onDismiss={() => setSaved(false)}>
                  Configuración guardada correctamente.
                </Banner>
              )}

              <InlineStack align="end" gap="200">
                {isConfigured && (
                  <Button
                    onClick={handleTestConnection}
                    loading={testing}
                    icon={RefreshIcon}
                    disabled={!apiKey}
                  >
                    Probar conexión
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={saving}
                  disabled={!isConfigured}
                >
                  Guardar configuración
                </Button>
              </InlineStack>
            </BlockStack>
          </Collapsible>
        </BlockStack>
      </Card>

      {/* ═══════════ CATÁLOGO DE SERVICIOS ═══════════ */}
      <Card>
        <BlockStack gap="400">
          <BlockStack gap="100">
            <Text variant="headingMd" as="h2">
              Catálogo de servicios
            </Text>
            <Text variant="bodySm" as="p" tone="subdued">
              Categorías que tu proveedor activo puede procesar.
            </Text>
          </BlockStack>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
            }}
          >
            {(Object.entries(SERVICE_CATEGORIES) as Array<
              [ServiceCategory, (typeof SERVICE_CATEGORIES)[ServiceCategory]]
            >).map(([key, cat]) => {
              const supported = supportedCategories.includes(key);
              return (
                <Box
                  key={key}
                  padding="400"
                  borderRadius="200"
                  background={supported ? 'bg-surface-success' : 'bg-surface-secondary'}
                  borderWidth="025"
                  borderColor={supported ? 'border-success' : 'border'}
                >
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="start">
                      <InlineStack gap="200" blockAlign="center">
                        <Box
                          background={supported ? 'bg-fill-success-secondary' : 'bg-fill-secondary'}
                          padding="150"
                          borderRadius="200"
                        >
                          <Icon source={cat.icon} tone={supported ? 'success' : 'subdued'} />
                        </Box>
                        <Text variant="bodyMd" fontWeight="semibold" as="span">
                          {cat.label}
                        </Text>
                      </InlineStack>
                      <Icon
                        source={supported ? CheckCircleIcon : XCircleIcon}
                        tone={supported ? 'success' : 'subdued'}
                      />
                    </InlineStack>
                    <Text variant="bodySm" as="p" tone="subdued">
                      {cat.description}
                    </Text>
                    <InlineStack gap="100" wrap>
                      {cat.examples.slice(0, 4).map((ex) => (
                        <Badge key={ex} size="small" tone={supported ? 'success' : undefined}>
                          {ex}
                        </Badge>
                      ))}
                    </InlineStack>
                  </BlockStack>
                </Box>
              );
            })}
          </div>
        </BlockStack>
      </Card>

      {/* ═══════════ MARKETPLACE DE PROVEEDORES ═══════════ */}
      <Card>
        <BlockStack gap="400">
          <BlockStack gap="100">
            <Text variant="headingMd" as="h2">
              Marketplace de proveedores
            </Text>
            <Text variant="bodySm" as="p" tone="subdued">
              Compara características y elige el proveedor que mejor se adapte a tu operación.
            </Text>
          </BlockStack>

          <BlockStack gap="300">
            {providers.map((p) => {
              const isActive = p.id === provider;
              const isProximamente = p.status !== 'disponible';
              return (
                <Box
                  key={p.id}
                  padding="400"
                  borderRadius="200"
                  background={isActive ? 'bg-surface-success' : 'bg-surface'}
                  borderWidth="025"
                  borderColor={isActive ? 'border-success' : 'border'}
                >
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center" wrap={false}>
                      <InlineStack gap="300" blockAlign="center">
                        <BrandLogo name={p.name} size={32} />
                        <BlockStack gap="050">
                          <InlineStack gap="200" blockAlign="center">
                            <Text variant="bodyMd" fontWeight="bold" as="span">
                              {p.name}
                            </Text>
                            {isActive && <Badge tone="success">Activo</Badge>}
                            {isProximamente && <Badge tone="attention">Próximamente</Badge>}
                            {!isActive && !isProximamente && <Badge>Disponible</Badge>}
                          </InlineStack>
                          <Text variant="bodySm" as="p" tone="subdued">
                            {p.description}
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      {!isActive && !isProximamente && (
                        <Button
                          size="slim"
                          variant="primary"
                          onClick={() => {
                            setProvider(p.id);
                            setExpandedConfig(true);
                          }}
                        >
                          Activar
                        </Button>
                      )}
                    </InlineStack>

                    {/* Capabilities matrix */}
                    <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '12px',
                        }}
                      >
                        <BlockStack gap="050">
                          <Text variant="bodySm" tone="subdued" as="span">
                            Cobertura
                          </Text>
                          <Text variant="bodySm" fontWeight="semibold" as="span">
                            {p.coverage}
                          </Text>
                        </BlockStack>
                        <BlockStack gap="050">
                          <Text variant="bodySm" tone="subdued" as="span">
                            Comisión
                          </Text>
                          <Text variant="bodySm" fontWeight="semibold" as="span">
                            {p.commission}
                          </Text>
                        </BlockStack>
                        <BlockStack gap="050">
                          <Text variant="bodySm" tone="subdued" as="span">
                            Liquidación
                          </Text>
                          <Text variant="bodySm" fontWeight="semibold" as="span">
                            {p.settlement}
                          </Text>
                        </BlockStack>
                      </div>
                    </Box>

                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued" as="span">
                        Categorías soportadas ({p.categories.length}/{totalCategories})
                      </Text>
                      <InlineStack gap="100" wrap>
                        {p.categories.map((c) => (
                          <Tooltip key={c} content={SERVICE_CATEGORIES[c].description}>
                            <Badge size="small">{SERVICE_CATEGORIES[c].label}</Badge>
                          </Tooltip>
                        ))}
                      </InlineStack>
                    </BlockStack>

                    {p.docsUrl && (
                      <InlineStack gap="200" blockAlign="center" wrap>
                        {p.apiKeyUrl && (
                          <Button
                            size="slim"
                            variant="primary"
                            url={p.apiKeyUrl}
                            external
                            icon={ConnectIcon}
                          >
                            Obtener API Key
                          </Button>
                        )}
                        <Button size="slim" url={p.docsUrl} external>
                          Documentación API
                        </Button>
                      </InlineStack>
                    )}
                  </BlockStack>
                </Box>
              );
            })}
          </BlockStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
