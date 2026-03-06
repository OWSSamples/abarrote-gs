// Exportaciones de componentes del Dashboard de Abarrotes

// Auth Components
export { LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm, AuthLayout } from './auth';

// Dashboard
export { DashboardHome } from './dashboard/DashboardHome';

// KPI
export { KPICard } from './kpi/KPICard';

// Charts
export { SalesChart } from './charts/SalesChart';
export { HourlySalesChart } from './charts/HourlySalesChart';

// Inventory
export { InventoryTable } from './inventory/InventoryTable';

// Actions
export { QuickActions } from './actions/QuickActions';

// Filters
export { AdvancedFilters } from './filters/AdvancedFilters';
export type { FilterState } from './filters/AdvancedFilters';

// Metrics
export { TopProducts } from './metrics/TopProducts';

// Modals
export { ProductDetailModal } from './modals/ProductDetailModal';
export { RegisterProductModal } from './modals/RegisterProductModal';
export { SaleTicketModal } from './modals/SaleTicketModal';

// Sales
export { SalesHistory } from './sales/SalesHistory';

// Caja
export { CorteCajaModal, CortesHistory } from './caja/CorteCajaModal';

// Fiado
export { FiadoManager } from './fiado/FiadoManager';

// Gastos
export { GastosManager } from './gastos/GastosManager';

// Proveedores
export { ProveedoresManager } from './suppliers/ProveedoresManager';

// Pedidos
export { PedidosManager } from './pedidos/PedidosManager';

// Reportes
export { ReportesView } from './reports/ReportesView';

// Configuración
export { ConfiguracionPage } from './settings/ConfiguracionPage';

// Navigation
export { SidebarNav } from './navigation/SidebarNav';

// Export
export { ExportModal, generateCSV, downloadFile, exportDashboardData } from './export/ExportModal';

// Notifications
export { ToastProvider, useToast } from './notifications/ToastProvider';
