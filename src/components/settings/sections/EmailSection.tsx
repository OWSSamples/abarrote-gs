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
} from '@shopify/polaris';
import {
  EmailIcon,
  SendIcon,
} from '@shopify/polaris-icons';
import type { SettingsSectionProps } from './types';

interface EmailSectionProps extends SettingsSectionProps {
  emailTesting: boolean;
  emailTestResult: { success: boolean; message: string } | null;
  handleEmailTest: () => void;
}

const EMAIL_TYPES = [
  { icon: '🧾', title: 'Ticket de compra digital', description: 'Se envía cuando el cliente proporciona su correo al pagar', badge: 'Transaccional' as const },
  { icon: '📊', title: 'Reporte diario', description: 'Resumen automático de ventas, gastos y utilidad a las 8:00 AM', badge: 'Reporte' as const },
  { icon: '📈', title: 'Reporte semanal', description: 'Resumen semanal cada lunes a las 7:00 AM', badge: 'Reporte' as const },
  { icon: '📦', title: 'Alerta de stock bajo', description: 'Cuando un producto alcanza el stock mínimo', badge: 'Alerta' as const },
  { icon: '↩️', title: 'Devolución registrada', description: 'Cuando se procesa una devolución total o parcial', badge: 'Alerta' as const },
  { icon: '💸', title: 'Gasto registrado', description: 'Cuando se captura un nuevo gasto', badge: 'Alerta' as const },
  { icon: '🔐', title: 'Cambio en pagos', description: 'Alertas de seguridad al modificar integraciones', badge: 'Seguridad' as const },
] as const;

export function EmailSection({
  config,
  updateField,
  emailTesting,
  emailTestResult,
  handleEmailTest,
}: EmailSectionProps) {
  const isConfigured = Boolean(config.emailEnabled && config.emailFrom && config.emailRecipients);

  return (
    <BlockStack gap="600">
      {/* ── Canal de Correo Electrónico ── */}
      <Layout.AnnotatedSection
        title="Correo Electrónico (AWS SES)"
        description="Envía tickets digitales, reportes y alertas por correo electrónico. Costos mínimos: ~$0.10 USD por cada 1,000 correos."
      >
        <Card padding="500">
          <BlockStack gap="500">
            <InlineStack gap="300" blockAlign="center" wrap>
              <Checkbox
                label="Activar envío de correos electrónicos"
                helpText="Permite que el sistema envíe correos transaccionales y alertas."
                checked={config.emailEnabled}
                onChange={(v) => updateField('emailEnabled', v)}
              />
              {isConfigured && <Badge tone="success">Activo</Badge>}
            </InlineStack>

            {config.emailEnabled && (
              <Box paddingBlockStart="200">
                <BlockStack gap="500">
                  <FormLayout>
                    <TextField
                      label="Correo remitente (From)"
                      value={config.emailFrom || ''}
                      onChange={(v) => updateField('emailFrom', v)}
                      autoComplete="email"
                      type="email"
                      placeholder="notificaciones@opendex.dev"
                      helpText="Debe estar verificado en AWS SES."
                    />
                    <TextField
                      label="Nombre del remitente"
                      value={config.emailFromName || ''}
                      onChange={(v) => updateField('emailFromName', v)}
                      autoComplete="off"
                      placeholder={config.storeName || 'Mi Abarrotes'}
                      helpText="El nombre que aparece en la bandeja del destinatario."
                    />
                  </FormLayout>

                  <FormLayout>
                    <TextField
                      label="Correo de respuesta (Reply-To)"
                      value={config.emailReplyTo || ''}
                      onChange={(v) => updateField('emailReplyTo', v)}
                      autoComplete="email"
                      type="email"
                      placeholder="soporte@tutienda.com"
                      helpText="Opcional. Si no se establece, se usa el remitente."
                    />
                  </FormLayout>

                  <FormLayout>
                    <TextField
                      label="Destinatarios de reportes y alertas"
                      value={config.emailRecipients || ''}
                      onChange={(v) => updateField('emailRecipients', v)}
                      autoComplete="off"
                      placeholder="owner@gmail.com, gerente@gmail.com"
                      helpText="Correos que recibirán reportes diarios, semanales y alertas. Separa con coma."
                      multiline={3}
                    />
                  </FormLayout>

                  <Divider />

                  <BlockStack gap="300">
                    <Button onClick={handleEmailTest} loading={emailTesting} icon={SendIcon} fullWidth>
                      Enviar correo de prueba
                    </Button>
                    {isConfigured && (
                      <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                        Se enviará al primer destinatario configurado
                      </Text>
                    )}
                  </BlockStack>

                  {emailTestResult && (
                    <Banner tone={emailTestResult.success ? 'success' : 'critical'}>
                      <p>{emailTestResult.message}</p>
                    </Banner>
                  )}
                </BlockStack>
              </Box>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      {/* ── Personalización del Correo ── */}
      <Layout.AnnotatedSection
        title="Personalización"
        description="Configura la apariencia de los correos que envía tu tienda."
      >
        <Card padding="500">
          <BlockStack gap="500">
            <Text as="h3" variant="headingSm">
              Branding
            </Text>

            <FormLayout>
              <TextField
                label="Color de acento"
                value={config.emailAccentColor || '#2563eb'}
                onChange={(v) => updateField('emailAccentColor', v)}
                autoComplete="off"
                placeholder="#2563eb"
                helpText="Color del encabezado de los correos (formato HEX)."
                connectedRight={
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      backgroundColor: config.emailAccentColor || '#2563eb',
                      border: '1px solid #d1d5db',
                      flexShrink: 0,
                    }}
                  />
                }
              />
            </FormLayout>

            <Divider />

            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Vista previa del encabezado
              </Text>
              <Box padding="300" borderRadius="200" background="bg-surface-secondary">
                <div
                  style={{
                    backgroundColor: config.emailAccentColor || '#2563eb',
                    borderRadius: 8,
                    padding: '24px 20px',
                    textAlign: 'center',
                  }}
                >
                  {config.logoUrl && (
                    <img
                      src={config.logoUrl}
                      alt={config.storeName}
                      style={{
                        maxHeight: 40,
                        maxWidth: '80%',
                        marginBottom: 8,
                        objectFit: 'contain',
                      }}
                    />
                  )}
                  <p
                    style={{
                      margin: 0,
                      color: '#ffffff',
                      fontSize: 16,
                      fontWeight: 600,
                      wordBreak: 'break-word',
                    }}
                  >
                    {config.emailFromName || config.storeName || 'Mi Abarrotes'}
                  </p>
                </div>
              </Box>
            </BlockStack>
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      {/* ── Tipos de correo ── */}
      <Layout.AnnotatedSection
        title="Correos Automáticos"
        description="Tipos de correo que el sistema envía cuando el canal está activo."
      >
        <Card padding="500">
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <Text as="h3" variant="headingSm">
                Correos Transaccionales
              </Text>
              <Badge tone={isConfigured ? 'success' : 'new'}>
                {isConfigured ? 'Activo' : 'Inactivo'}
              </Badge>
            </InlineStack>

            <Divider />

            <BlockStack gap="200">
              {EMAIL_TYPES.map((emailType) => (
                <EmailTypeRow key={emailType.title} {...emailType} />
              ))}
            </BlockStack>

            {!isConfigured && (
              <>
                <Divider />
                <Banner tone="warning" icon={EmailIcon}>
                  <p>
                    Configura el correo remitente y los destinatarios arriba para activar estos correos.
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

function EmailTypeRow({
  icon,
  title,
  description,
  badge,
}: {
  icon: string;
  title: string;
  description: string;
  badge: 'Transaccional' | 'Reporte' | 'Alerta' | 'Seguridad';
}) {
  const badgeTone =
    badge === 'Seguridad'
      ? 'critical'
      : badge === 'Alerta'
        ? 'warning'
        : badge === 'Reporte'
          ? 'info'
          : 'new';

  return (
    <Box paddingBlockStart="150" paddingBlockEnd="150" paddingInlineStart="100" paddingInlineEnd="100">
      <InlineStack gap="300" blockAlign="start" wrap={false}>
        <Box minWidth="28px">
          <Text as="span" variant="headingMd">
            {icon}
          </Text>
        </Box>
        <BlockStack gap="050">
          <InlineStack gap="200" blockAlign="center" wrap>
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {title}
            </Text>
            <Badge tone={badgeTone} size="small">
              {badge}
            </Badge>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            {description}
          </Text>
        </BlockStack>
      </InlineStack>
    </Box>
  );
}
