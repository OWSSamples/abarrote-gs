'use client';

import { useState, useCallback } from 'react';
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

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [unit, setUnit] = useState('pieza');
  const [unitMultiple, setUnitMultiple] = useState('1');
  const [currentStock, setCurrentStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [isPerishable, setIsPerishable] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setName('');
    setSku('');
    setBarcode('');
    setCategory('');
    setUnitPrice('');
    setCostPrice('');
    setUnit('pieza');
    setUnitMultiple('1');
    setCurrentStock('');
    setMinStock('');
    setExpirationDate('');
    setIsPerishable(false);
    setFile(null);
    setUploading(false);
    setErrors({});
  }, []);

  const handleDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) =>
      setFile(acceptedFiles[0]),
    [],
  );

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

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'El nombre es obligatorio';
    if (!sku.trim()) newErrors.sku = 'El SKU es obligatorio';
    if (!barcode.trim()) newErrors.barcode = 'El código de barras es obligatorio';
    if (!category) newErrors.category = 'Selecciona una categoría';
    if (!costPrice || parseFloat(costPrice) <= 0) newErrors.costPrice = 'Ingresa un precio de costo válido';
    if (!unitPrice || parseFloat(unitPrice) <= 0) newErrors.unitPrice = 'Ingresa un precio de venta válido';
    if (parseFloat(unitPrice) > 0 && parseFloat(costPrice) > 0 && parseFloat(costPrice) >= parseFloat(unitPrice)) {
      newErrors.costPrice = 'El precio de costo debe ser menor al precio de venta';
    }
    if (!currentStock || parseInt(currentStock) < 0) newErrors.currentStock = 'Ingresa un stock válido';
    if (!minStock || parseInt(minStock) < 0) newErrors.minStock = 'Ingresa un stock mínimo válido';
    if (isPerishable && !expirationDate) newErrors.expirationDate = 'Productos perecederos requieren fecha de vencimiento';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, sku, barcode, category, costPrice, unitPrice, currentStock, minStock, isPerishable, expirationDate]);

  const handleCostPriceChange = useCallback((value: string) => {
    setCostPrice(value);
    const cost = parseFloat(value);
    if (!isNaN(cost) && cost > 0) {
      const defaultMargin = parseFloat(storeConfig.defaultMargin || '30');
      const calculatedPrice = cost + (cost * (defaultMargin / 100));
      setUnitPrice(calculatedPrice.toFixed(2));
    } else if (value === '') {
      setUnitPrice('');
    }
  }, [storeConfig.defaultMargin]);

  const margin = parseFloat(unitPrice) > 0 && parseFloat(costPrice) > 0
    ? (((parseFloat(unitPrice) - parseFloat(costPrice)) / parseFloat(costPrice)) * 100).toFixed(1)
    : null;

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setUploading(true);

    try {
      let imageUrl = undefined;
      if (file) {
        const path = getProductImagePath(sku || Date.now().toString(), file.name);
        imageUrl = await uploadFile(file, path);
      }

      await registerProduct({
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode.trim(),
        category,
        costPrice: parseFloat(costPrice),
        unitPrice: parseFloat(unitPrice),
        unit,
        unitMultiple: parseInt(unitMultiple, 10) || 1,
        currentStock: parseInt(currentStock),
        minStock: parseInt(minStock),
        expirationDate: isPerishable ? expirationDate : null,
        isPerishable,
        imageUrl,
      });

      showSuccess('Producto registrado correctamente');
      onClose();
      resetForm();
    } catch (err: any) {
      showError(err.message || 'Error al registrar el producto');
    } finally {
      setUploading(false);
    }
  }, [validate, file, name, sku, barcode, category, costPrice, unitPrice, currentStock, minStock, isPerishable, expirationDate, registerProduct, showSuccess, showError, onClose, resetForm]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Registrar Nuevo Producto"
      primaryAction={{
        content: 'Registrar producto',
        onAction: handleSubmit,
        loading: uploading,
      }}
      secondaryActions={[{ content: 'Cancelar', onAction: onClose, disabled: uploading }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {hasErrors && (
            <Banner tone="warning">
              <p>Por favor corrige los errores antes de continuar.</p>
            </Banner>
          )}

          <Text as="h3" variant="headingMd">Imagen del producto</Text>
          <Box padding="200" borderStyle="dashed" borderWidth="025" borderColor="border" borderRadius="200">
            <DropZone
              onDrop={handleDropZoneDrop}
              variableHeight
              label="Foto del producto"
              labelHidden
              accept="image/*"
              type="image"
              disabled={uploading}
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
                value={name}
                onChange={setName}
                autoComplete="off"
                placeholder="Ej: Leche Lala 1L"
                error={errors.name}
              />
              <TextField
                label="SKU"
                value={sku}
                onChange={setSku}
                autoComplete="off"
                placeholder="Ej: LAC-001"
                error={errors.sku}
                helpText="Código interno del producto"
              />
            </FormLayout.Group>

            <TextField
              label="Código de barras"
              value={barcode}
              onChange={setBarcode}
              autoComplete="off"
              placeholder="Escanea o escribe el código de barras"
              error={errors.barcode}
              helpText="Escanea con el lector o escribe el código manualmente"
            />

            <CameraScanner
              onScan={(code) => {
                setBarcode(code);
                setErrors((prev) => { const { barcode: _, ...rest } = prev; return rest; });
              }}
              buttonLabel="Escanear codigo con camara"
              compact
            />

            <FormSelect
              label="Categoría"
              options={categoryOptions}
              value={category}
              onChange={setCategory}
              error={errors.category}
            />

            <FormLayout.Group>
              <TextField
                label="Precio de costo (MXN)"
                type="number"
                value={costPrice}
                onChange={handleCostPriceChange}
                autoComplete="off"
                prefix="$"
                placeholder="0.00"
                error={errors.costPrice}
                helpText="Cuánto te cuesta"
              />
              <TextField
                label="Precio al público (MXN)"
                type="number"
                value={unitPrice}
                onChange={setUnitPrice}
                autoComplete="off"
                prefix="$"
                placeholder="0.00"
                error={errors.unitPrice}
                helpText={margin ? `Margen: ${margin}%` : 'Para venta'}
              />
              <FormSelect
                label="Se vende por"
                options={unitOptions}
                value={unit}
                onChange={setUnit}
              />
              <TextField
                label="Cantidad por venta"
                type="number"
                value={unitMultiple}
                onChange={setUnitMultiple}
                autoComplete="off"
                min={1}
                helpText={`Ej: Se venden ${unitMultiple || 1} pz por $${unitPrice || '0.00'}`}
              />
            </FormLayout.Group>

            <FormLayout.Group>
              <TextField
                label="Stock actual"
                type="number"
                value={currentStock}
                onChange={setCurrentStock}
                autoComplete="off"
                placeholder="0"
                error={errors.currentStock}
                helpText="Cantidad actual en inventario"
              />
              <TextField
                label="Stock mínimo"
                type="number"
                value={minStock}
                onChange={setMinStock}
                autoComplete="off"
                placeholder="0"
                error={errors.minStock}
                helpText="Alerta cuando baje de este nivel"
              />
            </FormLayout.Group>

            <Checkbox
              label="¿Es producto perecedero?"
              checked={isPerishable}
              onChange={setIsPerishable}
              helpText="Marca si el producto tiene fecha de vencimiento"
            />

            {isPerishable && (
              <TextField
                label="Fecha de vencimiento"
                type="date"
                value={expirationDate}
                onChange={setExpirationDate}
                autoComplete="off"
                error={errors.expirationDate}
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
