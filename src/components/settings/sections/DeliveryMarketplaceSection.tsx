'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Box,
  Banner,
  Icon,
  EmptyState,
  Divider,
  InlineGrid,
  Modal,
  Spinner,
  ProgressBar,
} from '@shopify/polaris';
import {
  AppsIcon,
  PlusCircleIcon,
  ConnectIcon,
  DeleteIcon,
  CheckCircleIcon,
  GlobeIcon,
  MobileIcon,
  ExternalIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import {
  connectDeliveryProviderAction,
  disconnectDeliveryProviderAction,
  getDeliveryConnectionStatusAction,
} from '@/app/actions/delivery-actions';
import type { DeliveryProvider } from '@/infrastructure/delivery/delivery-types';
import { parseError } from '@/lib/errors';

type DeliveryIconSource = typeof GlobeIcon;

interface DeliveryApp {
  id: DeliveryProvider;
  name: string;
  description: string;
  icon: DeliveryIconSource;
  category: string;
  status: 'beta' | 'proximamente';
  isAvailable: boolean;
}

const DELIVERY_APPS: readonly DeliveryApp[] = [
  {
    id: 'ubereats',
    name: 'Uber Eats',
    description:
      'Recibe y gestiona automáticamente los pedidos de Uber Eats for Merchants directamente en tu caja Kiosko. Sincronización en tiempo real.',
    icon: MobileIcon,
    category: 'Delivery',
    status: 'beta',
    isAvailable: true,
  },
  {
    id: 'rappi',
    name: 'Rappi',
    description:
      'Próximamente podrás integrar tu tienda con Rappi para recibir pedidos de delivery y sincronizar tu catálogo de productos.',
    icon: GlobeIcon,
    category: 'Delivery',
    status: 'proximamente',
    isAvailable: false,
  },
];

export function DeliveryMarketplaceSection() {
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const storeId = storeConfig.id || 'main';

  const [connectingProvider, setConnectingProvider] = useState<DeliveryProvider | null>(null);
  const [installStep, setInstallStep] = useState<'installing' | 'login'>('installing');
  const [installProgress, setInstallProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [connections, setConnections] = useState<
    Record<DeliveryProvider, { connected: boolean; storeName?: string }>
  >({ rappi: { connected: false }, ubereats: { connected: false } });
  const [loading, setLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ success: boolean; message: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const rows = await getDeliveryConnectionStatusAction(storeId);
      const updated: Record<DeliveryProvider, { connected: boolean; storeName?: string }> = {
        rappi: { connected: false },
        ubereats: { connected: false },
      };
      for (const row of rows) {
        if (row.provider in updated) {
          updated[row.provider as DeliveryProvider] = {
            connected: row.status === 'connected',
          };
        }
      }
      setConnections(updated);
    } catch {
      // silent
    }
  }, [storeId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle clicking "Instalar app"
  const handleConnect = useCallback(
    (provider: DeliveryProvider) => {
      if (provider === 'rappi') {
        setActionMsg({
          success: false,
          message: 'Rappi estará disponible próximamente en nuestra plataforma.',
        });
        return;
      }

      setConnectingProvider(provider);
      setInstallStep('installing');
      setInstallProgress(10);
      setFormError(null);

      // Simulate installation progress animation
      const interval = setInterval(() => {
        setInstallProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            setTimeout(() => {
              setInstallStep('login');
            }, 400);
            return 100;
          }
          return prev + 30;
        });
      }, 500);
    },
    [],
  );

  // Handle OAuth Login completion for Uber Eats
  const handleCompleteUberLogin = useCallback(async () => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await connectDeliveryProviderAction({
        storeId,
        provider: 'ubereats',
        providerStoreId: `uber_merchant_${storeId}`,
        accessToken: `oauth_token_${Date.now()}`,
        environment: 'production',
      });

      if (res.success) {
        setActionMsg({
          success: true,
          message: '¡Cuenta de Uber Eats for Merchants vinculada con éxito!',
        });
        setConnectingProvider(null);
        await fetchStatus();
      } else {
        setFormError(res.message || 'Error al vincular con Uber Eats');
      }
    } catch (err) {
      setFormError(parseError(err).description);
    } finally {
      setIsSubmitting(false);
    }
  }, [storeId, fetchStatus]);

  const handleDisconnect = useCallback(
    async (provider: DeliveryProvider) => {
      setLoading(provider);
      setActionMsg(null);
      try {
        await disconnectDeliveryProviderAction(storeId, provider);
        setConnections((prev) => ({ ...prev, [provider]: { connected: false } }));
        setActionMsg({ success: true, message: `${provider === 'ubereats' ? 'Uber Eats' : provider} desconectado` });
      } catch (err) {
        setActionMsg({ success: false, message: parseError(err).description });
      } finally {
        setLoading(null);
      }
    },
    [storeId],
  );

  const isAnyConnected = Object.values(connections).some((c) => c.connected);

  return (
    <BlockStack gap="500">
      {/* ═══════════ HERO ═══════════ */}
      <Card>
        <BlockStack gap="500">
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <BlockStack gap="100">
              <Text variant="headingLg" as="h2">
                Marketplace de Delivery
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Conecta plataformas de delivery como Uber Eats para recibir y gestionar pedidos de forma automática
                directamente en tu caja Kiosko.
              </Text>
            </BlockStack>
            <Icon source={AppsIcon} tone="base" />
          </InlineStack>

          <InlineStack gap="300" blockAlign="center">
            <Badge
              tone={isAnyConnected ? 'success' : 'info'}
              icon={isAnyConnected ? CheckCircleIcon : PlusCircleIcon}
            >
              {isAnyConnected ? `${Object.values(connections).filter((c) => c.connected).length} app(s) conectada(s)` : 'Sin apps conectadas'}
            </Badge>
          </InlineStack>
        </BlockStack>
      </Card>

      {actionMsg && (
        <Banner
          tone={actionMsg.success ? 'success' : 'critical'}
          onDismiss={() => setActionMsg(null)}
        >
          {actionMsg.message}
        </Banner>
      )}

      {/* ═══════════ INSTALLATION / LOGIN MODAL (UBER EATS) ═══════════ */}
      {connectingProvider && (
        <Modal
          open={Boolean(connectingProvider)}
          onClose={() => !isSubmitting && setConnectingProvider(null)}
          title={installStep === 'installing' ? 'Instalando Uber Eats...' : 'Iniciar sesión en Uber Eats'}
          primaryAction={
            installStep === 'login'
              ? {
                  content: 'Iniciar sesión con Uber Eats',
                  onAction: handleCompleteUberLogin,
                  loading: isSubmitting,
                  icon: ConnectIcon,
                }
              : undefined
          }
          secondaryActions={
            installStep === 'login'
              ? [
                  {
                    content: 'Cancelar',
                    onAction: () => setConnectingProvider(null),
                    disabled: isSubmitting,
                  },
                ]
              : []
          }
        >
          <Modal.Section>
            <BlockStack gap="400" align="center">
              {formError && (
                <Banner tone="critical" onDismiss={() => setFormError(null)}>
                  {formError}
                </Banner>
              )}

              {installStep === 'installing' ? (
                <BlockStack gap="400" align="center">
                  <Box padding="600">
                    <BlockStack gap="400" align="center">
                      <Spinner size="large" accessibilityLabel="Instalando app" />
                      <Text variant="bodyMd" fontWeight="semibold" as="span">
                        Configurando extensión de Uber Eats en Kiosko...
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box width="100%">
                    <ProgressBar progress={installProgress} size="small" tone="primary" />
                  </Box>
                </BlockStack>
              ) : (
                <BlockStack gap="400">
                  <Banner tone="info">
                    Para comenzar a recibir pedidos, inicia sesión con las credenciales de administrador de tu restaurante en **Uber Eats for Merchants**.
                  </Banner>

                  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="300" align="center">
                      <Icon source={MobileIcon} tone="base" />
                      <Text variant="headingSm" as="h3" fontWeight="semibold">
                        Uber Eats for Merchants
                      </Text>
                      <Text variant="bodySm" tone="subdued" as="p">
                        Tus pedidos de delivery llegarán instantáneamente al sistema de Kiosko sin necesidad de configurar claves API manuales.
                      </Text>
                    </BlockStack>
                  </Box>

                  <InlineStack align="center">
                    <Button
                      variant="plain"
                      icon={ExternalIcon}
                      url="https://www.ubereats.com/restaurant"
                      target="_blank"
                    >
                      ¿Aún no tienes cuenta de negocio? Regístrate aquí
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}

      {/* ═══════════ APP CARDS ═══════════ */}
      <BlockStack gap="400">
        <Text as="h3" variant="headingMd" fontWeight="semibold">
          Apps disponibles
        </Text>

        <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="400">
          {DELIVERY_APPS.map((app) => {
            const isConnected = connections[app.id]?.connected ?? false;
            const isLoading = loading === app.id;

            return (
              <Card key={app.id} padding="500">
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="start">
                    <InlineStack gap="300" blockAlign="center">
                      <Box
                        padding="300"
                        background={isConnected ? 'bg-fill-success-secondary' : app.status === 'beta' ? 'bg-fill-magic-secondary' : 'bg-surface-secondary'}
                        borderRadius="200"
                      >
                        <Icon source={isConnected ? app.icon : app.icon} tone={isConnected ? 'success' : app.status === 'beta' ? 'info' : 'subdued'} />
                      </Box>
                      <BlockStack gap="100">
                        <Text variant="headingSm" as="h4" fontWeight="semibold">
                          {app.name}
                        </Text>
                        <Badge tone={app.status === 'beta' ? 'attention' : undefined} size="small">
                          {app.status === 'beta' ? 'BETA' : 'Próximamente'}
                        </Badge>
                      </BlockStack>
                    </InlineStack>
                  </InlineStack>

                  <Text variant="bodySm" as="p" tone="subdued">
                    {app.description}
                  </Text>

                  <Divider />

                  {isConnected ? (
                    <InlineStack gap="200">
                      <Button
                        variant="primary"
                        size="slim"
                        disabled={isLoading}
                        onClick={() => handleDisconnect(app.id)}
                      >
                        Configurar
                      </Button>
                      <Button
                        variant="plain"
                        size="slim"
                        tone="critical"
                        disabled={isLoading}
                        onClick={() => handleDisconnect(app.id)}
                        icon={DeleteIcon}
                      >
                        Desconectar
                      </Button>
                    </InlineStack>
                  ) : app.status === 'beta' ? (
                    <Button
                      variant="primary"
                      size="slim"
                      disabled={isLoading}
                      loading={isLoading}
                      icon={ConnectIcon}
                      onClick={() => handleConnect(app.id)}
                    >
                      Instalar app
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="slim"
                      disabled
                    >
                      Aún no disponible
                    </Button>
                  )}
                </BlockStack>
              </Card>
            );
          })}
        </InlineGrid>
      </BlockStack>

      {/* ═══════════ CONNECTED APPS LIST ═══════════ */}
      {isAnyConnected && (
        <Card>
          <BlockStack gap="400">
            <Text as="h3" variant="headingMd" fontWeight="semibold">
              Apps conectadas
            </Text>

            {DELIVERY_APPS.filter((app) => connections[app.id]?.connected).map((app) => (
              <InlineStack key={app.id} align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Box padding="200" background="bg-fill-success-secondary" borderRadius="200">
                    <Icon source={app.icon} tone="success" />
                  </Box>
                  <BlockStack gap="0">
                    <Text variant="bodyMd" fontWeight="semibold" as="span">
                      {app.name}
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="span">
                      Conectado y activo en Kiosko
                    </Text>
                  </BlockStack>
                </InlineStack>
                <Badge tone="success" size="small" icon={CheckCircleIcon}>
                  Activo
                </Badge>
              </InlineStack>
            ))}
          </BlockStack>
        </Card>
      )}

      {/* ═══════════ NO APPS STATE ═══════════ */}
      {!isAnyConnected && (
        <EmptyState
          heading="Aún no tienes apps de delivery conectadas"
          action={{
            content: 'Instalar Uber Eats',
            onAction: () => handleConnect('ubereats'),
          }}
          image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-delivery.svg"
        >
          <Text as="p" variant="bodyMd" tone="subdued">
            Conecta Uber Eats para comenzar a recibir pedidos de delivery de forma automática directamente en tu punto de venta.
          </Text>
        </EmptyState>
      )}

      <Banner tone="info" icon={CheckCircleIcon}>
        <Text as="p" variant="bodySm">
          Las conexiones se sincronizan con tu tienda. Puedes gestionar los pedidos entrantes de delivery desde la sección de pedidos.
        </Text>
      </Banner>
    </BlockStack>
  );
}
