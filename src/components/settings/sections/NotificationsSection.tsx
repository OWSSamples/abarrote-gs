'use client';

import {
  Card,
  TextField,
  FormLayout,
  BlockStack,
  InlineStack,
  Button,
  Checkbox,
  Box,
  Banner,
  Divider,
  Layout,
  Text,
  Badge,
  Icon,
} from '@shopify/polaris';
import {
  ChatIcon,
  NotificationIcon,
  AlertCircleIcon,
  OrderIcon,
  CashDollarIcon,
  ReturnIcon,
  InventoryIcon,
  LockIcon,
  CalendarIcon,
} from '@shopify/polaris-icons';
import type { SettingsSectionProps } from './types';

interface NotificationsSectionProps extends SettingsSectionProps {
  tgTesting: boolean;
  tgTestResult: { success: boolean; message: string } | null;
  handleTGTest: () => void;
}

const EVENT_CATALOG = [
  { icon: OrderIcon, label: 'Venta registrada', description: 'Cada venta completada en el POS', tone: 'info' as const },
  { icon: CashDollarIcon, label: 'Corte de caja', description: 'Resumen al cerrar turno', tone: 'info' as const },
  { icon: ReturnIcon, label: 'Devolución', description: 'Devoluciones totales o parciales', tone: 'warning' as const },
  { icon: CashDollarIcon, label: 'Gasto registrado', description: 'Cada gasto nuevo capturado', tone: 'attention' as const },
  { icon: InventoryIcon, label: 'Stock bajo', description: 'Producto alcanza stock mínimo', tone: 'warning' as const },
  { icon: AlertCircleIcon, label: 'Merma / pérdida', description: 'Registro de merma en inventario', tone: 'critical' as const },
  { icon: LockIcon, label: 'Proveedor de pagos', description: 'Conexión o desconexión de MP/Clip', tone: 'critical' as const },
  { icon: CalendarIcon, label: 'Reporte diario', description: 'Resumen automático a las 8:00 AM', tone: 'info' as const },
  { icon: CalendarIcon, label: 'Reporte semanal', description: 'Resumen semanal cada lunes 7:00 AM', tone: 'info' as const },
] as const;

export function NotificationsSection({
  config,
  updateField,
  tgTesting,
  tgTestResult,
  handleTGTest,
}: NotificationsSectionProps) {
  const isConfigured = Boolean(config.enableNotifications && config.telegramToken && config.telegramChatId);

  return (
    <BlockStack gap="600">
      <Layout.AnnotatedSection
        title="Canal de Notificaciones"
        description="Recibe alertas operativas y de seguridad en tiempo real a través de Telegram."
      >
        <Card padding="500">
          <BlockStack gap="500">
            <Checkbox
              label="Activar motor de notificaciones externas"
              helpText="Permite que el sistema envíe llamadas a la API de canales externos."
              checked={config.enableNotifications}
              onChange={(v) => updateField('enableNotifications', v)}
            />

            {config.enableNotifications && (
              <Box paddingBlockStart="200">
                <BlockStack gap="500">
                  <FormLayout>
                    <TextField
                      label="Telegram Bot Token"
                      value={config.telegramToken || ''}
                      onChange={(v) => updateField('telegramToken', v)}
                      autoComplete="off"
                      type="password"
                      placeholder="123456789:AAHK_..."
                      helpText="Se obtiene creando un bot corporativo usando @BotFather."
                    />
                    <TextField
                      label="Identificador de Chat (Chat ID)"
                      value={config.telegramChatId || ''}
                      onChange={(v) => updateField('telegramChatId', v)}
                      autoComplete="off"
                      placeholder="Ej: -100123456789"
                      helpText="El chat grupal o individual de los gerentes."
                    />
                  </FormLayout>

                  <Divider />

                  <BlockStack gap="300">
                    <Button onClick={handleTGTest} loading={tgTesting} icon={ChatIcon} fullWidth>
                      Disparar evento de prueba
                    </Button>
                    <InlineStack gap="200" align="center" blockAlign="center" wrap>
                      {isConfigured && (
                        <Badge tone="success">Configurado</Badge>
                      )}
                      {config.enableNotifications && !isConfigured && (
                        <Badge tone="attention">Faltan credenciales</Badge>
                      )}
                    </InlineStack>
                  </BlockStack>

                  {tgTestResult && (
                    <Banner tone={tgTestResult.success ? 'success' : 'critical'}>
                      <p>{tgTestResult.message}</p>
                    </Banner>
                  )}
                </BlockStack>
              </Box>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        title="Eventos Configurados"
        description="Eventos del sistema que generan notificaciones automáticas cuando el canal está activo."
      >
        <Card padding="500">
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <Text as="h3" variant="headingSm">
                Catálogo de Eventos
              </Text>
              <Badge tone={isConfigured ? 'success' : 'new'}>
                {isConfigured ? `${EVENT_CATALOG.length} activos` : 'Inactivo'}
              </Badge>
            </InlineStack>

            <Divider />

            <BlockStack gap="200">
              {EVENT_CATALOG.map((event) => (
                <Box key={event.label} paddingBlockStart="150" paddingBlockEnd="150" paddingInlineStart="100" paddingInlineEnd="100">
                  <InlineStack gap="300" blockAlign="start" wrap={false}>
                    <Box minWidth="24px">
                      <Icon source={event.icon} tone="base" />
                    </Box>
                    <BlockStack gap="050">
                      <InlineStack gap="200" blockAlign="center" wrap>
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {event.label}
                        </Text>
                        <Badge tone={event.tone} size="small">
                          {event.tone === 'critical' ? 'Seguridad' : event.tone === 'warning' ? 'Alerta' : 'Info'}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {event.description}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </Box>
              ))}
            </BlockStack>

            {!isConfigured && (
              <>
                <Divider />
                <Banner tone="warning" icon={NotificationIcon}>
                  <p>
                    Configura el bot de Telegram arriba para activar todas las notificaciones.
                  </p>
                </Banner>
              </>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );
}
