'use client';

import { useState, useCallback, useEffect } from 'react';
import { useForm, useField, notEmpty } from '@shopify/react-form';
import {
  Modal,
  FormLayout,
  TextField,
  Checkbox,
  BlockStack,
  InlineStack,
  Text,
  Box,
  DropZone,
  Thumbnail,
  Popover,
  DatePicker,
  Icon,
  Badge,
  Button,
} from '@shopify/polaris';
import { CalendarIcon } from '@shopify/polaris-icons';
import { FormSelect } from '@/components/ui/FormSelect';
import { uploadFile, getProductImagePath } from '@/lib/storage';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { CameraScanner } from '@/components/scanner/CameraScanner';
import { useAIDescription } from '@/hooks/useAIDescription';
import { parseError } from '@/lib/errors';

interface RegisterProductModalProps {
  open: boolean;
  onClose: () => void;
}

// Hardcoded default units
const unitOptions = [
  { label: 'Pieza', value: 'pieza' },
  { label: 'Kilo (kg)', value: 'kilo' },
  { label: 'Gramo (g)', value: 'gramo' },
  { label: 'Litro (L)', value: 'litro' },
  { label: 'Paquete', value: 'paquete' },
  { label: 'Caja', value: 'caja' },
  { label: 'Bulto', value: 'bulto' },
];

export function RegisterProductModal({ open, onClose }: RegisterProductModalProps) {
  const registerProduct = useDashboardStore((s) => s.registerProduct);
  const categories = useDashboardStore((s) => s.categories);
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const { showSuccess, showError } = useToast();
  const { aiEnabled, generating, generateDescription } = useAIDescription();
  const [aiDescription, setAiDescription] = useState('');

  const categoryOptions = [
    { label: 'Seleccionar categoría...', value: '' },
    ...categories.map((c) => ({ label: c.name, value: c.id })),
  ];
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [{ month, year }, setDate] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });

  const {
    fields,
    submit,
    submitting,
    dirty: _dirty,
    reset,
    makeClean: _makeClean,
  } = useForm({
    fields: {
      name: useField({
        value: '',
        validates: [notEmpty('El nombre es obligatorio')],
      }),
      sku: useField({
        value: '',
        validates: [notEmpty('El SKU es obligatorio')],
      }),
      barcode: useField({
        value: '',
        validates: [notEmpty('El código de barras es obligatorio')],
      }),
      category: useField({
        value: '',
        validates: [notEmpty('Selecciona una categoría')],
      }),
      unitPrice: useField({
        value: '',
        validates: [
          notEmpty('Ingresa un precio de venta'),
          (val) => (parseFloat(val) <= 0 ? 'Debe ser mayor a 0' : undefined),
        ],
      }),
      costPrice: useField({
        value: '',
        validates: [
          notEmpty('Ingresa un precio de costo'),
          (val) => (parseFloat(val) <= 0 ? 'Debe ser mayor a 0' : undefined),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (val, allValues: any) => {
            const cost = parseFloat(val);
            const price = parseFloat(allValues?.unitPrice ?? '');
            // Only validate cost < price when both fields have actual values
            if (!isNaN(cost) && !isNaN(price) && price > 0 && cost >= price) {
              return 'El costo debe ser menor al precio de venta';
            }
          },
        ],
      }),
      unit: useField('pieza'),
      unitMultiple: useField('1'),
      currentStock: useField({
        value: '',
        validates: [notEmpty('Ingresa el stock'), (val) => (parseInt(val) < 0 ? 'No puede ser negativo' : undefined)],
      }),
      minStock: useField({
        value: '',
        validates: [
          notEmpty('Ingresa el stock mínimo'),
          (val) => (parseInt(val) < 0 ? 'No puede ser negativo' : undefined),
        ],
      }),
      isPerishable: useField(false),
      expirationDate: useField({
        value: '',
        validates: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (val, allValues: any) => {
            if (allValues?.isPerishable && !val) return 'Fecha obligatoria para perecederos';
          },
        ],
      }),
    },
    onSubmit: async (form) => {
      try {
        let imageUrl = undefined;
        if (file) {
          // eslint-disable-next-line react-hooks/purity -- Date.now() used as fallback ID in event handler
          const path = getProductImagePath(form.sku || Date.now().toString(), file.name);
          imageUrl = await uploadFile(file, path);
        }

        await registerProduct({
          name: form.name.trim(),
          sku: form.sku.trim(),
          barcode: form.barcode.trim(),
          description: aiDescription.trim() || null,
          category: form.category,
          costPrice: parseFloat(form.costPrice),
          unitPrice: parseFloat(form.unitPrice),
          unit: form.unit,
          unitMultiple: parseInt(form.unitMultiple, 10) || 1,
          currentStock: parseInt(form.currentStock),
          minStock: parseInt(form.minStock),
          expirationDate: form.isPerishable ? form.expirationDate : null,
          isPerishable: form.isPerishable,
          imageUrl,
        });

        showSuccess('Producto registrado correctamente');
        onClose();
        reset();
        setFile(null);
        setAiDescription('');
      } catch (err: unknown) {
        const parsed = parseError(err);
        showError(parsed);
        return { status: 'fail', errors: [{ message: parsed.description }] };
      }
      return { status: 'success' };
    },
  });

  const [file, setFile] = useState<File | null>(null);

  const handleDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => setFile(acceptedFiles[0]),
    [],
  );

  // Auto-calculate suggested price when cost changes
  useEffect(() => {
    const cost = parseFloat(fields.costPrice.value);
    if (!isNaN(cost) && cost > 0 && !fields.unitPrice.dirty) {
      const defaultMargin = parseFloat(storeConfig.defaultMargin || '30');
      const calculatedPrice = cost + cost * (defaultMargin / 100);
      fields.unitPrice.onChange(calculatedPrice.toFixed(2));
    }
  }, [fields.costPrice.value, storeConfig.defaultMargin, fields.unitPrice]);

  const margin =
    parseFloat(fields.unitPrice.value) > 0 && parseFloat(fields.costPrice.value) > 0
      ? (
          ((parseFloat(fields.unitPrice.value) - parseFloat(fields.costPrice.value)) /
            parseFloat(fields.costPrice.value)) *
          100
        ).toFixed(1)
      : null;

  const handleClose = useCallback(() => {
    reset();
    setFile(null);
    onClose();
  }, [reset, onClose]);

  const fileUploadMarkup = !file && <DropZone.FileUpload actionHint="Archivos permitidos: .jpg, .png, .gif" />;
  const uploadedFileMarkup = file && (
    <InlineStack gap="300" blockAlign="center">
      <Thumbnail size="small" alt={file.name} source={window.URL.createObjectURL(file)} />
      <div>
        {file.name}{' '}
        <Text variant="bodySm" as="span" tone="subdued">
          {file.size} bytes
        </Text>
      </div>
    </InlineStack>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Registrar Nuevo Producto"
      primaryAction={{
        content: 'Registrar producto',
        onAction: submit,
        loading: submitting,
      }}
      secondaryActions={[{ content: 'Cancelar', onAction: handleClose, disabled: submitting }]}
    >
      {/* ── Imagen ── */}
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm" fontWeight="semibold">
            Imagen
          </Text>
          <DropZone
            onDrop={handleDropZoneDrop}
            variableHeight
            label="Foto del producto"
            labelHidden
            accept="image/*"
            type="image"
            disabled={submitting}
          >
            {uploadedFileMarkup}
            {fileUploadMarkup}
          </DropZone>
        </BlockStack>
      </Modal.Section>

      {/* ── Identificación ── */}
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm" fontWeight="semibold">
            Identificación
          </Text>
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="Nombre del producto"
                autoComplete="off"
                placeholder="Ej: Leche Lala 1L"
                {...fields.name}
              />
              <TextField
                label="SKU"
                autoComplete="off"
                placeholder="Ej: LAC-001"
                helpText="Código interno único"
                {...fields.sku}
              />
            </FormLayout.Group>
            <TextField
              label="Código de barras"
              autoComplete="off"
              placeholder="Escanea o escribe el código de barras"
              {...fields.barcode}
            />
            <CameraScanner
              onScan={(code) => {
                fields.barcode.onChange(code);
                fields.barcode.setError(undefined);
              }}
              buttonLabel="Escanear código con cámara"
              compact
            />
            <FormSelect label="Categoría" options={categoryOptions} {...fields.category} />
            {aiEnabled && (
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="bodySm" fontWeight="semibold">
                    Descripción del producto
                  </Text>
                  <Button
                    size="slim"
                    onClick={async () => {
                      const desc = await generateDescription({
                        name: fields.name.value,
                        category: fields.category.value,
                        unitPrice: parseFloat(fields.unitPrice.value) || undefined,
                        unit: fields.unit.value,
                      });
                      if (desc) {
                        setAiDescription(desc);
                        showSuccess('Descripción generada');
                      }
                    }}
                    loading={generating}
                    disabled={!fields.name.value.trim()}
                  >
                    Generar con IA
                  </Button>
                </InlineStack>
                <TextField
                  label="Descripción"
                  labelHidden
                  value={aiDescription}
                  onChange={setAiDescription}
                  multiline={3}
                  autoComplete="off"
                  placeholder="Haz clic en 'Generar con IA' para crear una descripción automática"
                  helpText={generating ? 'Generando descripción...' : ''}
                />
              </BlockStack>
            )}
          </FormLayout>
        </BlockStack>
      </Modal.Section>

      {/* ── Precios ── */}
      <Modal.Section>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingSm" fontWeight="semibold">
              Precios y unidad
            </Text>
            {margin && (
              <Badge tone={parseFloat(margin) >= 20 ? 'success' : parseFloat(margin) >= 10 ? 'attention' : 'critical'}>
                {`${margin}% margen`}
              </Badge>
            )}
          </InlineStack>
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="Precio de costo"
                type="number"
                autoComplete="off"
                prefix="$"
                placeholder="0.00"
                helpText="Cuánto te cuesta"
                {...fields.costPrice}
              />
              <TextField
                label="Precio al público"
                type="number"
                autoComplete="off"
                prefix="$"
                placeholder="0.00"
                helpText="Precio de venta"
                {...fields.unitPrice}
              />
            </FormLayout.Group>
            <FormLayout.Group>
              <FormSelect label="Se vende por" options={unitOptions} {...fields.unit} />
              <TextField
                label="Cantidad por venta"
                type="number"
                autoComplete="off"
                min={1}
                helpText={`${fields.unitMultiple.value || 1} unidad(es) por transacción`}
                {...fields.unitMultiple}
              />
            </FormLayout.Group>
          </FormLayout>
        </BlockStack>
      </Modal.Section>

      {/* ── Inventario ── */}
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm" fontWeight="semibold">
            Inventario
          </Text>
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="Stock actual"
                type="number"
                autoComplete="off"
                placeholder="0"
                helpText="Cantidad actual en tienda"
                {...fields.currentStock}
              />
              <TextField
                label="Stock mínimo"
                type="number"
                autoComplete="off"
                placeholder="0"
                helpText="Alerta cuando baje de este nivel"
                {...fields.minStock}
              />
            </FormLayout.Group>
            <Checkbox
              label="Producto perecedero"
              checked={fields.isPerishable.value}
              onChange={fields.isPerishable.onChange}
              helpText="Activa para productos con fecha de vencimiento"
            />
            {fields.isPerishable.value && (
              <Popover
                active={isDatePickerOpen}
                activator={
                  <TextField
                    label="Fecha de vencimiento"
                    value={fields.expirationDate.value}
                    placeholder="Selecciona una fecha"
                    autoComplete="off"
                    suffix={<Icon source={CalendarIcon} tone="subdued" />}
                    onFocus={() => setIsDatePickerOpen(true)}
                    error={fields.expirationDate.error}
                  />
                }
                onClose={() => setIsDatePickerOpen(false)}
              >
                <Box padding="400">
                  <DatePicker
                    month={month}
                    year={year}
                    onChange={(range) => {
                      const date = range.start;
                      const formattedDate = date.toISOString().split('T')[0];
                      fields.expirationDate.onChange(formattedDate);
                      setIsDatePickerOpen(false);
                    }}
                    onMonthChange={(m, y) => setDate({ month: m, year: y })}
                    selected={fields.expirationDate.value ? new Date(fields.expirationDate.value) : new Date()}
                  />
                </Box>
              </Popover>
            )}
          </FormLayout>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
