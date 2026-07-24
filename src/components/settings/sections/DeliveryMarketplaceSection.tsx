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
} from '@shopify/polaris';
import {
  AppsIcon,
  PlusCircleIcon,
  ConnectIcon,
  DeleteIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  GlobeIcon,
  MobileIcon,
} from '@shopify/polaris-icons';
import {
  useDashboardStore,
} from '@/store/dashboardStore';
import {
  disconnectDeliveryProviderAction,
  getDeliveryConnectionStatusAction,
} from '@/app/actions/delivery-actions';
import type { DeliveryProvider } from '@/infrastructure/delivery/delivery-types';
import { parseError } from '@/lib/errors';

interface DeliveryApp {
  id: DeliveryProvider;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  status: 'disponible' | 'próximamente';
}

const DELIVERY_SETUP_GUIDES: Record<DeliveryProvider, { title: string; steps: string[] }> = {
  rappi: {
    title: 'Conectar Rappi',
    steps: [
      'Ve a developer.rappi.com y crea una cuenta de desarrollador',
      'Registra tu tienda en el panel de Rappi',
      'Copia tu API Key y Store ID',
      'Pega las credenciales abajo y haz clic en Guardar',
    ],
  },
  ubereats: {
    title: 'Conectar Uber Eats',
    steps: [
      'Ve a developer.uber.com y crea una cuenta de desarrollador',
      'Registra tu tienda en Uber Eats Business',
      'Copia tu Access Token',
      'Pega la credencial abajo y haz clic en Guardar',
    ],
  },
};

const DELIVERY_APPS: readonly DeliveryApp[] = [
  {
    id: 'rappi',
    name: 'Rappi',
    description:
      'Conecta tu tienda con Rappi para recibir pedidos de delivery directamente en Kiosko. Gestiona pedidos, acepta/rechaza y sincroniza tu catalogo.',
    icon: GlobeIcon,
    category: 'Delivery',
    status: 'disponible',
  },
  {
    id: 'ubereats',
    name: 'Uber Eats',
    description:
      'Conecta tu tienda con Uber Eats para recibir pedidos de delivery. Gestiona pedidos, acepta/rechaza y sincroniza tu catalogo de productos.',
    icon: MobileIcon,
    category: 'Delivery',
    status: 'disponible',
  },
];

export function DeliveryMarketplaceSection() {
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const storeId = storeConfig.storeId || 'main';

  const [connectingProvider, setConnectingProvider] = useState<DeliveryProvider | null>(null);

  const [connections, setConnections] = useState<
    Record<DeliveryProvider, { connected: boolean; storeName?: string }>
  >({ rappi: { connected: false }, ubereats: { connected: false } });
  const [loading, setLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ success: boolean; message: string } | null>(
    null,
  );

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

  const handleConnect = useCallback(
    (provider: DeliveryProvider) => {
      setConnectingProvider(provider);
    },
    [],
  );

  const handleDisconnect = useCallback(
    async (provider: DeliveryProvider) => {
      setLoading(provider);
      setActionMsg(null);
      try {
        await disconnectDeliveryProviderAction(storeId, provider);
        setConnections((prev) => ({ ...prev, [provider]: { connected: false } }));
        setActionMsg({ success: true, message: `${provider} desconectado` });
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
                Instala apps de delivery como Rappi o Uber Eats para recibir pedidos y gestionarlos
                desde Kiosko. El tendero conecta su cuenta del delivery y gestiona todo desde esta
                pantalla.
              </Text>
            </BlockStack>
                  <Icon source={AppsIcon} tone="base" />
          </InlineStack>

          <InlineStack gap="300" blockAlign="center">
            <Badge
              tone={isAnyConnected ? 'success' : 'info'}
                  icon={isAnyConnected ? CheckCircleIcon : PlusCircleIcon}
            >
              {isAnyConnected ? `${Object.values(connections).filter((c) => c.connected).length} app(s) instalada(s)` : 'Sin apps instaladas'}
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

      {/* ═══════════ SETUP WIZARD ═══════════ */}
      {connectingProvider && (
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h3">
                {DELIVERY_SETUP_GUIDES[connectingProvider].title}
              </Text>
              <Button variant="plain" size="slim" onClick={() => setConnectingProvider(null)}>
                Cerrar
              </Button>
            </InlineStack>
            <Divider />
            <BlockStack gap="300">
              {DELIVERY_SETUP_GUIDES[connectingProvider].steps.map((step, i) => (
                <InlineStack key={i} gap="200" blockAlign="start">
                  <Box
                    padding="050"
                    background="bg-fill-info"
                    borderRadius="full"
                    minWidth="20px"
                    minHeight="20px"
                    textAlign="center"
                  >
                    <Text variant="bodySm" fontWeight="bold" tone="text-inverse">
                      {i + 1}
                    </Text>
                  </Box>
                  <Text variant="bodySm" as="p">
                    {step}
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
            <Button
              variant="primary"
              icon={ConnectIcon}
              onClick={() => {
                setConnectingProvider(null);
                setActionMsg({
                  success: true,
                  message: `Conexión iniciada para ${connectingProvider}. Sigue los pasos arriba para completar.`,
                });
              }}
            >
              Entendido, iniciar conexión
            </Button>
          </BlockStack>
        </Card>
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
                        background={isConnected ? 'bg-fill-success-secondary' : 'bg-fill-magic-secondary'}
                        borderRadius="200"
                      >
                        <Icon source={isConnected ? app.icon : AppsIcon} tone={isConnected ? 'success' : 'magic'} />
                      </Box>
                      <BlockStack gap="100">
                        <Text variant="headingSm" as="h4" fontWeight="semibold">
                          {app.name}
                        </Text>
                        <Badge tone={app.status === 'disponible' ? 'success' : 'attention'} size="small">
                          {app.status === 'disponible' ? 'Disponible' : 'Próximamente'}
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
                        destructive
                        disabled={isLoading}
                        onClick={() => handleDisconnect(app.id)}
                        icon={DeleteIcon}
                      >
                        Desconectar
                      </Button>
                    </InlineStack>
                  ) : (
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
                  )}
                </BlockStack>
              </Card>
            );
          })}
        </InlineGrid>
      </BlockStack>

      {/* ═══════════ INSTALLED APPS LIST ═══════════ */}
      {isAnyConnected && (
        <Card>
          <BlockStack gap="400">
            <Text as="h3" variant="headingMd" fontWeight="semibold">
              Apps instaladas
            </Text>

            {DELIVERY_APPS.filter((app) => connections[app.id]?.connected).map((app) => (
              <InlineStack key={app.id} align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Box padding="200" background="bg-fill-success-secondary" borderRadius="200">
                    <Icon source={app.icon} tone="success" />
                  </Box>
                  <BlockStack gap="0">
                    <Text variant="bodyMd" fontWeight="semibold">
                      {app.name}
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Conectado y activo
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
          heading="Aun no tienes apps de delivery instaladas"
          description="Instala una app de delivery desde el Marketplace arriba para comenzar a recibir pedidos de Rappi o Uber Eats en Kiosko."
          action={{
            content: 'Ir al Marketplace',
            onAction: () => {
              const el = document.querySelector('[data-marketplace-scroll]');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            },
          }}
          image={<AppsIcon />}
        />
      )}

      <Banner tone="info" icon={CheckCircleIcon}>
        <Text as="p" variant="bodySm">
          Las conexiones se guardan en tu tienda. Puedes conectar varias apps de delivery y
          gestionarlas desde esta misma pantalla.
        </Text>
      </Banner>
    </BlockStack>
  );
}