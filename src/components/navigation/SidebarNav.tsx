'use client';

import { Navigation } from '@shopify/polaris';
import {
  HomeIcon,
  OrderIcon,
  ProductIcon,
  PersonIcon,
  FinanceIcon,
  ChartVerticalIcon,
  SettingsIcon,
  PersonLockIcon,
  NotificationIcon,
} from '@shopify/polaris-icons';
import type { PermissionKey } from '@/types';

interface SidebarNavProps {
  selected: string;
  onSelect: (section: string) => void;
  badges?: {
    lowStock?: number;
    notifications?: number;
  };
  /** Current user's permissions — used to show/hide nav items */
  permissions?: PermissionKey[];
}

const SALES_SECTIONS = ['sales', 'sales-history', 'sales-corte'];
const PRODUCT_SECTIONS = ['inventory', 'catalog', 'inventory-audit', 'inventory-priority', 'pedidos'];
const CUSTOMER_SECTIONS = ['customers', 'fiado'];
const FINANCE_SECTIONS = ['expenses', 'suppliers', 'pedidos'];
const ANALYTICS_SECTIONS = ['analytics', 'reports'];

/** Returns true if the user has ANY of the given permissions */
function can(permissions: PermissionKey[] | undefined, ...keys: PermissionKey[]): boolean {
  if (!permissions || permissions.length === 0) return true; // no restrictions loaded yet or admin without role -> show all
  return keys.some((k) => permissions.includes(k));
}

export function SidebarNav({ selected, onSelect, badges, permissions }: SidebarNavProps) {
  // Main navigation items — filtered by permissions
  const mainItems = [];

  if (can(permissions, 'dashboard.view')) {
    mainItems.push({
      label: 'Inicio',
      icon: HomeIcon,
      selected: selected === 'overview',
      onClick: () => onSelect('overview'),
    });
  }

  if (can(permissions, 'sales.create', 'sales.view')) {
    const subNav = [];
    if (can(permissions, 'sales.view')) {
      subNav.push({
        url: '#',
        label: 'Historial',
        selected: selected === 'sales-history',
        onClick: () => onSelect('sales-history'),
      });
    }
    if (can(permissions, 'corte.create', 'corte.view')) {
      subNav.push({
        url: '#',
        label: 'Corte de Caja',
        selected: selected === 'sales-corte',
        onClick: () => onSelect('sales-corte'),
      });
    }
    mainItems.push({
      label: 'Pedidos',
      icon: OrderIcon,
      selected: SALES_SECTIONS.includes(selected),
      onClick: () => onSelect('sales'),
      ...(subNav.length > 0 ? { subNavigationItems: subNav } : {}),
    });
  }

  if (can(permissions, 'inventory.view')) {
    mainItems.push({
      label: 'Productos',
      icon: ProductIcon,
      badge: badges?.lowStock ? String(badges.lowStock) : undefined,
      selected: PRODUCT_SECTIONS.includes(selected),
      onClick: () => onSelect('inventory'),
      subNavigationItems: [
        {
          url: '#',
          label: 'Colecciones',
          selected: selected === 'catalog',
          onClick: () => onSelect('catalog'),
        },
        {
          url: '#',
          label: 'Inventario',
          selected: selected === 'inventory',
          onClick: () => onSelect('inventory'),
        },
        {
          url: '#',
          label: 'Órdenes de compra',
          selected: selected === 'pedidos',
          onClick: () => onSelect('pedidos'),
        },
      ],
    });
  }

  if (can(permissions, 'customers.view')) {
    const subNav = [];
    if (can(permissions, 'fiado.view', 'fiado.create')) {
      subNav.push({
        url: '#',
        label: 'Fiado / Crédito',
        matches: selected === 'fiado',
        onClick: () => onSelect('fiado'),
      });
    }
    mainItems.push({
      label: 'Clientes',
      icon: PersonIcon,
      selected: CUSTOMER_SECTIONS.includes(selected),
      onClick: () => onSelect('customers'),
      ...(subNav.length > 0 ? { subNavigationItems: subNav } : {}),
    });
  }

  // Admin section items
  const adminItems = [];

  if (can(permissions, 'expenses.view', 'suppliers.view', 'pedidos.view')) {
    const subNav = [];
    if (can(permissions, 'suppliers.view')) {
      subNav.push({
        url: '#',
        label: 'Proveedores',
        selected: selected === 'suppliers',
        onClick: () => onSelect('suppliers'),
      });
    }
    if (can(permissions, 'pedidos.view')) {
      subNav.push({
        url: '#',
        label: 'Pedidos',
        selected: selected === 'pedidos',
        onClick: () => onSelect('pedidos'),
      });
    }
    adminItems.push({
      label: 'Finanzas',
      icon: FinanceIcon,
      selected: FINANCE_SECTIONS.includes(selected),
      onClick: () => onSelect('expenses'),
      ...(subNav.length > 0 ? { subNavigationItems: subNav } : {}),
    });
  }

  if (can(permissions, 'analytics.view', 'reports.view')) {
    const subNav = [];
    if (can(permissions, 'reports.view')) {
      subNav.push({
        url: '#',
        label: 'Reportes',
        matches: selected === 'reports',
        onClick: () => onSelect('reports'),
      });
    }
    adminItems.push({
      label: 'Análisis Integral',
      icon: ChartVerticalIcon,
      selected: ANALYTICS_SECTIONS.includes(selected),
      onClick: () => onSelect('analytics'),
      ...(subNav.length > 0 ? { subNavigationItems: subNav } : {}),
    });
  }

  // System section items
  const systemItems = [];

  if (can(permissions, 'roles.manage')) {
    systemItems.push({
      label: 'Usuarios y Accesos',
      icon: PersonLockIcon,
      selected: selected === 'roles',
      onClick: () => onSelect('roles'),
    });
  }

  if (can(permissions, 'settings.view')) {
    systemItems.push({
      label: 'Configuración Avanzada',
      icon: SettingsIcon,
      selected: selected === 'settings',
      onClick: () => onSelect('settings'),
    });
  }

  return (
    <Navigation location="/">
      {mainItems.length > 0 && (
        <Navigation.Section items={mainItems} fill />
      )}
      {adminItems.length > 0 && (
        <Navigation.Section title="Administración Financiera" separator items={adminItems} />
      )}
      {systemItems.length > 0 && (
        <Navigation.Section title="Sistema" separator items={systemItems} />
      )}
    </Navigation>
  );
}
