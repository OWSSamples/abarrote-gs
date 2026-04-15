'use client';

import { useState, useCallback, useEffect } from 'react';
import { useForm, useField, notEmpty } from '@shopify/react-form';
import {
  Modal,
  FormLayout,
  TextField,
  Checkbox,
  Badge,
  BlockStack,
  InlineStack,
  Text,
  DropZone,
  Thumbnail,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { uploadFile, getProductImagePath } from '@/lib/storage';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { CameraScanner } from '@/components/scanner/CameraScanner';
import { Product } from '@/types';

interface UpdateProductModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
}

const unitOptions = [
  { label: 'Pieza', value: 'pieza' },
  { label: 'Kilo (kg)', value: 'kilo' },
  { label: 'Gramo (g)', value: 'gramo' },
  { label: 'Litro (L)', value: 'litro' },
  { label: 'Paquete', value: 'paquete' },
  { label: 'Caja', value: 'caja' },
  { label: 'Bulto', value: 'bulto' },
];

export function UpdateProductModal({ open, onClose, product }: UpdateProductModalProps) {
  const updateProductStore = useDashboardStore((s) => s.updateProduct);
  const categories = useDashboardStore((s) => s.categories);
  const storeConfig = useDashboardStore((s) => s.storeConfig);

  const categoryOptions = [
    { label: 'Seleccionar categoría...', value: '' },
    ...categories.map((c) => ({ label: c.name, value: c.id })),
  ];
  const { showSuccess, showError } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const { fields, makeClean, reset } = useForm({
    fields: {
      name: useField({
        value: product?.name || '',
        validates: [notEmpty('El nombre es obligatorio')],
      }),
      sku: useField({
        value: product?.sku || '',
        validates: [notEmpty('El SKU es obligatorio')],
      }),
      barcode: useField(product?.barcode || ''),
      category: useField({
        value: product?.category || '',
        validates: [notEmpty('Selecciona una categoría')],
      }),
      unitPrice: useField({
        value: product?.unitPrice?.toString() || '',
        validates: [
          notEmpty('Ingresa un precio de venta'),
          (val: string) => (parseFloat(val) <= 0 ? 'Debe ser mayor a 0' : undefined),
        ],
      }),
      costPrice: useField({
        value: product?.costPrice?.toString() || '',
        validates: [
          notEmpty('Ingresa un precio de costo'),
          (val: string) => (parseFloat(val) <= 0 ? 'Debe ser mayor a 0' : undefined),
        ],
      }),
      unit: useField(product?.unit || 'pieza'),
      unitMultiple: useField(product?.unitMultiple?.toString() || '1'),
      currentStock: useField({
        value: product?.currentStock?.toString() || '0',
        validates: [(val: string) => (parseInt(val) < 0 ? 'No puede ser negativo' : undefined)],
      }),
      minStock: useField(product?.minStock?.toString() || '0'),
      isPerishable: useField(product?.isPerishable || false),
      expirationDate: useField(product?.expirationDate || ''),
    },
    onSubmit: async () => ({ status: 'success' }),
  });

  // Sync form when product changes
  useEffect(() => {
    if (product) {
      fields.name.onChange(product.name || '');
      fields.sku.onChange(product.sku || '');
      fields.barcode.onChange(product.barcode || '');
      fields.category.onChange(product.category || '');
      fields.unitPrice.onChange(product.unitPrice?.toString() || '');
      fields.costPrice.onChange(product.costPrice?.toString() || '');
      fields.unit.onChange(product.unit || 'pieza');
      fields.unitMultiple.onChange(product.unitMultiple?.toString() || '1');
      fields.currentStock.onChange(product.currentStock?.toString() || '0');
      fields.minStock.onChange(product.minStock?.toString() || '0');
      fields.isPerishable.onChange(product.isPerishable || false);
      fields.expirationDate.onChange(product.expirationDate || '');
      makeClean();
    }
  }, [product, makeClean]);

  const autoSave = useCallback(
    async (fieldKey: string, value: unknown) => {
      if (!product) return;
      const f = fields as Record<
        string,
        { dirty: boolean; runValidation: (v: unknown) => string | undefined; newDefaultValue: (v: unknown) => void }
      >;
      const field = f[fieldKey];
      if (!field || !field.dirty) return;

      const error = field.runValidation(value);
      if (error) {
        showError(`Error en ${fieldKey}: ${error}`);
        return;
      }

      try {
        await updateProductStore(product.id, { [fieldKey]: value });
        field.newDefaultValue(value);
      } catch (err) {
        console.error(`Error auto-saving ${fieldKey}:`, err);
      }
    },
    [product, fields, updateProductStore, showError],
  );

  const handleCostPriceChange = useCallback(
    (value: string) => {
      fields.costPrice.onChange(value);
      const cost = parseFloat(value);
      if (!isNaN(cost) && cost > 0 && !fields.unitPrice.dirty) {
        const defaultMargin = parseFloat(storeConfig.defaultMargin || '30');
        const calculatedPrice = cost + cost * (defaultMargin / 100);
        fields.unitPrice.onChange(calculatedPrice.toFixed(2));
      }
    },
    [storeConfig.defaultMargin, fields.costPrice, fields.unitPrice],
  );

  const handleImageUpload = useCallback(
    async (newFile: File) => {
      if (!product) return;
      setIsUploadingImage(true);
      try {
        const path = getProductImagePath(fields.sku.value || product.id, newFile.name);
        const imageUrl = await uploadFile(newFile, path);
        await updateProductStore(product.id, { imageUrl });
        showSuccess('Imagen actualizada');
      } catch (_err) {
        showError('Error al subir imagen');
      } finally {
        setIsUploadingImage(false);
      }
    },
    [product, fields.sku.value, updateProductStore, showSuccess, showError],
  );

  useEffect(() => {
    if (file) {
      handleImageUpload(file);
      setFile(null);
    }
  }, [file, handleImageUpload]);

  const handleDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => setFile(acceptedFiles[0]),
    [],
  );

  const margin =
    parseFloat(fields.unitPrice.value) > 0 && parseFloat(fields.costPrice.value) > 0
      ? (
          ((parseFloat(fields.unitPrice.value) - parseFloat(fields.costPrice.value)) /
            parseFloat(fields.costPrice.value)) *
          100
        ).toFixed(1)
      : null;

  const fileUploadMarkup = !file && !product?.imageUrl && (
    <DropZone.FileUpload actionHint="Archivos permitidos: .jpg, .png, .gif" />
  );
  const uploadedFileMarkup = (file || product?.imageUrl) && (
    <InlineStack gap="300" blockAlign="center">
      {file ? (
        <Thumbnail size="small" alt={file.name} source={window.URL.createObjectURL(file)} />
      ) : (
        <OptimizedImage source={product?.imageUrl} alt={product?.name || ''} size="small" />
      )}
      <div>
        {file ? file.name : 'Imagen actual'}{' '}
        <Text variant="bodySm" as="span" tone="subdued">
          {file ? `${file.size} bytes` : ''}
        </Text>
      </div>
    </InlineStack>
  );

  const handleClose = useCallback(() => {
    reset();
    setFile(null);
    onClose();
  }, [reset, onClose]);

  return (
    <Modal
      key={product?.id ?? 'new'}
      open={open}
      onClose={handleClose}
      title={product ? `${product.name}` : 'Editar Producto'}
      primaryAction={{
        content: 'Listo',
        onAction: onClose,
      }}
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
            disabled={isUploadingImage}
          >
            {uploadedFileMarkup}
            {fileUploadMarkup}
          </DropZone>
          <Text as="p" variant="bodySm" tone="subdued">
            Los cambios se guardan automáticamente al salir de cada campo.
          </Text>
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
                label="Nombre"
                autoComplete="off"
                value={fields.name.value}
                onChange={fields.name.onChange}
                error={fields.name.error}
                onBlur={() => autoSave('name', fields.name.value)}
              />
              <TextField
                label="SKU"
                autoComplete="off"
                value={fields.sku.value}
                onChange={fields.sku.onChange}
                error={fields.sku.error}
                onBlur={() => autoSave('sku', fields.sku.value)}
              />
            </FormLayout.Group>
            <TextField
              label="Código de barras"
              autoComplete="off"
              value={fields.barcode.value}
              onChange={fields.barcode.onChange}
              error={fields.barcode.error}
              onBlur={() => autoSave('barcode', fields.barcode.value)}
              connectedRight={
                <CameraScanner
                  onScan={(code) => {
                    fields.barcode.onChange(code);
                    autoSave('barcode', code);
                  }}
                  buttonLabel="Escanear"
                  compact
                />
              }
            />
            <FormSelect
              label="Categoría"
              options={categoryOptions}
              value={fields.category.value}
              onChange={(v) => {
                fields.category.onChange(v);
                autoSave('category', v);
              }}
              error={fields.category.error}
            />
          </FormLayout>
        </BlockStack>
      </Modal.Section>

      {/* ── Precios ── */}
      <Modal.Section>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingSm" fontWeight="semibold">
              Precios
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
                label="Costo"
                type="number"
                autoComplete="off"
                prefix="$"
                value={fields.costPrice.value}
                onChange={handleCostPriceChange}
                error={fields.costPrice.error}
                onBlur={() => autoSave('costPrice', parseFloat(fields.costPrice.value))}
              />
              <TextField
                label="Venta"
                type="number"
                autoComplete="off"
                prefix="$"
                value={fields.unitPrice.value}
                onChange={fields.unitPrice.onChange}
                error={fields.unitPrice.error}
                onBlur={() => autoSave('unitPrice', parseFloat(fields.unitPrice.value))}
              />
              <FormSelect
                label="Unidad"
                options={unitOptions}
                value={fields.unit.value}
                onChange={(v) => {
                  fields.unit.onChange(v);
                  autoSave('unit', v);
                }}
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
                value={fields.currentStock.value}
                onChange={fields.currentStock.onChange}
                error={fields.currentStock.error}
                onBlur={() => autoSave('currentStock', parseInt(fields.currentStock.value, 10))}
              />
              <TextField
                label="Stock mínimo"
                type="number"
                autoComplete="off"
                value={fields.minStock.value}
                onChange={fields.minStock.onChange}
                error={fields.minStock.error}
                onBlur={() => autoSave('minStock', parseInt(fields.minStock.value, 10))}
              />
            </FormLayout.Group>
            <Checkbox
              label="Producto perecedero"
              checked={fields.isPerishable.value}
              onChange={(v) => {
                fields.isPerishable.onChange(v);
                autoSave('isPerishable', v);
              }}
            />
            {fields.isPerishable.value && (
              <TextField
                label="Fecha de vencimiento"
                type="date"
                autoComplete="off"
                value={fields.expirationDate.value}
                onChange={fields.expirationDate.onChange}
                error={fields.expirationDate.error}
                onBlur={() => autoSave('expirationDate', fields.expirationDate.value)}
              />
            )}
          </FormLayout>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
