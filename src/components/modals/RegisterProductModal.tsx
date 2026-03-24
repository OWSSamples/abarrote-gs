'use client';

import { useState, useCallback, useEffect } from 'react';
import { useForm, useField, notEmpty } from '@shopify/react-form';
import {
  Modal,
  FormLayout,
  TextField,
  Checkbox,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Box,
  DropZone,
  Thumbnail,
  Divider,
} from '@shopify/polaris';
import { NoteIcon } from '@shopify/polaris-icons';
import { FormSelect } from '@/components/ui/FormSelect';
import { uploadFile, getProductImagePath } from '@/lib/storage';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { CameraScanner } from '@/components/scanner/CameraScanner';

interface RegisterProductModalProps {
  open: boolean;
  onClose: () => void;
}

const categoryOptions = [
  { label: 'Seleccionar categoría...', value: '' },
  { label: 'Lácteos', value: 'lacteos' },
  { label: 'Panadería', value: 'panaderia' },
  { label: 'Huevo', value: 'huevo' },
  { label: 'Botanas', value: 'botanas' },
  { label: 'Bebidas', value: 'bebidas' },
  { label: 'Limpieza', value: 'limpieza' },
  { label: 'Abarrotes', value: 'abarrotes' },
  { label: 'Frutas y Verduras', value: 'frutas_verduras' },
  { label: 'Carnes', value: 'carnes' },
  { label: 'Otros', value: 'otros' },
];

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
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const { showSuccess, showError } = useToast();

  const {
    fields,
    submit,
    submitting,
    dirty,
    reset,
    makeClean,
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
          (val, { unitPrice }) => {
            const cost = parseFloat(val);
            const price = parseFloat(unitPrice);
            if (!isNaN(cost) && !isNaN(price) && cost >= price) {
              return 'El costo debe ser menor al precio de venta';
            }
          },
        ],
      }),
      unit: useField('pieza'),
      unitMultiple: useField('1'),
      currentStock: useField({
        value: '',
        validates: [
          notEmpty('Ingresa el stock'),
          (val) => (parseInt(val) < 0 ? 'No puede ser negativo' : undefined),
        ],
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
          (val, { isPerishable }) => {
            if (isPerishable && !val) return 'Fecha obligatoria para perecederos';
          },
        ],
      }),
    },
    onSubmit: async (form) => {
      try {
        let imageUrl = undefined;
        if (file) {
          const path = getProductImagePath(form.sku || Date.now().toString(), file.name);
          imageUrl = await uploadFile(file, path);
        }

        await registerProduct({
          name: form.name.trim(),
          sku: form.sku.trim(),
          barcode: form.barcode.trim(),
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
      } catch (err: any) {
        showError(err.message || 'Error al registrar el producto');
        return { status: 'fail', errors: [{ message: err.message }] };
      }
      return { status: 'success' };
    },
  });

  const [file, setFile] = useState<File | null>(null);

  const handleDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) =>
      setFile(acceptedFiles[0]),
    [],
  );

  // Auto-calculate suggested price when cost changes
  useEffect(() => {
    const cost = parseFloat(fields.costPrice.value);
    if (!isNaN(cost) && cost > 0 && !fields.unitPrice.dirty) {
      const defaultMargin = parseFloat(storeConfig.defaultMargin || '30');
      const calculatedPrice = cost + (cost * (defaultMargin / 100));
      fields.unitPrice.onChange(calculatedPrice.toFixed(2));
    }
  }, [fields.costPrice.value, storeConfig.defaultMargin, fields.unitPrice]);

  const margin = parseFloat(fields.unitPrice.value) > 0 && parseFloat(fields.costPrice.value) > 0
    ? (((parseFloat(fields.unitPrice.value) - parseFloat(fields.costPrice.value)) / parseFloat(fields.costPrice.value)) * 100).toFixed(1)
    : null;

  const handleClose = useCallback(() => {
    reset();
    setFile(null);
    onClose();
  }, [reset, onClose]);

  const fileUploadMarkup = !file && <DropZone.FileUpload actionHint="Archivos permitidos: .jpg, .png, .gif" />;
  const uploadedFileMarkup = file && (
    <InlineStack gap="300" blockAlign="center">
      <Thumbnail
        size="small"
        alt={file.name}
        source={window.URL.createObjectURL(file)}
      />
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
      <Modal.Section>
        <BlockStack gap="400">
          <Text as="h3" variant="headingMd">Imagen del producto</Text>
          <Box padding="200" borderStyle="dashed" borderWidth="025" borderColor="border" borderRadius="200">
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
          </Box>

          <Divider />

          <Text as="h3" variant="headingMd">Información básica</Text>

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
                helpText="Código interno del producto"
                {...fields.sku}
              />
            </FormLayout.Group>

            <TextField
              label="Código de barras"
              autoComplete="off"
              placeholder="Escanea o escribe el código de barras"
              helpText="Escanea con el lector o escribe el código manualmente"
              {...fields.barcode}
            />

            <CameraScanner
              onScan={(code) => {
                fields.barcode.onChange(code);
                fields.barcode.setError(undefined);
              }}
              buttonLabel="Escanear codigo con camara"
              compact
            />

            <FormSelect
              label="Categoría"
              options={categoryOptions}
              {...fields.category}
            />

            <FormLayout.Group>
              <TextField
                label="Precio de costo (MXN)"
                type="number"
                autoComplete="off"
                prefix="$"
                placeholder="0.00"
                helpText="Cuánto te cuesta"
                {...fields.costPrice}
              />
              <TextField
                label="Precio al público (MXN)"
                type="number"
                autoComplete="off"
                prefix="$"
                placeholder="0.00"
                helpText={margin ? `Margen: ${margin}%` : 'Para venta'}
                {...fields.unitPrice}
              />
              <FormSelect
                label="Se vende por"
                options={unitOptions}
                {...fields.unit}
              />
              <TextField
                label="Cantidad por venta"
                type="number"
                autoComplete="off"
                min={1}
                helpText={`Ej: Se venden ${fields.unitMultiple.value || 1} pz por $${fields.unitPrice.value || '0.00'}`}
                {...fields.unitMultiple}
              />
            </FormLayout.Group>

            <FormLayout.Group>
              <TextField
                label="Stock actual"
                type="number"
                autoComplete="off"
                placeholder="0"
                helpText="Cantidad actual en inventario"
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
              label="¿Es producto perecedero?"
              checked={fields.isPerishable.value}
              onChange={fields.isPerishable.onChange}
              helpText="Marca si el producto tiene fecha de vencimiento"
            />

            {fields.isPerishable.value && (
              <TextField
                label="Fecha de vencimiento"
                type="date"
                autoComplete="off"
                {...fields.expirationDate}
              />
            )}
          </FormLayout>

          <Box paddingBlockStart="200">
            <InlineStack align="space-between">
              <Text as="span" variant="bodySm" tone="subdued">
                El producto aparecerá automáticamente en el inventario.
              </Text>
            </InlineStack>
          </Box>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
