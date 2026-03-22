'use client';

import { useState, useCallback } from 'react';
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  ProgressBar,
  Divider,
  Button,
  TextField,
  Banner,
  Checkbox,
  DropZone,
  Thumbnail,
  Box,
  FormLayout,
  Grid,
  Icon,
  Popover,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import { DeleteIcon, EditIcon, ImageIcon } from '@shopify/polaris-icons';
import { Product } from '@/types';
import { formatCurrency, formatDate, getDaysUntil, getStockStatus } from '@/lib/utils';
import { useDashboardStore } from '@/store/dashboardStore';
import { uploadFile, getProductImagePath } from '@/lib/storage';
import { useToast } from '@/components/notifications/ToastProvider';

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onSave?: (product: Product, changes: ProductChanges) => void;
  isInline?: boolean;
}

interface ProductChanges {
  newStock?: number;
  reason?: string;
}

export function ProductDetailModal({
  product,
  open,
  onClose,
  onSave,
  isInline = false,
}: ProductDetailModalProps) {
  const [editMode, setEditMode] = useState(false);
  const [editProductMode, setEditProductMode] = useState(false);
  const [newStock, setNewStock] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const deleteProduct = useDashboardStore((s) => s.deleteProduct);
  const updateProduct = useDashboardStore((s) => s.updateProduct);
  const { showSuccess, showError } = useToast();

  // Edit product form state
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editUnitPrice, setEditUnitPrice] = useState('');
  const [editMinStock, setEditMinStock] = useState('');
  const [editIsPerishable, setEditIsPerishable] = useState(false);
  const [editExpirationDate, setEditExpirationDate] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);

  const stockStatus = product ? getStockStatus(product.currentStock, product.minStock) : null;
  const daysUntil = product?.expirationDate ? getDaysUntil(product.expirationDate) : null;

  const handleSave = useCallback(() => {
    if (!product) return;
    if (onSave && newStock) {
      onSave(product, {
        newStock: parseInt(newStock, 10),
        reason: adjustmentReason,
      });
    }
    setEditMode(false);
    setNewStock('');
    setAdjustmentReason('');
    onClose();
  }, [product, onSave, newStock, adjustmentReason, onClose]);

  const handleStartEdit = useCallback(() => {
    if (!product) return;
    setEditName(product.name);
    setEditSku(product.sku);
    setEditBarcode(product.barcode);
    setEditCategory(product.category);
    setEditCostPrice(String(product.costPrice));
    setEditUnitPrice(String(product.unitPrice));
    setEditMinStock(String(product.minStock));
    setEditIsPerishable(product.isPerishable);
    setEditExpirationDate(product.expirationDate || '');
    setEditImageUrl(product.imageUrl || '');
    setEditFile(null);
    setEditProductMode(true);
  }, [product]);

  const handleSaveProduct = useCallback(async (shouldClose = true) => {
    if (!product) return;
    if (!editName.trim()) { showError('El nombre es obligatorio'); return; }
    if (!editUnitPrice || parseFloat(editUnitPrice) <= 0) { showError('El precio de venta debe ser mayor a 0'); return; }
    setSaving(true);
    try {
      let finalImageUrl = editImageUrl;
      if (editFile) {
        const path = getProductImagePath(editSku || product.id, editFile.name);
        finalImageUrl = await uploadFile(editFile, path);
      }

      await updateProduct(product.id, {
        name: editName.trim(),
        sku: editSku.trim(),
        barcode: editBarcode.trim(),
        category: editCategory,
        costPrice: parseFloat(editCostPrice),
        unitPrice: parseFloat(editUnitPrice),
        minStock: parseInt(editMinStock),
        isPerishable: editIsPerishable,
        expirationDate: editIsPerishable ? editExpirationDate : null,
        imageUrl: finalImageUrl,
      });
      
      if (shouldClose) {
        showSuccess(`"${editName}" actualizado correctamente`);
        setEditProductMode(false);
        onClose();
      } else {
        // Silent success for immediate sync or different notification
      }
      setSaving(false);
    } catch {
      showError('Error al guardar los cambios');
      setSaving(false);
    }
  }, [product, editName, editSku, editBarcode, editCategory, editCostPrice, editUnitPrice, editMinStock, editIsPerishable, editExpirationDate, editFile, editImageUrl, updateProduct, showSuccess, showError, onClose]);

  const handleDelete = async () => {
    if (!product) return;
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      showSuccess(`"${product.name}" eliminado`);
      setShowDeleteConfirm(false);
      setDeleting(false);
      onClose();
    } catch {
      showError('Error al eliminar producto');
      setDeleting(false);
    }
  };

  const getExpirationBadge = () => {
    if (!daysUntil) return null;
    if (!daysUntil) return null;
    if (daysUntil <= 0) return <Badge tone="critical">Vencido</Badge>;
    if (daysUntil <= 2) return <Badge tone="critical">{`Vence en ${daysUntil} días`}</Badge>;
    if (daysUntil <= 7) return <Badge tone="warning">{`Vence en ${daysUntil} días`}</Badge>;
    return <Badge tone="success">{`Vence en ${daysUntil} días`}</Badge>;
  };

  const adjustmentReasons = [
    { label: 'Seleccionar razón...', value: '' },
    { label: 'Recuento físico', value: 'recount' },
    { label: 'Recepción de mercancía', value: 'reception' },
    { label: 'Devolución de cliente', value: 'return' },
    { label: 'Merma/Robo', value: 'shrinkage' },
    { label: 'Error de sistema', value: 'system_error' },
    { label: 'Otro', value: 'other' },
  ];

  const categoryOptions = [
    { label: 'Abarrotes Secos', value: 'Abarrotes Secos' },
    { label: 'Lácteos', value: 'Lácteos' },
    { label: 'Panadería', value: 'Panadería' },
    { label: 'Carnes y Embutidos', value: 'Carnes y Embutidos' },
    { label: 'Frutas y Verduras', value: 'Frutas y Verduras' },
    { label: 'Bebidas', value: 'Bebidas' },
    { label: 'Limpieza', value: 'Limpieza' },
    { label: 'Higiene Personal', value: 'Higiene Personal' },
    { label: 'Huevos', value: 'Huevos' },
    { label: 'Tortillería', value: 'Tortillería' },
  ];

  if (!product) return null;

  const renderEditContent = () => (
    <div style={{ backgroundColor: '#f1f2f4', minHeight: '100%', padding: isInline ? '0' : '20px' }}>
      <div style={{ maxWidth: '1200px', margin: 'auto' }}>
        <FormLayout>
          {isInline && (
            <Box paddingBlockEnd="400">
              <InlineStack align="space-between">
                <Button variant="plain" onClick={() => setEditProductMode(false)}>← Volver a detalles</Button>
                <InlineStack gap="200">
                  <Button onClick={() => setEditProductMode(false)}>Cancelar</Button>
                  <Button variant="primary" onClick={() => handleSaveProduct(true)} loading={saving}>Guardar</Button>
                </InlineStack>
              </InlineStack>
            </Box>
          )}
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4 }}>
              <BlockStack gap="400">
                <Box background="bg-surface" padding="400" borderRadius="300" shadow="300">
                  <BlockStack gap="400">
                    <TextField label="Título" value={editName} onChange={setEditName} onBlur={() => handleSaveProduct(false)} autoComplete="off" requiredIndicator />
                    <TextField label="Descripción" multiline={4} value="Descripción del producto..." onChange={() => {}} autoComplete="off" />
                  </BlockStack>
                </Box>
                <Box background="bg-surface" padding="400" borderRadius="300" shadow="300">
                  <Text as="h3" variant="headingSm">Multimedia</Text>
                  <div style={{ border: '1px solid var(--p-color-border-secondary)', borderRadius: '0.5rem', background: 'var(--p-color-bg-surface-secondary)', width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {product!.imageUrl ? <img src={product!.imageUrl} alt="Thumbnail" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <Icon source={ImageIcon} tone="subdued" />}
                  </div>
                </Box>
              </BlockStack>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4 }}>
              <Box background="bg-surface" padding="400" borderRadius="300" shadow="300">
                <BlockStack gap="400">
                  <Text as="h3" variant="headingSm">Estado</Text>
                  <Badge tone="success">Activo</Badge>
                  <FormSelect options={categoryOptions} value={editCategory} onChange={setEditCategory} label="Categoría" />
                  <TextField label="Precio" type="number" value={editUnitPrice} onChange={setEditUnitPrice} prefix="$" autoComplete="off" />
                </BlockStack>
              </Box>
            </Grid.Cell>
          </Grid>
        </FormLayout>
      </div>
    </div>
  );

  const renderViewContent = () => (
    <BlockStack gap="500">
      {isInline && (
        <Box paddingBlockEnd="400">
          <InlineStack align="space-between" blockAlign="center">
            <Button variant="plain" onClick={onClose}>← Volver a la lista</Button>
            <Button onClick={handleStartEdit}>Editar Producto</Button>
          </InlineStack>
        </Box>
      )}
      <InlineStack gap="400" blockAlign="center">
        <Thumbnail size="medium" source={product!.imageUrl || ImageIcon} alt={product!.name} />
        <BlockStack gap="100">
          <Text variant="headingXl" as="h2" fontWeight="bold">{product!.name?.toUpperCase()}</Text>
          <Badge tone="info">{product!.category}</Badge>
        </BlockStack>
      </InlineStack>
      <Divider />
      <Grid>
        <Grid.Cell columnSpan={{ xs: 6, md: 6 }}>
          <BlockStack gap="200">
            <Text as="h3" variant="headingMd">Inventario</Text>
            <Text as="p" variant="bodyLg">{product!.currentStock} unidades disponibles</Text>
            <ProgressBar progress={stockStatus?.percentage || 0} tone={stockStatus?.status === 'critical' ? 'critical' : 'primary'} />
          </BlockStack>
        </Grid.Cell>
        <Grid.Cell columnSpan={{ xs: 6, md: 6 }}>
          <BlockStack gap="200">
            <Text as="h3" variant="headingMd">Precio</Text>
            <Text as="p" variant="headingLg" fontWeight="bold">{formatCurrency(product!.unitPrice)}</Text>
            <Text as="p" variant="bodySm" tone="subdued">Costo: {formatCurrency(product!.costPrice)}</Text>
          </BlockStack>
        </Grid.Cell>
      </Grid>
      {!isInline && (
        <InlineStack align="end" gap="200">
          <Button onClick={handleStartEdit}>Editar</Button>
          <Button tone="critical" onClick={() => setShowDeleteConfirm(true)}>Eliminar</Button>
        </InlineStack>
      )}
    </BlockStack>
  );

  if (isInline) {
    return editProductMode ? renderEditContent() : renderViewContent();
  }

  return (
    <Modal open={open} onClose={() => { setEditProductMode(false); onClose(); }} title={product!.name.toUpperCase()} size="large">
       <Modal.Section>{editProductMode ? renderEditContent() : renderViewContent()}</Modal.Section>
    </Modal>
  );
}
