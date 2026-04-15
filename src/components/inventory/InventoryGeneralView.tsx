'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BlockStack,
  Button,
  Card,
  IndexTable,
  InlineStack,
  Text,
  TextField,
  useIndexResourceState,
  IndexFilters,
  useSetIndexFiltersMode,
  IndexFiltersMode,
  Badge,
  EmptySearchResult,
} from '@shopify/polaris';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { Product } from '@/types';
import { useToast } from '@/components/notifications/ToastProvider';
import { useDashboardStore } from '@/store/dashboardStore';
import { ProductExportModal, ProductImportModal } from './ShopifyModals';
import { downloadFile, generateCSV } from '@/components/export/ExportModal';
import { generatePDF } from '@/components/export/generatePDF';
import { InventoryColumnsPopover } from './InventoryColumnsPopover';
import {
  BulkColumnKey,
  BulkEditRow,
  BULK_COLUMN_DEFINITIONS,
  INVENTORY_GENERAL_COLUMNS_FALLBACK,
  parseInventoryGeneralColumns,
  serializeInventoryGeneralColumns,
} from './InventoryTypes';
import { InventoryBulkEdit } from './InventoryBulkEdit';
import { formatCurrency } from '@/lib/utils';

// --- Columnas fijas de inventario ---
const INVENTORY_SORT_OPTIONS = [
  { label: 'Producto', value: 'product asc' as const, directionLabel: 'A-Z' },
  { label: 'Producto', value: 'product desc' as const, directionLabel: 'Z-A' },
  { label: 'Stock', value: 'stock asc' as const, directionLabel: 'Menor a mayor' },
  { label: 'Stock', value: 'stock desc' as const, directionLabel: 'Mayor a menor' },
];

interface InventoryGeneralViewProps {
  products: Product[];
  onProductClick?: (product: Product) => void;
  exportOpen: boolean;
  onExportClose: () => void;
  importOpen: boolean;
  onImportClose: () => void;
  onImportSuccess?: () => void;
}

export function InventoryGeneralView({
  products,
  onProductClick,
  exportOpen,
  onExportClose,
  importOpen,
  onImportClose,
  onImportSuccess,
}: InventoryGeneralViewProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [queryValue, setQueryValue] = useState('');
  const [sortSelected, setSortSelected] = useState(['product asc']);
  const [isColumnsPopoverOpen, setIsColumnsPopoverOpen] = useState(false);
  const [columnQuery, setColumnQuery] = useState('');
  const { mode, setMode } = useSetIndexFiltersMode(IndexFiltersMode.Filtering);

  // --- Edicion masiva ---
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [isSavingBulkEdit, setIsSavingBulkEdit] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkEditRow[]>([]);

  const storeConfig = useDashboardStore((state) => state.storeConfig);
  const saveStoreConfig = useDashboardStore((state) => state.saveStoreConfig);
  const [appliedVisibleColumns, setAppliedVisibleColumns] = useState(
    parseInventoryGeneralColumns(INVENTORY_GENERAL_COLUMNS_FALLBACK),
  );
  const [draftVisibleColumns, setDraftVisibleColumns] = useState(
    parseInventoryGeneralColumns(INVENTORY_GENERAL_COLUMNS_FALLBACK),
  );
  const toast = useToast();

  // --- Inline editable state for Disponible / En existencia ---
  const [editedValues, setEditedValues] = useState<Record<string, { available?: string; onHand?: string }>>({});

  const handlePersistColumns = useCallback(
    async (nextColumns: Record<BulkColumnKey, boolean>) => {
      setAppliedVisibleColumns(nextColumns);
      try {
        await saveStoreConfig({
          inventoryGeneralColumns: serializeInventoryGeneralColumns(nextColumns),
        });
      } catch {
        toast.showError('No se pudieron guardar las columnas de inventario');
      }
    },
    [saveStoreConfig, toast],
  );

  useEffect(() => {
    const persistedColumns = parseInventoryGeneralColumns(storeConfig.inventoryGeneralColumns);
    setAppliedVisibleColumns(persistedColumns);
    if (!isBulkEditing) {
      setDraftVisibleColumns(persistedColumns);
    }
  }, [isBulkEditing, storeConfig.inventoryGeneralColumns]);

  // --- Tabs with counts ---
  const tabCounts = useMemo(() => {
    const lowStock = products.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStock).length;
    const outOfStock = products.filter((p) => p.currentStock === 0).length;
    return { lowStock, outOfStock };
  }, [products]);

  const inventoryTabs = useMemo(
    () => [
      { id: 'all', content: 'Todo', isLocked: true, index: 0, onAction: () => {} },
      { id: 'low', content: `Stock bajo (${tabCounts.lowStock})`, index: 1, onAction: () => {} },
      { id: 'out', content: `Agotados (${tabCounts.outOfStock})`, index: 2, onAction: () => {} },
    ],
    [tabCounts],
  );

  // --- Filtro ---
  const filteredProducts = useMemo(() => {
    let result = products;

    // Tab filter
    if (selectedTab === 1) result = result.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStock);
    else if (selectedTab === 2) result = result.filter((p) => p.currentStock === 0);

    const query = queryValue.trim().toLowerCase();
    const filtered = query
      ? result.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.sku.toLowerCase().includes(query) ||
            p.barcode.toLowerCase().includes(query),
        )
      : [...result];

    const [sortKey, sortDir] = sortSelected[0].split(' ');
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'product') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'stock') cmp = a.currentStock - b.currentStock;
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return filtered;
  }, [products, selectedTab, queryValue, sortSelected]);

  // --- Resource selection ---
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(
    filteredProducts as { id: string }[],
  );

  const selectedProducts = useMemo(
    () => filteredProducts.filter((p) => selectedResources.includes(p.id)),
    [filteredProducts, selectedResources],
  );

  // --- Inline edit handlers ---
  const handleInlineChange = useCallback((productId: string, field: 'available' | 'onHand', value: string) => {
    setEditedValues((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }));
  }, []);

  const updateProductStore = useDashboardStore((s) => s.updateProduct);

  const handleInlineSave = useCallback(
    async (product: Product) => {
      const edited = editedValues[product.id];
      if (!edited) return;

      const parsedAvailable = edited.available !== undefined ? parseInt(edited.available, 10) : undefined;
      const parsedOnHand = edited.onHand !== undefined ? parseInt(edited.onHand, 10) : undefined;

      const newStock =
        parsedOnHand !== undefined && !isNaN(parsedOnHand)
          ? parsedOnHand
          : parsedAvailable !== undefined && !isNaN(parsedAvailable)
            ? parsedAvailable
            : undefined;

      if (newStock === undefined || newStock === product.currentStock) return;

      try {
        // Usamos el store para actualización optimista instantánea
        await updateProductStore(product.id, { currentStock: newStock });
        toast.showSuccess(`Stock de "${product.name}" actualizado a ${newStock}`);
        setEditedValues((prev) => {
          const next = { ...prev };
          delete next[product.id];
          return next;
        });
        // Ya no llamamos a onImportSuccess() para evitar el refetch masivo
      } catch {
        toast.showError('Error al actualizar stock');
      }
    },
    [editedValues, toast, updateProductStore],
  );

  // --- Bulk edit ---
  const visibleColumnDefinitions = useMemo(
    () => BULK_COLUMN_DEFINITIONS.filter((c) => draftVisibleColumns[c.key]),
    [draftVisibleColumns],
  );

  const handleOpenBulkEdit = useCallback(() => {
    if (selectedProducts.length === 0) {
      toast.showError('Selecciona al menos un producto para edicion masiva');
      return;
    }
    setDraftVisibleColumns(appliedVisibleColumns);
    setBulkRows(
      selectedProducts.map((p) => ({
        id: p.id,
        title: p.name,
        sku: p.sku || '',
        barcode: p.barcode || '',
        category: p.category || '',
        unitPrice: String(p.unitPrice),
        costPrice: String(p.costPrice),
        available: String(p.currentStock),
        onHand: String(p.currentStock),
        minStock: String(p.minStock),
        expirationDate: p.expirationDate || '',
      })),
    );
    setIsBulkEditing(true);
  }, [appliedVisibleColumns, selectedProducts, toast]);

  const handleCloseBulkEdit = useCallback(() => {
    setIsBulkEditing(false);
    setIsColumnsPopoverOpen(false);
    setColumnQuery('');
    setDraftVisibleColumns(appliedVisibleColumns);
  }, [appliedVisibleColumns]);

  const handleBulkFieldChange = useCallback((id: string, field: BulkColumnKey, value: string) => {
    setBulkRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }, []);

  const handleDraftColumnChange = useCallback((key: BulkColumnKey, checked: boolean) => {
    setDraftVisibleColumns((c) => ({ ...c, [key]: checked }));
  }, []);

  const handleAppliedColumnChange = useCallback(
    (key: BulkColumnKey, checked: boolean) => {
      void handlePersistColumns({ ...appliedVisibleColumns, [key]: checked });
    },
    [appliedVisibleColumns, handlePersistColumns],
  );

  const handleSaveBulkEdit = useCallback(async () => {
    if (bulkRows.length === 0) {
      setIsBulkEditing(false);
      return;
    }
    setIsSavingBulkEdit(true);
    try {
      await Promise.all(
        bulkRows.map(async (row) => {
          const product = products.find((p) => p.id === row.id);
          if (!product) return;
          // Usamos el store para cada actualización
          await updateProductStore(product.id, {
            name: row.title.trim() || product.name,
            sku: row.sku.trim(),
            barcode: row.barcode.trim(),
            category: row.category.trim() || product.category,
            currentStock: parseInt(row.onHand, 10) || parseInt(row.available, 10) || product.currentStock,
            minStock: parseInt(row.minStock, 10) || product.minStock,
            unitPrice: parseFloat(row.unitPrice) || product.unitPrice,
            costPrice: parseFloat(row.costPrice) || product.costPrice,
            expirationDate: row.expirationDate.trim() || null,
          });
        }),
      );
      await saveStoreConfig({ inventoryGeneralColumns: serializeInventoryGeneralColumns(draftVisibleColumns) });
      toast.showSuccess(`Se actualizaron ${bulkRows.length} producto(s)`);
      setAppliedVisibleColumns(draftVisibleColumns);
      setIsBulkEditing(false);
      // Actualización masiva terminada, el store ya tiene los datos nuevos.
    } catch {
      toast.showError('No se pudo guardar la edicion masiva');
    } finally {
      setIsSavingBulkEdit(false);
    }
  }, [bulkRows, draftVisibleColumns, products, saveStoreConfig, toast, updateProductStore]);

  // --- Promoted bulk actions ---
  const promotedBulkActions = [{ content: 'Edicion masiva', onAction: handleOpenBulkEdit }];

  // --- Export handler ---
  const handleExport = useCallback(
    (format: string) => {
      const exportData = products.map((p) => {
        const unavailable = p.expirationDate && new Date(p.expirationDate) < new Date() ? p.currentStock : 0;
        return {
          Producto: p.name,
          SKU: p.sku || 'Sin SKU',
          'Código de Barras': p.barcode || 'N/A',
          Categoría: p.category || 'N/A',
          'Costo Unitario ($)': p.costPrice,
          'Precio Público ($)': p.unitPrice,
          'Unidad de Venta': p.unit || 'N/A',
          'Es Perecedero': p.isPerishable ? 'Sí' : 'No',
          'No disponible': unavailable,
          Comprometido: 0,
          Disponible: Math.max(p.currentStock - unavailable, 0),
          'En existencia': p.currentStock,
          'Inventario Mínimo': p.minStock,
          'Fecha de Vencimiento': p.expirationDate || 'N/A',
        };
      });
      const filename = `Inventario_General_${new Date().toISOString().split('T')[0]}`;
      if (format === 'pdf') {
        generatePDF('Inventario general', exportData as Record<string, unknown>[], `${filename}.pdf`);
      } else {
        const csvContent = generateCSV(exportData as Record<string, unknown>[], true);
        const mime = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
        downloadFile(csvContent, `${filename}.csv`, mime);
      }
    },
    [products],
  );

  // --- Columnas Dinámicas para la vista ---
  const activeColumns = useMemo(
    () => BULK_COLUMN_DEFINITIONS.filter((c) => appliedVisibleColumns[c.key]),
    [appliedVisibleColumns],
  );

  const dynamicHeadings = useMemo(
    () => activeColumns.map((col) => ({ title: col.mainTableTitle || col.label })),
    [activeColumns],
  );

  const rowMarkup = filteredProducts.map((product, index) => {
    const unavailable =
      product.expirationDate && new Date(product.expirationDate) < new Date() ? product.currentStock : 0;
    const committed = 0;
    const available = Math.max(product.currentStock - unavailable - committed, 0);
    const onHand = product.currentStock;
    const edited = editedValues[product.id];

    return (
      <IndexTable.Row
        id={product.id}
        key={product.id}
        position={index}
        selected={selectedResources.includes(product.id)}
        onClick={() => onProductClick?.(product)}
      >
        {activeColumns.map((col) => {
          switch (col.key) {
            case 'title':
              return (
                <IndexTable.Cell key={col.key}>
                  <InlineStack gap="300" blockAlign="center">
                    <OptimizedImage source={product.imageUrl} alt={product.name} size="small" />
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {product.name}
                    </Text>
                  </InlineStack>
                </IndexTable.Cell>
              );
            case 'sku':
              return (
                <IndexTable.Cell key={col.key}>
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {product.sku || 'Sin SKU'}
                  </Text>
                </IndexTable.Cell>
              );
            case 'barcode':
              return (
                <IndexTable.Cell key={col.key}>
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {product.barcode || 'N/A'}
                  </Text>
                </IndexTable.Cell>
              );
            case 'category':
              return (
                <IndexTable.Cell key={col.key}>
                  <Text as="span" variant="bodyMd">
                    {product.category || 'N/A'}
                  </Text>
                </IndexTable.Cell>
              );
            case 'unitPrice':
              return (
                <IndexTable.Cell key={col.key}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <Text as="span" variant="bodyMd">
                      {formatCurrency(product.unitPrice)}
                    </Text>
                  </span>
                </IndexTable.Cell>
              );
            case 'costPrice':
              return (
                <IndexTable.Cell key={col.key}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <Text as="span" variant="bodyMd" tone="subdued">
                      {formatCurrency(product.costPrice)}
                    </Text>
                  </span>
                </IndexTable.Cell>
              );
            case 'minStock':
              return (
                <IndexTable.Cell key={col.key}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <Text as="span" variant="bodyMd">
                      {product.minStock}
                    </Text>
                  </span>
                </IndexTable.Cell>
              );
            case 'expirationDate':
              return (
                <IndexTable.Cell key={col.key}>
                  <Text as="span" variant="bodyMd">
                    {product.expirationDate || 'N/A'}
                  </Text>
                </IndexTable.Cell>
              );
            case 'available': {
              const stockTone =
                available === 0 ? 'critical' : available <= product.minStock ? 'attention' : undefined;
              return (
                <IndexTable.Cell key={col.key}>
                  <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '160px' }}>
                    <InlineStack gap="200" wrap={false} blockAlign="center">
                      <div style={{ flexGrow: 1 }}>
                        <TextField
                          label="Disponible"
                          labelHidden
                          autoComplete="off"
                          type="number"
                          value={edited?.available !== undefined ? edited.available : String(available)}
                          onChange={(v) => handleInlineChange(product.id, 'available', v)}
                        />
                      </div>
                      {edited?.available !== undefined ? (
                        <Button size="slim" variant="primary" onClick={() => handleInlineSave(product)}>
                          Guardar
                        </Button>
                      ) : (
                        stockTone && <Badge tone={stockTone}>{available === 0 ? 'Agotado' : 'Bajo'}</Badge>
                      )}
                    </InlineStack>
                  </div>
                </IndexTable.Cell>
              );
            }
            case 'onHand': {
              const onHandTone =
                onHand === 0 ? 'critical' : onHand <= product.minStock ? 'attention' : undefined;
              return (
                <IndexTable.Cell key={col.key}>
                  <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '160px' }}>
                    <InlineStack gap="200" wrap={false} blockAlign="center">
                      <div style={{ flexGrow: 1 }}>
                        <TextField
                          label="En existencia"
                          labelHidden
                          autoComplete="off"
                          type="number"
                          value={edited?.onHand !== undefined ? edited.onHand : String(onHand)}
                          onChange={(v) => handleInlineChange(product.id, 'onHand', v)}
                        />
                      </div>
                      {edited?.onHand !== undefined ? (
                        <Button size="slim" variant="primary" onClick={() => handleInlineSave(product)}>
                          Guardar
                        </Button>
                      ) : (
                        onHandTone && <Badge tone={onHandTone}>{onHand === 0 ? 'Agotado' : 'Bajo'}</Badge>
                      )}
                    </InlineStack>
                  </div>
                </IndexTable.Cell>
              );
            }
            default:
              return <IndexTable.Cell key={col.key}>-</IndexTable.Cell>;
          }
        })}
      </IndexTable.Row>
    );
  });

  // --- Bulk edit mode ---
  if (isBulkEditing) {
    return (
      <InventoryBulkEdit
        bulkRows={bulkRows}
        products={products}
        visibleColumnDefinitions={visibleColumnDefinitions}
        draftVisibleColumns={draftVisibleColumns}
        isSavingBulkEdit={isSavingBulkEdit}
        isColumnsPopoverOpen={isColumnsPopoverOpen}
        columnQuery={columnQuery}
        onColumnsPopoverToggle={() => setIsColumnsPopoverOpen((c) => !c)}
        onColumnsPopoverClose={() => setIsColumnsPopoverOpen(false)}
        onColumnQueryChange={setColumnQuery}
        onDraftColumnChange={handleDraftColumnChange}
        onBulkFieldChange={handleBulkFieldChange}
        onClose={handleCloseBulkEdit}
        onSave={handleSaveBulkEdit}
      />
    );
  }

  return (
    <BlockStack gap="400">
      <Card padding="0">
        <IndexFilters
          sortOptions={INVENTORY_SORT_OPTIONS}
          sortSelected={sortSelected}
          queryValue={queryValue}
          queryPlaceholder="Buscar por nombre, SKU o código de barras..."
          onQueryChange={setQueryValue}
          onQueryClear={() => setQueryValue('')}
          onSort={setSortSelected}
          cancelAction={{ onAction: () => {}, disabled: false, loading: false }}
          tabs={inventoryTabs}
          selected={selectedTab}
          onSelect={setSelectedTab}
          mode={mode}
          setMode={setMode}
          filters={[]}
          appliedFilters={[]}
          onClearAll={() => {}}
        />

        {/* Column config (floating) */}
        <div style={{ position: 'absolute', right: '16px', top: '8px', zIndex: 1 }}>
          <InventoryColumnsPopover
            active={isColumnsPopoverOpen}
            activator={
              <Button
                size="slim"
                onClick={() => setIsColumnsPopoverOpen((c) => !c)}
                accessibilityLabel="Administrar columnas"
              >
                Columnas
              </Button>
            }
            onClose={() => setIsColumnsPopoverOpen(false)}
            columnQuery={columnQuery}
            onColumnQueryChange={setColumnQuery}
            selectedColumns={appliedVisibleColumns}
            onColumnChange={handleAppliedColumnChange}
          />
        </div>

        {/* Tabla con encabezados dinámicos */}
        <IndexTable
          resourceName={{ singular: 'producto', plural: 'productos' }}
          itemCount={filteredProducts.length}
          selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          headings={dynamicHeadings as [{ title: string }, ...{ title: string }[]]}
          promotedBulkActions={promotedBulkActions}
          sortable={[true, false, false, false, false, false, false]}
          emptyState={
            <EmptySearchResult
              title="No se encontraron productos"
              description="Intenta con otro término de búsqueda."
              withIllustration
            />
          }
        >
          {rowMarkup}
        </IndexTable>
      </Card>

      {/* Modales controlados desde padre */}
      <ProductExportModal open={exportOpen} onClose={onExportClose} onExport={handleExport} />
      <ProductImportModal open={importOpen} onClose={onImportClose} onImportSuccess={onImportSuccess} />
    </BlockStack>
  );
}
