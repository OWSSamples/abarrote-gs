'use client';

import { useCallback, useState } from 'react';
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
  Select,
  Collapsible,
} from '@shopify/polaris';
import type { SettingsSectionProps } from './types';

interface EmailSectionProps extends SettingsSectionProps {
  emailTesting: boolean;
  emailTestResult: { success: boolean; message: string } | null;
  handleEmailTest: () => void;
}

type EmailTypeKey =
  | 'emailTicketEnabled'
  | 'emailDailyReportEnabled'
  | 'emailWeeklyReportEnabled'
  | 'emailStockAlertEnabled'
  | 'emailRefundAlertEnabled'
  | 'emailExpenseAlertEnabled'
  | 'emailSecurityAlertEnabled';

interface EmailTypeConfig {
  key: EmailTypeKey;
  title: string;
  description: string;
  category: 'Transaccional' | 'Reporte' | 'Alerta' | 'Seguridad';
}

const EMAIL_TYPES: EmailTypeConfig[] = [
  {
    key: 'emailTicketEnabled',
    title: 'Ticket de compra digital',
    description: 'Envía el ticket cuando el cliente proporciona su correo al pagar.',
    category: 'Transaccional',
  },
  {
    key: 'emailDailyReportEnabled',
    title: 'Reporte diario',
    description: 'Resumen de ventas, gastos y utilidad.',
    category: 'Reporte',
  },
  {
    key: 'emailWeeklyReportEnabled',
    title: 'Reporte semanal',
    description: 'Resumen semanal con comparaciones y tendencias.',
    category: 'Reporte',
  },
  {
    key: 'emailStockAlertEnabled',
    title: 'Alerta de stock bajo',
    description: 'Cuando un producto alcanza el stock mínimo.',
    category: 'Alerta',
  },
  {
    key: 'emailRefundAlertEnabled',
    title: 'Devolución registrada',
    description: 'Cuando se procesa una devolución total o parcial.',
    category: 'Alerta',
  },
  {
    key: 'emailExpenseAlertEnabled',
    title: 'Gasto registrado',
    description: 'Cuando se captura un nuevo gasto.',
    category: 'Alerta',
  },
  {
    key: 'emailSecurityAlertEnabled',
    title: 'Cambio en pagos',
    description: 'Alertas de seguridad al modificar integraciones.',
    category: 'Seguridad',
  },
];

const CATEGORY_TONE = {
  Transaccional: 'new',
  Reporte: 'info',
  Alerta: 'warning',
  Seguridad: 'critical',
} as const;

const DAY_OPTIONS = [
  { label: 'Lunes', value: 'monday' },
  { label: 'Martes', value: 'tuesday' },
  { label: 'Miércoles', value: 'wednesday' },
  { label: 'Jueves', value: 'thursday' },
  { label: 'Viernes', value: 'friday' },
  { label: 'Sábado', value: 'saturday' },
  { label: 'Domingo', value: 'sunday' },
];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const t = `${String(h).padStart(2, '0')}:00`;
  return { label: t, value: t };
});

export function EmailSection({
  config,
  updateField,
  emailTesting,
  emailTestResult,
  handleEmailTest,
}: EmailSectionProps) {
  const isConfigured = Boolean(config.emailEnabled && config.emailFrom && config.emailRecipients);
  const [previewOpen, setPreviewOpen] = useState(false);
  const togglePreview = useCallback(() => setPreviewOpen((o) => !o), []);

  const enabledCount = EMAIL_TYPES.filter((t) => config[t.key] as boolean).length;

  return (
    <BlockStack gap="600">
      {/* ── 1. Canal de Correo Electrónico ── */}
      <Layout.AnnotatedSection
        title="Canal de Correo"
        description="Activa el envío de correos transaccionales y alertas a través de AWS SES. ~$0.10 USD / 1,000 correos."
      >
        <Card padding="0">
          <Box padding="400">
            <BlockStack gap="500">
              <InlineStack align="space-between" blockAlign="center" wrap>
                <Checkbox
                  label="Activar correo electrónico"
                  helpText="Permite que el sistema envíe correos de forma automática."
                  checked={config.emailEnabled}
                  onChange={(v) => updateField('emailEnabled', v)}
                />
                <Badge tone={isConfigured ? 'success' : 'attention'}>
                  {isConfigured ? 'Activo' : 'Sin configurar'}
                </Badge>
              </InlineStack>

              {config.emailEnabled && (
                <Box paddingBlockStart="200">
                  <BlockStack gap="400">
                    <FormLayout>
                      <FormLayout.Group>
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
                          helpText="Nombre que aparece en la bandeja."
                        />
                      </FormLayout.Group>
                    </FormLayout>

                    <FormLayout>
                      <FormLayout.Group>
                        <TextField
                          label="Reply-To (respuesta)"
                          value={config.emailReplyTo || ''}
                          onChange={(v) => updateField('emailReplyTo', v)}
                          autoComplete="email"
                          type="email"
                          placeholder="soporte@tutienda.com"
                          helpText="Opcional. Si vacío se usa el remitente."
                        />
                        <TextField
                          label="Destinatarios de alertas"
                          value={config.emailRecipients || ''}
                          onChange={(v) => updateField('emailRecipients', v)}
                          autoComplete="off"
                          placeholder="owner@gmail.com, gerente@gmail.com"
                          helpText="Separa con coma."
                          multiline={2}
                        />
                      </FormLayout.Group>
                    </FormLayout>
                  </BlockStack>
                </Box>
              )}
            </BlockStack>
          </Box>

          {config.emailEnabled && (
            <>
              <Divider />
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Button onClick={handleEmailTest} loading={emailTesting} variant="primary">
                    Enviar correo de prueba
                  </Button>
                  {isConfigured && (
                    <Text as="span" variant="bodySm" tone="subdued">
                      Se envía al primer destinatario
                    </Text>
                  )}
                </InlineStack>
                {emailTestResult && (
                  <Box paddingBlockStart="300">
                    <Banner tone={emailTestResult.success ? 'success' : 'critical'}>
                      <p>{emailTestResult.message}</p>
                    </Banner>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Card>
      </Layout.AnnotatedSection>

      {/* ── 2. Tipos de Correo ── */}
      <Layout.AnnotatedSection
        title="Tipos de Correo"
        description="Activa o desactiva cada tipo de notificación por correo de forma individual."
      >
        <Card padding="0">
          {/* Summary header */}
          <Box padding="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="headingSm" fontWeight="semibold">
                Notificaciones activas
              </Text>
              <Text as="span" variant="bodySm" fontWeight="semibold">
                {enabledCount} de {EMAIL_TYPES.length}
              </Text>
            </InlineStack>
          </Box>

          <Divider />

          {/* Email type rows */}
          {EMAIL_TYPES.map((emailType, i) => {
            const enabled = (config[emailType.key] as boolean) ?? true;
            return (
              <div key={emailType.key}>
                <div
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    opacity: isConfigured ? 1 : 0.5,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <Checkbox
                      label={
                        <InlineStack gap="200" blockAlign="center" wrap>
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {emailType.title}
                          </Text>
                          <Badge
                            tone={CATEGORY_TONE[emailType.category]}
                            size="small"
                          >
                            {emailType.category}
                          </Badge>
                        </InlineStack>
                      }
                      helpText={emailType.description}
                      checked={enabled}
                      onChange={(v) => updateField(emailType.key, v)}
                      disabled={!isConfigured}
                    />
                  </div>
                </div>
                {i < EMAIL_TYPES.length - 1 && <Divider />}
              </div>
            );
          })}

          {!isConfigured && (
            <>
              <Divider />
              <Box padding="400">
                <Banner tone="warning">
                  <p>
                    Configura el canal de correo arriba para activar las notificaciones individuales.
                  </p>
                </Banner>
              </Box>
            </>
          )}
        </Card>
      </Layout.AnnotatedSection>

      {/* ── 3. Programación de Reportes ── */}
      <Layout.AnnotatedSection
        title="Programación"
        description="Configura cuándo se envían los reportes automáticos."
      >
        <Card>
          <BlockStack gap="400">
            <FormLayout>
              <FormLayout.Group>
                <Select
                  label="Hora del reporte diario"
                  options={TIME_OPTIONS}
                  value={config.emailDailyReportTime || '08:00'}
                  onChange={(v) => updateField('emailDailyReportTime', v)}
                  helpText="Hora (Ciudad de México) para el resumen diario."
                  disabled={!config.emailDailyReportEnabled}
                />
                <Select
                  label="Día del reporte semanal"
                  options={DAY_OPTIONS}
                  value={config.emailWeeklyReportDay || 'monday'}
                  onChange={(v) => updateField('emailWeeklyReportDay', v)}
                  helpText="Se envía a las 7:00 AM del día seleccionado."
                  disabled={!config.emailWeeklyReportEnabled}
                />
              </FormLayout.Group>
            </FormLayout>
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      {/* ── 4. Personalización ── */}
      <Layout.AnnotatedSection
        title="Personalización"
        description="Ajusta la apariencia y contenido de los correos que envía tu tienda."
      >
        <Card padding="0">
          <Box padding="400">
            <BlockStack gap="500">
              <FormLayout>
                <TextField
                  label="Color de marca"
                  value={config.emailAccentColor || '#2563eb'}
                  onChange={(v) => updateField('emailAccentColor', v)}
                  autoComplete="off"
                  placeholder="#2563eb"
                  helpText="Color del encabezado de correos. Haz clic en el cuadro para elegir."
                  connectedRight={
                    <label
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        backgroundColor: config.emailAccentColor || '#2563eb',
                        border: '1px solid var(--p-color-border)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <input
                        type="color"
                        value={config.emailAccentColor || '#2563eb'}
                        onChange={(e) => updateField('emailAccentColor', e.target.value)}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer',
                          border: 'none',
                          padding: 0,
                        }}
                      />
                    </label>
                  }
                />
              </FormLayout>

              <FormLayout>
                <TextField
                  label="Pie de correo"
                  value={config.emailFooterText || ''}
                  onChange={(v) => updateField('emailFooterText', v)}
                  autoComplete="off"
                  placeholder="Gracias por tu preferencia. Visítanos en Av. Principal #123."
                  helpText="Texto que aparece al final de cada correo. Dejar vacío para usar el texto predeterminado."
                  multiline={2}
                />
              </FormLayout>

              <FormLayout>
                <TextField
                  label="Firma / Mensaje de cierre"
                  value={config.emailSignature || ''}
                  onChange={(v) => updateField('emailSignature', v)}
                  autoComplete="off"
                  placeholder="Atentamente, El equipo de Mi Abarrotes"
                  helpText="Se muestra antes del pie en correos transaccionales (tickets, alertas)."
                  multiline={2}
                />
              </FormLayout>
            </BlockStack>
          </Box>

          <Divider />

          {/* Preview */}
          <Box padding="400">
            <BlockStack gap="300">
              <Button onClick={togglePreview} variant="plain">
                {previewOpen ? 'Ocultar vista previa' : 'Ver vista previa del correo'}
              </Button>
              <Collapsible open={previewOpen} id="email-preview">
                <Box padding="300" borderRadius="200" background="bg-surface-secondary">
                  {/* Email header preview */}
                  <div
                    style={{
                      backgroundColor: config.emailAccentColor || '#2563eb',
                      borderRadius: '8px 8px 0 0',
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
                      }}
                    >
                      {config.emailFromName || config.storeName || 'Mi Abarrotes'}
                    </p>
                  </div>
                  {/* Email body preview */}
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      padding: '20px',
                      fontSize: 13,
                      color: '#374151',
                      lineHeight: 1.6,
                    }}
                  >
                    <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Contenido del correo</p>
                    <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 12 }}>
                      El cuerpo varía según el tipo de notificación.
                    </p>
                    {config.emailSignature && (
                      <p
                        style={{
                          margin: '16px 0 0',
                          paddingTop: 12,
                          borderTop: '1px solid #e5e7eb',
                          fontSize: 12,
                          color: '#6b7280',
                          fontStyle: 'italic',
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {config.emailSignature}
                      </p>
                    )}
                  </div>
                  {/* Footer preview */}
                  <div
                    style={{
                      backgroundColor: '#f9fafb',
                      borderTop: '1px solid #e5e7eb',
                      borderRadius: '0 0 8px 8px',
                      padding: '12px 20px',
                      textAlign: 'center',
                      fontSize: 11,
                      color: '#9ca3af',
                    }}
                  >
                    {config.emailFooterText || `Este correo fue enviado automáticamente por ${config.storeName || 'tu tienda'}. No respondas a este mensaje.`}
                  </div>
                </Box>
              </Collapsible>
            </BlockStack>
          </Box>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );
}
