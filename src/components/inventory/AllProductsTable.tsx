'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  IndexFilters,
  useSetIndexFiltersMode,
  IndexFiltersMode,
  TabProps,
  useIndexResourceState,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Box,
  EmptySearchResult,
} from '@shopify/polaris';
import { ImageIcon } from '@shopify/polaris-icons';
import { Product } from '@/types';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { formatCurrency } from '@/lib/utils';
import { ProductExportModal, ProductImportModal } from './ShopifyModals';
import { generateCSV, downloadFile, generateXLSX } from '@/components/export/ExportModal';
import { generatePDF } from '@/components/export/generatePDF';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface AllProductsTableProps {
  products: Product[];
  onProductClick?: (product: Product) => void;
  onDeleteProducts?: (products: Product[]) => void;
  onUpdateProduct?: (product: Product) => void;
  exportOpen: boolean;
  onExportClose: () => void;
  importOpen: boolean;
  onImportClose: () => void;
  onImportSuccess?: () => void;
}

type ProductStatus = 'active' | 'draft' | 'agotado';

function getProductStatus(product: Product): ProductStatus {
  if (product.currentStock === 0) return 'agotado';
  if (!product.barcode && product.currentStock <= product.minStock) return 'draft';
  return 'active';
}

function getStatusBadge(status: ProductStatus) {
  switch (status) {
    case 'active':
      return <Badge tone="success">Activo</Badge>;
    case 'draft':
      return <Badge tone="attention">Incompleto</Badge>;
    case 'agotado':
      return <Badge tone="critical">Agotado</Badge>;
  }
}

export function AllProductsTable({
  products,
  onProductClick,
  onDeleteProducts,
  onUpdateProduct,
  exportOpen,
  onExportClose,
  importOpen,
  onImportClose,
  onImportSuccess,
}: AllProductsTableProps) {
  // --- Tabs ---
  const [selected, setSelected] = useState(0);

  const statusCounts = useMemo(() => {
    const active = products.filter((p) => getProductStatus(p) === 'active').length;
    const draft = products.filter((p) => getProductStatus(p) === 'draft').length;
    const agotado = products.filter((p) => getProductStatus(p) === 'agotado').length;
    return { active, draft, agotado };
  }, [products]);

  const tabs: TabProps[] = useMemo(
    () => [
      { content: 'Todos', index: 0, onAction: () => {}, id: 'all-0', isLocked: true },
      { content: `Activos (${statusCounts.active})`, index: 1, onAction: () => {}, id: 'active-1' },
      { content: `Incompletos (${statusCounts.draft})`, index: 2, onAction: () => {}, id: 'draft-2' },
      { content: `Agotados (${statusCounts.agotado})`, index: 3, onAction: () => {}, id: 'agotado-3' },
    ],
    [statusCounts],
  );

  // --- Sorting ---
  const [sortSelected, setSortSelected] = useState(['product asc']);
  const sortOptions = [
    { label: 'Producto', value: 'product asc' as const, directionLabel: 'A-Z' },
    { label: 'Producto', value: 'product desc' as const, directionLabel: 'Z-A' },
    { label: 'Precio', value: 'price asc' as const, directionLabel: 'Menor a mayor' },
    { label: 'Precio', value: 'price desc' as const, directionLabel: 'Mayor a menor' },
    { label: 'Inventario', value: 'inventory asc' as const, directionLabel: 'Menor a mayor' },
    { label: 'Inventario', value: 'inventory desc' as const, directionLabel: 'Mayor a menor' },
    { label: 'Categoría', value: 'category asc' as const, directionLabel: 'A-Z' },
    { label: 'Categoría', value: 'category desc' as const, directionLabel: 'Z-A' },
  ];

  // --- Search ---
  const { mode, setMode } = useSetIndexFiltersMode(IndexFiltersMode.Filtering);
  const [queryValue, setQueryValue] = useState('');

  // --- Filter by tab + search + sort ---
  const filteredProducts = useMemo(() => {
    let result = products;

    if (selected === 1) result = result.filter((p) => getProductStatus(p) === 'active');
    else if (selected === 2) result = result.filter((p) => getProductStatus(p) === 'draft');
    else if (selected === 3) result = result.filter((p) => getProductStatus(p) === 'agotado');

    if (queryValue) {
      const q = queryValue.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }

    const [sortKey, sortDir] = sortSelected[0].split(' ');
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'product') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'price') cmp = a.unitPrice - b.unitPrice;
      else if (sortKey === 'inventory') cmp = a.currentStock - b.currentStock;
      else if (sortKey === 'category') cmp = a.category.localeCompare(b.category);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [products, selected, queryValue, sortSelected]);

  // --- Resource selection ---
  const resourceName = { singular: 'producto', plural: 'productos' };
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(
    filteredProducts as { id: string }[],
  );

  const selectedProducts = filteredProducts.filter((p) => selectedResources.includes(p.id));

  const promotedBulkActions = [
    {
      content: 'Editar',
      onAction: () => {
        if (selectedProducts.length === 1) onUpdateProduct?.(selectedProducts[0]);
      },
      disabled: selectedProducts.length !== 1,
    },
  ];
  const bulkActions = [
    {
      content: `Eliminar ${selectedProducts.length} producto${selectedProducts.length === 1 ? '' : 's'}`,
      destructive: true,
      onAction: () => {
        if (selectedProducts.length > 0) onDeleteProducts?.(selectedProducts);
      },
    },
  ];

  // --- Export handler ---
  const handleExport = useCallback(
    (format: string) => {
      const exportData = products.map((p) => ({
        Nombre: p.name,
        SKU: p.sku || 'N/A',
        'Código de Barras': p.barcode || 'N/A',
        Categoría: p.category || 'N/A',
        'Costo ($)': p.costPrice,
        'Precio ($)': p.unitPrice,
        Unidad: p.unit || 'N/A',
        Stock: p.currentStock,
        'Stock Mínimo': p.minStock,
        Perecedero: p.isPerishable ? 'Sí' : 'No',
      }));
      const filename = `Productos_${new Date().toISOString().split('T')[0]}`;
      if (format === 'pdf') {
        generatePDF('Catálogo de Productos', exportData as Record<string, unknown>[], `${filename}.pdf`);
      } else if (format === 'excel') {
        generateXLSX(exportData as Record<string, unknown>[], 'Productos').then((blob) => {
          downloadFile(blob, `${filename}.xlsx`);
        });
      } else {
        const csvContent = generateCSV(exportData as Record<string, unknown>[], true);
        downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
      }
    },
    [products],
  );

  const isMobile = useMediaQuery('(max-width: 768px)');

  // --- Desktop row ---
  const rowMarkup = filteredProducts.map((product, index) => {
    const status = getProductStatus(product);
    const margin =
      product.costPrice > 0
        ? (((product.unitPrice - product.costPrice) / product.costPrice) * 100).toFixed(0)
        : null;
    const stockTone =
      product.currentStock === 0 ? 'critical' : product.currentStock <= product.minStock ? 'caution' : undefined;

    return (
      <IndexTable.Row
        id={product.id}
        key={product.id}
        position={index}
        selected={selectedResources.includes(product.id)}
        onClick={() => onProductClick?.(product)}
      >
        <IndexTable.Cell>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <OptimizedImage source={product.imageUrl} alt={product.name} size="small" />
            <BlockStack gap="050">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {product.name}
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                {product.sku || '—'}
              </Text>
            </BlockStack>
          </InlineStack>
        </IndexTable.Cell>

        <IndexTable.Cell>{getStatusBadge(status)}</IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" tone={stockTone} fontWeight={product.currentStock === 0 ? 'semibold' : undefined}>
            {product.currentStock}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {' '}/ {product.minStock} mín.
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <BlockStack gap="050">
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {formatCurrency(product.unitPrice)}
              </Text>
            </span>
            {margin && (
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                <Text as="span" variant="bodySm" tone="subdued">
                  {margin}% margen
                </Text>
              </span>
            )}
          </BlockStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {product.category || '—'}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  // --- Mobile item ---
  const renderMobileItem = useCallback(
    (product: Product) => {
      const status = getProductStatus(product);
      const media = product.imageUrl ? (
        <Thumbnail source={product.imageUrl} alt={product.name} size="small" />
      ) : (
        <Thumbnail source={ImageIcon} alt={product.name} size="small" />
      );

      return (
        <ResourceItem
          id={product.id}
          media={media}
          onClick={() => onProductClick?.(product)}
          accessibilityLabel={`Ver ${product.name}`}
          verticalAlignment="center"
        >
          <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
            <BlockStack gap="050">
              <Text as="p" variant="bodyMd" fontWeight="semibold" truncate>
                {product.name}
              </Text>
              <InlineStack gap="200" blockAlign="center">
                {getStatusBadge(status)}
                <Text as="span" variant="bodySm" tone="subdued">
                  {product.category}
                </Text>
              </InlineStack>
            </BlockStack>
            <BlockStack gap="050" inlineAlign="end">
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {formatCurrency(product.unitPrice)}
                </Text>
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                <Text
                  as="span"
                  variant="bodySm"
                  tone={product.currentStock === 0 ? 'critical' : 'subdued'}
                >
                  {product.currentStock} uds
                </Text>
              </span>
            </BlockStack>
          </InlineStack>
        </ResourceItem>
      );
    },
    [onProductClick],
  );

  const emptyState = (
    <EmptySearchResult
      title="No se encontraron productos"
      description="Intenta con otro término de búsqueda o cambia los filtros."
      withIllustration
    />
  );

  return (
    <BlockStack gap="400">
      <Card padding="0">
        <IndexFilters
          sortOptions={sortOptions}
          sortSelected={sortSelected}
          queryValue={queryValue}
          queryPlaceholder="Buscar por nombre, SKU, código o categoría..."
          onQueryChange={setQueryValue}
          onQueryClear={() => setQueryValue('')}
          onSort={setSortSelected}
          cancelAction={{ onAction: () => {}, disabled: false, loading: false }}
          tabs={tabs}
          selected={selected}
          onSelect={setSelected}
          mode={mode}
          setMode={setMode}
          filters={[]}
          appliedFilters={[]}
          onClearAll={() => {}}
        />

        {isMobile ? (
          filteredProducts.length === 0 ? (
            <Box padding="600">{emptyState}</Box>
          ) : (
            <ResourceList
              resourceName={resourceName}
              items={filteredProducts}
              renderItem={renderMobileItem}
              totalItemsCount={filteredProducts.length}
              selectable
              selectedItems={selectedResources}
              onSelectionChange={(ids) => handleSelectionChange('single' as never, false, ids as never)}
              promotedBulkActions={promotedBulkActions}
              bulkActions={bulkActions}
            />
          )
        ) : (
          <IndexTable
            resourceName={resourceName}
            itemCount={filteredProducts.length}
            selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: 'Producto' },
              { title: 'Estado' },
              { title: 'Inventario', alignment: 'start' },
              { title: 'Precio', alignment: 'start' },
              { title: 'Categoría' },
            ]}
            promotedBulkActions={promotedBulkActions}
            bulkActions={bulkActions}
            emptyState={emptyState}
          >
            {rowMarkup}
          </IndexTable>
        )}
      </Card>

      <ProductExportModal open={exportOpen} onClose={onExportClose} onExport={handleExport} />
      <ProductImportModal open={importOpen} onClose={onImportClose} onImportSuccess={onImportSuccess} />
    </BlockStack>
  );
}
