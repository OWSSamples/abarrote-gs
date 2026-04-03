'use client';

import { useCallback } from 'react';
import {
  Card,
  FormLayout,
  TextField,
  BlockStack,
  Layout,
  Checkbox,
  Banner,
  Button,
  InlineStack,
  Text,
  Box,
  Badge,
  Divider,
} from '@shopify/polaris';
import type { SettingsSectionProps } from './types';

export function CustomerDisplaySection({ config, updateField }: SettingsSectionProps) {
  const displayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/display`
    : '/display';

  const handleOpenDisplay = useCallback(() => {
    window.open('/display', 'customer_display', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
  }, []);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
    } catch {
      // silent fallback
    }
  }, [displayUrl]);

  return (
    <BlockStack gap="500">
      <Layout.AnnotatedSection
        title="Pantalla del cliente"
        description="Muestra a tus clientes los productos que están comprando en tiempo real desde un segundo monitor o tablet."
      >
        <Card>
          <FormLayout>
            <Checkbox
              label="Activar pantalla del cliente"
              checked={config.customerDisplayEnabled}
              onChange={(v) => updateField('customerDisplayEnabled', v)}
              helpText="Habilita la pantalla secundaria que muestra la compra actual al cliente."
            />

            {config.customerDisplayEnabled && (
              <Banner tone="info">
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm">
                    Abre la pantalla del cliente en un segundo monitor, tablet o navegador.
                    Se sincroniza automáticamente con la caja en tiempo real.
                  </Text>
                  <InlineStack gap="200">
                    <Button size="slim" variant="primary" onClick={handleOpenDisplay}>
                      Abrir pantalla
                    </Button>
                    <Button size="slim" onClick={handleCopyUrl}>
                      Copiar URL
                    </Button>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    URL: {displayUrl}
                  </Text>
                </BlockStack>
              </Banner>
            )}
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      {config.customerDisplayEnabled && (
        <>
          <Layout.AnnotatedSection
            title="Mensajes personalizados"
            description="Define los textos que verá el cliente en la pantalla de bienvenida y al finalizar su compra."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="Mensaje de bienvenida"
                  value={config.customerDisplayWelcome}
                  onChange={(v) => updateField('customerDisplayWelcome', v)}
                  autoComplete="off"
                  placeholder="Ej: ¡Bienvenido! Gracias por visitarnos"
                  helpText="Se muestra cuando no hay venta activa. Si se deja vacío se usa el predeterminado."
                  maxLength={120}
                  showCharacterCount
                />

                <TextField
                  label="Mensaje de despedida"
                  value={config.customerDisplayFarewell}
                  onChange={(v) => updateField('customerDisplayFarewell', v)}
                  autoComplete="off"
                  placeholder="Ej: ¡Gracias por su compra! Vuelva pronto"
                  helpText="Se muestra al finalizar la venta junto con el total y folio."
                  maxLength={120}
                  showCharacterCount
                />

                <TextField
                  label="Texto promocional"
                  value={config.customerDisplayPromoText}
                  onChange={(v) => updateField('customerDisplayPromoText', v)}
                  autoComplete="off"
                  placeholder="Ej: 🎉 2x1 en refrescos · 10% en lácteos"
                  helpText="Se muestra en la pantalla de espera debajo de la hora. Ideal para ofertas del día."
                  maxLength={200}
                  showCharacterCount
                  multiline={2}
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Instrucciones de uso"
            description="Cómo configurar la pantalla del cliente en tu punto de venta."
          >
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge>1</Badge>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Segundo monitor</Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Conecta un segundo monitor a tu computadora. Abre la pantalla del cliente y
                    arrástrala al segundo monitor. Ponla en pantalla completa con F11.
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge>2</Badge>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Tablet / Celular</Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Abre la URL de la pantalla en el navegador de una tablet o celular conectado
                    a la misma red Wi-Fi. Colócala frente al cliente.
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge>3</Badge>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Sincronización</Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    La pantalla se actualiza automáticamente cada vez que escaneas un producto
                    o cambias el método de pago en la caja. No requiere configuración adicional.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>
        </>
      )}
    </BlockStack>
  );
}
