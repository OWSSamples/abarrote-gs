'use client';

import { useCallback, useState } from 'react';
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  DropZone,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
  Thumbnail,
} from '@shopify/polaris';
import { provisionAdditionalTenant } from '@/app/actions/register-tenant-actions';
import { useToast } from '@/components/notifications/ToastProvider';

type BusinessType = 'miscelania' | 'abarrotes' | 'ropa' | 'comida_rapida' | 'otro_retail';
type FieldName =
  | 'tenantName'
  | 'businessTypeOther'
  | 'phone'
  | 'contactEmail'
  | 'taxId'
  | 'taxRegime'
  | 'estimatedUsers'
  | 'logo';

type FieldErrors = Partial<Record<FieldName, string>>;

const COUNTRY_OPTIONS = [
  { value: 'MX', label: 'México' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CL', label: 'Chile' },
  { value: 'PE', label: 'Perú' },
  { value: 'AR', label: 'Argentina' },
  { value: 'ZZ', label: 'Otro país' },
];

const BUSINESS_TYPE_OPTIONS: Array<{ value: BusinessType; label: string }> = [
  { value: 'abarrotes', label: 'Abarrotes' },
  { value: 'miscelania', label: 'Miscelánea' },
  { value: 'ropa', label: 'Tienda de ropa' },
  { value: 'comida_rapida', label: 'Comida rápida / mostrador' },
  { value: 'otro_retail', label: 'Otro retail sin reservas' },
];

const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_LOGO_SIZE = 200 * 1024;

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase();
}

function normalizePhone(value: string): string {
  const compact = value.trim().replace(/\D/g, '');
  return compact ? `+${compact}` : '';
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No fue posible leer el logo.'));
    reader.readAsDataURL(file);
  });
}

interface CreateBusinessPageProps {
  accountEmail?: string | null;
}

export function CreateBusinessPage({ accountEmail }: CreateBusinessPageProps) {
  const toast = useToast();
  const [tenantName, setTenantName] = useState('');
  const [country, setCountry] = useState('MX');
  const [businessType, setBusinessType] = useState<BusinessType>('abarrotes');
  const [businessTypeOther, setBusinessTypeOther] = useState('');
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState(normalizeEmail(accountEmail));
  const [taxId, setTaxId] = useState('');
  const [taxRegime, setTaxRegime] = useState('');
  const [taxRegimeDescription, setTaxRegimeDescription] = useState('');
  const [estimatedUsers, setEstimatedUsers] = useState('1');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const clearError = useCallback((field: FieldName) => {
    setFormError('');
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const handleLogoDrop = useCallback(async (_files: File[], accepted: File[], rejected: File[]) => {
    setFormError('');
    if (rejected.length > 0 || !accepted[0]) {
      setFieldErrors((current) => ({ ...current, logo: 'Selecciona una imagen PNG, JPG o WebP.' }));
      return;
    }

    const file = accepted[0];
    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      setFieldErrors((current) => ({ ...current, logo: 'El formato del logo no está permitido.' }));
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setFieldErrors((current) => ({ ...current, logo: 'El logo debe pesar menos de 200 KB.' }));
      return;
    }

    try {
      const dataUrl = await readAsDataUrl(file);
      setLogoFile(file);
      setLogoDataUrl(dataUrl);
      clearError('logo');
    } catch {
      setFieldErrors((current) => ({ ...current, logo: 'No fue posible procesar el logo.' }));
    }
  }, [clearError]);

  const validate = useCallback((): {
    normalizedPhone: string;
    normalizedContactEmail: string;
    normalizedUsers: number;
  } | null => {
    const errors: FieldErrors = {};
    const normalizedPhone = normalizePhone(phone);
    const normalizedContactEmail = normalizeEmail(contactEmail);
    const normalizedUsers = Number.parseInt(estimatedUsers, 10);
    const normalizedTaxId = taxId.trim().toUpperCase();

    if (tenantName.trim().replace(/\s+/g, ' ').length < 2) {
      errors.tenantName = 'Captura un nombre de negocio válido.';
    }
    if (businessType === 'otro_retail' && businessTypeOther.trim().length < 3) {
      errors.businessTypeOther = 'Describe el giro del negocio.';
    }
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      errors.phone = 'Usa un teléfono con lada internacional, por ejemplo +525512345678.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContactEmail)) {
      errors.contactEmail = 'Ingresa un correo de contacto válido.';
    }
    if (!Number.isFinite(normalizedUsers) || normalizedUsers < 1 || normalizedUsers > 500) {
      errors.estimatedUsers = 'El número de usuarios debe estar entre 1 y 500.';
    }
    if (country === 'MX') {
      if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(normalizedTaxId)) {
        errors.taxId = 'Ingresa un RFC válido.';
      }
      if (!taxRegime.trim()) errors.taxRegime = 'Captura el régimen fiscal.';
    } else {
      if (!normalizedTaxId) errors.taxId = 'Captura el identificador fiscal.';
      if (!taxRegime.trim()) errors.taxRegime = 'Captura el régimen tributario.';
    }

    setFieldErrors(errors);
    setFormError('');
    if (Object.keys(errors).length > 0) return null;

    return { normalizedPhone, normalizedContactEmail, normalizedUsers };
  }, [businessType, businessTypeOther, contactEmail, country, estimatedUsers, phone, taxId, taxRegime, tenantName]);

  const handleCreate = useCallback(async () => {
    if (isLoading) return;
    const validated = validate();
    if (!validated) {
      toast.showError('Revisa los campos marcados antes de continuar.');
      return;
    }

    setIsLoading(true);
    try {
      await provisionAdditionalTenant({
        tenantName: tenantName.trim().replace(/\s+/g, ' '),
        country,
        businessType,
        businessTypeOther: businessTypeOther.trim(),
        contactEmail: validated.normalizedContactEmail,
        phone: validated.normalizedPhone,
        taxId: taxId.trim().toUpperCase(),
        taxRegime: taxRegime.trim(),
        taxRegimeDescription: taxRegimeDescription.trim(),
        estimatedUsers: validated.normalizedUsers,
        logoDataUrl,
      });
      toast.showSuccess('Negocio creado y seleccionado correctamente.');
      window.location.assign('/dashboard');
    } catch (error) {
      const candidate = error as { code?: string; message?: string };
      const safeMessage =
        candidate.code === 'VALIDATION_ERROR' || candidate.code === 'AUTH_ERROR'
          ? candidate.message || 'No fue posible crear el negocio.'
          : 'No fue posible crear el negocio en este momento.';
      const lowerMessage = safeMessage.toLowerCase();

      if (lowerMessage.includes('nombre') || lowerMessage.includes('tienda')) {
        setFieldErrors((current) => ({ ...current, tenantName: safeMessage }));
      } else {
        setFormError(safeMessage);
      }
      toast.showError(safeMessage);
    } finally {
      setIsLoading(false);
    }
  }, [businessType, businessTypeOther, country, isLoading, logoDataUrl, taxId, taxRegime, taxRegimeDescription, tenantName, toast, validate]);

  return (
    <Page
      fullWidth
      title="Crear otro negocio"
      subtitle="Configura un espacio independiente y adminístralo con tu misma cuenta."
      backAction={{ content: 'Volver al panel', url: '/dashboard' }}
      primaryAction={{ content: 'Crear negocio', onAction: handleCreate, loading: isLoading }}
      secondaryActions={[{ content: 'Cancelar', url: '/dashboard', disabled: isLoading }]}
    >
      <BlockStack gap="400">
        {formError ? (
          <Banner tone="critical" title="No se pudo crear el negocio">
            <p>{formError}</p>
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">Información del negocio</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Define cómo se identificará este negocio dentro de tu cuenta.
                  </Text>
                </BlockStack>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
                  <div className="xl:col-span-6">
                    <TextField
                      label="Nombre del negocio"
                      value={tenantName}
                      onChange={(value) => { setTenantName(value); clearError('tenantName'); }}
                      autoComplete="organization"
                      placeholder="Abarrotes La Esquina"
                      error={fieldErrors.tenantName}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="xl:col-span-3">
                    <Select
                      label="País"
                      options={COUNTRY_OPTIONS}
                      value={country}
                      onChange={setCountry}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="xl:col-span-3">
                    <Select
                      label="Tipo de negocio"
                      options={BUSINESS_TYPE_OPTIONS}
                      value={businessType}
                      onChange={(value) => setBusinessType(value as BusinessType)}
                      disabled={isLoading}
                    />
                  </div>
                  {businessType === 'otro_retail' ? (
                    <div className="md:col-span-2 xl:col-span-12">
                      <TextField
                        label="Describe el giro"
                        value={businessTypeOther}
                        onChange={(value) => { setBusinessTypeOther(value); clearError('businessTypeOther'); }}
                        autoComplete="off"
                        placeholder="Ej. papelería, ferretería o tienda de regalos"
                        error={fieldErrors.businessTypeOther}
                        disabled={isLoading}
                      />
                    </div>
                  ) : null}
                </div>

                <Divider />

                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">Contacto</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Información operativa para comunicaciones y documentos del negocio.
                  </Text>
                </BlockStack>

                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Teléfono de contacto"
                    value={phone}
                    onChange={(value) => { setPhone(value); clearError('phone'); }}
                    type="tel"
                    autoComplete="tel"
                    placeholder="+52 55 1234 5678"
                    error={fieldErrors.phone}
                    disabled={isLoading}
                  />
                  <TextField
                    label="Correo de contacto"
                    value={contactEmail}
                    onChange={(value) => { setContactEmail(value); clearError('contactEmail'); }}
                    type="email"
                    autoComplete="email"
                    placeholder="contacto@negocio.com"
                    error={fieldErrors.contactEmail}
                    disabled={isLoading}
                  />
                </div>

                <Divider />

                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">Información fiscal</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Captura los datos correspondientes al país seleccionado.
                  </Text>
                </BlockStack>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <TextField
                    label={country === 'MX' ? 'RFC' : 'Identificador fiscal'}
                    value={taxId}
                    onChange={(value) => { setTaxId(value.toUpperCase()); clearError('taxId'); }}
                    autoComplete="off"
                    placeholder={country === 'MX' ? 'XAXX010101000' : 'Tax ID'}
                    error={fieldErrors.taxId}
                    disabled={isLoading}
                  />
                  <TextField
                    label={country === 'MX' ? 'Régimen fiscal' : 'Régimen tributario'}
                    value={taxRegime}
                    onChange={(value) => { setTaxRegime(value); clearError('taxRegime'); }}
                    autoComplete="off"
                    placeholder={country === 'MX' ? '612' : 'General'}
                    error={fieldErrors.taxRegime}
                    disabled={isLoading}
                  />
                  <TextField
                    label="Descripción del régimen"
                    value={taxRegimeDescription}
                    onChange={setTaxRegimeDescription}
                    autoComplete="off"
                    placeholder="Personas físicas con actividades empresariales"
                    disabled={isLoading}
                  />
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">Capacidad y marca</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Define el tamaño inicial del equipo y la identidad visual.
                  </Text>
                </BlockStack>

                <TextField
                  label="Usuarios incluidos"
                  value={estimatedUsers}
                  onChange={(value) => { setEstimatedUsers(value); clearError('estimatedUsers'); }}
                  type="number"
                  min={1}
                  max={500}
                  autoComplete="off"
                  helpText="Incluye al propietario. Podrás ajustar esta capacidad después."
                  error={fieldErrors.estimatedUsers}
                  disabled={isLoading}
                />

                <Divider />

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">Logo del negocio</Text>
                  <DropZone
                    accept="image/png,image/jpeg,image/webp"
                    type="image"
                    allowMultiple={false}
                    variableHeight
                    onDrop={handleLogoDrop}
                    error={Boolean(fieldErrors.logo)}
                    disabled={isLoading}
                  >
                    {logoFile && logoDataUrl ? (
                      <Box padding="300">
                        <InlineStack gap="300" blockAlign="center" wrap={false}>
                          <Thumbnail source={logoDataUrl} alt="Vista previa del logo" size="small" />
                          <BlockStack gap="050">
                            <Text as="span" variant="bodySm" fontWeight="medium">
                              {logoFile.name}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {Math.ceil(logoFile.size / 1024)} KB
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Box>
                    ) : (
                      <DropZone.FileUpload
                        actionTitle="Seleccionar logo"
                        actionHint="PNG, JPG o WebP · máximo 200 KB"
                      />
                    )}
                  </DropZone>
                  {fieldErrors.logo ? (
                    <Text as="p" variant="bodySm" tone="critical">{fieldErrors.logo}</Text>
                  ) : null}
                  {logoFile ? (
                    <InlineStack align="end">
                      <Button
                        variant="plain"
                        onClick={() => { setLogoFile(null); setLogoDataUrl(undefined); clearError('logo'); }}
                        disabled={isLoading}
                      >
                        Quitar logo
                      </Button>
                    </InlineStack>
                  ) : null}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
