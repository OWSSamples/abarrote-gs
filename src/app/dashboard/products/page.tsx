'use client';

import { useCallback, useState } from 'react';
import { Page, Badge, InlineStack, Text } from '@shopify/polaris';
import { 
  PlusIcon, 
  ExportIcon, 
  ImportIcon, 
  ViewIcon, 
  EmailIcon, 
  SettingsIcon,
  CollectionIcon 
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { AllProductsTable } from '@/components/inventory/AllProductsTable';
import { RegisterProductModal } from '@/components/modals/RegisterProductModal';
import { UpdateProductModal } from '@/components/modals/UpdateProductModal';
import { deleteProduct } from '@/app/actions/db-actions';
import { useToast } from '@/components/notifications/ToastProvider';
import { CategoryManagerModal } from '@/components/modals/CategoryManagerModal';
import { Product } from '@/types';

export default function ProductsPage() {
  const products = useDashboardStore((s) => s.products);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);
  const toast = useToast();

  const [registerProductOpen, setRegisterProductOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [updateProductOpen, setUpdateProductOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [productToUpdate, setProductToUpdate] = useState<Product | null>(null);

  const handleProductClick = useCallback((product: Product) => {
    setProductToUpdate(product);
    setUpdateProductOpen(true);
  }, []);

  const handleDeleteProducts = useCallback(async (productsToDelete: Product[]) => {
    const count = productsToDelete.length;
    const label = count === 1 ? `"${productsToDelete[0].name}"` : `${count} productos`;
    if (confirm(`¿Estás seguro de eliminar ${label}?`)) {
      try {
        await Promise.all(productsToDelete.map((p) => deleteProduct(p.id)));
        toast.showSuccess(`${count === 1 ? `Producto ${label}` : label} eliminado${count > 1 ? 's' : ''}`);
        fetchDashboardData();
      } catch {
        toast.showError('Error al eliminar productos');
      }
    }
  }, [toast, fetchDashboardData]);

  return (
    <>
      <Page
        fullWidth
        backAction={{ content: 'Dashboard', url: '/dashboard' }}
        title="Productos"
        titleMetadata={<Badge tone="info">{`${products.length} artículos`}</Badge>}
        subtitle="Listado general y control de inventario de toda la tienda."
        primaryAction={{
          content: 'Agregar producto',
          icon: PlusIcon,
          onAction: () => setRegisterProductOpen(true),
        }}
        secondaryActions={[
          { 
            content: 'Exportar', 
            icon: ExportIcon,
            onAction: () => setExportOpen(true) 
          },
          { 
            content: 'Importar', 
            icon: ImportIcon,
            onAction: () => setImportOpen(true) 
          },
          {
            content: 'Categorías',
            icon: CollectionIcon,
            onAction: () => setCategoryManagerOpen(true),
          },
        ]}
        actionGroups={[
          {
            title: 'Más herramientas',
            icon: SettingsIcon,
            actions: [
              { content: 'Análisis de ventas', icon: ViewIcon, onAction: () => {} },
              { content: 'Marketing masivo', icon: EmailIcon, onAction: () => {} },
            ],
          },
        ]}
      >
        <AllProductsTable
          products={products}
          onProductClick={handleProductClick}
          onDeleteProducts={handleDeleteProducts}
          onUpdateProduct={handleProductClick}
          exportOpen={exportOpen}
          onExportClose={() => setExportOpen(false)}
          importOpen={importOpen}
          onImportClose={() => setImportOpen(false)}
          onImportSuccess={fetchDashboardData}
        />
      </Page>

      <RegisterProductModal open={registerProductOpen} onClose={() => setRegisterProductOpen(false)} />

      <CategoryManagerModal open={categoryManagerOpen} onClose={() => setCategoryManagerOpen(false)} />

      <UpdateProductModal
        key={productToUpdate?.id || 'none'}
        open={updateProductOpen}
        onClose={() => {
          setUpdateProductOpen(false);
          setProductToUpdate(null);
        }}
        product={productToUpdate}
      />
    </>
  );
}
