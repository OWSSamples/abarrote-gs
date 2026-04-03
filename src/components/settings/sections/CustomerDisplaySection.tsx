'use client';

import { useCallback, useState } from 'react';
import {
  Card,
  FormLayout,
  TextField,
  BlockStack,
  Layout,
  Banner,
  Button,
  InlineStack,
  Text,
  Box,
  Badge,
  Divider,
  DropZone,
  Thumbnail,
  Spinner,
} from '@shopify/polaris';
import { ImageIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { uploadFile } from '@/lib/storage';
import type { SettingsSectionProps } from './types';

export function CustomerDisplaySection({ config, updateField }: SettingsSectionProps) {
  const saveStoreConfig = useDashboardStore((s) => s.saveStoreConfig);
  const storeEnabled = useDashboardStore((s) => s.storeConfig.customerDisplayEnabled);
  const [toggling, setToggling] = useState(false);
  const [promoUploading, setPromoUploading] = useState(false);
  const [promoUploadError, setPromoUploadError] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  const displayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/display`
    : '/display';

  // Toggle persists directly to DB + Zustand store (bypasses form)
  const handleToggle = useCallback(async () => {
    setToggling(true);
    try {
      const next = !storeEnabled;
      await saveStoreConfig({ customerDisplayEnabled: next });
      // Also sync the form field so the UI below reacts immediately
      updateField('customerDisplayEnabled', next);
    } finally {
      setToggling(false);
    }
  }, [storeEnabled, saveStoreConfig, updateField]);

  const handleOpenDisplay = useCallback(() => {
    window.open(
      '/display',
      'customer_display',
      'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no',
    );
  }, []);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2500);
    } catch {
      // silent
    }
  }, [displayUrl]);

  const handlePromoImageDrop = useCallback(
    async (_accepted: File[], rejected: File[]) => {
      if (rejected.length > 0) {
        setPromoUploadError('Solo se aceptan imágenes (JPG, PNG, WebP) de máximo 5 MB.');
        return;
      }
    },
    [],
  );

  const handlePromoImageAccepted = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setPromoUploading(true);
      setPromoUploadError(null);
      try {
        const path = `display/promo-${Date.now()}.${file.name.split('.').pop()}`;
        const url = await uploadFile(file, path);
        updateField('customerDisplayPromoImage', url);
      } catch {
        setPromoUploadError('No se pudo subir la imagen. Intenta de nuevo.');
      } finally {
        setPromoUploading(false);
      }
    },
    [updateField],
  );

  const handleRemovePromoImage = useCallback(() => {
    updateField('customerDisplayPromoImage', '');
  }, [updateField]);

  const isEnabled = storeEnabled;

  return (
    <BlockStack gap="500">
      {/* ── Toggle (auto-save, no save bar) ── */}
      <Layout.AnnotatedSection
        title="Pantalla del cliente"
        description="Muestra a tus clientes los productos que están comprando en tiempo real desde un segundo monitor o tablet."
      >
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text variant="headingSm" as="h3">
                  Pantalla del cliente
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Habilita la pantalla secundaria que muestra la compra actual al cliente.
                </Text>
              </BlockStack>
              <Button
                role="switch"
                ariaChecked={isEnabled}
                onClick={handleToggle}
                variant={isEnabled ? 'primary' : undefined}
                tone={isEnabled ? 'success' : undefined}
                size="slim"
                loading={toggling}
                accessibilityLabel={isEnabled ? 'Desactivar pantalla' : 'Activar pantalla'}
              >
                {isEnabled ? 'Activada' : 'Desactivada'}
              </Button>
            </InlineStack>

            {isEnabled && (
              <>
                <Divider />
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Abre la pantalla en un segundo monitor, tablet o navegador.
                    Se sincroniza automáticamente con la caja.
                  </Text>
                  <InlineStack gap="200">
                    <Button size="slim" variant="primary" onClick={handleOpenDisplay}>
                      Abrir pantalla
                    </Button>
                    <Button size="slim" onClick={handleCopyUrl}>
                      {urlCopied ? '✓ Copiada' : 'Copiar URL'}
                    </Button>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {displayUrl}
                  </Text>
                </BlockStack>
              </>
            )}
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>

      {/* ── Content (only when enabled, triggers save bar via updateField) ── */}
      {isEnabled && (
        <>
          <Layout.AnnotatedSection
            title="Mensajes personalizados"
            description="Textos que verá el cliente en la pantalla de bienvenida y al finalizar su compra."
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
                  placeholder="Ej: 2x1 en refrescos · 10% en lácteos"
                  helpText="Se muestra en la pantalla de espera. Ideal para ofertas del día."
                  maxLength={200}
                  showCharacterCount
                  multiline={2}
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Imagen promocional"
            description="Sube una imagen que se mostrará en la pantalla de espera. Ideal para banners de ofertas o promociones."
          >
            <Card>
              <BlockStack gap="400">
                {promoUploadError && (
                  <Banner tone="critical" onDismiss={() => setPromoUploadError(null)}>
                    <p>{promoUploadError}</p>
                  </Banner>
                )}

                {config.customerDisplayPromoImage ? (
                  <BlockStack gap="300">
                    <Box borderRadius="200" overflow="hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={config.customerDisplayPromoImage}
                        alt="Imagen promocional"
                        style={{
                          width: '100%',
                          maxHeight: 200,
                          objectFit: 'contain',
                          borderRadius: 8,
                          border: '1px solid var(--p-color-border)',
                        }}
                      />
                    </Box>
                    <InlineStack gap="200">
                      <Button size="slim" tone="critical" onClick={handleRemovePromoImage}>
                        Quitar imagen
                      </Button>
                    </InlineStack>
                  </BlockStack>
                ) : (
                  <DropZone
                    accept="image/*"
                    type="image"
                    allowMultiple={false}
                    onDrop={handlePromoImageDrop}
                    onDropAccepted={handlePromoImageAccepted}
                  >
                    {promoUploading ? (
                      <Box padding="800">
                        <InlineStack align="center" gap="200">
                          <Spinner size="small" />
                          <Text as="span" variant="bodySm" tone="subdued">Subiendo imagen…</Text>
                        </InlineStack>
                      </Box>
                    ) : (
                      <DropZone.FileUpload
                        actionTitle="Subir imagen promocional"
                        actionHint="JPG, PNG o WebP — máximo 5 MB"
                      />
                    )}
                  </DropZone>
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Instrucciones de uso"
            description="Cómo configurar la pantalla del cliente."
          >
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge>1</Badge>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Segundo monitor</Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Conecta un segundo monitor. Abre la pantalla del cliente y arrástrala
                    al segundo monitor. Ponla en pantalla completa con F11.
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge>2</Badge>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">Tablet / Celular</Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Abre la URL en el navegador de una tablet o celular conectado a la misma
                    red Wi-Fi. Colócala frente al cliente.
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
                    o cambias el método de pago. No requiere configuración adicional.
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
