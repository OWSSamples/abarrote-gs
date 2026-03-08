'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Frame,
  Page,
  Layout,
  Card,
  Banner,
  SkeletonPage,
  SkeletonDisplayText,
  SkeletonBodyText,
  BlockStack,
  InlineStack,
  Button,
  Text,
  Modal,
  FormLayout,
  TextField,
  IndexTable,
  Badge,
  EmptyState,
  Loading,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import {
  MoneyIcon,
  InventoryIcon,
  CalendarIcon,
  CartIcon,
  ExportIcon,
  RefreshIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { KPICard } from '@/components/kpi/KPICard';
import { SalesChart } from '@/components/charts/SalesChart';
import { HourlySalesChart } from '@/components/charts/HourlySalesChart';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { AllProductsTable } from '@/components/inventory/AllProductsTable';
import { InventoryAuditView } from '@/components/inventory/InventoryAuditView';
import { QuickActions } from '@/components/actions/QuickActions';
import { AdvancedFilters, FilterState } from '@/components/filters/AdvancedFilters';
import { TopProducts } from '@/components/metrics/TopProducts';
import { ExportModal, exportDashboardData } from '@/components/export/ExportModal';
import { ProductDetailModal } from '@/components/modals/ProductDetailModal';
import { RegisterProductModal } from '@/components/modals/RegisterProductModal';
import { SalesHistory } from '@/components/sales/SalesHistory';
import { CorteCajaModal, CortesHistory } from '@/components/caja/CorteCajaModal';
import { FiadoManager } from '@/components/fiado/FiadoManager';
import { GastosManager } from '@/components/gastos/GastosManager';
import { ProveedoresManager } from '@/components/suppliers/ProveedoresManager';
import { PedidosManager } from '@/components/pedidos/PedidosManager';
import { ReportesView } from '@/components/reports/ReportesView';
import { ConfiguracionPage } from '@/components/settings/ConfiguracionPage';
import { RolesManager } from '@/components/roles/RolesManager';
import { SidebarNav } from '@/components/navigation/SidebarNav';
import { Product, PermissionKey } from '@/types';
import { useToast } from '@/components/notifications/ToastProvider';
import { CustomTopBar } from '@/components/navigation/CustomTopBar';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { UserMenu } from '@/components/auth/UserMenu';
import { deleteProduct, updateProduct } from '@/app/actions/db-actions';

const SECTION_PERMISSIONS: Record<string, PermissionKey[]> = {
  overview: ['dashboard.view'],
  sales: ['sales.create', 'sales.view'],
  'sales-history': ['sales.view'],
  'sales-corte': ['corte.create', 'corte.view'],
  inventory: ['inventory.view'],
  'inventory-audit': ['inventory.view'],
  catalog: ['inventory.view'],
  customers: ['customers.view'],
  fiado: ['fiado.view', 'fiado.create'],
  expenses: ['expenses.view'],
  suppliers: ['suppliers.view'],
  pedidos: ['pedidos.view'],
  analytics: ['analytics.view'],
  reports: ['reports.view'],
  settings: ['settings.view'],
  roles: ['roles.manage'],
  notifications: ['dashboard.view'],
  'inventory-priority': ['inventory.view'],
};

const SECTION_TITLES: Record<string, string> = {
  overview: 'Inicio',
  sales: 'Ventas',
  'sales-history': 'Historial de Ventas',
  'sales-corte': 'Corte de Caja',
  inventory: 'Inventario',
  'inventory-audit': 'Auditoría de Inventario',
  catalog: 'Catálogo de Productos',
  customers: 'Clientes',
  fiado: 'Fiado / Crédito',
  expenses: 'Gastos',
  suppliers: 'Proveedores',
  pedidos: 'Pedidos a Proveedores',
  analytics: 'Análisis',
  reports: 'Reportes',
  settings: 'Configuración',
  roles: 'Usuarios y Roles',
  notifications: 'Notificaciones',
  'inventory-priority': 'Inventario Prioritario',
};

export function DashboardHome() {
  const {
    kpiData,
    inventoryAlerts,
    products,
    salesData,
    isLoading,
    error,
    fetchDashboardData,
    adjustStock,
    createPedido,
    currentUserRole,
    roleDefinitions,
  } = useDashboardStore();

  const userPermissions = currentUserRole
    ? roleDefinitions.find((r) => r.id === currentUserRole.roleId)?.permissions || []
    : [];

  const toast = useToast();

  const [selectedSection, setSelectedSection] = useState('overview');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [corteModalOpen, setCorteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [mobileNavActive, setMobileNavActive] = useState(false);
  const [registerProductOpen, setRegisterProductOpen] = useState(false);
  const [pedidoModalOpen, setPedidoModalOpen] = useState(false);
  const [pedidoProveedor, setPedidoProveedor] = useState('');
  const [pedidoNotas, setPedidoNotas] = useState('');
  const [updateProductOpen, setUpdateProductOpen] = useState(false);
  const [productToUpdate, setProductToUpdate] = useState<Product | null>(null);
  const [updateStock, setUpdateStock] = useState('');
  const [updatePrice, setUpdatePrice] = useState('');
  const [updateCostPrice, setUpdateCostPrice] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    categories: [],
    alertTypes: [],
    stockStatus: [],
    dateRange: null,
  });

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  const handleExport = useCallback((options: Parameters<typeof exportDashboardData>[0]) => {
    const exportData = {
      inventory: inventoryAlerts.map(a => a.product),
      lowStock: inventoryAlerts.filter(a => a.alertType === 'low_stock').map(a => a.product),
      expiring: inventoryAlerts.filter(a => a.alertType === 'expiration').map(a => a.product),
      dailySales: salesData,
    };
    exportDashboardData(options, exportData);
  }, [inventoryAlerts, salesData]);

  const handleProductClick = useCallback((product: Product) => {
    setSelectedProduct(product);
    setProductModalOpen(true);
  }, []);

  const filteredAlerts = inventoryAlerts.filter((alert) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        alert.product.name.toLowerCase().includes(searchLower) ||
        alert.product.sku.toLowerCase().includes(searchLower) ||
        alert.product.category.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    if (filters.alertTypes.length > 0 && !filters.alertTypes.includes(alert.alertType)) {
      return false;
    }
    if (filters.categories.length > 0) {
      const productCategoryKey = alert.product.category.toLowerCase();
      if (!filters.categories.includes(productCategoryKey)) return false;
    }
    return true;
  });

  const handleProductSave = useCallback(async (product: Product, changes: { newStock?: number; reason?: string }) => {
    if (changes.newStock !== undefined && changes.reason) {
      await adjustStock(product.id, changes.newStock, changes.reason);
      toast.showSuccess(`Stock de ${product.name} actualizado a ${changes.newStock} unidades`);
    }
  }, [adjustStock, toast]);

  const handleTableExport = useCallback(() => {
    setExportModalOpen(true);
  }, []);

  const handleTableCreatePedido = useCallback(() => {
    setPedidoModalOpen(true);
  }, []);

  const handleDeleteProduct = useCallback(async (product: Product) => {
    if (confirm(`¿Estás seguro de eliminar "${product.name}"?`)) {
      try {
        await deleteProduct(product.id);
        toast.showSuccess(`Producto "${product.name}" eliminado`);
        fetchDashboardData();
      } catch (error) {
        toast.showError('Error al eliminar el producto');
      }
    }
  }, [toast, fetchDashboardData]);

  const handleOpenUpdateProduct = useCallback((product: Product) => {
    setProductToUpdate(product);
    setUpdateStock(product.currentStock.toString());
    setUpdatePrice(product.unitPrice.toString());
    setUpdateCostPrice(product.costPrice.toString());
    setUpdateProductOpen(true);
  }, []);

  const handleUpdateProductSubmit = useCallback(async () => {
    if (!productToUpdate) return;
    try {
      await updateProduct(productToUpdate.id, {
        currentStock: parseInt(updateStock, 10) || productToUpdate.currentStock,
        unitPrice: parseFloat(updatePrice) || productToUpdate.unitPrice,
        costPrice: parseFloat(updateCostPrice) || productToUpdate.costPrice,
      });
      toast.showSuccess(`Producto "${productToUpdate.name}" actualizado`);
      setUpdateProductOpen(false);
      setProductToUpdate(null);
      fetchDashboardData();
    } catch (error) {
      toast.showError('Error al actualizar el producto');
    }
  }, [productToUpdate, updateStock, updatePrice, updateCostPrice, toast, fetchDashboardData]);

  const lowStockProducts = inventoryAlerts
    .filter((a) => a.alertType === 'low_stock' || a.product.currentStock < a.product.minStock)
    .map((a) => ({
      productId: a.product.id,
      productName: a.product.name,
      currentStock: a.product.currentStock,
      minStock: a.product.minStock,
      cantidad: Math.max(a.product.minStock - a.product.currentStock, 0),
    }));

  const handlePedidoSubmit = useCallback(async () => {
    if (!pedidoProveedor) return;
    await createPedido({
      proveedor: pedidoProveedor,
      productos: lowStockProducts.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        cantidad: p.cantidad,
      })),
      notas: pedidoNotas,
    });
    toast.showSuccess(`Pedido creado para ${pedidoProveedor}`);
    setPedidoModalOpen(false);
    setPedidoProveedor('');
    setPedidoNotas('');
  }, [pedidoProveedor, pedidoNotas, lowStockProducts, createPedido, toast]);

  const proveedorOptions = [
    { label: 'Seleccionar proveedor...', value: '' },
    { label: 'Distribuidora García', value: 'Distribuidora García' },
    { label: 'Proveedor General', value: 'Proveedor General' },
  ];

  const toggleMobileNav = useCallback(() => {
    setMobileNavActive((prev) => !prev);
  }, []);

  const handleSectionSelect = useCallback((section: string) => {
    setSelectedSection(section);
    setMobileNavActive(false);
  }, []);

  const criticalAlerts = inventoryAlerts.filter(
    (alert) => alert.severity === 'critical'
  );

  const topBarMarkup = (
    <CustomTopBar userMenu={<UserMenu />} onNavigationToggle={toggleMobileNav} />
  );

  const navigationMarkup = (
    <SidebarNav
      selected={selectedSection}
      onSelect={handleSectionSelect}
      badges={{
        lowStock: kpiData?.lowStockProducts,
        notifications: criticalAlerts.length,
      }}
      permissions={userPermissions}
    />
  );

  const renderSectionContent = () => {
    const requiredPerms = SECTION_PERMISSIONS[selectedSection];
    if (requiredPerms && currentUserRole) {
      const hasPerm = requiredPerms.some((p) => userPermissions.includes(p));
      if (!hasPerm) {
        return (
          <Page title="Acceso Denegado">
            <Banner tone="critical" title="No tienes permiso">
              <p>Contacta a un administrador.</p>
            </Banner>
          </Page>
        );
      }
    }

    switch (selectedSection) {
      case 'overview':
        return (
          <BlockStack gap="400">
            <QuickActions />
            <Layout>
              <Layout.Section variant="oneHalf">
                <SalesChart data={salesData} />
              </Layout.Section>
              <Layout.Section variant="oneHalf">
                <HourlySalesChart />
              </Layout.Section>
            </Layout>
            <Layout>
              <Layout.Section variant="oneHalf">
                <InventoryTable alerts={filteredAlerts} onProductClick={handleProductClick} />
              </Layout.Section>
              <Layout.Section variant="oneHalf">
                <TopProducts />
              </Layout.Section>
            </Layout>
          </BlockStack>
        );
      case 'sales':
        return (
          <BlockStack gap="400">
            <QuickActions />
            <SalesHistory />
          </BlockStack>
        );
      case 'sales-history': return <SalesHistory />;
      case 'sales-corte':
        return (
          <BlockStack gap="400">
            <InlineStack align="end"><Button variant="primary" onClick={() => setCorteModalOpen(true)}>Nuevo Corte de Caja</Button></InlineStack>
            <CortesHistory />
          </BlockStack>
        );
      case 'inventory':
        return (
          <BlockStack gap="400">
            <AdvancedFilters onFiltersChange={handleFiltersChange} />
            <InventoryTable alerts={filteredAlerts} onProductClick={handleProductClick} />
            <AllProductsTable products={products} onProductClick={handleProductClick} onRegisterProduct={() => setRegisterProductOpen(true)} onExport={handleTableExport} onCreatePedido={handleTableCreatePedido} onDeleteProduct={handleDeleteProduct} onUpdateProduct={handleOpenUpdateProduct} />
          </BlockStack>
        );
      case 'inventory-audit': return <InventoryAuditView />;
      case 'catalog':
        return <AllProductsTable products={products} onProductClick={handleProductClick} onRegisterProduct={() => setRegisterProductOpen(true)} onExport={handleTableExport} onCreatePedido={handleTableCreatePedido} onDeleteProduct={handleDeleteProduct} onUpdateProduct={handleOpenUpdateProduct} />;
      case 'inventory-priority':
        return (
          <BlockStack gap="400">
            <InventoryTable alerts={inventoryAlerts} onProductClick={handleProductClick} />
          </BlockStack>
        );
      case 'customers':
      case 'fiado':
        return <FiadoManager />;
      case 'expenses': return <GastosManager />;
      case 'suppliers': return <ProveedoresManager />;
      case 'pedidos': return <PedidosManager />;
      case 'analytics': return <AnalyticsView />;
      case 'reports': return <ReportesView />;
      case 'settings': return <ConfiguracionPage />;
      case 'roles': return <RolesManager />;
      case 'notifications':
        return (
          <BlockStack gap="400">
            {criticalAlerts.length > 0 ? (
              <InventoryTable alerts={criticalAlerts} onProductClick={handleProductClick} />
            ) : (
              <Card><EmptyState heading="Sin notificaciones" image=""><p>Todo está en orden.</p></EmptyState></Card>
            )}
          </BlockStack>
        );
      default: return null;
    }
  };

  const wrapWithPage = (content: React.ReactNode) => {
    return (
      <Page
        fullWidth
        title={SECTION_TITLES[selectedSection] || 'Dashboard'}
        secondaryActions={[
          { content: 'Actualizar', icon: RefreshIcon, onAction: fetchDashboardData },
          { content: 'Exportar', icon: ExportIcon, onAction: () => setExportModalOpen(true) },
        ]}
      >
        <Layout>
          {selectedSection === 'overview' && (
            <Layout.Section>
              <InlineStack gap="400" wrap={true}>
                <div style={{ flex: '1 1 240px' }}><KPICard title="Ventas Hoy" value={kpiData?.dailySales || 0} type="currency" icon={<MoneyIcon />} /></div>
                <div style={{ flex: '1 1 240px' }}><KPICard title="Stock Bajo" value={kpiData?.lowStockProducts || 0} type="number" icon={<InventoryIcon />} /></div>
                <div style={{ flex: '1 1 240px' }}><KPICard title="Por Vencer" value={kpiData?.expiringProducts || 0} type="number" icon={<CalendarIcon />} /></div>
                <div style={{ flex: '1 1 240px' }}><KPICard title="Tasa Merma" value={kpiData?.mermaRate || 0} type="percentage" icon={<CartIcon />} /></div>
              </InlineStack>
            </Layout.Section>
          )}
          <Layout.Section>{content}</Layout.Section>
        </Layout>
      </Page>
    );
  };

  const finalContent = () => {
    const content = renderSectionContent();
    const section = selectedSection;
    // Sections that already return a <Page> - do NOT wrap
    if (['customers', 'fiado', 'analytics', 'settings'].includes(section)) {
      return content;
    }
    return wrapWithPage(content);
  };

  return (
    <>
      {topBarMarkup}
      <Frame navigation={navigationMarkup} showMobileNavigation={mobileNavActive} onNavigationDismiss={toggleMobileNav}>
        {isLoading && <Loading />}
        {error ? (
          <Page title="Error" fullWidth><Banner tone="critical" title="Error"><p>{error}</p><Button onClick={() => window.location.reload()}>Reintentar</Button></Banner></Page>
        ) : isLoading ? (
          <SkeletonPage title={SECTION_TITLES[selectedSection] || 'Dashboard'} fullWidth><Layout><Layout.Section><SkeletonBodyText lines={10} /></Layout.Section></Layout></SkeletonPage>
        ) : (
          finalContent()
        )}
        <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} onExport={handleExport} />
        <CorteCajaModal open={corteModalOpen} onClose={() => setCorteModalOpen(false)} />
        <ProductDetailModal product={selectedProduct} open={productModalOpen} onClose={() => { setProductModalOpen(false); setSelectedProduct(null); }} onSave={handleProductSave} />
        <RegisterProductModal open={registerProductOpen} onClose={() => setRegisterProductOpen(false)} />
        <Modal open={updateProductOpen} onClose={() => { setUpdateProductOpen(false); setProductToUpdate(null); }} title={productToUpdate ? `Actualizar ${productToUpdate.name}` : 'Actualizar Producto'} primaryAction={{ content: 'Guardar Cambios', onAction: handleUpdateProductSubmit }} secondaryActions={[{ content: 'Cancelar', onAction: () => { setUpdateProductOpen(false); setProductToUpdate(null); } }]}>
          <Modal.Section><FormLayout><TextField label="Stock Actual" type="number" value={updateStock} onChange={setUpdateStock} autoComplete="off" /><TextField label="Precio Venta" type="number" value={updatePrice} onChange={setUpdatePrice} autoComplete="off" prefix="$" /><TextField label="Precio Costo" type="number" value={updateCostPrice} onChange={setUpdateCostPrice} autoComplete="off" prefix="$" /></FormLayout></Modal.Section>
        </Modal>
        <Modal open={pedidoModalOpen} onClose={() => { setPedidoModalOpen(false); setPedidoProveedor(''); setPedidoNotas(''); }} title="Crear Pedido" primaryAction={{ content: 'Crear Pedido', onAction: handlePedidoSubmit, disabled: !pedidoProveedor || lowStockProducts.length === 0 }} secondaryActions={[{ content: 'Cancelar', onAction: () => { setPedidoModalOpen(false); setPedidoProveedor(''); setPedidoNotas(''); } }]} size="large">
          <Modal.Section><BlockStack gap="400"><FormLayout><FormSelect label="Proveedor" options={proveedorOptions} value={pedidoProveedor} onChange={setPedidoProveedor} /><TextField label="Notas" value={pedidoNotas} onChange={setPedidoNotas} multiline={3} autoComplete="off" /></FormLayout></BlockStack></Modal.Section>
        </Modal>
      </Frame >
    </>
  );
}
