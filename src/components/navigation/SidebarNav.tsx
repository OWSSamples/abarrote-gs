'use client';

import { Navigation } from '@shopify/polaris';
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
    const isSel = selected === 'overview';
    mainItems.push({
      url: '#',
      label: 'Inicio',
      icon: isSel ? HomeIcon : HomeFilledIcon,
      selected: isSel,
      onClick: () => onSelect('overview'),
    });
  }

  if (can(permissions, 'sales.create', 'sales.view')) {
    const subNav = [];
    if (can(permissions, 'sales.view')) {
      subNav.push({
        url: '#',
        label: 'Lista de folios',
        matches: selected === 'sales-history' || selected === 'sales',
        onClick: () => onSelect('sales-history'),
      });
    }
    if (can(permissions, 'corte.create', 'corte.view')) {
      subNav.push({
        url: '#',
        label: 'Corte de Caja',
        matches: selected === 'sales-corte',
        onClick: () => onSelect('sales-corte'),
      });
    }
    const isSel = SALES_SECTIONS.includes(selected);
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

  if (can(permissions, 'inventory.view')) {
    const isSel = PRODUCT_SECTIONS.includes(selected);
    mainItems.push({
      url: '#',
      label: 'Productos',
      icon: isSel ? ProductIcon : ProductFilledIcon,
      badge: badges?.lowStock ? String(badges.lowStock) : undefined,
      selected: isSel,
      expanded: isSel,
      onClick: () => onSelect('inventory'),
      subNavigationItems: [
        {
          url: '#',
          label: 'Inventario General',
          matches: selected === 'inventory',
          onClick: () => onSelect('inventory'),
        },
        {
          url: '#',
          label: 'Reposición (Pedidos)',
          matches: selected === 'pedidos',
          onClick: () => onSelect('pedidos'),
        },
        {
          url: '#',
          label: 'Prioridad',
          matches: selected === 'inventory-priority',
          onClick: () => onSelect('inventory-priority'),
        },
      ],
    });
  }

  if (can(permissions, 'customers.view')) {
    const subNav = [];
    subNav.push({
      url: '#',
      label: 'Todos los Clientes',
      matches: selected === 'customers',
      onClick: () => onSelect('customers'),
    });
    if (can(permissions, 'fiado.view', 'fiado.create')) {
      subNav.push({
        url: '#',
        label: 'Deudores (Fiado / Crédito)',
        matches: selected === 'fiado',
        onClick: () => onSelect('fiado'),
      });
    }
    const isSel = CUSTOMER_SECTIONS.includes(selected);
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

  if (can(permissions, 'expenses.view', 'suppliers.view', 'pedidos.view')) {
    const subNav = [];
    if (can(permissions, 'suppliers.view')) {
      subNav.push({
        url: '#',
        label: 'Proveedores',
        matches: selected === 'suppliers',
        onClick: () => onSelect('suppliers'),
      });
    }
    if (can(permissions, 'pedidos.view')) {
      subNav.push({
        url: '#',
        label: 'Pedidos a Proveedor',
        matches: selected === 'pedidos',
        onClick: () => onSelect('pedidos'),
      });
    }
    const isSel = FINANCE_SECTIONS.includes(selected);
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
    const isSel = ANALYTICS_SECTIONS.includes(selected);
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

  // System section items
  const systemItems = [];

  if (can(permissions, 'roles.manage')) {
    const isSel = selected === 'roles';
    systemItems.push({
      url: '#',
      label: 'Usuarios y Accesos',
      icon: isSel ? PersonLockIcon : PersonLockFilledIcon,
      selected: isSel,
      onClick: () => onSelect('roles'),
    });
  }

  if (can(permissions, 'settings.view')) {
    const isSel = selected === 'settings';
    systemItems.push({
      url: '#',
      label: 'Configuración Avanzada',
      icon: isSel ? SettingsIcon : SettingsFilledIcon,
      selected: isSel,
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
