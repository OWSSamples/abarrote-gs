'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  Button,
  Thumbnail,
  IndexFilters,
  useSetIndexFiltersMode,
  IndexFiltersMode,
  TabProps,
  useIndexResourceState,
} from '@shopify/polaris';
import { ImageIcon } from '@shopify/polaris-icons';
import { Product } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ProductExportModal, ProductImportModal } from './ShopifyModals';
import { generateCSV, downloadFile } from '@/components/export/ExportModal';
import { generatePDF } from '@/components/export/generatePDF';

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

type ProductStatus = 'active' | 'draft' | 'archived';

function getProductStatus(product: Product): ProductStatus {
  if (product.currentStock === 0) return 'archived';
  if (!product.barcode && product.currentStock <= product.minStock) return 'draft';
  return 'active';
}

function getStatusBadge(status: ProductStatus) {
  switch (status) {
    case 'active':
      return <Badge tone="success">Activo</Badge>;
    case 'draft':
      return <Badge>Borrador</Badge>;
    case 'archived':
      return <Badge tone="info">Archivado</Badge>;
  }
}

function getInventoryText(product: Product) {
  if (product.currentStock === 0) {
    return (
      <Text as="p" variant="bodyMd" tone="critical">
        0 en stock
      </Text>
    );
  }
  return (
    <BlockStack gap="050">
      <Text as="p" variant="bodyMd">
        {product.currentStock} en stock
      </Text>
      <Text as="p" variant="bodySm" tone="subdued">
        en 1 ubicación
      </Text>
    </BlockStack>
  );
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
  const tabLabels = ['Todos', 'Activos', 'Borradores', 'Archivados'];

  const tabs: TabProps[] = tabLabels.map((label, index) => ({
    content: label,
    index,
    onAction: () => {},
    id: `${label}-${index}`,
    isLocked: index === 0,
  }));

  // --- Sorting ---
  const [sortSelected, setSortSelected] = useState(['product asc']);
  const sortOptions = [
    { label: 'Producto', value: 'product asc' as const, directionLabel: 'A-Z' },
    { label: 'Producto', value: 'product desc' as const, directionLabel: 'Z-A' },
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

    // Tab filter
    if (selected === 1) result = result.filter((p) => getProductStatus(p) === 'active');
    else if (selected === 2) result = result.filter((p) => getProductStatus(p) === 'draft');
    else if (selected === 3) result = result.filter((p) => getProductStatus(p) === 'archived');

    // Search filter
    if (queryValue) {
      const q = queryValue.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    // Sort
    const [sortKey, sortDir] = sortSelected[0].split(' ');
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'product') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'inventory') cmp = a.currentStock - b.currentStock;
      else if (sortKey === 'category') cmp = a.category.localeCompare(b.category);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [products, selected, queryValue, sortSelected]);

  // --- Resource selection ---
  const resourceName = { singular: 'producto', plural: 'productos' };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(filteredProducts as any);

  // --- Promoted bulk actions ---
  const selectedProducts = filteredProducts.filter((p) => selectedResources.includes(p.id));

  const promotedBulkActions = [
    {
      content: 'Editar seleccionados',
      onAction: () => {
        if (selectedProducts.length === 1) {
          onUpdateProduct?.(selectedProducts[0]);
        }
      },
      disabled: selectedProducts.length !== 1,
    },
  ];
  const bulkActions = [
    {
      content: `Eliminar ${selectedProducts.length} producto${selectedProducts.length === 1 ? '' : 's'}`,
      destructive: true,
      onAction: () => {
        if (selectedProducts.length > 0) {
          onDeleteProducts?.(selectedProducts);
        }
      },
    },
  ];

  // --- Export handler ---
  const handleExport = useCallback(
    (format: string) => {
      const exportData = filteredProducts.map((p) => ({
        'Nombre Corto': p.name,
        SKU: p.sku,
        'Código de Barras': p.barcode,
        Categoría: p.category,
        'Inventario Actual': p.currentStock,
        'Inventario Mínimo': p.minStock,
        'Costo Inicial': p.costPrice,
        'Precio Público': p.unitPrice,
        Vencimiento: p.expirationDate ? formatDate(p.expirationDate) : 'N/A',
      }));

      const filename = `Inventario_Productos_${new Date().toISOString().split('T')[0]}`;

      if (format === 'pdf') {
        generatePDF(
          'Reporte de Inventario Kiosco',
          exportData as Record<string, unknown>[],
          `${filename}.pdf`
        );
      } else {
        const csvContent = generateCSV(exportData as Record<string, unknown>[], true);
        const mime =
          format === 'csv'
            ? 'text/csv;charset=utf-8;'
            : 'application/vnd.ms-excel;charset=utf-8;';
        downloadFile(csvContent, `${filename}.csv`, mime);
      }
    },
    [filteredProducts]
  );

  // --- Row markup ---
  const rowMarkup = filteredProducts.map((product, index) => {
    const status = getProductStatus(product);
    return (
      <IndexTable.Row
        id={product.id}
        key={product.id}
        position={index}
        selected={selectedResources.includes(product.id)}
        onClick={() => onProductClick?.(product)}
      >
        {/* Producto */}
        <IndexTable.Cell>
          <InlineStack gap="300" blockAlign="center">
            <Thumbnail
              size="small"
              source={product.imageUrl || ImageIcon}
              alt={product.name}
            />
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {product.name}
            </Text>
          </InlineStack>
        </IndexTable.Cell>

        {/* Estado */}
        <IndexTable.Cell>{getStatusBadge(status)}</IndexTable.Cell>

        {/* Inventario */}
        <IndexTable.Cell>{getInventoryText(product)}</IndexTable.Cell>

        {/* Categoría */}
        <IndexTable.Cell>
          <Text as="p" variant="bodyMd">
            {product.category}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <BlockStack gap="500">
      <Card padding="0">
        <IndexFilters
          sortOptions={sortOptions}
          sortSelected={sortSelected}
          queryValue={queryValue}
          queryPlaceholder="Buscar productos..."
          onQueryChange={setQueryValue}
          onQueryClear={() => setQueryValue('')}
          onSort={setSortSelected}
          cancelAction={{
            onAction: () => {},
            disabled: false,
            loading: false,
          }}
          tabs={tabs}
          selected={selected}
          onSelect={setSelected}
          mode={mode}
          setMode={setMode}
          filters={[]}
          appliedFilters={[]}
          onClearAll={() => {}}
        />

        <IndexTable
          resourceName={resourceName}
          itemCount={filteredProducts.length}
          selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          headings={[
            { title: 'Producto' },
            { title: 'Estado' },
            { title: 'Inventario' },
            { title: 'Categoría' },
          ]}
          promotedBulkActions={promotedBulkActions}
          bulkActions={bulkActions}
        >
          {rowMarkup}
        </IndexTable>
      </Card>

      <InlineStack align="center">
        <Button variant="monochromePlain">Más información sobre productos</Button>
      </InlineStack>

      {/* Export modal — controlled from parent */}
      <ProductExportModal
        open={exportOpen}
        onClose={onExportClose}
        onExport={handleExport}
      />

      {/* Import modal — controlled from parent */}
      <ProductImportModal
        open={importOpen}
        onClose={onImportClose}
        onImportSuccess={onImportSuccess}
      />
    </BlockStack>
  );
}
