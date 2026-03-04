'use client';

import { useState, useCallback, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import {
  Card,
  Text,
  TextField,
  Select,
  FormLayout,
  BlockStack,
  InlineStack,
  Button,
  Banner,
  Layout,
  Checkbox,
  Badge,
  Spinner,
  Divider,
} from '@shopify/polaris';
import {
  getMPConfig,
  saveMPConfig,
  getDevices,
} from '@/lib/mercadopago';
import type { MercadoPagoConfig } from '@/lib/mercadopago';
import { useDashboardStore } from '@/store/dashboardStore';
import type { StoreConfig } from '@/types';

export function ConfiguracionPage() {
  const { storeConfig, saveStoreConfig } = useDashboardStore();
  const [config, setConfig] = useState<StoreConfig>(storeConfig);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync from store when storeConfig changes (e.g., after initial fetch)
  useEffect(() => {
    setConfig(storeConfig);
  }, [storeConfig]);

  // Mercado Pago config
  const [mpConfig, setMpConfig] = useState<MercadoPagoConfig>({ accessToken: '', deviceId: '', enabled: false });
  const [mpSaved, setMpSaved] = useState(false);
  const [mpTesting, setMpTesting] = useState(false);
  const [mpTestResult, setMpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [mpDevices, setMpDevices] = useState<{ id: string; operating_mode: string }[]>([]);

  useEffect(() => {
    setMpConfig(getMPConfig());
  }, []);

  const updateField = useCallback(<K extends keyof StoreConfig>(field: K, value: StoreConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveStoreConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving config:', err);
    }
    setSaving(false);
  }, [config, saveStoreConfig]);

  const handleMPSave = useCallback(() => {
    saveMPConfig(mpConfig);
    setMpSaved(true);
    setTimeout(() => setMpSaved(false), 3000);
  }, [mpConfig]);

  const handleMPTest = useCallback(async () => {
    if (!mpConfig.accessToken) {
      setMpTestResult({ success: false, message: 'Ingresa un Access Token primero' });
      return;
    }
    setMpTesting(true);
    setMpTestResult(null);
    try {
      const devices = await getDevices(mpConfig.accessToken);
      setMpDevices(devices);
      if (devices.length > 0) {
        setMpTestResult({ success: true, message: `Conexión exitosa. ${devices.length} terminal(es) encontrada(s).` });
        if (!mpConfig.deviceId && devices.length > 0) {
          setMpConfig(prev => ({ ...prev, deviceId: devices[0].id }));
        }
      } else {
        setMpTestResult({ success: false, message: 'Conexión exitosa pero no se encontraron terminales vinculadas.' });
      }
    } catch (err) {
      setMpTestResult({ success: false, message: err instanceof Error ? err.message : 'Error al conectar con Mercado Pago' });
    }
    setMpTesting(false);
  }, [mpConfig.accessToken, mpConfig.deviceId]);

  // Generate ticket preview text
  const previewText = `
       ${config.legalName}
  ${config.address}
       C.P. ${config.postalCode}, ${config.city}
     RFC: ${config.rfc}
       TEL: ${config.phone}
     REGIMEN FISCAL - ${config.regimenFiscal}
  ${config.regimenDescription}
 ESTE COMPROBANTE NO ES VALIDO PARA
         EFECTOS FISCALES

TDA#${config.storeNumber} OP#CAJERO 1     TR# V-000001
01/01/2026              12:00:00
RFC: SIN R.F.C.
----------------------------------------
  PRODUCTO EJEMPLO
    2 pza x $25.00          $ 50.00
  REFRESCO COLA 600ML
    1 pza x $18.00          $ 18.00
----------------------------------------
  SUBTOTAL                    $ 68.00
  TOTAL                       $ 68.00
  EFECTIVO                    $ 68.00
  CAMBIO                      $ 0.00

----------------------------------------
  IVA    ${config.ivaRate}.0%     $ 58.62     $ 9.38
----------------------------------------
  TOTAL IVA                   $ 9.38

     ARTICULOS VENDIDOS    3
`;

  const previewTextAfter = `----------------------------------------

${config.ticketFooter.split('\\n').map((l: string) => `       ${l}`).join('\n')}
      Necesitas ayuda ahora?
         ${config.ticketServicePhone}
----------------------------------------
      Vigencia ${config.ticketVigencia}
`;

  return (
    <BlockStack gap="400">
      {saved && (
        <Banner tone="success" title="Configuración guardada" onDismiss={() => setSaved(false)}>
          <p>Los cambios se han guardado y sincronizado automáticamente en todos los tickets.</p>
        </Banner>
      )}

      <Layout>
        <Layout.AnnotatedSection
          title="Datos de la tienda"
          description="Información general que aparece en el encabezado de los tickets de venta y corte de caja."
        >
          <Card>
            <FormLayout>
              <TextField
                label="Nombre corto de la tienda"
                value={config.storeName}
                onChange={(v) => updateField('storeName', v)}
                autoComplete="off"
                helpText="Nombre que se muestra en reportes y corte de caja"
              />
              <TextField
                label="Razón social (nombre legal)"
                value={config.legalName}
                onChange={(v) => updateField('legalName', v)}
                autoComplete="off"
                helpText="Aparece en la primera línea del ticket"
              />
              <TextField
                label="Dirección"
                value={config.address}
                onChange={(v) => updateField('address', v)}
                autoComplete="off"
                multiline={2}
              />
              <FormLayout.Group>
                <TextField
                  label="Ciudad"
                  value={config.city}
                  onChange={(v) => updateField('city', v)}
                  autoComplete="off"
                />
                <TextField
                  label="Código Postal"
                  value={config.postalCode}
                  onChange={(v) => updateField('postalCode', v)}
                  autoComplete="off"
                />
              </FormLayout.Group>
              <FormLayout.Group>
                <TextField
                  label="Teléfono"
                  value={config.phone}
                  onChange={(v) => updateField('phone', v)}
                  autoComplete="tel"
                />
                <TextField
                  label="Número de sucursal"
                  value={config.storeNumber}
                  onChange={(v) => updateField('storeNumber', v)}
                  autoComplete="off"
                  helpText="Ej: 001, aparece como TDA#001"
                />
              </FormLayout.Group>
            </FormLayout>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Datos fiscales"
          description="RFC y régimen fiscal que se imprimen en los tickets."
        >
          <Card>
            <FormLayout>
              <TextField
                label="RFC"
                value={config.rfc}
                onChange={(v) => updateField('rfc', v)}
                autoComplete="off"
              />
              <FormLayout.Group>
                <TextField
                  label="Clave del Régimen Fiscal"
                  value={config.regimenFiscal}
                  onChange={(v) => updateField('regimenFiscal', v)}
                  autoComplete="off"
                  helpText="Ej: 612, 601, 625"
                />
                <TextField
                  label="Descripción del Régimen"
                  value={config.regimenDescription}
                  onChange={(v) => updateField('regimenDescription', v)}
                  autoComplete="off"
                  helpText="Ej: REGIMEN SIMPLIFICADO DE CONFIANZA"
                />
              </FormLayout.Group>
            </FormLayout>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Impuestos y moneda"
          description="Configura la tasa de IVA y la moneda de tu negocio."
        >
          <Card>
            <FormLayout>
              <FormLayout.Group>
                <TextField
                  label="Tasa de IVA (%)"
                  type="number"
                  value={config.ivaRate}
                  onChange={(v) => updateField('ivaRate', v)}
                  autoComplete="off"
                  suffix="%"
                />
                <Select
                  label="Moneda"
                  options={[
                    { label: 'Peso Mexicano (MXN)', value: 'MXN' },
                    { label: 'Dólar Americano (USD)', value: 'USD' },
                  ]}
                  value={config.currency}
                  onChange={(v) => updateField('currency', v)}
                />
              </FormLayout.Group>
            </FormLayout>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Pie del ticket"
          description="Personaliza el mensaje que aparece al final de cada ticket de venta."
        >
          <Card>
            <FormLayout>
              <TextField
                label="Mensaje del pie del ticket"
                value={config.ticketFooter}
                onChange={(v) => updateField('ticketFooter', v)}
                autoComplete="off"
                multiline={4}
                helpText="Usa \\n para saltos de línea. Este texto se centra en el ticket."
              />
              <FormLayout.Group>
                <TextField
                  label="Teléfono de atención al cliente"
                  value={config.ticketServicePhone}
                  onChange={(v) => updateField('ticketServicePhone', v)}
                  autoComplete="off"
                  helpText="Aparece en el pie del ticket"
                />
                <TextField
                  label="Vigencia del ticket"
                  value={config.ticketVigencia}
                  onChange={(v) => updateField('ticketVigencia', v)}
                  autoComplete="off"
                  helpText="Ej: 12/2026"
                />
              </FormLayout.Group>
            </FormLayout>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Vista previa del ticket"
          description="Así se verá tu ticket de venta con los datos configurados."
        >
          <Card>
            <div style={{ background: '#fff', padding: '8px', maxWidth: '360px', margin: '0 auto', border: '1px solid #ddd' }}>
              <pre style={{
                fontFamily: "'Courier New', 'Consolas', 'Lucida Console', monospace",
                fontSize: '10.5px',
                lineHeight: '1.3',
                margin: 0,
                padding: '4px 6px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: '#000',
                background: '#fff',
              }}>{previewText}</pre>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px 0', width: '100%' }}>
                <svg style={{ display: 'block', margin: '0 auto', maxWidth: '260px' }} ref={(el) => {
                  if (el) {
                    try {
                      JsBarcode(el, 'V-00000112345678', {
                        format: config.ticketBarcodeFormat || 'CODE128',
                        width: 1.5,
                        height: 40,
                        displayValue: true,
                        fontSize: 10,
                        font: 'Courier New',
                        textMargin: 2,
                        margin: 0,
                      });
                    } catch { /* format may not support this value */ }
                  }
                }} />
              </div>
              <pre style={{
                fontFamily: "'Courier New', 'Consolas', 'Lucida Console', monospace",
                fontSize: '10.5px',
                lineHeight: '1.3',
                margin: 0,
                padding: '4px 6px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: '#000',
                background: '#fff',
              }}>{previewTextAfter}</pre>
            </div>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Código de barras del ticket"
          description="Selecciona el formato de código de barras que se imprime en cada ticket de venta."
        >
          <Card>
            <FormLayout>
              <Select
                label="Formato de código de barras"
                options={[
                  { label: 'CODE128 (recomendado — alfanumérico)', value: 'CODE128' },
                  { label: 'CODE128A (solo mayúsculas + control)', value: 'CODE128A' },
                  { label: 'CODE128B (mayúsculas y minúsculas)', value: 'CODE128B' },
                  { label: 'CODE128C (solo dígitos, compacto)', value: 'CODE128C' },
                  { label: 'CODE39 (alfanumérico clásico)', value: 'CODE39' },
                  { label: 'ITF14 (14 dígitos, logística)', value: 'ITF14' },
                  { label: 'pharmacode (industria farmacéutica)', value: 'pharmacode' },
                  { label: 'codabar (bibliotecas, bancos de sangre)', value: 'codabar' },
                ]}
                value={config.ticketBarcodeFormat || 'CODE128'}
                onChange={(v) => updateField('ticketBarcodeFormat', v)}
                helpText="CODE128 es el más versátil y soporta letras y números. CODE39 es un estándar industrial clásico."
              />
            </FormLayout>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Alertas de inventario"
          description="Define los umbrales para recibir alertas."
        >
          <Card>
            <FormLayout>
              <FormLayout.Group>
                <TextField
                  label="Umbral de stock bajo (%)"
                  type="number"
                  value={config.lowStockThreshold}
                  onChange={(v) => updateField('lowStockThreshold', v)}
                  autoComplete="off"
                  suffix="%"
                  helpText="Alerta cuando el stock baje de este porcentaje del mínimo"
                />
                <TextField
                  label="Aviso de vencimiento (días)"
                  type="number"
                  value={config.expirationWarningDays}
                  onChange={(v) => updateField('expirationWarningDays', v)}
                  autoComplete="off"
                  suffix="días"
                  helpText="Días antes del vencimiento para mostrar alerta"
                />
              </FormLayout.Group>
            </FormLayout>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Preferencias"
          description="Opciones generales del sistema."
        >
          <Card>
            <BlockStack gap="400">
              <Checkbox
                label="Imprimir tickets automáticamente"
                helpText="Imprime un ticket de venta al completar cada transacción"
                checked={config.printReceipts}
                onChange={(v) => updateField('printReceipts', v)}
              />
              <Checkbox
                label="Respaldo automático"
                helpText="Realiza un respaldo de datos diario automáticamente"
                checked={config.autoBackup}
                onChange={(v) => updateField('autoBackup', v)}
              />
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Terminal Mercado Pago"
          description="Conecta tu terminal Point de Mercado Pago para cobrar con tarjeta directamente desde el punto de venta."
        >
          <Card>
            <BlockStack gap="400">
              <Checkbox
                label="Habilitar cobro con terminal Mercado Pago"
                helpText="Permite enviar cobros a tu terminal Point al seleccionar pago con tarjeta"
                checked={mpConfig.enabled}
                onChange={(v) => setMpConfig(prev => ({ ...prev, enabled: v }))}
              />

              {mpConfig.enabled && (
                <FormLayout>
                  <TextField
                    label="Access Token"
                    value={mpConfig.accessToken}
                    onChange={(v) => setMpConfig(prev => ({ ...prev, accessToken: v }))}
                    autoComplete="off"
                    type="password"
                    placeholder="APP_USR-..."
                    helpText="Lo encuentras en Mercado Pago → Tu negocio → Configuración → Gestión y administración → Credenciales → Access Token de producción"
                  />
                  <TextField
                    label="Device ID (Terminal)"
                    value={mpConfig.deviceId}
                    onChange={(v) => setMpConfig(prev => ({ ...prev, deviceId: v }))}
                    autoComplete="off"
                    placeholder="Ej: PAX_A910__SMARTPOS1234567890"
                    helpText="Identificador de tu terminal Point. Usa 'Probar conexión' para detectarlo automáticamente."
                  />

                  <InlineStack gap="200">
                    <Button onClick={handleMPTest} loading={mpTesting}>
                      Probar conexión
                    </Button>
                    <Button variant="primary" onClick={handleMPSave}>
                      Guardar configuración MP
                    </Button>
                  </InlineStack>

                  {mpSaved && (
                    <Banner tone="success" onDismiss={() => setMpSaved(false)}>
                      <p>Configuración de Mercado Pago guardada.</p>
                    </Banner>
                  )}

                  {mpTesting && (
                    <InlineStack gap="200" blockAlign="center">
                      <Spinner size="small" />
                      <Text as="p" variant="bodySm">Conectando con Mercado Pago...</Text>
                    </InlineStack>
                  )}

                  {mpTestResult && (
                    <Banner tone={mpTestResult.success ? 'success' : 'critical'}>
                      <p>{mpTestResult.message}</p>
                    </Banner>
                  )}

                  {mpDevices.length > 0 && (
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingSm">Terminales detectadas:</Text>
                      {mpDevices.map((d) => (
                        <InlineStack key={d.id} gap="200" blockAlign="center">
                          <Badge tone={d.id === mpConfig.deviceId ? 'success' : undefined}>
                            {d.id === mpConfig.deviceId ? 'Seleccionada' : 'Disponible'}
                          </Badge>
                          <Text as="p" variant="bodySm">{d.id}</Text>
                          {d.id !== mpConfig.deviceId && (
                            <Button size="slim" onClick={() => setMpConfig(prev => ({ ...prev, deviceId: d.id }))}>
                              Usar esta
                            </Button>
                          )}
                        </InlineStack>
                      ))}
                    </BlockStack>
                  )}

                  <Banner tone="info">
                    <p>
                      <strong>¿Cómo funciona?</strong> Al cobrar una venta con Tarjeta, el sistema envía el monto a tu
                      terminal Point. El cliente pasa su tarjeta en la terminal y el cobro se confirma automáticamente.
                      La comisión de Mercado Pago (2.5% + IVA) se agrega al total de la venta.
                    </p>
                  </Banner>
                </FormLayout>
              )}
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>
      </Layout>

      <InlineStack align="end">
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Guardar cambios
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
