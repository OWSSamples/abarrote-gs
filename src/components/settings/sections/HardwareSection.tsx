'use client';

import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Divider,
  FormLayout,
  InlineStack,
  Layout,
  Text,
  TextField,
} from '@shopify/polaris';
import { ConnectIcon, ResetIcon } from '@shopify/polaris-icons';
import { useTicketPrinter } from '@/hooks/useTicketPrinter';
import type { SettingsSectionProps } from './types';
import { BrandLogo } from '@/components/ui/BrandLogo';

const STATUS_LABELS: Record<string, string> = {
  disconnected: 'Desconectada',
  connecting: 'Conectando…',
  ready: 'Lista',
  printing: 'Imprimiendo…',
  error: 'Error',
};

const STATUS_TONES: Record<string, 'success' | 'critical' | 'attention' | undefined> = {
  disconnected: undefined,
  connecting: 'attention',
  ready: 'success',
  printing: 'attention',
  error: 'critical',
};

export function HardwareSection({ config, updateField }: SettingsSectionProps) {
  const {
    connectPrinter,
    disconnectPrinter,
    openDrawer,
    isPrinterReady,
    printerStatus,
    printerInfo,
    isWebSerialSupported,
  } = useTicketPrinter();

  return (
    <BlockStack gap="500">
      {/* ── Thermal Printer — WebSerial ── */}
      <Layout.AnnotatedSection
        title="Impresora Térmica (USB)"
        description="Conecta tu impresora térmica por USB para impresión directa de tickets ESC/POS sin diálogos del navegador."
      >
        <Card>
          <BlockStack gap="400">
            {!isWebSerialSupported && (
              <Banner tone="warning" title="Navegador no compatible">
                <p>
                  WebSerial requiere <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong> en escritorio.
                  Safari, Firefox y navegadores móviles no son compatibles.
                </p>
              </Banner>
            )}

            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="050">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    Estado de conexión
                  </Text>
                  <Badge tone={STATUS_TONES[printerStatus]}>
                    {STATUS_LABELS[printerStatus] || printerStatus}
                  </Badge>
                </InlineStack>
                {printerInfo.portName && (
                  <Text as="span" variant="bodyXs" tone="subdued">
                    {printerInfo.portName}
                  </Text>
                )}
                {printerInfo.error && (
                  <Text as="span" variant="bodyXs" tone="critical">
                    {printerInfo.error}
                  </Text>
                )}
              </BlockStack>

              <InlineStack gap="200">
                {isPrinterReady ? (
                  <Button
                    onClick={disconnectPrinter}
                    icon={ResetIcon}
                    variant="secondary"
                    tone="critical"
                  >
                    Desconectar
                  </Button>
                ) : (
                  <Button
                    onClick={connectPrinter}
                    icon={ConnectIcon}
                    variant="primary"
                    disabled={!isWebSerialSupported || printerStatus === 'connecting'}
                    loading={printerStatus === 'connecting'}
                  >
                    Conectar impresora
                  </Button>
                )}
              </InlineStack>
            </InlineStack>

            {isPrinterReady && (
              <>
                <Divider />
                <InlineStack gap="200">
                  <Button variant="secondary" size="slim" onClick={openDrawer}>
                    Probar cajón de dinero
                  </Button>
                </InlineStack>
              </>
            )}

            <Banner tone="info">
              <p>
                Al hacer clic en &quot;Conectar impresora&quot;, el navegador mostrará un selector de puertos USB.
                Selecciona tu impresora térmica de la lista. La conexión se mantiene mientras la pestaña esté abierta.
              </p>
            </Banner>
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      {/* ── Network Printer (IP) ── */}
      <Layout.AnnotatedSection
        title="Impresora de Red (Avanzado)"
        description="Para impresoras conectadas por WiFi o Ethernet. Requiere que la impresora esté en la misma red."
      >
        <Card>
          <FormLayout>
            <TextField
              label="Dirección IP de la impresora"
              placeholder="Ej: 192.168.1.100"
              value={config.printerIp || ''}
              onChange={(v) => updateField('printerIp', v)}
              autoComplete="off"
              helpText="Consulta el manual de tu impresora para encontrar su IP. Generalmente se imprime un ticket de diagnóstico al encenderla."
            />
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      {/* ── Cash Drawer & Scale ── */}
      <Layout.AnnotatedSection
        title="Cajón de Dinero y Báscula"
        description="El cajón se abre automáticamente al imprimir si está conectado al puerto RJ-11 de la impresora térmica."
      >
        <Card>
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="Puerto del cajón de dinero"
                placeholder="Ej: COM1 o USB"
                value={config.cashDrawerPort || ''}
                onChange={(v) => updateField('cashDrawerPort', v)}
                autoComplete="off"
                helpText="Si tu cajón está conectado a la impresora por RJ-11, no necesitas configurar nada aquí — se abre con el comando de impresión."
              />
              <TextField
                label="Puerto de la báscula serial"
                placeholder="Ej: COM2"
                value={config.scalePort || ''}
                onChange={(v) => updateField('scalePort', v)}
                autoComplete="off"
                helpText="Para lectura automática de peso en productos a granel. Requiere Chrome/Edge."
              />
            </FormLayout.Group>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      {/* ── Compatibility Info ── */}
      <Layout.AnnotatedSection
        title="Compatibilidad"
        description="Información sobre los periféricos soportados."
      >
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <Badge tone="success">Funcional</Badge>
              <Text as="span" variant="bodySm">
                <strong>Escáner de código de barras</strong> — Cualquier escáner USB tipo &quot;keyboard wedge&quot;. También cámara del dispositivo.
              </Text>
            </InlineStack>
            <Divider />
            <InlineStack gap="200" blockAlign="center">
              <Badge tone={isPrinterReady ? 'success' : 'attention'}>
                {isPrinterReady ? 'Conectada' : 'Disponible'}
              </Badge>
              <Text as="span" variant="bodySm">
                <strong>Impresora térmica</strong> — USB vía WebSerial (Chrome/Edge). Epson, Star, Xprinter y compatibles ESC/POS.
              </Text>
            </InlineStack>
            <Divider />
            <InlineStack gap="200" blockAlign="center">
              <Badge tone={isPrinterReady ? 'success' : 'attention'}>
                {isPrinterReady ? 'Listo' : 'Requiere impresora'}
              </Badge>
              <Text as="span" variant="bodySm">
                <strong>Cajón de dinero</strong> — Se abre por pulso ESC/POS vía la impresora térmica (RJ-11).
              </Text>
            </InlineStack>
            <Divider />
            <InlineStack gap="200" blockAlign="center">
              <Badge>Próximamente</Badge>
              <Text as="span" variant="bodySm">
                <strong>Báscula serial</strong> — Lectura automática de peso para productos a granel.
              </Text>
            </InlineStack>
            <Divider />
            <InlineStack gap="200" blockAlign="center">
              <Badge tone="success">Funcional</Badge>
              <Text as="span" variant="bodySm">
                <strong>Terminal de pago</strong> — integrados por red:
              </Text>
              <InlineStack gap="150" blockAlign="center">
                <BrandLogo name="Mercado Pago" size={20} />
                <BrandLogo name="Clip" size={20} />
              </InlineStack>
            </InlineStack>
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );
}
