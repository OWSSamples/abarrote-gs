'use client';

import { Navigation } from '@shopify/polaris';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  HomeFilledIcon,
  OrderIcon,
  OrderFilledIcon,
  ProductIcon,
  ProductFilledIcon,
  PersonIcon,
  PersonFilledIcon,
  FinanceIcon,
  FinanceFilledIcon,
  ChartVerticalIcon,
  ChartVerticalFilledIcon,
  SettingsIcon,
  SettingsFilledIcon,
  PersonLockIcon,
  PersonLockFilledIcon,
  AppsIcon,
  AppsFilledIcon,
} from '@shopify/polaris-icons';
import { usePermissions } from '@/hooks/usePermissions';
import { useDashboardStore } from '@/store/dashboardStore';

interface SidebarNavProps {
  onSelect: (section: string) => void;
  badges?: {
    lowStock?: number;
    notifications?: number;
  };
}

const SALES_PATHS = ['/dashboard/sales', '/dashboard/sales/corte', '/dashboard/sales/pagos-mp'];
const PRODUCT_PATHS = [
  '/dashboard/products',
  '/dashboard/products/inventory',
  '/dashboard/products/priority',
  '/dashboard/products/audit',
  '/dashboard/products/pedidos',
  '/dashboard/products/mermas',
];
const CUSTOMER_PATHS = ['/dashboard/customers', '/dashboard/customers/fiado'];
const FINANCE_PATHS = ['/dashboard/finance/expenses', '/dashboard/finance/suppliers'];
const ANALYTICS_PATHS = ['/dashboard/analytics', '/dashboard/analytics/reports'];
const OTHERS_PATHS = ['/dashboard/others/promotions', '/dashboard/others/categories', '/dashboard/others/servicios'];

export function SidebarNav({ onSelect, badges }: SidebarNavProps) {
  const { hasAnyPermission, isLoaded } = usePermissions();
  const pathname = usePathname();
  const mpEnabled = useDashboardStore((s) => s.storeConfig.mpEnabled);

  const isPath = (path: string) => pathname === path;
  const isAnyPath = (paths: string[]) => paths.some((p) => pathname === p);

  /** Show all items while permissions are still loading */
  const can = (...keys: Parameters<typeof hasAnyPermission>) => !isLoaded || hasAnyPermission(...keys);

  // Main navigation items — filtered by permissions
  const mainItems = [];

  if (can('dashboard.view')) {
    const isSel = isPath('/dashboard');
    mainItems.push({
      url: '#',
      label: 'Inicio',
      icon: isSel ? HomeIcon : HomeFilledIcon,
      selected: isSel,
      onClick: () => onSelect('overview'),
    });
  }

  if (can('sales.create', 'sales.view')) {
    const subNav = [];
    if (can('corte.create', 'corte.view')) {
      subNav.push({
        url: '#',
        label: 'Corte de Caja',
        matches: isPath('/dashboard/sales/corte'),
        onClick: () => onSelect('sales-corte'),
      });
    }
    if (mpEnabled) {
      subNav.push({
        url: '#',
        label: 'MercadoPago',
        matches: isPath('/dashboard/sales/pagos-mp'),
        onClick: () => onSelect('pagos-mp'),
      });
    }
    const isSel = isAnyPath(SALES_PATHS);
    mainItems.push({
      url: '#',
      label: 'Ventas',
      icon: isSel ? OrderIcon : OrderFilledIcon,
      selected: isSel,
      expanded: isSel,
      onClick: () => onSelect('sales-history'),
      ...(subNav.length > 0 ? { subNavigationItems: subNav } : {}),
    });
  }

  if (can('inventory.view')) {
    const isSel = isAnyPath(PRODUCT_PATHS);
    mainItems.push({
      url: '#',
      label: 'Productos',
      icon: isSel ? ProductIcon : ProductFilledIcon,
      badge: badges?.lowStock ? String(badges.lowStock) : undefined,
      selected: isSel,
      expanded: isSel,
      onClick: () => onSelect('catalog'),
      subNavigationItems: [
        {
          url: '#',
          label: 'Inventario General',
          matches: isPath('/dashboard/products/inventory'),
          onClick: () => onSelect('inventory'),
        },
        {
          url: '#',
          label: 'Reposición (Pedidos)',
          matches: isPath('/dashboard/products/pedidos'),
          onClick: () => onSelect('pedidos'),
        },
        {
          url: '#',
          label: 'Mermas',
          matches: isPath('/dashboard/products/mermas'),
          onClick: () => onSelect('mermas'),
        },
        {
          url: '#',
          label: 'Prioridad',
          matches: isPath('/dashboard/products/priority'),
          onClick: () => onSelect('inventory-priority'),
        },
      ],
    });
  }

  if (can('customers.view')) {
    const subNav = [];
    if (can('fiado.view', 'fiado.create')) {
      subNav.push({
        url: '#',
        label: 'Fiado / Crédito',
        matches: isPath('/dashboard/customers/fiado'),
        onClick: () => onSelect('fiado'),
      });
    }
    const isSel = isAnyPath(CUSTOMER_PATHS);
    mainItems.push({
      url: '#',
      label: 'Clientes',
      icon: isSel ? PersonIcon : PersonFilledIcon,
      selected: isSel,
      expanded: isSel,
      onClick: () => onSelect('customers'),
      ...(subNav.length > 0 ? { subNavigationItems: subNav } : {}),
    });
  }

  // Admin section items
  const adminItems = [];

  if (can('expenses.view', 'suppliers.view', 'pedidos.view')) {
    const subNav = [];
    if (can('suppliers.view')) {
      subNav.push({
        url: '#',
        label: 'Proveedores',
        matches: isPath('/dashboard/finance/suppliers'),
        onClick: () => onSelect('suppliers'),
      });
    }
    const isSel = isAnyPath(FINANCE_PATHS);
    adminItems.push({
      url: '#',
      label: 'Finanzas',
      icon: isSel ? FinanceIcon : FinanceFilledIcon,
      selected: isSel,
      expanded: isSel,
      onClick: () => onSelect('expenses'),
      ...(subNav.length > 0 ? { subNavigationItems: subNav } : {}),
    });
  }

  if (can('analytics.view', 'reports.view')) {
    const subNav = [];
    if (can('reports.view')) {
      subNav.push({
        url: '#',
        label: 'Reportes',
        matches: isPath('/dashboard/analytics/reports'),
        onClick: () => onSelect('reports'),
      });
    }
    const isSel = isAnyPath(ANALYTICS_PATHS);
    adminItems.push({
      url: '#',
      label: 'Análisis Integral',
      icon: isSel ? ChartVerticalIcon : ChartVerticalFilledIcon,
      selected: isSel,
      expanded: isSel,
      onClick: () => onSelect('analytics'),
      ...(subNav.length > 0 ? { subNavigationItems: subNav } : {}),
    });
  }

  // "Otros" section — Promociones y Categorías
  if (can('inventory.view', 'inventory.edit')) {
    const isSel = isAnyPath(OTHERS_PATHS);
    adminItems.push({
      url: '#',
      label: 'Otros',
      icon: isSel ? AppsIcon : AppsFilledIcon,
      selected: isSel,
      expanded: isSel,
      onClick: () => onSelect('promotions'),
      subNavigationItems: [
        {
          url: '#',
          label: 'Servicios y Recargas',
          matches: isPath('/dashboard/others/servicios'),
          onClick: () => onSelect('servicios'),
        },
        {
          url: '#',
          label: 'Promociones',
          matches: isPath('/dashboard/others/promotions'),
          onClick: () => onSelect('promotions'),
        },
        {
          url: '#',
          label: 'Categorías',
          matches: isPath('/dashboard/others/categories'),
          onClick: () => onSelect('categories'),
        },
      ],
    });
  }

  // System section items
  const systemItems = [];

  if (can('roles.manage')) {
    const isSel = isPath('/dashboard/settings/roles');
    systemItems.push({
      url: '#',
      label: 'Usuarios y Accesos',
      icon: isSel ? PersonLockIcon : PersonLockFilledIcon,
      selected: isSel,
      onClick: () => onSelect('roles'),
    });
  }

  if (can('settings.view')) {
    const isSel = isPath('/dashboard/settings');
    systemItems.push({
      url: '#',
      label: 'Configuración Avanzada',
      icon: isSel ? SettingsIcon : SettingsFilledIcon,
      selected: isSel,
      onClick: () => onSelect('settings'),
    });
  }

  return (
    <Navigation location={pathname}>
      {mainItems.length > 0 && <Navigation.Section items={mainItems} fill />}
      {adminItems.length > 0 && <Navigation.Section title="Administración Financiera" separator items={adminItems} />}
      {systemItems.length > 0 && <Navigation.Section title="Sistema" separator items={systemItems} />}
    </Navigation>
  );
}
