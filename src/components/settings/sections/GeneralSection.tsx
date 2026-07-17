'use client';

import {
  Card,
  Text,
  TextField,
  FormLayout,
  BlockStack,
  InlineStack,
  Button,
  Checkbox,
  DropZone,
  Box,
  Spinner,
  Layout,
} from '@shopify/polaris';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import type { SettingsSectionProps } from './types';

interface GeneralSectionProps extends SettingsSectionProps {
  logoUploading: boolean;
  logoError: string | null;
  handleLogoDrop: (accepted: File[], rejected: File[]) => void;
  handleLogoDropAccepted: (files: File[]) => void;
  setLogoError: (error: string | null) => void;
}

export function GeneralSection({
  config,
  updateField,
  logoUploading,
  logoError,
  handleLogoDrop,
  handleLogoDropAccepted,
  setLogoError,
}: GeneralSectionProps) {
  return (
    <BlockStack gap="500">
      <Layout.AnnotatedSection
        title="Perfil de la tienda"
        description="Información básica pública que representa a tu negocio."
      >
        <Card>
          <FormLayout>
            <TextField
              label="Nombre comercial del sistema"
              value={config.storeName}
              onChange={(v) => updateField('storeName', v)}
              autoComplete="off"
              helpText="Nombre que verán tus empleados en el Dashboard."
            />
            <TextField
              label="Razón social (nombre legal)"
              value={config.legalName}
              onChange={(v) => updateField('legalName', v)}
              autoComplete="off"
              helpText="Nombre de tu negocio o persona física para los recibos."
            />
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" fontWeight="medium">
                Logotipo (Ticket y Pantalla)
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Imagen que aparecerá impresa en los tickets. Ideal en blanco y negro, máx. 5 MB.
              </Text>
              {config.logoUrl ? (
                <InlineStack gap="300" align="start" blockAlign="center">
                  <OptimizedImage source={config.logoUrl} alt="Logo de la tienda" size="large" />
                  <BlockStack gap="100">
                    <Button
                      size="slim"
                      tone="critical"
                      variant="plain"
                      onClick={() => {
                        updateField('logoUrl', undefined);
                        setLogoError(null);
                      }}
                    >
                      Quitar logo
                    </Button>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Arrastra una nueva imagen para reemplazar
                    </Text>
                  </BlockStack>
                </InlineStack>
              ) : null}
              <DropZone
                accept="image/*"
                type="image"
                allowMultiple={false}
                onDrop={handleLogoDrop}
                onDropAccepted={handleLogoDropAccepted}
                disabled={logoUploading}
              >
                {logoUploading ? (
                  <Box padding="400">
                    <InlineStack gap="300" align="center" blockAlign="center">
                      <Spinner size="small" />
                      <Text as="p" variant="bodySm">
                        Subiendo logo...
                      </Text>
                    </InlineStack>
                  </Box>
                ) : (
                  <DropZone.FileUpload actionTitle="Subir logo" actionHint="o arrastra aquí JPG, PNG, WebP, SVG" />
                )}
              </DropZone>
              {logoError && (
                <Text as="p" variant="bodySm" tone="critical">
                  {logoError}
                </Text>
              )}
            </BlockStack>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection
        title="Ubicación y Contacto"
        description="La dirección física donde operas y tus datos de atención al público."
      >
        <Card>
          <FormLayout>
            <TextField
              label="Dirección física"
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
                label="Teléfono principal"
                value={config.phone}
                onChange={(v) => updateField('phone', v)}
                autoComplete="tel"
              />
              <TextField
                label="Número identificador de sucursal"
                value={config.storeNumber}
                onChange={(v) => updateField('storeNumber', v)}
                autoComplete="off"
                helpText="Ej: 001, usado para multitiendas."
              />
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
            <TextField
              label="Capacidad de usuarios activos"
              type="number"
              value={String(config.estimatedUsers ?? 1)}
              onChange={(value) => {
                const parsed = Number.parseInt(value, 10);
                updateField('estimatedUsers', Number.isFinite(parsed) ? Math.min(500, Math.max(1, parsed)) : 1);
              }}
              min={1}
              max={500}
              autoComplete="off"
              helpText="Incluye al propietario. Si el valor es 1, no podrás agregar colaboradores activos."
            />
            <Checkbox
              label="Respaldos automatizados"
              helpText="Crea instantáneas de tu base de datos y ventas diariamente para tu tranquilidad."
              checked={config.autoBackup}
              onChange={(v) => updateField('autoBackup', v)}
            />
          </BlockStack>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );
}
