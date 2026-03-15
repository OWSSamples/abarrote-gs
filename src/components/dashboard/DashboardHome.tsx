'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Frame,
  Page,
  Layout,
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
  Select,
  IndexTable,
  Badge,
  ActionList,
} from '@shopify/polaris';
import {
  MoneyIcon,
  InventoryIcon,
  CalendarIcon,
  CartIcon,
  ExportIcon,
  RefreshIcon,
  ProductIcon,
  SettingsIcon,
  ExitIcon,
  CashDollarIcon,
  PersonIcon,
} from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { KPICard } from '@/components/kpi/KPICard';
import { SalesChart } from '@/components/charts/SalesChart';
import { HourlySalesChart } from '@/components/charts/HourlySalesChart';
import { MonthlyProfitChart } from '@/components/charts/MonthlyProfitChart';
import { InventoryTable } from '@/components/inventory/InventoryTable';
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
import { ProfileModal } from '@/components/modals/ProfileModal';
import { Product } from '@/types';
import { useToast } from '@/components/notifications/ToastProvider';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePermissions, SECTION_PERMISSIONS } from '@/lib/usePermissions';

const SECTION_TITLES: Record<string, string> = {
  overview: 'Inicio',
  sales: 'Ventas',
  'sales-history': 'Historial de Ventas',
  'sales-corte': 'Corte de Caja',
  inventory: 'Inventario',
  catalog: 'Catálogo de Productos',
  customers: 'Clientes',
  fiado: 'Fiado / Crédito',
  expenses: 'Gastos',
  suppliers: 'Proveedores',
  pedidos: 'Pedidos a Proveedores',
  analytics: 'Análisis',
  reports: 'Reportes',
  roles: 'Usuarios y Roles',
  settings: 'Configuración',
};

const SECTION_SUBTITLES: Record<string, string> = {
  overview: 'Resumen de tu negocio',
  sales: 'Punto de venta y registro',
  'sales-history': 'Registro de todas las ventas',
  'sales-corte': 'Cierre y conteo de caja',
  inventory: 'Control de existencias',
  catalog: 'Todos los productos registrados',
  customers: 'Directorio de clientes',
  fiado: 'Gestión de crédito a clientes',
  expenses: 'Control de gastos del negocio',
  suppliers: 'Directorio de proveedores',
  pedidos: 'Gestión de pedidos y recepción de mercancía',
  analytics: 'Gráficas y tendencias',
  reports: 'Resúmenes y métricas',
  roles: 'Asigna roles y permisos a tu equipo',
  settings: 'Configuración del sistema',
};

export function DashboardHome() {
  const {
    kpiData,
    inventoryAlerts,
    salesData,
    isLoading,
    error,
    fetchDashboardData,
    adjustStock,
    createPedido,
    ensureOwnerRole,
    fetchRoleDefinitions,
    checkMidnightCorte,
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
  const [searchValue, setSearchValue] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [userMenuActive, setUserMenuActive] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { permissions, isLoaded: permissionsLoaded } = usePermissions();

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    categories: [],
    alertTypes: [],
    stockStatus: [],
    dateRange: null,
  });

  useEffect(() => {
    fetchDashboardData();
    fetchRoleDefinitions();
  }, [fetchDashboardData, fetchRoleDefinitions]);

  // Auto-register role for current user (first user becomes owner)
  useEffect(() => {
    if (user) {
      ensureOwnerRole(user.uid, user.email || '', user.displayName || '');
    }
  }, [user, ensureOwnerRole]);

  // Check for auto midnight corte on load
  useEffect(() => {
    checkMidnightCorte();
    // Also schedule check at midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 5, 0); // 12:00:05 AM next day
    const msUntilMidnight = midnight.getTime() - now.getTime();
    const timer = setTimeout(() => {
      checkMidnightCorte();
    }, msUntilMidnight);
    return () => clearTimeout(timer);
  }, [checkMidnightCorte]);

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

  if (isLoading) {
    return (
      <SkeletonPage primaryAction title="Dashboard de Abarrotes">
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <SkeletonDisplayText size="large" />
              <SkeletonBodyText lines={4} />
            </BlockStack>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  if (error) {
    return (
      <Page title="Dashboard de Abarrotes">
        <Banner tone="critical" title="Error al cargar el dashboard">
          <p>{error}</p>
        </Banner>
      </Page>
    );
  }

  const criticalAlerts = inventoryAlerts.filter(
    (alert) => alert.severity === 'critical'
  );

  const topBarMarkup = (() => {
    const userMenuInitials = user?.displayName
      ? user.displayName
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : user?.email?.charAt(0).toUpperCase() || 'U';

    const userMenuMarkup = (
      <TopBar.UserMenu
        actions={[
          {
            items: [
              {
                content: 'Mi Perfil',
                icon: PersonIcon,
                onAction: () => {
                  setProfileModalOpen(true);
                  setUserMenuActive(false);
                },
              },
            ],
          },
          ...((!permissionsLoaded || permissions.length === 0 || permissions.includes('corte.create'))
            ? [{
                items: [
                  {
                    content: 'Corte de Caja',
                    icon: CashDollarIcon,
                    onAction: () => {
                      setCorteModalOpen(true);
                      setUserMenuActive(false);
                    },
                  },
                ],
              }]
            : []),
          ...((!permissionsLoaded || permissions.length === 0 || permissions.includes('settings.view'))
            ? [{
                items: [
                  {
                    content: 'Configuracion',
                    icon: SettingsIcon,
                    onAction: () => handleSectionSelect('settings'),
                  },
                ],
              }]
            : []),
          {
            items: [
              {
                content: 'Cerrar sesion',
                icon: ExitIcon,
                onAction: signOut,
              },
            ],
          },
        ]}
        name={user?.displayName || user?.email?.split('@')[0] || 'Usuario'}
        detail={user?.email || ''}
        initials={userMenuInitials}
        avatar={user?.photoURL || undefined}
        open={userMenuActive}
        onToggle={() => setUserMenuActive((prev) => !prev)}
      />
    );

    const searchResultsMarkup = searchValue ? (
      <ActionList
        items={Object.entries(SECTION_TITLES)
          .filter(([key, title]) => {
            if (!title.toLowerCase().includes(searchValue.toLowerCase())) return false;
            // Respect permissions in search
            if (permissionsLoaded && permissions.length > 0) {
              const required = SECTION_PERMISSIONS[key];
              if (required && !required.some((k) => permissions.includes(k))) return false;
            }
            return true;
          })
          .map(([key, title]) => ({
            content: title,
            helpText: SECTION_SUBTITLES[key] || '',
            onAction: () => {
              handleSectionSelect(key);
              setSearchValue('');
              setSearchActive(false);
            },
          }))}
      />
    ) : null;

    const searchFieldMarkup = (
      <TopBar.SearchField
        onChange={(value) => {
          setSearchValue(value);
          setSearchActive(value.length > 0);
        }}
        value={searchValue}
        placeholder="Buscar secciones, productos..."
        showFocusBorder
      />
    );

    return (
      <TopBar
        showNavigationToggle
        onNavigationToggle={toggleMobileNav}
        userMenu={userMenuMarkup}
        searchField={searchFieldMarkup}
        searchResults={searchResultsMarkup}
        searchResultsVisible={searchActive}
        onSearchResultsDismiss={() => {
          setSearchActive(false);
          setSearchValue('');
        }}
      />
    );
  })();

  const navigationMarkup = (
    <SidebarNav
      selected={selectedSection}
      onSelect={handleSectionSelect}
      badges={{
        lowStock: kpiData?.lowStockProducts,
      }}
      permissions={permissionsLoaded ? permissions : undefined}
    />
  );

  const renderSectionContent = () => {
    // Guard: if permissions are loaded, check if user can access this section
    if (permissionsLoaded && permissions.length > 0) {
      const required = SECTION_PERMISSIONS[selectedSection];
      if (required && !required.some((k) => permissions.includes(k))) {
        return (
          <Banner tone="warning" title="Acceso restringido">
            <p>No tienes permisos para acceder a esta seccion. Contacta al propietario o administrador.</p>
          </Banner>
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
              <Layout.Section>
                <MonthlyProfitChart />
              </Layout.Section>
            </Layout>
            <Layout>
              <Layout.Section variant="oneHalf">
                <InventoryTable
                  alerts={filteredAlerts}
                  onProductClick={handleProductClick}
                  onExport={handleTableExport}
                  onCreatePedido={handleTableCreatePedido}
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
              onExport={handleTableExport}
              onCreatePedido={handleTableCreatePedido}
              onRegisterProduct={() => setRegisterProductOpen(true)}
            />
          </BlockStack>
        );

      case 'catalog':
        return (
          <BlockStack gap="400">
            <InventoryTable
              alerts={inventoryAlerts}
              onProductClick={handleProductClick}
              onExport={handleTableExport}
              onCreatePedido={handleTableCreatePedido}
              onRegisterProduct={() => setRegisterProductOpen(true)}
            />
            <TopProducts />
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
        return (
          <BlockStack gap="400">
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
                <TopProducts title="Productos Más Vendidos" />
              </Layout.Section>
              <Layout.Section variant="oneHalf">
                <TopProducts title="Mayor Margen de Ganancia" />
              </Layout.Section>
            </Layout>
          </BlockStack>
        );

      case 'reports':
        return <ReportesView />;

      case 'roles':
        return <RolesManager />;

      case 'settings':
        return <ConfiguracionPage />;

      default:
        return null;
    }
  };

  return (
    <Frame
      logo={{
        topBarSource: '/logo.svg',
        contextualSaveBarSource: '/logo.svg',
        accessibilityLabel: 'Abarrotes GS',
        url: '#',
        width: 124,
      }}
      topBar={topBarMarkup}
      navigation={navigationMarkup}
      showMobileNavigation={mobileNavActive}
      onNavigationDismiss={toggleMobileNav}
    >
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

          <Layout.Section>
            {renderSectionContent()}
          </Layout.Section>
        </Layout>
      </Page>

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
              <Select
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

      <ProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </Frame>
  );
}
