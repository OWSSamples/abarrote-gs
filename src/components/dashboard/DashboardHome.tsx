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
  TopBar,
  Text,
  Modal,
  FormLayout,
  TextField,
  IndexTable,
  Badge,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import {
  MoneyIcon,
  InventoryIcon,
  CalendarIcon,
  CartIcon,
  ExportIcon,
  RefreshIcon,
  ProductIcon,
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
import { SidebarNav } from '@/components/navigation/SidebarNav';
import { Product } from '@/types';
import { useToast } from '@/components/notifications/ToastProvider';
import { CustomTopBar } from '@/components/navigation/CustomTopBar';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { UserMenu } from '@/components/auth/UserMenu';
import { deleteProduct, updateProduct } from '@/app/actions/db-actions';

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
};

const SECTION_SUBTITLES: Record<string, string> = {
  overview: 'Resumen de tu negocio',
  sales: 'Punto de venta y registro',
  'sales-history': 'Registro de todas las ventas',
  'sales-corte': 'Cierre y conteo de caja',
  inventory: 'Control de existencias',
  'inventory-audit': 'Revisión y conteo ciego de stock',
  catalog: 'Todos los productos registrados',
  customers: 'Directorio de clientes',
  fiado: 'Gestión de crédito a clientes',
  expenses: 'Control de gastos del negocio',
  suppliers: 'Directorio de proveedores',
  pedidos: 'Gestión de pedidos y recepción de mercancía',
  analytics: 'Gráficas y tendencias',
  reports: 'Resúmenes y métricas',
  settings: 'Configuración del sistema',
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
  } = useDashboardStore();

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

  // Filtrar alertas basado en los filtros
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
      const categoryMap: Record<string, string> = {
        'Lácteos': 'lacteos',
        'Panadería': 'panaderia',
        'Carnes y Embutidos': 'carnes',
        'Frutas y Verduras': 'frutas',
        'Abarrotes Secos': 'abarrotes',
        'Bebidas': 'bebidas',
        'Limpieza': 'limpieza',
        'Higiene Personal': 'higiene',
        'Huevos': 'huevos',
        'Tortillería': 'tortilleria',
      };
      const productCategoryKey = categoryMap[alert.product.category] || alert.product.category.toLowerCase();
      if (!filters.categories.includes(productCategoryKey)) return false;
    }
    if (filters.stockStatus.length > 0) {
      const pct = alert.product.minStock > 0
        ? (alert.product.currentStock / alert.product.minStock) * 100
        : 100;
      const status = pct <= 25 ? 'critical' : pct <= 50 ? 'warning' : 'normal';
      if (!filters.stockStatus.includes(status)) return false;
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

    toast.showSuccess(`Pedido creado para ${pedidoProveedor} con ${lowStockProducts.length} productos`);
    setPedidoModalOpen(false);
    setPedidoProveedor('');
    setPedidoNotas('');
  }, [pedidoProveedor, pedidoNotas, lowStockProducts, createPedido, toast]);

  const proveedorOptions = [
    { label: 'Seleccionar proveedor...', value: '' },
    { label: 'Distribuidora García', value: 'Distribuidora García' },
    { label: 'Abarrotes Mayoreo MX', value: 'Abarrotes Mayoreo MX' },
    { label: 'Lácteos del Norte', value: 'Lácteos del Norte' },
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
    <CustomTopBar userMenu={<UserMenu />} />
  );

  const navigationMarkup = (
    <SidebarNav
      selected={selectedSection}
      onSelect={handleSectionSelect}
      badges={{
        lowStock: kpiData?.lowStockProducts,
      }}
    />
  );

  const renderSectionContent = () => {
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
                <InventoryTable
                  alerts={filteredAlerts}
                  onProductClick={handleProductClick}
                />
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

      case 'sales-history':
        return <SalesHistory />;

      case 'sales-corte':
        return (
          <BlockStack gap="400">
            <InlineStack align="end">
              <Button variant="primary" onClick={() => setCorteModalOpen(true)}>
                Nuevo Corte de Caja
              </Button>
            </InlineStack>
            <CortesHistory />
          </BlockStack>
        );

      case 'inventory':
        return (
          <BlockStack gap="400">
            <AdvancedFilters onFiltersChange={handleFiltersChange} />
            <InventoryTable
              alerts={filteredAlerts}
              onProductClick={handleProductClick}
            />
            <AllProductsTable
              products={products}
              onProductClick={handleProductClick}
              onRegisterProduct={() => setRegisterProductOpen(true)}
              onExport={handleTableExport}
              onCreatePedido={handleTableCreatePedido}
              onDeleteProduct={handleDeleteProduct}
              onUpdateProduct={handleOpenUpdateProduct}
            />
          </BlockStack>
        );

      case 'inventory-audit':
        return <InventoryAuditView />;

      case 'catalog':
        return (
          <BlockStack gap="400">
            <AllProductsTable
              products={products}
              onProductClick={handleProductClick}
              onRegisterProduct={() => setRegisterProductOpen(true)}
              onExport={handleTableExport}
              onCreatePedido={handleTableCreatePedido}
              onDeleteProduct={handleDeleteProduct}
              onUpdateProduct={handleOpenUpdateProduct}
            />
          </BlockStack>
        );

      case 'customers':
        return <FiadoManager />;

      case 'fiado':
        return <FiadoManager />;

      case 'expenses':
        return <GastosManager />;

      case 'suppliers':
        return <ProveedoresManager />;

      case 'pedidos':
        return <PedidosManager />;

      case 'analytics':
        return <AnalyticsView />;

      case 'reports':
        return <ReportesView />;

      case 'settings':
        return <ConfiguracionPage />;

      default:
        return null;
    }
  };

  return (
    <>
      {topBarMarkup}
      <Frame
        navigation={navigationMarkup}
        showMobileNavigation={mobileNavActive}
        onNavigationDismiss={toggleMobileNav}
      >
        {error ? (
          <Page title="Error">
            <Banner tone="critical" title="Error al cargar el dashboard">
              <p>{error}</p>
              <Button onClick={() => window.location.reload()}>Reintentar</Button>
            </Banner>
          </Page>
        ) : isLoading ? (
          <SkeletonPage
            title={SECTION_TITLES[selectedSection] || 'Dashboard'}
            primaryAction
          >
            <Layout>
              <Layout.Section>
                <InlineStack gap="400" wrap={true}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{ flex: '1 1 220px', minWidth: 220 }}>
                      <Card>
                        <BlockStack gap="200">
                          <SkeletonDisplayText size="small" />
                          <SkeletonDisplayText size="large" />
                        </BlockStack>
                      </Card>
                    </div>
                  ))}
                </InlineStack>
              </Layout.Section>

              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <SkeletonDisplayText size="small" />
                    <SkeletonBodyText lines={4} />
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section variant="oneHalf">
                <Card>
                  <BlockStack gap="400">
                    <SkeletonDisplayText size="small" />
                    <SkeletonBodyText lines={10} />
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section variant="oneHalf">
                <Card>
                  <BlockStack gap="400">
                    <SkeletonDisplayText size="small" />
                    <SkeletonBodyText lines={10} />
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </SkeletonPage>
        ) : (
          <Page
            title={SECTION_TITLES[selectedSection] || 'Dashboard'}
            subtitle={SECTION_SUBTITLES[selectedSection] || 'Gestión de abarrotes'}
            primaryAction={{
              content: 'Actualizar',
              icon: RefreshIcon,
              onAction: fetchDashboardData,
            }}
            secondaryActions={[
              {
                content: 'Exportar',
                icon: ExportIcon,
                onAction: () => setExportModalOpen(true),
              },
            ]}
          >
            <Layout>
              {criticalAlerts.length > 0 && (
                <Layout.Section>
                  <Banner
                    tone="critical"
                    title={`${criticalAlerts.length} productos requieren atención inmediata`}
                  >
                    <p>
                      Tienes productos críticos por vencimiento o stock muy bajo.
                      Revisa la sección de Inventario.
                    </p>
                  </Banner>
                </Layout.Section>
              )}

              {selectedSection === 'overview' && (
                <Layout.Section>
                  <InlineStack gap="400" wrap={true}>
                    <div style={{ flex: '1 1 220px', minWidth: 220 }}>
                      <KPICard
                        title="Ventas del Día"
                        value={kpiData?.dailySales || 0}
                        type="currency"
                        change={kpiData?.dailySalesChange}
                        changeLabel="vs ayer"
                        icon={<MoneyIcon />}
                      />
                    </div>
                    <div style={{ flex: '1 1 220px', minWidth: 220 }}>
                      <KPICard
                        title="Productos Stock Bajo"
                        value={kpiData?.lowStockProducts || 0}
                        type="number"
                        icon={<InventoryIcon />}
                      />
                    </div>
                    <div style={{ flex: '1 1 220px', minWidth: 220 }}>
                      <KPICard
                        title="Productos por Vencer"
                        value={kpiData?.expiringProducts || 0}
                        type="number"
                        icon={<CalendarIcon />}
                      />
                    </div>
                    <div style={{ flex: '1 1 220px', minWidth: 220 }}>
                      <KPICard
                        title="Tasa de Merma"
                        value={kpiData?.mermaRate || 0}
                        type="percentage"
                        change={kpiData?.mermaRateChange}
                        changeLabel="vs mes anterior"
                        icon={<CartIcon />}
                      />
                    </div>
                  </InlineStack>
                </Layout.Section>
              )}

              <Layout.Section>
                {renderSectionContent()}
              </Layout.Section>
            </Layout>
          </Page>
        )}

        <ExportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          onExport={handleExport}
        />
        <CorteCajaModal
          open={corteModalOpen}
          onClose={() => setCorteModalOpen(false)}
        />
        <ProductDetailModal
          product={selectedProduct}
          open={productModalOpen}
          onClose={() => {
            setProductModalOpen(false);
            setSelectedProduct(null);
          }}
          onSave={handleProductSave}
        />
        <RegisterProductModal
          open={registerProductOpen}
          onClose={() => setRegisterProductOpen(false)}
        />

        {/* Modal para Actualizar Producto */}
        <Modal
          open={updateProductOpen}
          onClose={() => {
            setUpdateProductOpen(false);
            setProductToUpdate(null);
          }}
          title={productToUpdate ? `Actualizar ${productToUpdate.name}` : 'Actualizar Producto'}
          primaryAction={{
            content: 'Guardar Cambios',
            onAction: handleUpdateProductSubmit,
          }}
          secondaryActions={[
            {
              content: 'Cancelar',
              onAction: () => {
                setUpdateProductOpen(false);
                setProductToUpdate(null);
              },
            },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Stock Actual"
                type="number"
                value={updateStock}
                onChange={setUpdateStock}
                autoComplete="off"
                helpText="Cantidad actual en inventario"
              />
              <TextField
                label="Precio de Venta"
                type="number"
                value={updatePrice}
                onChange={setUpdatePrice}
                autoComplete="off"
                prefix="$"
                helpText="Precio al público"
              />
              <TextField
                label="Precio de Costo"
                type="number"
                value={updateCostPrice}
                onChange={setUpdateCostPrice}
                autoComplete="off"
                prefix="$"
                helpText="Precio de compra al proveedor"
              />
            </FormLayout>
          </Modal.Section>
        </Modal>

        {/* Modal para Crear Pedido a Proveedor */}
        <Modal
          open={pedidoModalOpen}
          onClose={() => {
            setPedidoModalOpen(false);
            setPedidoProveedor('');
            setPedidoNotas('');
          }}
          title="Crear Pedido a Proveedor"
          primaryAction={{
            content: 'Crear Pedido',
            onAction: handlePedidoSubmit,
            disabled: !pedidoProveedor || lowStockProducts.length === 0,
          }}
          secondaryActions={[
            {
              content: 'Cancelar',
              onAction: () => {
                setPedidoModalOpen(false);
                setPedidoProveedor('');
                setPedidoNotas('');
              },
            },
          ]}
          size="large"
        >
          <Modal.Section>
            <BlockStack gap="400">
              <FormLayout>
                <FormSelect
                  label="Proveedor"
                  options={proveedorOptions}
                  value={pedidoProveedor}
                  onChange={setPedidoProveedor}
                  helpText="Selecciona el proveedor al que se le hará el pedido"
                />
                <TextField
                  label="Notas adicionales"
                  value={pedidoNotas}
                  onChange={setPedidoNotas}
                  multiline={3}
                  autoComplete="off"
                  placeholder="Instrucciones especiales, urgencia, etc."
                />
              </FormLayout>

              {lowStockProducts.length > 0 ? (
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">
                      Productos con stock bajo
                    </Text>
                    <Badge tone="warning">{`${lowStockProducts.length} productos`}</Badge>
                  </InlineStack>
                  <IndexTable
                    itemCount={lowStockProducts.length}
                    headings={[
                      { title: 'Producto' },
                      { title: 'Stock actual' },
                      { title: 'Stock mínimo' },
                      { title: 'Cantidad a pedir' },
                    ]}
                    selectable={false}
                  >
                    {lowStockProducts.map((p, i) => (
                      <IndexTable.Row id={p.productId} key={p.productId} position={i}>
                        <IndexTable.Cell>
                          <Text as="p" variant="bodyMd" fontWeight="semibold">{p.productName}</Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="p" variant="bodyMd" tone="critical">{p.currentStock}</Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="p" variant="bodyMd">{p.minStock}</Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone="info">{`${p.cantidad} unidades`}</Badge>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                </BlockStack>
              ) : (
                <Banner tone="success">
                  <p>No hay productos con stock bajo en este momento.</p>
                </Banner>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      </Frame>
    </>
  );
}
