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
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
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

export function RegisterProductModal({ open, onClose }: RegisterProductModalProps) {
  const registerProduct = useDashboardStore((s) => s.registerProduct);
  const { showSuccess, showError } = useToast();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [isPerishable, setIsPerishable] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setName('');
    setSku('');
    setBarcode('');
    setCategory('');
    setUnitPrice('');
    setCostPrice('');
    setCurrentStock('');
    setMinStock('');
    setExpirationDate('');
    setIsPerishable(false);
    setErrors({});
  }, []);

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

  const margin = parseFloat(unitPrice) > 0 && parseFloat(costPrice) > 0
    ? (((parseFloat(unitPrice) - parseFloat(costPrice)) / parseFloat(costPrice)) * 100).toFixed(1)
    : null;

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    try {
      await registerProduct({
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode.trim(),
        category,
        costPrice: parseFloat(costPrice),
        unitPrice: parseFloat(unitPrice),
        currentStock: parseInt(currentStock),
        minStock: parseInt(minStock),
        expirationDate: expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isPerishable,
      });
      showSuccess(`Producto "${name}" registrado exitosamente`);
      resetForm();
      onClose();
    } catch {
      showError('Error al registrar el producto');
    }
  }, [name, sku, barcode, category, costPrice, unitPrice, currentStock, minStock, expirationDate, isPerishable, registerProduct, resetForm, onClose, showSuccess, showError, validate]);

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
        content: 'Registrar Producto',
        onAction: handleSubmit,
      }}
      secondaryActions={[
        {
          content: 'Cancelar',
          onAction: handleClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {hasErrors && (
            <Banner tone="warning">
              <p>Por favor corrige los errores antes de continuar.</p>
            </Banner>
          )}

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
                onChange={setCostPrice}
                autoComplete="off"
                prefix="$"
                placeholder="0.00"
                error={errors.costPrice}
                helpText="Cuánto te cuesta comprar este producto"
              />
              <TextField
                label="Precio de venta (MXN)"
                type="number"
                value={unitPrice}
                onChange={setUnitPrice}
                autoComplete="off"
                prefix="$"
                placeholder="0.00"
                error={errors.unitPrice}
                helpText={margin ? `Margen: ${margin}%` : 'Precio al público'}
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
