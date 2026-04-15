'use client';

import { useCallback, useState } from 'react';
import { Page, Badge } from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import { InventoryGeneralView } from '@/components/inventory/InventoryGeneralView';
import { UpdateProductModal } from '@/components/modals/UpdateProductModal';
import { Product } from '@/types';

export default function InventoryPage() {
  const products = useDashboardStore((s) => s.products);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);

  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [updateProductOpen, setUpdateProductOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleProductClick = useCallback((product: Product) => {
    setSelectedProduct(product);
    setUpdateProductOpen(true);
  }, []);

  const lowStockCount = products.filter((p) => p.currentStock <= p.minStock && p.currentStock > 0).length;
  const outOfStockCount = products.filter((p) => p.currentStock === 0).length;

  return (
    <Page
      fullWidth
      backAction={{ content: 'Productos', url: '/dashboard/products' }}
      title="Inventario"
      titleMetadata={
        outOfStockCount > 0 ? (
          <Badge tone="critical">{`${outOfStockCount} agotados`}</Badge>
        ) : lowStockCount > 0 ? (
          <Badge tone="warning">{`${lowStockCount} stock bajo`}</Badge>
        ) : undefined
      }
      subtitle="Control de existencias, edición en línea y edición masiva de inventario."
      secondaryActions={[
        { content: 'Exportar', onAction: () => setExportOpen(true) },
        { content: 'Importar', onAction: () => setImportOpen(true) },
      ]}
    >
      <InventoryGeneralView
        products={products}
        onProductClick={handleProductClick}
        exportOpen={exportOpen}
        onExportClose={() => setExportOpen(false)}
        importOpen={importOpen}
        onImportClose={() => setImportOpen(false)}
        onImportSuccess={fetchDashboardData}
      />

      <UpdateProductModal
        open={updateProductOpen}
        onClose={() => {
          setUpdateProductOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
      />
    </Page>
  );
}
