'use client';

import { useState, useCallback, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import {
  Card,
  Text,
  TextField,
  FormLayout,
  BlockStack,
  InlineStack,
  Button,
  Banner,
  Layout,
  Checkbox,
  Badge,
  Spinner,
  Page,
  Icon,
  Grid,
  Box,
  Divider,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import {
  getMPConfig,
  saveMPConfig,
  getDevices,
} from '@/lib/mercadopago';
import type { MercadoPagoConfig } from '@/lib/mercadopago';
import { useDashboardStore } from '@/store/dashboardStore';
import type { StoreConfig } from '@/types';
import {
  StoreIcon,
  ReceiptIcon,
  InventoryIcon,
  ChatIcon,
  CreditCardIcon,
  NoteIcon,
  MoneyIcon,
  PrintIcon,
  StarFilledIcon,
  SettingsFilledIcon
} from '@shopify/polaris-icons';

const SETTINGS_CATEGORIES = [
  { id: 'general', title: 'Detalles de la tienda', description: 'Gestiona la identidad de tu negocio, dirección y preferencias básicas.', icon: StoreIcon },
  { id: 'fiscal', title: 'Fiscales e Impuestos', description: 'Configura tu RFC, régimen fiscal, moneda y tasas de IVA.', icon: NoteIcon },
  { id: 'pos', title: 'Punto de Venta y Recibos', description: 'Personaliza los tickets impresos y la estructura de códigos de barras.', icon: ReceiptIcon },
  { id: 'hardware', title: 'Hardware y Periféricos', description: 'Configura IPs de impresoras, cajones de dinero y básculas seriales.', icon: PrintIcon },
  { id: 'loyalty', title: 'Loyalty y Puntos', description: 'Configura las conversiones y recompensas para la fidelización de clientes.', icon: StarFilledIcon },
  { id: 'inventory', title: 'Inventario de productos', description: 'Establece reglas y umbrales para alertas de stock y caducidad.', icon: InventoryIcon },
  { id: 'notifications', title: 'Notificaciones', description: 'Conecta notificaciones push a tu celular mediante Telegram.', icon: ChatIcon },
  { id: 'payments', title: 'Pagos Integrados', description: 'Vincula tu terminal Point de Mercado Pago para cobros físicos.', icon: CreditCardIcon },
];

export function ConfiguracionPage() {
  const { storeConfig, saveStoreConfig } = useDashboardStore();
  const [config, setConfig] = useState<StoreConfig>(storeConfig);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    setConfig(storeConfig);
  }, [storeConfig]);

  const isDirty = JSON.stringify(config) !== JSON.stringify(storeConfig);

  // Mercado Pago config
  const [mpConfig, setMpConfig] = useState<MercadoPagoConfig>({ accessToken: '', publicKey: '', deviceId: '', enabled: false });
  const [mpSaved, setMpSaved] = useState(false);
  const [mpTesting, setMpTesting] = useState(false);
  const [mpTestResult, setMpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [mpDevices, setMpDevices] = useState<{ id: string; operating_mode: string }[]>([]);

  // Telegram config
  const [tgTesting, setTgTesting] = useState(false);
  const [tgTestResult, setTgTestResult] = useState<{ success: boolean; message: string } | null>(null);

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

  const handleTGTest = useCallback(async () => {
    if (!config.telegramToken || !config.telegramChatId) {
      setTgTestResult({ success: false, message: 'Ingresa Token y Chat ID primero' });
      return;
    }
    setTgTesting(true);
    setTgTestResult(null);
    try {
      const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.telegramChatId,
          text: '✅ <b>PRUEBA DE CONEXIÓN</b>\n\nTu consola de abarrotes está conectada correctamente a Telegram.',
          parse_mode: 'HTML',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTgTestResult({ success: true, message: 'Notificación enviada con éxito' });
      } else {
        setTgTestResult({ success: false, message: `Error de Telegram: ${data.description}` });
      }
    } catch (err) {
      setTgTestResult({ success: false, message: 'Error al conectar con Telegram API' });
    }
    setTgTesting(false);
  }, [config.telegramToken, config.telegramChatId]);

  // Generators for Ticket Preview
  const TW = 40;
  const center = (text: string) => {
    const t = text.trim();
    if (t.length >= TW) return t;
    const pad = TW - t.length;
    return ' '.repeat(Math.floor(pad / 2)) + t;
  };
  const wrapCenter = (text: string) => {
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const c = cur ? `${cur} ${w}` : w;
      if (c.length > TW) { if (cur) lines.push(center(cur)); cur = w; }
      else cur = c;
    }
    if (cur) lines.push(center(cur));
    return lines.join('\n');
  };
  const dashes = '-'.repeat(TW);
  const fmtAmt = (s: string) => ('$ ' + s).padStart(16);
  const footerPrev = (config.ticketFooter || '').split('\\n').map((l: string) => center(l)).join('\n');

  const previewText = `
${center(config.legalName || 'NOMBRE LEGAL')}
${center(config.address || 'DIRECCIÓN OMITIDA')}
${center(`C.P. ${config.postalCode || '00000'}, ${config.city || 'CIUDAD'}`)}
${center(`RFC: ${config.rfc || 'XAXX010101000'}`)}
${center(`TEL: ${config.phone || '000-000-0000'}`)}
${center(`REGIMEN FISCAL - ${config.regimenFiscal || 'XXX'}`)}
${wrapCenter(config.regimenDescription || 'DESCRIPCIÓN DEL REGIMEN')}
${center('ESTE COMPROBANTE NO ES VALIDO PARA')}
${center('EFECTOS FISCALES')}

${center(`TDA#${config.storeNumber || '001'} OP#CAJERO 1     TR# V-000001`)}
${center('01/01/2026              12:00:00')}
${center('RFC: SIN R.F.C.')}
${dashes}
  PRODUCTO EJEMPLO
    2 pza x $25.00    ${fmtAmt('50.00')}
  REFRESCO COLA 600ML
    1 pza x $18.00    ${fmtAmt('18.00')}
${dashes}
  SUBTOTAL            ${fmtAmt('68.00')}
  TOTAL               ${fmtAmt('68.00')}
  EFECTIVO            ${fmtAmt('68.00')}
  CAMBIO              ${fmtAmt('0.00')}

${dashes}
  IVA    ${config.ivaRate || '0'}.0%  ${fmtAmt('58.62')}${fmtAmt('9.38')}
${dashes}
  TOTAL IVA           ${fmtAmt('9.38')}

${center('ARTICULOS VENDIDOS    3')}
`;

  const previewTextAfter = `${dashes}

${footerPrev}
${center('Necesitas ayuda ahora?')}
${center(config.ticketServicePhone || 'SIN TELÉFONO')}
${dashes}
${center(`Vigencia ${config.ticketVigencia || 'N/A'}`)}
`;


  // ================= VIEW RENDERERS ================= //

  const renderGeneralConfig = () => (
    <BlockStack gap="500">
      <Layout.AnnotatedSection
        title="Perfil de la tienda"
        description="Información básica pública que representa a tu negocio."
      >
        <Card>
          <FormLayout>
            <TextField label="Nombre comercial del sistema" value={config.storeName} onChange={(v) => updateField('storeName', v)} autoComplete="off" helpText="Nombre que verán tus empleados en el Dashboard." />
            <TextField label="Razón social (nombre legal)" value={config.legalName} onChange={(v) => updateField('legalName', v)} autoComplete="off" helpText="Nombre de tu negocio o persona física para los recibos." />
            <TextField label="URL del Logotipo (Ticket y Pantalla)" value={config.logoUrl || ''} onChange={(v) => updateField('logoUrl', v)} autoComplete="off" helpText="Pega el enlace web de la imagen de tu logo para que aparezca impreso (Ideal en blanco y negro)." />
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        title="Ubicación y Contacto"
        description="La dirección física donde operas y tus datos de atención al público."
      >
        <Card>
          <FormLayout>
            <TextField label="Dirección física" value={config.address} onChange={(v) => updateField('address', v)} autoComplete="off" multiline={2} />
            <FormLayout.Group>
              <TextField label="Ciudad" value={config.city} onChange={(v) => updateField('city', v)} autoComplete="off" />
              <TextField label="Código Postal" value={config.postalCode} onChange={(v) => updateField('postalCode', v)} autoComplete="off" />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField label="Teléfono principal" value={config.phone} onChange={(v) => updateField('phone', v)} autoComplete="tel" />
              <TextField label="Número identificador de sucursal" value={config.storeNumber} onChange={(v) => updateField('storeNumber', v)} autoComplete="off" helpText="Ej: 001, usado para multitiendas." />
            </FormLayout.Group>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        title="Preferencias del sistema"
        description="Ajustes de comportamiento general en segundo plano."
      >
        <Card>
          <BlockStack gap="400">
            <Checkbox label="Respaldos automatizados" helpText="Crea instantáneas de tu base de datos y ventas diariamente para tu tranquilidad." checked={config.autoBackup} onChange={(v) => updateField('autoBackup', v)} />
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );

  const renderFiscalConfig = () => (
    <BlockStack gap="500">
      <Layout.AnnotatedSection title="Información Contable" description="Datos esenciales para el desglose de ventas e impuestos.">
        <Card>
          <FormLayout>
            <TextField label="Registro Federal de Contribuyentes (RFC)" value={config.rfc} onChange={(v) => updateField('rfc', v)} autoComplete="off" />
            <FormLayout.Group>
              <TextField label="Clave del Régimen Fiscal" value={config.regimenFiscal} onChange={(v) => updateField('regimenFiscal', v)} autoComplete="off" helpText="Ej: 612, 626" />
              <TextField label="Descripción del Régimen" value={config.regimenDescription} onChange={(v) => updateField('regimenDescription', v)} autoComplete="off" helpText="Ej: RESICO" />
            </FormLayout.Group>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection title="Moneda y Tasas" description="Moneda por defecto y porcentaje de impuesto al valor agregado.">
        <Card>
          <FormLayout>
            <FormLayout.Group>
              <TextField label="Tasa de IVA global (%)" type="number" value={config.ivaRate} onChange={(v) => updateField('ivaRate', v)} autoComplete="off" suffix="%" helpText="Aplicado a la base gravable" />
              <FormSelect
                label="Moneda principal"
                options={[{ label: 'Peso Mexicano (MXN)', value: 'MXN' }, { label: 'Dólar Americano (USD)', value: 'USD' }]}
                value={config.currency}
                onChange={(v) => updateField('currency', v)}
              />
            </FormLayout.Group>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );

  const renderPosConfig = () => (
    <BlockStack gap="500">
      <Layout.AnnotatedSection title="Comportamiento del checkout" description="Automatizaciones para agilizar el cobro en mostrador.">
        <Card background="bg-surface">
          <Checkbox label="Imprimir ticket automáticamente al cobrar" helpText="Elimina el paso de confirmación y despacha el recibo hacia la impresora térmica de inmediato." checked={config.printReceipts} onChange={(v) => updateField('printReceipts', v)} />
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection title="Formatos de Ticket" description="Mensajes de pie de página y estándar tecnológico para el código de barras.">
        <Card>
          <FormLayout>
            <TextField label="Mensaje del pie del ticket" value={config.ticketFooter} onChange={(v) => updateField('ticketFooter', v)} autoComplete="off" multiline={3} helpText="Agrega políticas de devolución o agradecimientos. Usa \n para saltos de línea." />
            <FormLayout.Group>
              <TextField label="Teléfono de soporte/reclamaciones" value={config.ticketServicePhone} onChange={(v) => updateField('ticketServicePhone', v)} autoComplete="off" />
              <TextField label="Límite de vigencia" value={config.ticketVigencia} onChange={(v) => updateField('ticketVigencia', v)} autoComplete="off" helpText="Ej: 30 Días / Fin de mes" />
            </FormLayout.Group>
            <Box paddingBlockStart="200">
              <FormSelect
                label="Simbología del Código de Barras"
                options={[
                  { label: 'CODE128 (estándar, alfanumérico)', value: 'CODE128' },
                  { label: 'CODE39 (clásico)', value: 'CODE39' },
                  { label: 'ITF14 (logística)', value: 'ITF14' },
                ]}
                value={config.ticketBarcodeFormat || 'CODE128'}
                onChange={(v) => updateField('ticketBarcodeFormat', v)}
                helpText="Usado en la parte inferior para identificar la transacción."
              />
            </Box>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection title="Simulador de Ticket" description="Una vista previa realista de cómo los recibos saldrán de la impresora térmica con la configuración actual.">
        <Card>
          <div style={{ background: '#fcfcfc', padding: '12px', maxWidth: '380px', margin: '0 auto', border: '1px solid #e1e3e5', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <pre style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4', margin: 0, padding: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#111' }}>
              {previewText}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', width: '100%' }}>
              <svg style={{ display: 'block', maxWidth: '100%' }} ref={(el) => {
                if (el) {
                  try {
                    JsBarcode(el, 'V-00000112345678', {
                      format: config.ticketBarcodeFormat || 'CODE128', width: 1.5, height: 40, displayValue: true, fontSize: 10, font: 'monospace', margin: 0,
                    });
                  } catch { }
                }
              }} />
            </div>
            <pre style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4', margin: 0, padding: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#111' }}>
              {previewTextAfter}
            </pre>
          </div>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );

  const renderHardwareConfig = () => (
    <BlockStack gap="500">
      <Layout.AnnotatedSection title="Dispositivos Locales" description="Parametriza los puertos de conexión física si corres el software con hardware avanzado.">
        <Card>
          <FormLayout>
            <TextField label="Dirección IP Impresora Térmica" placeholder="Ej: 192.168.1.100" value={config.printerIp || ''} onChange={(v) => updateField('printerIp', v)} autoComplete="off" helpText="Solo necesario si usas impresoras de red o WiFi para despachar comandas o tickets extra." />
            <FormLayout.Group>
              <TextField label="Puerto Cajón de Dinero" placeholder="Ej: COM1 o USB" value={config.cashDrawerPort || ''} onChange={(v) => updateField('cashDrawerPort', v)} autoComplete="off" helpText="Envía el pulso de apertura." />
              <TextField label="Puerto Báscula Serial" placeholder="Ej: COM2" value={config.scalePort || ''} onChange={(v) => updateField('scalePort', v)} autoComplete="off" helpText="Para lecturas directas en checkout." />
            </FormLayout.Group>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );

  const renderLoyaltyConfig = () => (
    <BlockStack gap="500">
      <Layout.AnnotatedSection title="Motor de Recompensas" description="Habilita un monedero electrónico para retener a tus clientes con beneficios en cada compra del abarrote.">
        <Card>
          <BlockStack gap="400">
            <Checkbox label="Habilitar sistema CashBack (Puntos en Cartera)" helpText="Permite que los usuarios registrados acumulen un porcentaje de su compra para volver a gastarlo luego." checked={config.loyaltyEnabled} onChange={(v) => updateField('loyaltyEnabled', v)} />

            {config.loyaltyEnabled && (
              <Box paddingBlockStart="300">
                <FormLayout>
                  <FormLayout.Group>
                    <TextField label="Pesos a Puntos" type="number" prefix="Cada $" suffix=" = 1 Pto." value={String(config.pointsPerPeso || 100)} onChange={(v) => updateField('pointsPerPeso', Number(v) || 100)} autoComplete="off" helpText="¿Cuánto debe gastar el cliente en pesos para generar 1 punto?" />
                    <TextField label="Valor del Punto" type="number" prefix="1 Pto. = $" value={String(config.pointsValue || 1)} onChange={(v) => updateField('pointsValue', Number(v) || 1)} autoComplete="off" helpText="¿A cuántos pesos de descuento equivale 1 punto cuando lo canjea?" />
                  </FormLayout.Group>
                  <Banner tone="info">
                    <p>
                      <strong>Configuración actual:</strong> Por cada ${config.pointsPerPeso} gastados, el cliente gana 1 punto. A su vez, 1 punto equivale a ${config.pointsValue} de descuento en el futuro.
                    </p>
                  </Banner>
                </FormLayout>
              </Box>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );

  const renderInventoryConfig = () => (
    <BlockStack gap="500">
      <Layout.AnnotatedSection title="Parámetros de sensibilidad" description="Decide qué tan restrictivo será el sistema para avisarte sobre la escasez o la caducidad de tus productos.">
        <Card>
          <FormLayout>
            <FormLayout.Group>
              <TextField label="Umbral crítico de stock bajo (%)" type="number" value={config.lowStockThreshold} onChange={(v) => updateField('lowStockThreshold', v)} autoComplete="off" suffix="%" helpText="Si un producto requiere mínimo 10, y el umbral es 25%, la alerta roja salta al tener ≤2 unidades." />
              <TextField label="Margen de vencimiento preventivo (días)" type="number" value={config.expirationWarningDays} onChange={(v) => updateField('expirationWarningDays', v)} autoComplete="off" suffix="días" helpText="Con cuánta anticipación deseas que el producto aparezca en la lista de revisión." />
            </FormLayout.Group>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );

  const renderNotificationsConfig = () => (
    <BlockStack gap="500">
      <Layout.AnnotatedSection title="Integración con Telegram Push" description="Recibe eventos críticos (como un stock agotado o el resumen del cierre de caja diario) directamente como un mensaje en tu celular personal o al de tus supervisores.">
        <Card>
          <BlockStack gap="400">
            <Checkbox label="Activar motor de notificaciones externas" helpText="Permite que el sistema envíe llamadas a la API de canales externos." checked={config.enableNotifications} onChange={(v) => updateField('enableNotifications', v)} />

            {config.enableNotifications && (
              <Box paddingBlockStart="300">
                <FormLayout>
                  <TextField label="Telegram Bot Token" value={config.telegramToken || ''} onChange={(v) => updateField('telegramToken', v)} autoComplete="off" type="password" placeholder="123456789:AAHK_..." helpText="Se obtiene creando un bot corporativo usando @BotFather." />
                  <TextField label="Identificador de Chat (Chat ID)" value={config.telegramChatId || ''} onChange={(v) => updateField('telegramChatId', v)} autoComplete="off" placeholder="Ej: -100123456789" helpText="El chat grupal o individual de los gerentes." />
                  <Divider />
                  <InlineStack gap="300" blockAlign="center">
                    <Button onClick={handleTGTest} loading={tgTesting} icon={ChatIcon}>Disparar evento de prueba</Button>
                  </InlineStack>
                  {tgTestResult && (
                    <Banner tone={tgTestResult.success ? 'success' : 'critical'}>
                      <p>{tgTestResult.message}</p>
                    </Banner>
                  )}
                </FormLayout>
              </Box>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );

  const renderPaymentsConfig = () => (
    <BlockStack gap="500">
      <Layout.AnnotatedSection title="Mercado Pago Smart POS" description="Reemplaza los pagos no integrados conectando directamente tu lector físico. Esto elimina errores de cobro y agiliza las filas.">
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="center">
              <img src="https://http2.mlstatic.com/frontend-assets/ui-navigation/5.23.0/mercadopago/logo__small@2x.png" alt="Mercado Pago" width="30" />
              <Checkbox label="Procesar transacciones con tarjeta vía Point" checked={mpConfig.enabled} onChange={(v) => setMpConfig(prev => ({ ...prev, enabled: v }))} />
            </InlineStack>

            {mpConfig.enabled && (
              <Box paddingBlockStart="300">
                <FormLayout>
                  <TextField label="Access Token del Negocio" value={mpConfig.accessToken} onChange={(v) => setMpConfig(prev => ({ ...prev, accessToken: v }))} autoComplete="off" type="password" placeholder="APP_USR-..." helpText="Token secreto de Producción. No lo compartas con el personal." />
                  <TextField label="Public Key (Checkout & QR)" value={mpConfig.publicKey || ''} onChange={(v) => setMpConfig(prev => ({ ...prev, publicKey: v }))} autoComplete="off" placeholder="APP_USR-..." helpText="Llave Pública para renderizar Tarjetas e invocar Checkouts web." />
                  <TextField label="Device ID (Hardware)" value={mpConfig.deviceId} onChange={(v) => setMpConfig(prev => ({ ...prev, deviceId: v }))} autoComplete="off" placeholder="Ej: PAX_A910__..." helpText="ID interno del lector físico. Usa el botón de descubrir para detectarlo automáticamente en tu misma red WiFi." />

                  <Divider />
                  <InlineStack gap="300" blockAlign="center">
                    <Button onClick={handleMPTest} loading={mpTesting}>Descubrir Terminales</Button>
                    <Button variant="primary" onClick={handleMPSave}>Sincronizar Integración MP</Button>
                  </InlineStack>

                  {mpSaved && (
                    <Banner tone="success" onDismiss={() => setMpSaved(false)}>
                      <p>Hardware sincronizado. Los cobros ahora se dispararán al dispositivo configurado.</p>
                    </Banner>
                  )}

                  {mpTestResult && (
                    <Banner tone={mpTestResult.success ? 'success' : 'critical'}>
                      <p>{mpTestResult.message}</p>
                    </Banner>
                  )}

                  {mpDevices.length > 0 && (
                    <Box paddingBlockStart="200">
                      <BlockStack gap="300">
                        <Text as="h3" variant="headingSm">Dispositivos en línea detectados:</Text>
                        <Card>
                          <BlockStack gap="200">
                            {mpDevices.map((d) => (
                              <InlineStack key={d.id} gap="400" blockAlign="center" align="space-between">
                                <InlineStack gap="300" blockAlign="center">
                                  <Badge tone={d.id === mpConfig.deviceId ? 'success' : 'info'}>
                                    {d.id === mpConfig.deviceId ? 'Enlazada' : 'Detectada'}
                                  </Badge>
                                  <Text as="p" variant="bodyMd" fontWeight="medium">{d.id}</Text>
                                </InlineStack>
                                {d.id !== mpConfig.deviceId && (
                                  <Button size="slim" onClick={() => setMpConfig(prev => ({ ...prev, deviceId: d.id }))}>
                                    Enlazar esta terminal
                                  </Button>
                                )}
                              </InlineStack>
                            ))}
                          </BlockStack>
                        </Card>
                      </BlockStack>
                    </Box>
                  )}
                </FormLayout>
              </Box>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );

  // ================= MAIN RENDER ================= //

  const getActiveView = () => {
    switch (selectedCategory) {
      case 'general': return renderGeneralConfig();
      case 'fiscal': return renderFiscalConfig();
      case 'pos': return renderPosConfig();
      case 'hardware': return renderHardwareConfig();
      case 'loyalty': return renderLoyaltyConfig();
      case 'inventory': return renderInventoryConfig();
      case 'notifications': return renderNotificationsConfig();
      case 'payments': return renderPaymentsConfig();
      default: return null;
    }
  };

  const activeCategory = SETTINGS_CATEGORIES.find(c => c.id === selectedCategory);

  if (selectedCategory !== null) {
    return (
      <BlockStack gap="400">
        {saved && (
          <Banner tone="success" title="Cambios guardados" onDismiss={() => setSaved(false)}>
            <p>Tu configuración se ha actualizado correctamente en todos los módulos del sistema.</p>
          </Banner>
        )}
        <Page
          backAction={{ content: 'Configuración', onAction: () => setSelectedCategory(null) }}
          title={activeCategory?.title || 'Configuración'}
          subtitle={activeCategory?.description}
          primaryAction={isDirty ? {
            content: 'Guardar cambios',
            onAction: handleSave,
            loading: saving,
          } : undefined}
          secondaryActions={isDirty ? [{
            content: 'Descartar',
            onAction: () => setConfig(storeConfig),
            destructive: true,
          }] : []}
        >
          <Box paddingBlockEnd="1200">
            {getActiveView()}
          </Box>
        </Page>
      </BlockStack>
    );
  }

  return (
    <Page
      title={(
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon source={SettingsFilledIcon} tone="base" />
          <span>Configuración</span>
        </div>
      ) as any}
      subtitle="Administra las políticas operativas, la identidad fiscal y la infraestructura de tu negocio."
    >
      {saved && (
        <Box paddingBlockEnd="400">
          <Banner tone="success" title="Cambios guardados" onDismiss={() => setSaved(false)}>
            <p>Tu configuración se ha actualizado correctamente.</p>
          </Banner>
        </Box>
      )}

      <Layout>
        <Layout.Section>
          <Grid>
            {SETTINGS_CATEGORIES.map((cat) => (
              <Grid.Cell key={cat.id} columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
                <Box
                  background="bg-surface"
                  borderWidth="025"
                  borderColor="border"
                  borderRadius="300"
                  padding="500"
                  shadow="100"
                  minHeight="160px"
                >
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="start">
                      <Box
                        background="bg-fill-secondary"
                        borderRadius="200"
                        padding="200"
                      >
                        <Icon source={cat.icon} tone="base" />
                      </Box>
                      <Button
                        variant="plain"
                        onClick={() => setSelectedCategory(cat.id)}
                      >
                        Abrir
                      </Button>
                    </InlineStack>
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingSm" fontWeight="semibold">
                        {cat.title}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {cat.description}
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </Box>
              </Grid.Cell>
            ))}
          </Grid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

