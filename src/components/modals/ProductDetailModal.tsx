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
  FormLayout,
  Checkbox,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import { DeleteIcon, EditIcon } from '@shopify/polaris-icons';
import { Product } from '@/types';
import { formatCurrency, formatDate, getDaysUntil, getStockStatus } from '@/lib/utils';
import { useDashboardStore } from '@/store/dashboardStore';
import { useToast } from '@/components/notifications/ToastProvider';

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onSave?: (product: Product, changes: ProductChanges) => void;
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
    setEditProductMode(true);
  }, [product]);

  const handleSaveProduct = useCallback(async () => {
    if (!product) return;
    if (!editName.trim()) { showError('El nombre es obligatorio'); return; }
    if (!editUnitPrice || parseFloat(editUnitPrice) <= 0) { showError('El precio de venta debe ser mayor a 0'); return; }
    setSaving(true);
    try {
      await updateProduct(product.id, {
        name: editName.trim(),
        sku: editSku.trim(),
        barcode: editBarcode.trim(),
        category: editCategory.trim(),
        costPrice: parseFloat(editCostPrice) || 0,
        unitPrice: parseFloat(editUnitPrice) || 0,
        minStock: parseInt(editMinStock) || 0,
        isPerishable: editIsPerishable,
        expirationDate: editExpirationDate || null,
      });
      showSuccess(`"${editName}" actualizado correctamente`);
      setEditProductMode(false);
      setSaving(false);
      onClose();
    } catch {
      showError('Error al guardar los cambios');
      setSaving(false);
    }
  }, [product, editName, editSku, editBarcode, editCategory, editCostPrice, editUnitPrice, editMinStock, editIsPerishable, editExpirationDate, updateProduct, showSuccess, showError, onClose]);

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

  // Edit product mode
  if (editProductMode) {
    return (
      <Modal
        open={open}
        onClose={() => { setEditProductMode(false); onClose(); }}
        title={`Editar: ${product.name}`}
        primaryAction={{ content: 'Guardar Cambios', onAction: handleSaveProduct, loading: saving, disabled: !editName.trim() }}
        secondaryActions={[{ content: 'Cancelar', onAction: () => setEditProductMode(false) }]}
        size="large"
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Nombre del producto" value={editName} onChange={setEditName} autoComplete="off" requiredIndicator />
            <FormLayout.Group>
              <TextField label="SKU" value={editSku} onChange={setEditSku} autoComplete="off" />
              <TextField label="Código de barras" value={editBarcode} onChange={setEditBarcode} autoComplete="off" />
            </FormLayout.Group>
            <FormSelect label="Categoría" options={categoryOptions} value={editCategory} onChange={setEditCategory} />
            <FormLayout.Group>
              <TextField label="Precio de costo (MXN)" type="number" value={editCostPrice} onChange={setEditCostPrice} autoComplete="off" prefix="$" />
              <TextField label="Precio de venta (MXN)" type="number" value={editUnitPrice} onChange={setEditUnitPrice} autoComplete="off" prefix="$" requiredIndicator />
            </FormLayout.Group>
            <TextField label="Stock mínimo" type="number" value={editMinStock} onChange={setEditMinStock} autoComplete="off" helpText="Cuando el inventario baje de este número se mostrará alerta" />
            <Checkbox label="Es producto perecedero" checked={editIsPerishable} onChange={setEditIsPerishable} />
            {editIsPerishable && (
              <TextField label="Fecha de caducidad" type="date" value={editExpirationDate} onChange={setEditExpirationDate} autoComplete="off" />
            )}
            {parseFloat(editUnitPrice) > 0 && parseFloat(editCostPrice) > 0 && (
              <Banner tone="info">
                <p>Margen de ganancia: {formatCurrency(parseFloat(editUnitPrice) - parseFloat(editCostPrice))} ({((parseFloat(editUnitPrice) - parseFloat(editCostPrice)) / parseFloat(editCostPrice) * 100).toFixed(1)}%)</p>
              </Banner>
            )}
          </FormLayout>
        </Modal.Section>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product.name}
      primaryAction={
        editMode
          ? {
            content: 'Guardar Cambios',
            onAction: handleSave,
            disabled: !newStock || !adjustmentReason,
          }
          : {
            content: 'Ajustar Stock',
            onAction: () => setEditMode(true),
          }
      }
      secondaryActions={[
        {
          content: editMode ? 'Cancelar' : 'Cerrar',
          onAction: () => {
            if (editMode) {
              setEditMode(false);
              setNewStock('');
              setAdjustmentReason('');
            } else {
              onClose();
            }
          },
        },
      ]}
      size="large"
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Header con info básica */}
          <InlineStack align="space-between">
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">
                SKU: {product.sku}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Categoría: {product.category}
              </Text>
            </BlockStack>
            <InlineStack gap="200">
              {product.isPerishable && <Badge>Perecedero</Badge>}
              {getExpirationBadge()}
            </InlineStack>
          </InlineStack>

          <Divider />

          {/* Estado del Stock */}
          <BlockStack gap="200">
            <Text as="h4" variant="headingSm">
              Estado del Inventario
            </Text>
            <InlineStack gap="400">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Stock Actual
                </Text>
                <Text as="p" variant="headingLg">
                  {product.currentStock} unidades
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Stock Mínimo
                </Text>
                <Text as="p" variant="headingLg">
                  {product.minStock} unidades
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Nivel
                </Text>
                <Badge
                  tone={
                    stockStatus.status === 'critical'
                      ? 'critical'
                      : stockStatus.status === 'warning'
                        ? 'warning'
                        : 'success'
                  }
                >
                  {`${Math.round(stockStatus.percentage)}%`}
                </Badge>
              </BlockStack>
            </InlineStack>
            <ProgressBar
              progress={stockStatus.percentage}
              tone={stockStatus.status === 'critical' ? 'critical' : undefined}
              size="small"
            />
          </BlockStack>

          <Divider />

          {/* Información de Precio */}
          <BlockStack gap="200">
            <Text as="h4" variant="headingSm">
              Información de Precio
            </Text>
            <InlineStack gap="400">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Costo
                </Text>
                <Text as="p" variant="headingLg">
                  {formatCurrency(product.costPrice)}
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Precio Venta
                </Text>
                <Text as="p" variant="headingLg">
                  {formatCurrency(product.unitPrice)}
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Margen
                </Text>
                <Text as="p" variant="headingLg" tone="success">
                  {product.costPrice > 0 ? `${(((product.unitPrice - product.costPrice) / product.costPrice) * 100).toFixed(0)}%` : '—'}
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Valor en Inventario
                </Text>
                <Text as="p" variant="headingLg">
                  {formatCurrency(product.unitPrice * product.currentStock)}
                </Text>
              </BlockStack>
            </InlineStack>
          </BlockStack>

          {product.expirationDate && (
            <>
              <Divider />
              <BlockStack gap="200">
                <Text as="h4" variant="headingSm">
                  Información de Caducidad
                </Text>
                <InlineStack gap="400">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Fecha de Vencimiento
                    </Text>
                    <Text as="p" variant="bodyMd">
                      {formatDate(product.expirationDate)}
                    </Text>
                  </BlockStack>
                </InlineStack>
                {daysUntil !== null && daysUntil <= 7 && (
                  <Banner
                    tone={daysUntil <= 2 ? 'critical' : 'warning'}
                    title={daysUntil <= 0 ? 'Producto Vencido' : 'Próximo a Vencer'}
                  >
                    <p>
                      {daysUntil <= 0
                        ? 'Este producto ya venció y debe ser retirado del inventario.'
                        : `Quedan ${daysUntil} día(s) para el vencimiento. Considera aplicar promociones.`}
                    </p>
                  </Banner>
                )}
              </BlockStack>
            </>
          )}

          {/* Modo de edición */}
          {editMode && (
            <>
              <Divider />
              <BlockStack gap="300">
                <Text as="h4" variant="headingSm">
                  Ajustar Inventario
                </Text>
                <Banner tone="warning">
                  <p>Los ajustes de inventario quedarán registrados en el historial.</p>
                </Banner>
                <InlineStack gap="400">
                  <TextField
                    label="Nueva Cantidad"
                    type="number"
                    value={newStock}
                    onChange={setNewStock}
                    autoComplete="off"
                    placeholder={product.currentStock.toString()}
                  />
                  <div style={{ minWidth: 250 }}>
                    <FormSelect
                      label="Razón del Ajuste"
                      options={adjustmentReasons}
                      value={adjustmentReason}
                      onChange={setAdjustmentReason}
                    />
                  </div>
                </InlineStack>
                {newStock && (
                  <Text as="p" variant="bodySm" tone="subdued">
                    Diferencia: {parseInt(newStock, 10) - product.currentStock} unidades
                  </Text>
                )}
              </BlockStack>
            </>
          )}

          {/* Eliminar Producto */}
          <Divider />
          {showDeleteConfirm ? (
            <Banner
              tone="critical"
              title="¿Estás seguro de eliminar este producto?"
              onDismiss={() => setShowDeleteConfirm(false)}
            >
              <p style={{ marginBottom: 12 }}>
                Se eliminará <strong>{product.name}</strong> permanentemente del inventario. Esta acción no se puede deshacer.
              </p>
              <InlineStack gap="200">
                <Button
                  variant="primary"
                  tone="critical"
                  onClick={handleDelete}
                  loading={deleting}
                >
                  Sí, Eliminar
                </Button>
                <Button onClick={() => setShowDeleteConfirm(false)}>
                  Cancelar
                </Button>
              </InlineStack>
            </Banner>
          ) : (
            <InlineStack align="end" gap="300">
              <Button
                variant="plain"
                icon={EditIcon}
                onClick={handleStartEdit}
              >
                Editar Producto
              </Button>
              <Button
                variant="plain"
                tone="critical"
                icon={DeleteIcon}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Eliminar Producto
              </Button>
            </InlineStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
