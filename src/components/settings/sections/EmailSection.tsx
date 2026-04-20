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
  Popover,
  ColorPicker,
  hsbToHex,
  RangeSlider,
} from '@shopify/polaris';
import type { HSBAColor } from '@shopify/polaris';

function hexToHsb(hex: string): HSBAColor {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / d + 2) / 6;
    else hue = ((r - g) / d + 4) / 6;
  }
  return { hue: hue * 360, saturation: max === 0 ? 0 : d / max, brightness: max, alpha: 1 };
}
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
  | 'emailMonthlyReportEnabled'
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
    key: 'emailMonthlyReportEnabled',
    title: 'Reporte mensual',
    description: 'Resumen mensual con métricas acumuladas y análisis de tendencia.',
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

const MONTHLY_DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => ({
  label: `Día ${i + 1}`,
  value: String(i + 1),
}));

const DIGEST_INTERVAL_OPTIONS = [
  { label: '15 minutos', value: '15' },
  { label: '30 minutos', value: '30' },
  { label: '1 hora', value: '60' },
  { label: '2 horas', value: '120' },
  { label: '4 horas', value: '240' },
  { label: '8 horas', value: '480' },
  { label: '24 horas (1 vez al día)', value: '1440' },
];

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
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const toggleColorPicker = useCallback(() => setColorPickerOpen((o) => !o), []);

  const currentHex = config.emailAccentColor || '#2563eb';
  let currentHsb: HSBAColor;
  try {
    currentHsb = hexToHsb(currentHex);
  } catch {
    currentHsb = hexToHsb('#2563eb');
  }

  const handleColorChange = useCallback(
    (hsb: HSBAColor) => {
      updateField('emailAccentColor', hsbToHex(hsb));
    },
    [updateField],
  );

  const enabledCount = EMAIL_TYPES.filter((t) => config[t.key] as boolean).length;

  return (
    <BlockStack gap="600">
      {/* ═══════════════════════════════════════════════════════════
          1. CANAL DE CORREO — Activación + Identidad del remitente
         ═══════════════════════════════════════════════════════════ */}
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
                          placeholder={config.storeName || 'Mi Tienda'}
                          helpText="Nombre que aparece en la bandeja."
                        />
                      </FormLayout.Group>
                    </FormLayout>

                    <FormLayout>
                      <TextField
                        label="Reply-To (respuesta)"
                        value={config.emailReplyTo || ''}
                        onChange={(v) => updateField('emailReplyTo', v)}
                        autoComplete="email"
                        type="email"
                        placeholder="soporte@tutienda.com"
                        helpText="Opcional. Si vacío se usa el remitente."
                      />
                    </FormLayout>

                    <FormLayout>
                      <TextField
                        label="Prefijo del asunto"
                        value={config.emailSubjectPrefix || ''}
                        onChange={(v) => updateField('emailSubjectPrefix', v)}
                        autoComplete="off"
                        placeholder={`[${config.storeName || 'Mi Tienda'}]`}
                        helpText="Se agrega antes del asunto de cada correo. Ej: [Mi Tienda] Reporte Diario"
                      />
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

      {/* ═══════════════════════════════════════════════════════════
          2. DESTINATARIOS — Principales, CC, BCC
         ═══════════════════════════════════════════════════════════ */}
      {config.emailEnabled && (
        <Layout.AnnotatedSection
          title="Destinatarios"
          description="Configura quién recibe los correos. Los destinatarios principales reciben reportes y alertas. CC/BCC para copias adicionales."
        >
          <Card>
            <BlockStack gap="400">
              <FormLayout>
                <TextField
                  label="Destinatarios principales"
                  value={config.emailRecipients || ''}
                  onChange={(v) => updateField('emailRecipients', v)}
                  autoComplete="off"
                  placeholder="owner@gmail.com, gerente@gmail.com"
                  helpText="Correos que reciben reportes y alertas. Separa con coma."
                  multiline={2}
                />
              </FormLayout>
              <FormLayout>
                <FormLayout.Group>
                  <TextField
                    label="CC (Copia)"
                    value={config.emailCcRecipients || ''}
                    onChange={(v) => updateField('emailCcRecipients', v)}
                    autoComplete="off"
                    placeholder="contador@gmail.com"
                    helpText="Recibe copia visible de cada correo."
                  />
                  <TextField
                    label="BCC (Copia oculta)"
                    value={config.emailBccRecipients || ''}
                    onChange={(v) => updateField('emailBccRecipients', v)}
                    autoComplete="off"
                    placeholder="auditoria@empresa.com"
                    helpText="Recibe copia sin que los demás lo vean."
                  />
                </FormLayout.Group>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>
      )}

      {/* ═══════════════════════════════════════════════════════════
          3. TIPOS DE CORREO — Toggles individuales
         ═══════════════════════════════════════════════════════════ */}
      <Layout.AnnotatedSection
        title="Tipos de Correo"
        description="Activa o desactiva cada tipo de notificación de forma individual."
      >
        <Card padding="0">
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
                          <Badge tone={CATEGORY_TONE[emailType.category]} size="small">
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
                  <p>Configura el canal de correo arriba para activar las notificaciones individuales.</p>
                </Banner>
              </Box>
            </>
          )}
        </Card>
      </Layout.AnnotatedSection>

      {/* ═══════════════════════════════════════════════════════════
          4. PROGRAMACIÓN — Horarios de reportes
         ═══════════════════════════════════════════════════════════ */}
      <Layout.AnnotatedSection
        title="Programación"
        description="Define cuándo se envían los reportes automáticos. Todos los horarios en zona Ciudad de México."
      >
        <Card>
          <BlockStack gap="500">
            <Text as="h3" variant="headingSm" fontWeight="semibold">
              Reporte Diario
            </Text>
            <FormLayout>
              <Select
                label="Hora de envío"
                options={TIME_OPTIONS}
                value={config.emailDailyReportTime || '08:00'}
                onChange={(v) => updateField('emailDailyReportTime', v)}
                helpText="Hora para el resumen diario."
                disabled={!config.emailDailyReportEnabled}
              />
            </FormLayout>

            <Divider />

            <Text as="h3" variant="headingSm" fontWeight="semibold">
              Reporte Semanal
            </Text>
            <FormLayout>
              <FormLayout.Group>
                <Select
                  label="Día de envío"
                  options={DAY_OPTIONS}
                  value={config.emailWeeklyReportDay || 'monday'}
                  onChange={(v) => updateField('emailWeeklyReportDay', v)}
                  disabled={!config.emailWeeklyReportEnabled}
                />
                <Select
                  label="Hora de envío"
                  options={TIME_OPTIONS}
                  value={config.emailWeeklyReportTime || '07:00'}
                  onChange={(v) => updateField('emailWeeklyReportTime', v)}
                  disabled={!config.emailWeeklyReportEnabled}
                />
              </FormLayout.Group>
            </FormLayout>

            <Divider />

            <Text as="h3" variant="headingSm" fontWeight="semibold">
              Reporte Mensual
            </Text>
            <FormLayout>
              <FormLayout.Group>
                <Select
                  label="Día del mes"
                  options={MONTHLY_DAY_OPTIONS}
                  value={String(config.emailMonthlyReportDay || 1)}
                  onChange={(v) => updateField('emailMonthlyReportDay', Number(v))}
                  helpText="Se envía a las 8:00 AM del día seleccionado."
                  disabled={!config.emailMonthlyReportEnabled}
                />
              </FormLayout.Group>
            </FormLayout>
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      {/* ═══════════════════════════════════════════════════════════
          5. ADJUNTOS — PDF tickets, Excel reportes
         ═══════════════════════════════════════════════════════════ */}
      <Layout.AnnotatedSection
        title="Adjuntos"
        description="Configura qué archivos se adjuntan automáticamente a los correos."
      >
        <Card padding="0">
          <div style={{ padding: '12px 16px' }}>
            <Checkbox
              label="Adjuntar ticket en PDF"
              helpText="Los correos de ticket de compra digital incluirán un archivo PDF descargable del ticket."
              checked={config.emailAttachPdfTicket}
              onChange={(v) => updateField('emailAttachPdfTicket', v)}
            />
          </div>
          <Divider />
          <div style={{ padding: '12px 16px' }}>
            <Checkbox
              label="Adjuntar reporte en Excel"
              helpText="Los reportes diarios, semanales y mensuales incluirán un archivo XLSX con el detalle completo."
              checked={config.emailAttachExcelReport}
              onChange={(v) => updateField('emailAttachExcelReport', v)}
            />
          </div>
        </Card>
      </Layout.AnnotatedSection>

      {/* ═══════════════════════════════════════════════════════════
          6. CONTROL DE ALERTAS — Throttle + Digest
         ═══════════════════════════════════════════════════════════ */}
      <Layout.AnnotatedSection
        title="Control de Alertas"
        description="Evita spam de notificaciones. Agrupa alertas en un solo correo (digest) o limita la cantidad por hora."
      >
        <Card>
          <BlockStack gap="500">
            <RangeSlider
              label={`Máximo de alertas por hora: ${config.emailMaxAlertsPerHour ?? 20}`}
              value={config.emailMaxAlertsPerHour ?? 20}
              onChange={(v) => updateField('emailMaxAlertsPerHour', v as number)}
              min={1}
              max={50}
              step={1}
              output
              helpText="Si se supera este límite, las alertas adicionales se descartan hasta la siguiente hora."
            />

            <Divider />

            <Checkbox
              label="Activar modo digest"
              helpText="En vez de enviar cada alerta al instante, agrupa varias en un solo correo resumen."
              checked={config.emailDigestEnabled}
              onChange={(v) => updateField('emailDigestEnabled', v)}
            />

            {config.emailDigestEnabled && (
              <Box paddingInlineStart="800">
                <Select
                  label="Intervalo de agrupación"
                  options={DIGEST_INTERVAL_OPTIONS}
                  value={String(config.emailDigestIntervalMinutes || 60)}
                  onChange={(v) => updateField('emailDigestIntervalMinutes', Number(v))}
                  helpText="Las alertas se acumulan durante este periodo y se envían juntas."
                />
              </Box>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      {/* ═══════════════════════════════════════════════════════════
          7. REINTENTOS — Auto-retry en caso de fallo
         ═══════════════════════════════════════════════════════════ */}
      <Layout.AnnotatedSection
        title="Reintentos"
        description="Configura el comportamiento cuando un correo no se puede enviar."
      >
        <Card>
          <BlockStack gap="400">
            <Checkbox
              label="Reintentar automáticamente"
              helpText="Si un correo falla (error de red, SES temporalmente no disponible), el sistema reintenta enviarlo."
              checked={config.emailAutoRetry}
              onChange={(v) => updateField('emailAutoRetry', v)}
            />

            {config.emailAutoRetry && (
              <RangeSlider
                label={`Máximo de reintentos: ${config.emailMaxRetries ?? 3}`}
                value={config.emailMaxRetries ?? 3}
                onChange={(v) => updateField('emailMaxRetries', v as number)}
                min={1}
                max={5}
                step={1}
                output
                helpText="Cada reintento espera exponencialmente más tiempo (1s, 2s, 4s...)."
              />
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      {/* ═══════════════════════════════════════════════════════════
          8. PERSONALIZACIÓN — Branding, firma, pie, preview
         ═══════════════════════════════════════════════════════════ */}
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
                  helpText="Haz clic en el cuadro de color para abrir el selector."
                  connectedRight={
                    <Popover
                      active={colorPickerOpen}
                      onClose={toggleColorPicker}
                      activator={
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={toggleColorPicker}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleColorPicker(); }}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 'var(--p-border-radius-200)',
                            backgroundColor: currentHex,
                            border: '1px solid var(--p-color-border)',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        />
                      }
                    >
                      <Box padding="300">
                        <BlockStack gap="300">
                          <ColorPicker
                            onChange={handleColorChange}
                            color={currentHsb}
                          />
                          <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                            {currentHex}
                          </Text>
                        </BlockStack>
                      </Box>
                    </Popover>
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
                  helpText="Texto al final de cada correo. Dejar vacío para el texto predeterminado."
                  multiline={2}
                />
              </FormLayout>

              <FormLayout>
                <TextField
                  label="Firma / Mensaje de cierre"
                  value={config.emailSignature || ''}
                  onChange={(v) => updateField('emailSignature', v)}
                  autoComplete="off"
                  placeholder="Atentamente, El equipo de Mi Tienda"
                  helpText="Se muestra antes del pie en correos transaccionales."
                  multiline={2}
                />
              </FormLayout>
            </BlockStack>
          </Box>

          <Divider />

          <Box padding="400">
            <BlockStack gap="300">
              <Button onClick={togglePreview} variant="plain">
                {previewOpen ? 'Ocultar vista previa' : 'Ver vista previa del correo'}
              </Button>
              <Collapsible open={previewOpen} id="email-preview">
                <Box padding="300" borderRadius="200" background="bg-surface-secondary">
                  {/* Header */}
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
                        style={{ maxHeight: 40, maxWidth: '80%', marginBottom: 8, objectFit: 'contain' }}
                      />
                    )}
                    <p style={{ margin: 0, color: '#ffffff', fontSize: 16, fontWeight: 600 }}>
                      {config.emailFromName || config.storeName || 'Mi Tienda'}
                    </p>
                  </div>
                  {/* Subject preview */}
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      padding: '12px 20px',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: 12,
                      color: '#6b7280',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#374151' }}>Asunto: </span>
                    {config.emailSubjectPrefix ? `${config.emailSubjectPrefix} ` : ''}Reporte Diario — {config.storeName || 'Mi Tienda'}
                  </div>
                  {/* Body */}
                  <div style={{ backgroundColor: '#ffffff', padding: '20px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Contenido del correo</p>
                    <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 12 }}>
                      El cuerpo varía según el tipo de notificación (ticket, reporte, alerta).
                    </p>
                    {config.emailAttachPdfTicket && (
                      <p style={{ margin: '8px 0', fontSize: 11, color: '#6b7280' }}>
                        📎 ticket-compra-0001.pdf
                      </p>
                    )}
                    {config.emailAttachExcelReport && (
                      <p style={{ margin: '8px 0', fontSize: 11, color: '#6b7280' }}>
                        📎 reporte-diario-2026-04-15.xlsx
                      </p>
                    )}
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
                  {/* Footer */}
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
