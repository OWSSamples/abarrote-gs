'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
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
  Button,
  Banner,
  Box,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { uploadFile, getProductImagePath } from '@/lib/storage';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';
import { CameraScanner } from '@/components/scanner/CameraScanner';
import { useAIDescription } from '@/hooks/useAIDescription';
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
  // Only mount the form when there IS a product — this ensures useField
  // initializes with the actual product values instead of empty strings.
  // When product changes, React unmounts/remounts the inner component
  // because the key changes, giving useField fresh initial values.
  if (!product) {
    return (
      <Modal open={open} onClose={onClose} title="Editar Producto">
        <Modal.Section>
          <Text as="p" variant="bodySm" tone="subdued">Selecciona un producto para editar.</Text>
        </Modal.Section>
      </Modal>
    );
  }

  return <UpdateProductForm key={product.id} open={open} onClose={onClose} product={product} />;
}

function UpdateProductForm({ open, onClose, product }: { open: boolean; onClose: () => void; product: Product }) {
  const updateProductStore = useDashboardStore((s) => s.updateProduct);
  const categories = useDashboardStore((s) => s.categories);
  const storeConfig = useDashboardStore((s) => s.storeConfig);

  const categoryOptions = [
    { label: 'Seleccionar categoría...', value: '' },
    ...categories.map((c) => ({ label: c.name, value: c.id })),
  ];
  const { showSuccess, showError } = useToast();
  const { aiEnabled, generating, generateDescription } = useAIDescription();
  const [aiDescription, setAiDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // ── Stock adjustment state ──
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentBusy, setAdjustmentBusy] = useState(false);

  const { fields, makeClean, reset } = useForm({
    fields: {
      name: useField({
        value: product.name || '',
        validates: [notEmpty('El nombre es obligatorio')],
      }),
      sku: useField({
        value: product.sku || '',
        validates: [notEmpty('El SKU es obligatorio')],
      }),
      barcode: useField(product.barcode || ''),
      category: useField({
        value: product.category || '',
        validates: [notEmpty('Selecciona una categoría')],
      }),
      unitPrice: useField({
        value: product.unitPrice?.toString() || '',
        validates: [
          notEmpty('Ingresa un precio de venta'),
          (val: string) => (parseFloat(val) <= 0 ? 'Debe ser mayor a 0' : undefined),
        ],
      }),
      costPrice: useField({
        value: product.costPrice?.toString() || '',
        validates: [
          notEmpty('Ingresa un precio de costo'),
          (val: string) => (parseFloat(val) <= 0 ? 'Debe ser mayor a 0' : undefined),
        ],
      }),
      unit: useField(product.unit || 'pieza'),
      unitMultiple: useField(product.unitMultiple?.toString() || '1'),
      currentStock: useField({
        value: product.currentStock?.toString() || '0',
        validates: [(val: string) => (parseInt(val) < 0 ? 'No puede ser negativo' : undefined)],
      }),
      minStock: useField(product.minStock?.toString() || '0'),
      isPerishable: useField(product.isPerishable || false),
      expirationDate: useField(product.expirationDate || ''),
    },
    onSubmit: async () => ({ status: 'success' }),
  });

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
    setAdjustmentQty('');
    setAdjustmentReason('');
    onClose();
  }, [reset, onClose]);

  const adjustmentReasonOptions = useMemo(
    () => [
      { label: 'Seleccionar motivo…', value: '' },
      { label: 'Recepción de mercancía', value: 'recepcion' },
      { label: 'Devolución de cliente', value: 'devolucion_cliente' },
      { label: 'Corrección de conteo', value: 'correccion_conteo' },
      { label: 'Transferencia entre sucursales', value: 'transferencia' },
      { label: 'Otro', value: 'otro' },
    ],
    [],
  );

  const handleStockAdjustment = useCallback(async () => {
    if (!product) return;
    const qty = parseInt(adjustmentQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showError('Ingresa una cantidad válida mayor a 0.');
      return;
    }
    if (!adjustmentReason) {
      showError('Selecciona un motivo para el surtido.');
      return;
    }

    const currentStock = product.currentStock ?? 0;
    const newStock = currentStock + qty;

    setAdjustmentBusy(true);
    try {
      await updateProductStore(product.id, { currentStock: newStock });
      fields.currentStock.onChange(newStock.toString());
      fields.currentStock.newDefaultValue(newStock.toString());
      setAdjustmentQty('');
      setAdjustmentReason('');
      showSuccess(
        `+${qty} unidades surtidas. Stock actualizado: ${newStock}. Motivo: ${adjustmentReasonOptions.find((o) => o.value === adjustmentReason)?.label ?? adjustmentReason}`,
      );
    } catch {
      showError('Error al surtir stock.');
    }
    setAdjustmentBusy(false);
  }, [product, adjustmentQty, adjustmentReason, updateProductStore, fields.currentStock, showSuccess, showError, adjustmentReasonOptions]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={product.name}
      primaryAction={{
        content: 'Listo',
        onAction: handleClose,
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

      {/* ── Surtir Mercancía ── */}
      <Modal.Section>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingSm" fontWeight="semibold">
              Surtir mercancía
            </Text>
            <Badge tone="info">
              {`Stock actual: ${fields.currentStock.value}`}
            </Badge>
          </InlineStack>

          <Banner tone="info">
            <Text as="p" variant="bodySm">
              Agrega unidades al inventario cuando recibas mercancía. El stock no se puede reducir manualmente
              — solo se descuenta automáticamente al registrar ventas.
            </Text>
          </Banner>

          <FormLayout>
            <TextField
              label="Cantidad a surtir"
              type="number"
              autoComplete="off"
              value={adjustmentQty}
              onChange={setAdjustmentQty}
              min={1}
              helpText={
                adjustmentQty && parseInt(adjustmentQty, 10) > 0
                  ? `Nuevo stock: ${(product.currentStock ?? 0) + parseInt(adjustmentQty, 10)}`
                  : undefined
              }
            />
            <FormSelect
              label="Motivo del surtido"
              options={adjustmentReasonOptions}
              value={adjustmentReason}
              onChange={setAdjustmentReason}
            />
          </FormLayout>

          <Box>
            <Button
              variant="primary"
              onClick={handleStockAdjustment}
              loading={adjustmentBusy}
              disabled={!adjustmentQty || parseInt(adjustmentQty, 10) <= 0 || !adjustmentReason}
            >
              Surtir al inventario
            </Button>
          </Box>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
