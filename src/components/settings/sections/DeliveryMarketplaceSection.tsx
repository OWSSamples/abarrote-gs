'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  InlineGrid,
  InlineStack,
  Modal,
  ProgressBar,
  Spinner,
  Text,
} from '@shopify/polaris';
import {
  AlertCircleIcon,
  AppsIcon,
  CheckCircleIcon,
  ConnectIcon,
  DeleteIcon,
  ExternalIcon,
  GlobeIcon,
  MobileIcon,
  PlusCircleIcon,
} from '@shopify/polaris-icons';
import { useSearchParams } from 'next/navigation';
import { disconnectDeliveryProviderAction, getDeliveryConnectionStatusAction } from '@/app/actions/delivery-actions';
import type { DeliveryProvider } from '@/infrastructure/delivery/delivery-types';
import { parseError } from '@/lib/errors';
import { useDashboardStore } from '@/store/dashboardStore';

type DeliveryIconSource = typeof GlobeIcon;

interface DeliveryApp {
  id: DeliveryProvider;
  name: string;
  vendor: string;
  tagline: string;
  description: string;
  icon: DeliveryIconSource;
  category: string;
  status: 'beta' | 'proximamente';
  isAvailable: boolean;
  plan: string;
  rating: string;
  installTime: string;
  highlights: string[];
  features: string[];
  permissions: string[];
  setupSteps: string[];
  docsUrl: string;
}

interface ConnectionState {
  installed: boolean;
  connected: boolean;
  status: 'connected' | 'disconnected' | 'suspended' | 'not_installed';
  providerStoreId?: string;
  environment?: string;
  connectedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  totalOrders: number;
  pendingOrders: number;
  activeOrders: number;
  latestOrderAt?: Date | string | null;
}

const EMPTY_CONNECTION: ConnectionState = {
  installed: false,
  connected: false,
  status: 'not_installed',
  totalOrders: 0,
  pendingOrders: 0,
  activeOrders: 0,
  latestOrderAt: null,
};

const DELIVERY_APPS: readonly DeliveryApp[] = [
  {
    id: 'ubereats',
    name: 'Uber Eats',
    vendor: 'Uber Direct / Uber Eats Marketplace',
    tagline: 'Pedidos de marketplace en tiempo real dentro de Kiosko.',
    description:
      'Recibe pedidos, valida firmas, guarda eventos, acepta órdenes, sincroniza preparación y opera Uber Eats desde el flujo de caja.',
    icon: MobileIcon,
    category: 'Delivery',
    status: 'beta',
    isAvailable: true,
    plan: 'Incluido en Beta',
    rating: 'Nuevo',
    installTime: '3 min',
    highlights: ['OAuth seguro', 'Webhook M2M', 'Pedidos en vivo', 'Acciones operativas'],
    features: [
      'Recepción automática de pedidos entrantes.',
      'Estados operativos: aceptar, rechazar y marcar listo.',
      'Validación de webhook con Cognito M2M y firma HMAC.',
      'Tokens cifrados en servidor y conexión persistente por tienda.',
      'Métricas de actividad y salud de integración en el marketplace.',
    ],
    permissions: [
      'Leer pedidos del canal Uber Eats.',
      'Enviar confirmaciones de preparación y disponibilidad.',
      'Guardar eventos técnicos para auditoría e idempotencia.',
      'Asociar la conexión únicamente con esta tienda.',
    ],
    setupSteps: [
      'Instalar la app en Kiosko.',
      'Autorizar con la cuenta administradora de Uber Eats.',
      'Confirmar webhook público en el portal de Uber.',
      'Recibir el primer evento y validar pedidos en Kiosko.',
    ],
    docsUrl: 'https://developer.uber.com/docs/eats',
  },
  {
    id: 'rappi',
    name: 'Rappi',
    vendor: 'Rappi Marketplace',
    tagline: 'Catálogo y pedidos Rappi desde el punto de venta.',
    description:
      'Próximamente podrás integrar tu tienda con Rappi para recibir pedidos de delivery y sincronizar tu catálogo de productos.',
    icon: GlobeIcon,
    category: 'Delivery',
    status: 'proximamente',
    isAvailable: false,
    plan: 'Próximamente',
    rating: 'Lista de espera',
    installTime: 'Pendiente',
    highlights: ['Catálogo', 'Pedidos', 'Inventario', 'Promociones'],
    features: [
      'Recepción de pedidos Rappi en Kiosko.',
      'Sincronización futura de catálogo y disponibilidad.',
      'Alertas operativas para pedidos pendientes.',
    ],
    permissions: [
      'Leer pedidos Rappi.',
      'Actualizar estados de preparación.',
      'Sincronizar catálogo cuando esté disponible.',
    ],
    setupSteps: ['Unirse a la lista de espera.', 'Activar credenciales Rappi.', 'Configurar catálogo y horarios.'],
    docsUrl: 'https://www.rappi.com.mx/',
  },
];

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return 'Sin actividad';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin actividad';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getConnectionTone(connection: ConnectionState): 'success' | 'attention' | 'critical' | 'info' | undefined {
  if (connection.connected) return 'success';
  if (connection.status === 'suspended') return 'critical';
  if (connection.installed) return 'attention';
  return 'info';
}

function getConnectionLabel(connection: ConnectionState): string {
  if (connection.connected) return 'Instalada';
  if (connection.status === 'suspended') return 'Suspendida';
  if (connection.installed) return 'Requiere conexión';
  return 'No instalada';
}

function getDefaultConnections(): Record<DeliveryProvider, ConnectionState> {
  return {
    rappi: { ...EMPTY_CONNECTION },
    ubereats: { ...EMPTY_CONNECTION },
  };
}

export function DeliveryMarketplaceSection() {
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const storeId = storeConfig.id || 'main';
  const searchParams = useSearchParams();

  const [connections, setConnections] = useState<Record<DeliveryProvider, ConnectionState>>(getDefaultConnections);
  const [selectedAppId, setSelectedAppId] = useState<DeliveryProvider>('ubereats');
  const [detailAppId, setDetailAppId] = useState<DeliveryProvider | null>(null);
  const [installingProvider, setInstallingProvider] = useState<DeliveryProvider | null>(null);
  const [oauthStep, setOauthStep] = useState<'installing' | 'oauth' | 'success' | 'error'>('installing');
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isOAuthSubmitting, setIsOAuthSubmitting] = useState(false);
  const [loading, setLoading] = useState<DeliveryProvider | null>(null);
  const [actionMsg, setActionMsg] = useState<{ success: boolean; message: string } | null>(null);

  const selectedApp = DELIVERY_APPS.find((app) => app.id === selectedAppId) ?? DELIVERY_APPS[0];
  const detailApp = detailAppId ? DELIVERY_APPS.find((app) => app.id === detailAppId) : null;
  const selectedConnection = connections[selectedApp.id] ?? EMPTY_CONNECTION;
  const detailConnection = detailApp ? (connections[detailApp.id] ?? EMPTY_CONNECTION) : EMPTY_CONNECTION;

  const fetchStatus = useCallback(async () => {
    try {
      const rows = await getDeliveryConnectionStatusAction(storeId);
      const updated = getDefaultConnections();
      for (const row of rows) {
        if (row.provider in updated) {
          const provider = row.provider as DeliveryProvider;
          const status = row.status as ConnectionState['status'];
          updated[provider] = {
            installed: true,
            connected: status === 'connected',
            status,
            providerStoreId: row.providerStoreId || undefined,
            environment: row.environment || undefined,
            connectedAt: row.connectedAt,
            updatedAt: row.updatedAt,
            totalOrders: row.totalOrders ?? 0,
            pendingOrders: row.pendingOrders ?? 0,
            activeOrders: row.activeOrders ?? 0,
            latestOrderAt: row.latestOrderAt,
          };
        }
      }
      setConnections(updated);
    } catch (err) {
      setActionMsg({ success: false, message: parseError(err).description });
    }
  }, [storeId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const oauthProvider = searchParams.get('oauth');
    const oauthDeliveredProvider = searchParams.get('provider');
    if (oauthProvider === 'success' && oauthDeliveredProvider === 'ubereats') {
      setInstallingProvider(null);
      setOauthStep('success');
      setActionMsg({ success: true, message: 'Uber Eats quedó instalado y conectado para esta tienda.' });
      void fetchStatus();
    }
    if (oauthProvider === 'denied' || oauthProvider === 'error') {
      setInstallingProvider(null);
      setOauthStep('error');
      setOauthError(searchParams.get('msg') ?? 'La autorización fue cancelada o falló');
      setActionMsg({ success: false, message: 'No se pudo completar la instalación de Uber Eats.' });
    }
  }, [searchParams, fetchStatus]);

  const installedCount = useMemo(
    () => Object.values(connections).filter((connection) => connection.installed).length,
    [connections],
  );
  const connectedCount = useMemo(
    () => Object.values(connections).filter((connection) => connection.connected).length,
    [connections],
  );
  const totalActiveOrders = useMemo(
    () => Object.values(connections).reduce((sum, connection) => sum + connection.activeOrders, 0),
    [connections],
  );

  const handleInstall = useCallback((provider: DeliveryProvider) => {
    const app = DELIVERY_APPS.find((item) => item.id === provider);
    if (!app?.isAvailable) {
      setActionMsg({ success: false, message: `${app?.name ?? provider} estará disponible próximamente.` });
      return;
    }
    setSelectedAppId(provider);
    setInstallingProvider(provider);
    setOauthStep('installing');
    setOauthError(null);
    window.setTimeout(() => setOauthStep('oauth'), 900);
  }, []);

  const handleOpenUberOAuth = useCallback(async () => {
    setIsOAuthSubmitting(true);
    setOauthError(null);
    try {
      const params = new URLSearchParams({ store: storeId });
      window.open(
        `/api/integrations/uber/authorize?${params.toString()}`,
        'uber_oauth',
        'width=650,height=750,resizable=yes,scrollbars=yes',
      );
      setIsOAuthSubmitting(false);
    } catch (err) {
      setOauthError(parseError(err).description);
      setIsOAuthSubmitting(false);
    }
  }, [storeId]);

  const handleDisconnect = useCallback(
    async (provider: DeliveryProvider) => {
      setLoading(provider);
      setActionMsg(null);
      try {
        const appName = DELIVERY_APPS.find((app) => app.id === provider)?.name ?? provider;
        const result = await disconnectDeliveryProviderAction(storeId, provider);
        if (!result.success) throw new Error(result.message ?? 'No se pudo desconectar la app');
        await fetchStatus();
        setActionMsg({
          success: true,
          message: `${appName} se desconectó. La app queda instalada para reconectar después.`,
        });
      } catch (err) {
        setActionMsg({ success: false, message: parseError(err).description });
      } finally {
        setLoading(null);
      }
    },
    [storeId, fetchStatus],
  );

  return (
    <BlockStack gap="500">
      <Card>
        <BlockStack gap="500">
          <InlineStack align="space-between" blockAlign="start" gap="400">
            <BlockStack gap="150">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={AppsIcon} tone="base" />
                <Text variant="headingLg" as="h2">
                  Marketplace de Apps
                </Text>
              </InlineStack>
              <Text variant="bodyMd" as="p" tone="subdued">
                Instala extensiones como en Shopify: cada app queda persistida por tienda, muestra su salud, permisos,
                actividad y configuración operativa.
              </Text>
            </BlockStack>
            <InlineStack gap="200">
              <Badge
                tone={connectedCount > 0 ? 'success' : 'info'}
                icon={connectedCount > 0 ? CheckCircleIcon : PlusCircleIcon}
              >
                {`${connectedCount} conectada(s)`}
              </Badge>
              <Badge tone="info">{`${installedCount} instalada(s)`}</Badge>
            </InlineStack>
          </InlineStack>

          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
            <Card background="bg-surface-secondary">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Apps instaladas
                </Text>
                <Text as="p" variant="headingLg" fontWeight="bold">
                  {installedCount}
                </Text>
              </BlockStack>
            </Card>
            <Card background="bg-surface-secondary">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Pedidos activos
                </Text>
                <Text as="p" variant="headingLg" fontWeight="bold">
                  {totalActiveOrders}
                </Text>
              </BlockStack>
            </Card>
            <Card background="bg-surface-secondary">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Canal destacado
                </Text>
                <Text as="p" variant="headingLg" fontWeight="bold">
                  {selectedApp.name}
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </BlockStack>
      </Card>

      {actionMsg && (
        <Banner tone={actionMsg.success ? 'success' : 'critical'} onDismiss={() => setActionMsg(null)}>
          {actionMsg.message}
        </Banner>
      )}

      <InlineGrid columns={{ xs: 1, md: 2 }} gap="500">
        <BlockStack gap="300">
          <Text as="h3" variant="headingMd" fontWeight="semibold">
            Catálogo
          </Text>
          {DELIVERY_APPS.map((app) => {
            const connection = connections[app.id] ?? EMPTY_CONNECTION;
            const isSelected = selectedAppId === app.id;
            return (
              <Card key={app.id} background={isSelected ? 'bg-fill-info-secondary' : undefined}>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="start" gap="300">
                    <InlineStack gap="300" blockAlign="center">
                      <Box
                        padding="300"
                        background={connection.connected ? 'bg-fill-success-secondary' : 'bg-surface-secondary'}
                        borderRadius="200"
                      >
                        <Icon source={app.icon} tone={connection.connected ? 'success' : 'base'} />
                      </Box>
                      <BlockStack gap="050">
                        <Text as="h4" variant="headingSm" fontWeight="semibold">
                          {app.name}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {app.category}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    <Badge tone={app.status === 'beta' ? 'attention' : undefined}>
                      {app.status === 'beta' ? 'BETA' : 'Próximamente'}
                    </Badge>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {app.tagline}
                  </Text>
                  <InlineStack gap="200">
                    <Badge
                      tone={getConnectionTone(connection)}
                      icon={connection.connected ? CheckCircleIcon : undefined}
                    >
                      {getConnectionLabel(connection)}
                    </Badge>
                    <Badge>{app.plan}</Badge>
                  </InlineStack>
                  <InlineStack gap="200">
                    <Button size="slim" onClick={() => setSelectedAppId(app.id)} pressed={isSelected}>
                      Ver detalle
                    </Button>
                    <Button size="slim" variant="plain" onClick={() => setDetailAppId(app.id)}>
                      Ficha completa
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            );
          })}
        </BlockStack>

        <BlockStack gap="400">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between" blockAlign="start" gap="400">
                  <InlineStack gap="300" blockAlign="center">
                    <Box
                      padding="400"
                      background={selectedConnection.connected ? 'bg-fill-success-secondary' : 'bg-surface-secondary'}
                      borderRadius="300"
                    >
                      <Icon source={selectedApp.icon} tone={selectedConnection.connected ? 'success' : 'base'} />
                    </Box>
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingLg" fontWeight="bold">
                        {selectedApp.name}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Por {selectedApp.vendor}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <Badge
                    tone={getConnectionTone(selectedConnection)}
                    icon={selectedConnection.connected ? CheckCircleIcon : undefined}
                  >
                    {getConnectionLabel(selectedConnection)}
                  </Badge>
                </InlineStack>

                <Text as="p" variant="bodyMd">
                  {selectedApp.description}
                </Text>

                <InlineGrid columns={{ xs: 2, sm: 4 }} gap="300">
                  <Metric label="Tiempo de instalación" value={selectedApp.installTime} />
                  <Metric label="Señal de confianza" value={selectedApp.rating} />
                  <Metric label="Actividad total" value={`${selectedConnection.totalOrders}`} />
                  <Metric label="Pedidos activos" value={`${selectedConnection.activeOrders}`} />
                </InlineGrid>

                <Divider />

                <BlockStack gap="300">
                  <Text as="h4" variant="headingSm" fontWeight="semibold">
                    Funciones incluidas
                  </Text>
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="200">
                    {selectedApp.features.map((feature) => (
                      <InlineStack key={feature} gap="200" blockAlign="start" wrap={false}>
                        <Icon source={CheckCircleIcon} tone="success" />
                        <Text as="span" variant="bodySm">
                          {feature}
                        </Text>
                      </InlineStack>
                    ))}
                  </InlineGrid>
                </BlockStack>

                <InlineStack gap="200">
                  {selectedConnection.connected ? (
                    <>
                      <Button variant="primary" onClick={() => setDetailAppId(selectedApp.id)}>
                        Configurar app
                      </Button>
                      <Button
                        tone="critical"
                        icon={DeleteIcon}
                        loading={loading === selectedApp.id}
                        onClick={() => handleDisconnect(selectedApp.id)}
                      >
                        Desconectar
                      </Button>
                    </>
                  ) : selectedApp.isAvailable ? (
                    <Button variant="primary" icon={ConnectIcon} onClick={() => handleInstall(selectedApp.id)}>
                      {selectedConnection.installed ? 'Reconectar app' : 'Instalar app'}
                    </Button>
                  ) : (
                    <Button disabled>Unirme a lista de espera</Button>
                  )}
                  <Button variant="plain" icon={ExternalIcon} url={selectedApp.docsUrl} target="_blank">
                    Documentación
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd" fontWeight="semibold">
                  Checklist de instalación
                </Text>
                {selectedApp.setupSteps.map((step, index) => {
                  const complete = selectedConnection.connected || (selectedConnection.installed && index === 0);
                  return (
                    <InlineStack key={step} gap="300" blockAlign="start" wrap={false}>
                      <Badge tone={complete ? 'success' : 'info'}>{`${index + 1}`}</Badge>
                      <BlockStack gap="050">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          {step}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {complete ? 'Completado para esta tienda.' : 'Pendiente de completar.'}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  );
                })}
              </BlockStack>
            </Card>
          </BlockStack>
        </BlockStack>
      </InlineGrid>

      {connectedCount === 0 && (
        <EmptyState
          heading="Instala tu primera app de delivery"
          action={{ content: 'Instalar Uber Eats', onAction: () => handleInstall('ubereats') }}
          image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-delivery.svg"
        >
          <Text as="p" variant="bodyMd" tone="subdued">
            El marketplace conserva las apps instaladas por tienda y muestra su estado real cada vez que vuelves al
            dashboard.
          </Text>
        </EmptyState>
      )}

      {installingProvider && (
        <InstallModal
          app={DELIVERY_APPS.find((app) => app.id === installingProvider) ?? DELIVERY_APPS[0]}
          step={oauthStep}
          error={oauthError}
          submitting={isOAuthSubmitting}
          onClose={() => !isOAuthSubmitting && setInstallingProvider(null)}
          onAuthorize={handleOpenUberOAuth}
          onRetry={() => {
            setOauthStep('oauth');
            setOauthError(null);
          }}
        />
      )}

      {detailApp && (
        <AppDetailModal
          app={detailApp}
          connection={detailConnection}
          loading={loading === detailApp.id}
          onClose={() => setDetailAppId(null)}
          onInstall={() => handleInstall(detailApp.id)}
          onDisconnect={() => handleDisconnect(detailApp.id)}
        />
      )}
    </BlockStack>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box padding="300" background="bg-surface-secondary" borderRadius="200">
      <BlockStack gap="050">
        <Text as="p" variant="bodyXs" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="headingSm" fontWeight="bold">
          {value}
        </Text>
      </BlockStack>
    </Box>
  );
}

function InstallModal({
  app,
  step,
  error,
  submitting,
  onClose,
  onAuthorize,
  onRetry,
}: {
  app: DeliveryApp;
  step: 'installing' | 'oauth' | 'success' | 'error';
  error: string | null;
  submitting: boolean;
  onClose: () => void;
  onAuthorize: () => void;
  onRetry: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={step === 'installing' ? `Instalando ${app.name}` : `Conectar ${app.name}`}
      primaryAction={
        step === 'oauth'
          ? { content: 'Autorizar con Uber Eats', onAction: onAuthorize, loading: submitting, icon: ConnectIcon }
          : undefined
      }
      secondaryActions={step === 'oauth' ? [{ content: 'Cancelar', onAction: onClose, disabled: submitting }] : []}
    >
      <Modal.Section>
        <BlockStack gap="400" align="center">
          {error && <Banner tone="critical">{error}</Banner>}
          {step === 'installing' && (
            <BlockStack gap="400" align="center">
              <Spinner size="large" accessibilityLabel="Instalando app" />
              <Text as="p" variant="headingSm" fontWeight="semibold">
                Preparando permisos y conexión segura...
              </Text>
              <Box width="100%">
                <ProgressBar progress={72} size="small" tone="primary" />
              </Box>
            </BlockStack>
          )}
          {step === 'oauth' && (
            <BlockStack gap="400">
              <Banner tone="info">
                Autoriza con la cuenta administradora. Kiosko guardará la conexión cifrada y no tendrás que instalarla
                de nuevo.
              </Banner>
              <Card background="bg-surface-secondary">
                <BlockStack gap="300">
                  <InlineStack gap="300" blockAlign="center">
                    <Icon source={app.icon} tone="base" />
                    <Text as="h3" variant="headingSm" fontWeight="semibold">
                      {app.name}
                    </Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {app.tagline}
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          )}
          {step === 'success' && (
            <BlockStack gap="300" align="center">
              <Icon source={CheckCircleIcon} tone="success" />
              <Text as="p" variant="headingSm" fontWeight="semibold">
                App instalada correctamente
              </Text>
            </BlockStack>
          )}
          {step === 'error' && (
            <BlockStack gap="300" align="center">
              <Icon source={AlertCircleIcon} tone="critical" />
              <Text as="p" variant="headingSm" fontWeight="semibold">
                No se pudo completar la instalación
              </Text>
              <Button variant="primary" onClick={onRetry}>
                Reintentar
              </Button>
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

function AppDetailModal({
  app,
  connection,
  loading,
  onClose,
  onInstall,
  onDisconnect,
}: {
  app: DeliveryApp;
  connection: ConnectionState;
  loading: boolean;
  onClose: () => void;
  onInstall: () => void;
  onDisconnect: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={app.name}
      primaryAction={
        app.isAvailable && !connection.connected
          ? {
              content: connection.installed ? 'Reconectar app' : 'Instalar app',
              onAction: onInstall,
              icon: ConnectIcon,
            }
          : undefined
      }
      secondaryActions={
        connection.connected
          ? [{ content: 'Desconectar', onAction: onDisconnect, destructive: true, loading }]
          : [{ content: 'Cerrar', onAction: onClose }]
      }
    >
      <Modal.Section>
        <BlockStack gap="500">
          <InlineStack align="space-between" blockAlign="start" gap="400">
            <InlineStack gap="300" blockAlign="center">
              <Box
                padding="400"
                background={connection.connected ? 'bg-fill-success-secondary' : 'bg-surface-secondary'}
                borderRadius="300"
              >
                <Icon source={app.icon} tone={connection.connected ? 'success' : 'base'} />
              </Box>
              <BlockStack gap="100">
                <Text as="h3" variant="headingMd" fontWeight="bold">
                  {app.tagline}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {app.vendor}
                </Text>
              </BlockStack>
            </InlineStack>
            <Badge tone={getConnectionTone(connection)}>{getConnectionLabel(connection)}</Badge>
          </InlineStack>

          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
            <Metric label="Ambiente" value={connection.environment ?? 'Producción'} />
            <Metric label="Store ID" value={connection.providerStoreId ?? 'Pendiente'} />
            <Metric label="Conectado" value={formatDateTime(connection.connectedAt)} />
          </InlineGrid>

          <BlockStack gap="300">
            <Text as="h4" variant="headingSm" fontWeight="semibold">
              Permisos solicitados
            </Text>
            {app.permissions.map((permission) => (
              <InlineStack key={permission} gap="200" blockAlign="start" wrap={false}>
                <Icon source={CheckCircleIcon} tone="success" />
                <Text as="span" variant="bodySm">
                  {permission}
                </Text>
              </InlineStack>
            ))}
          </BlockStack>

          <Divider />

          <BlockStack gap="300">
            <Text as="h4" variant="headingSm" fontWeight="semibold">
              Capacidades profundas
            </Text>
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="200">
              {app.highlights.map((highlight) => (
                <Badge key={highlight} tone="info">
                  {highlight}
                </Badge>
              ))}
            </InlineGrid>
          </BlockStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
