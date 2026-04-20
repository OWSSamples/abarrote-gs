'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Badge,
  Banner,
  Card,
  Text,
  TextField,
  FormLayout,
  BlockStack,
  InlineStack,
  Layout,
  Checkbox,
  Button,
  DataTable,
  Spinner,
  Modal,
  Box,
  Divider,
  Tooltip,
  Collapsible,
  Link,
  Icon,
  DescriptionList,
} from '@shopify/polaris';
import { ExternalIcon, AlertCircleIcon, CheckCircleIcon } from '@shopify/polaris-icons';
import { FormSelect } from '@/components/ui/FormSelect';
import { isValidRFC, getRFCType } from '@/lib/validation/rfc';
import { formatCurrency } from '@/lib/utils';
import type { SettingsSectionProps } from './types';
import { CFDI_PAC_AUTH_TYPES, CFDI_PAC_PROVIDERS, CFDI_REGIMENES, type CFDIRecord } from '@/types';
import { fetchCFDIRecords, cancelCFDI } from '@/app/actions/analytics-advanced-actions';

// ── PAC Provider Detail Card ──
function PacProviderCard({
  provider,
  isSelected,
  onSelect,
}: {
  provider: (typeof CFDI_PAC_PROVIDERS)[number];
  isSelected: boolean;
  onSelect: () => void;
}) {
  if (provider.id === 'none') return null;

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        position: 'relative',
        padding: 'var(--p-space-300)',
        borderRadius: 'var(--p-border-radius-200)',
        border: isSelected
          ? '2px solid var(--p-color-border-emphasis)'
          : '1px solid var(--p-color-border)',
        background: isSelected
          ? 'var(--p-color-bg-surface-selected)'
          : 'var(--p-color-bg-surface)',
        cursor: 'pointer',
        transition: 'border-color 120ms ease, background 120ms ease',
        overflow: 'hidden',
        minHeight: '80px',
      }}
    >
      {/* Blurred logo watermark */}
      {provider.logoText && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '-4px',
            bottom: '-10px',
            fontSize: '56px',
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            textTransform: 'uppercase',
            color: isSelected
              ? 'var(--p-color-text-emphasis)'
              : 'var(--p-color-text-secondary)',
            opacity: isSelected ? 0.12 : 0.07,
            filter: 'blur(1.5px)',
            userSelect: 'none',
            pointerEvents: 'none',
            transition: 'opacity 120ms ease, color 120ms ease',
          }}
        >
          {provider.logoText}
        </div>
      )}

      <BlockStack gap="100">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Text as="span" variant="headingSm" fontWeight="semibold">
              {provider.label}
            </Text>
            {isSelected && <Badge tone="info">Seleccionado</Badge>}
          </InlineStack>
          {provider.website && (
            <Tooltip content="Abrir sitio web del PAC">
              <Link url={provider.website} target="_blank" removeUnderline>
                <Icon source={ExternalIcon} tone="base" />
              </Link>
            </Tooltip>
          )}
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">
          {provider.description}
        </Text>
      </BlockStack>
    </div>
  );
}

export function FiscalSection({ config, updateField }: SettingsSectionProps) {
  const rfcError =
    config.rfc && !isValidRFC(config.rfc)
      ? 'RFC inválido. Formato: 3-4 letras + 6 dígitos (AAMMDD) + 3 homoclave'
      : undefined;
  const rfcType = config.rfc ? getRFCType(config.rfc) : null;

  // ── CFDI State ──
  const [cfdiRecords, setCfdiRecords] = useState<CFDIRecord[]>([]);
  const [cfdiLoading, setCfdiLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CFDIRecord | null>(null);
  const [cancelReason, setCancelReason] = useState<'01' | '02' | '03' | '04'>('02');
  const [cancelRelatedUuid, setCancelRelatedUuid] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

  const pacConfigured =
    config.cfdiPacProvider !== 'none' &&
    Boolean(config.cfdiPacApiKey?.trim()) &&
    (config.cfdiPacAuthType !== 'basic' || Boolean(config.cfdiPacApiSecret?.trim()));

  const hasPac = Boolean(config.rfc && config.regimenFiscal && pacConfigured);

  const selectedProvider = useMemo(
    () => CFDI_PAC_PROVIDERS.find((p) => p.id === config.cfdiPacProvider) ?? CFDI_PAC_PROVIDERS[0],
    [config.cfdiPacProvider],
  );

  const authTypeOptions = CFDI_PAC_AUTH_TYPES.map((authType) => ({
    label: authType.label,
    value: authType.id,
  }));

  const loadCfdiRecords = useCallback(async () => {
    setCfdiLoading(true);
    try {
      const records = await fetchCFDIRecords();
      setCfdiRecords(records);
    } catch {
      /* non-critical */
    }
    setCfdiLoading(false);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- initial data load */
  useEffect(() => {
    loadCfdiRecords();
  }, [loadCfdiRecords]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleCancelCfdi = useCallback(async () => {
    if (!cancelTarget) return;
    setCancelBusy(true);
    try {
      await cancelCFDI(cancelTarget.id, cancelReason, cancelReason === '01' ? cancelRelatedUuid : undefined);
      setCancelModalOpen(false);
      setCancelTarget(null);
      loadCfdiRecords();
    } catch {
      /* shown via toast */
    }
    setCancelBusy(false);
  }, [cancelTarget, cancelReason, cancelRelatedUuid, loadCfdiRecords]);

  const handleProviderSelect = useCallback(
    (providerId: string) => {
      updateField('cfdiPacProvider', providerId);
      const provider = CFDI_PAC_PROVIDERS.find((p) => p.id === providerId);
      if (provider && 'authDefault' in provider && provider.authDefault) {
        updateField('cfdiPacAuthType', provider.authDefault);
      }
    },
    [updateField],
  );

  const STATUS_TONE: Record<string, 'success' | 'attention' | 'critical' | 'info'> = {
    timbrada: 'success',
    pending: 'attention',
    cancelada: 'info',
    error: 'critical',
  };
  const STATUS_LABEL: Record<string, string> = {
    timbrada: 'Timbrada',
    pending: 'Pendiente',
    cancelada: 'Cancelada',
    error: 'Error',
  };

  return (
    <BlockStack gap="500">
      {/* ── Datos Contables ── */}
      <Layout.AnnotatedSection
        title="Información Contable"
        description="Datos fiscales esenciales para el desglose correcto de ventas e impuestos ante el SAT."
      >
        <Card>
          <FormLayout>
            <TextField
              label="Registro Federal de Contribuyentes (RFC)"
              value={config.rfc}
              onChange={(v) => updateField('rfc', v.toUpperCase())}
              autoComplete="off"
              error={rfcError}
              helpText={rfcType ? `Tipo: ${rfcType}` : 'Persona física (13 chars) o moral (12 chars)'}
              maxLength={13}
            />
            <FormLayout.Group>
              <FormSelect
                label="Régimen Fiscal"
                options={[
                  { label: 'Seleccionar régimen…', value: '' },
                  ...CFDI_REGIMENES.map((r) => ({
                    label: `${r.clave} — ${r.descripcion}`,
                    value: r.clave,
                  })),
                ]}
                value={config.regimenFiscal}
                onChange={(v) => {
                  updateField('regimenFiscal', v);
                  const match = CFDI_REGIMENES.find((r) => r.clave === v);
                  if (match) {
                    updateField('regimenDescription', match.descripcion);
                  }
                }}
                helpText="Catálogo completo de regímenes fiscales del SAT."
              />
              <TextField
                label="Descripción del Régimen"
                value={config.regimenDescription}
                onChange={(v) => updateField('regimenDescription', v)}
                autoComplete="off"
                disabled={Boolean(config.regimenFiscal && CFDI_REGIMENES.some((r) => r.clave === config.regimenFiscal))}
                helpText="Se llena automáticamente al elegir régimen."
              />
            </FormLayout.Group>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      {/* ── Moneda y Tasas ── */}
      <Layout.AnnotatedSection
        title="Moneda y Tasas"
        description="Moneda por defecto y porcentaje de impuesto al valor agregado."
      >
        <Card>
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="Tasa de IVA global (%)"
                type="number"
                value={config.ivaRate}
                onChange={(v) => updateField('ivaRate', v)}
                autoComplete="off"
                suffix="%"
                helpText="Aplicado a la base gravable"
              />
              <FormSelect
                label="Moneda principal"
                options={[
                  { label: 'Peso Mexicano (MXN)', value: 'MXN' },
                  { label: 'Dólar Americano (USD)', value: 'USD' },
                ]}
                value={config.currency}
                onChange={(v) => updateField('currency', v)}
              />
            </FormLayout.Group>
            <Checkbox
              label="Los precios de los productos ya incluyen IVA"
              checked={config.pricesIncludeIva}
              onChange={(value) => updateField('pricesIncludeIva', value)}
              helpText="Si está marcado, el IVA se extraerá del total (Total / 1.16). Si no está marcado, se sumará al subtotal (Subtotal + 16%)."
            />
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      {/* ── PAC Selection ── */}
      <Layout.AnnotatedSection
        title="Proveedor de Timbrado (PAC)"
        description="Selecciona tu Proveedor Autorizado de Certificación (PAC) para timbrar CFDI 4.0 ante el SAT. Solo mostramos PACs con autorización vigente."
      >
        <BlockStack gap="400">
          {/* Status Banner + Badge */}
          <InlineStack gap="200" blockAlign="center" wrap={false}>
            <Text as="h3" variant="headingMd">
              Estado
            </Text>
            <Badge tone={hasPac ? 'success' : 'attention'}>
              {hasPac ? 'PAC Configurado' : 'Pendiente'}
            </Badge>
            {hasPac && (
              <Badge tone={config.cfdiPacEnvironment === 'production' ? 'success' : 'attention'}>
                {config.cfdiPacEnvironment === 'production' ? 'Producción' : 'Sandbox'}
              </Badge>
            )}
          </InlineStack>

          {!hasPac && (
            <Banner tone="warning" icon={AlertCircleIcon}>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  Timbrado no disponible
                </Text>
                <Text as="p" variant="bodySm">
                  Para emitir CFDI ante el SAT necesitas: RFC configurado, régimen fiscal, un PAC seleccionado y
                  credenciales válidas.
                </Text>
              </BlockStack>
            </Banner>
          )}

          {hasPac && (
            <Banner tone="success" icon={CheckCircleIcon}>
              <Text as="p" variant="bodyMd">
                Conectado a <Text as="span" fontWeight="semibold">{selectedProvider.label}</Text>.
                Listo para timbrar CFDI 4.0.
              </Text>
            </Banner>
          )}

          {/* Provider Grid */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Elige tu PAC autorizado por el SAT
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Todos los proveedores listados están autorizados por el SAT. Haz clic para seleccionar.
              </Text>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 'var(--p-space-200)',
                }}
              >
                {CFDI_PAC_PROVIDERS.filter((p) => p.id !== 'none').map((provider) => (
                  <PacProviderCard
                    key={provider.id}
                    provider={provider}
                    isSelected={config.cfdiPacProvider === provider.id}
                    onSelect={() => handleProviderSelect(provider.id)}
                  />
                ))}
              </div>

              <Divider />

              {/* None option */}
              <Checkbox
                label="No usar PAC — guardar CFDI solo localmente"
                checked={config.cfdiPacProvider === 'none'}
                onChange={(checked) => {
                  if (checked) updateField('cfdiPacProvider', 'none');
                }}
                helpText="Los comprobantes se generan pero no se timbran ante el SAT."
              />
            </BlockStack>
          </Card>

          {/* How to get key — contextual help */}
          {selectedProvider.id !== 'none' && selectedProvider.howToGetKey && (
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  ¿Cómo obtener tus credenciales de {selectedProvider.label}?
                </Text>

                <Text as="p" variant="bodyMd" tone="subdued">
                  {selectedProvider.howToGetKey}
                </Text>

                {selectedProvider.website && (
                  <Link url={selectedProvider.website} target="_blank">
                    Ir a {selectedProvider.website.replace('https://', '').replace(/\/$/, '')}
                  </Link>
                )}
              </BlockStack>
            </Card>
          )}

          {/* Credentials & Connection */}
          {config.cfdiPacProvider !== 'none' && (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingSm">
                    Conexión y Credenciales
                  </Text>
                  <Button
                    variant="plain"
                    onClick={() => setShowCredentials((v) => !v)}
                  >
                    {showCredentials ? 'Ocultar campos' : 'Mostrar campos'}
                  </Button>
                </InlineStack>

                <FormLayout>
                  <FormLayout.Group>
                    <FormSelect
                      label="Ambiente"
                      options={[
                        { label: 'Sandbox (pruebas)', value: 'sandbox' },
                        { label: 'Producción', value: 'production' },
                      ]}
                      value={config.cfdiPacEnvironment}
                      onChange={(v) => updateField('cfdiPacEnvironment', v)}
                      helpText={
                        config.cfdiPacEnvironment === 'production'
                          ? 'Los CFDI se timbran con valor fiscal real.'
                          : 'Modo de pruebas sin valor fiscal. Ideal para configurar.'
                      }
                    />
                    <FormSelect
                      label="Autenticación"
                      options={authTypeOptions}
                      value={config.cfdiPacAuthType}
                      onChange={(v) => updateField('cfdiPacAuthType', v)}
                      helpText="Tipo de autenticación que requiere la API de tu PAC."
                    />
                  </FormLayout.Group>
                </FormLayout>

                <Collapsible
                  open={showCredentials}
                  id="pac-credentials-collapsible"
                  transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
                >
                  <BlockStack gap="300">
                    <Divider />
                    <FormLayout>
                      <TextField
                        label="URL de timbrado (opcional)"
                        value={config.cfdiPacApiUrl ?? ''}
                        onChange={(v) => updateField('cfdiPacApiUrl', v)}
                        autoComplete="off"
                        helpText="Déjalo vacío para usar la URL oficial del proveedor."
                        placeholder="https://api.ejemplo.com/v4/cfdi40/stamp"
                      />

                      <FormLayout.Group>
                        <TextField
                          label={config.cfdiPacAuthType === 'bearer' ? 'Token de API' : 'API Key / Usuario'}
                          value={config.cfdiPacApiKey ?? ''}
                          onChange={(v) => updateField('cfdiPacApiKey', v)}
                          autoComplete="off"
                          type="password"
                          helpText="Credencial principal proporcionada por tu PAC."
                        />
                        <TextField
                          label={
                            config.cfdiPacAuthType === 'basic'
                              ? 'API Secret / Password'
                              : 'API Secret (opcional)'
                          }
                          value={config.cfdiPacApiSecret ?? ''}
                          onChange={(v) => updateField('cfdiPacApiSecret', v)}
                          autoComplete="off"
                          type="password"
                          helpText={
                            config.cfdiPacAuthType === 'basic'
                              ? 'Requerido para autenticación Basic.'
                              : 'Solo si tu PAC requiere un segundo secreto.'
                          }
                        />
                      </FormLayout.Group>

                      <TextField
                        label="Ruta de cancelación"
                        value={config.cfdiPacCancelPath ?? '/cancel'}
                        onChange={(v) => updateField('cfdiPacCancelPath', v)}
                        autoComplete="off"
                        helpText="Ruta relativa para cancelar CFDI. Por defecto /cancel."
                      />
                    </FormLayout>
                  </BlockStack>
                </Collapsible>
              </BlockStack>
            </Card>
          )}

          {/* Resumen de configuración */}
          {config.cfdiPacProvider !== 'none' && (
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Resumen de la conexión
                </Text>
                <DescriptionList
                  items={[
                    { term: 'Proveedor', description: selectedProvider.label },
                    {
                      term: 'Ambiente',
                      description:
                        config.cfdiPacEnvironment === 'production' ? 'Producción' : 'Sandbox (pruebas)',
                    },
                    {
                      term: 'Autenticación',
                      description:
                        CFDI_PAC_AUTH_TYPES.find((a) => a.id === config.cfdiPacAuthType)?.label ?? config.cfdiPacAuthType,
                    },
                    {
                      term: 'API Key',
                      description: config.cfdiPacApiKey
                        ? `${'•'.repeat(8)}${config.cfdiPacApiKey.slice(-4)}`
                        : '— sin configurar —',
                    },
                    {
                      term: 'Estado',
                      description: pacConfigured ? '✓ Credenciales completas' : '✗ Faltan credenciales',
                    },
                  ]}
                />
              </BlockStack>
            </Card>
          )}
        </BlockStack>
      </Layout.AnnotatedSection>

      {/* ── Comprobantes Fiscales ── */}
      <Layout.AnnotatedSection
        title="Comprobantes Fiscales (CFDI)"
        description="Historial de comprobantes emitidos. Puedes cancelar facturas timbradas directamente ante el SAT."
      >
        <Card padding="0">
          {cfdiLoading ? (
            <Box padding="600">
              <InlineStack align="center">
                <Spinner size="small" />
                <Text as="span" variant="bodySm" tone="subdued">
                  Cargando comprobantes…
                </Text>
              </InlineStack>
            </Box>
          ) : cfdiRecords.length === 0 ? (
            <Box padding="600">
              <BlockStack gap="200" inlineAlign="center">
                <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                  No hay comprobantes fiscales emitidos aún.
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Los CFDI aparecerán aquí cuando realices ventas con facturación electrónica.
                </Text>
              </BlockStack>
            </Box>
          ) : (
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text']}
              headings={['Folio', 'RFC Receptor', 'UUID', 'Total', 'Estado', 'Acciones']}
              rows={cfdiRecords.slice(0, 20).map((r) => [
                r.folio,
                r.receptorRfc,
                r.uuid ? `${r.uuid.slice(0, 8)}…` : '—',
                formatCurrency(r.total),
                <Badge key={r.id} tone={STATUS_TONE[r.status] ?? 'info'}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>,
                r.status === 'timbrada' ? (
                  <Button
                    key={`c-${r.id}`}
                    variant="plain"
                    tone="critical"
                    onClick={() => {
                      setCancelTarget(r);
                      setCancelModalOpen(true);
                    }}
                  >
                    Cancelar
                  </Button>
                ) : (
                  '—'
                ),
              ])}
            />
          )}
        </Card>
      </Layout.AnnotatedSection>

      {/* ── CFDI Cancel Modal ── */}
      <Modal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title={`Cancelar CFDI ${cancelTarget?.folio ?? ''}`}
        primaryAction={{
          content: 'Cancelar CFDI ante SAT',
          destructive: true,
          loading: cancelBusy,
          onAction: handleCancelCfdi,
        }}
        secondaryActions={[{ content: 'Cerrar', onAction: () => setCancelModalOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Banner tone="warning">
              <Text as="p" variant="bodySm">
                La cancelación de un CFDI es irreversible ante el SAT. Asegúrate de seleccionar el motivo correcto.
              </Text>
            </Banner>
            <FormSelect
              label="Motivo de cancelación (SAT)"
              options={[
                { label: '01 — Comprobante emitido con errores con relación', value: '01' },
                { label: '02 — Comprobante emitido con errores sin relación', value: '02' },
                { label: '03 — No se llevó a cabo la operación', value: '03' },
                { label: '04 — Operación nominativa en CFDI global', value: '04' },
              ]}
              value={cancelReason}
              onChange={(v) => setCancelReason(v as typeof cancelReason)}
            />
            {cancelReason === '01' && (
              <TextField
                label="UUID del CFDI que sustituye"
                value={cancelRelatedUuid}
                onChange={setCancelRelatedUuid}
                autoComplete="off"
                helpText="Ingresa el UUID del nuevo CFDI que reemplaza al que se va a cancelar."
              />
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
