'use client';

import { Navigation } from '@shopify/polaris';
import {
  HomeFilledIcon,
  OrderIcon,
  ProductIcon,
  PersonIcon,
  FinanceIcon,
  ChartVerticalFilledIcon,
  SettingsIcon,
  PersonLockFilledIcon,
} from '@shopify/polaris-icons';
import type { PermissionKey } from '@/types';

interface SidebarNavProps {
  selected: string;
  onSelect: (section: string) => void;
  badges?: {
    lowStock?: number;
  };
  /** Current user's permissions — used to show/hide nav items */
  permissions?: PermissionKey[];
}

const SALES_SECTIONS = ['sales', 'sales-history', 'sales-corte'];
const PRODUCT_SECTIONS = ['inventory', 'catalog', 'inventory-audit'];
const CUSTOMER_SECTIONS = ['customers', 'fiado'];
const FINANCE_SECTIONS = ['expenses', 'suppliers', 'pedidos'];
const ANALYTICS_SECTIONS = ['analytics', 'reports'];

/** Returns true if the user has ANY of the given permissions */
function can(permissions: PermissionKey[] | undefined, ...keys: PermissionKey[]): boolean {
  if (!permissions || permissions.length === 0) return true; // no restrictions loaded yet → show all (graceful)
  return keys.some((k) => permissions.includes(k));
}

export function SidebarNav({ selected, onSelect, badges, permissions }: SidebarNavProps) {
  // Main navigation items — filtered by permissions
  const mainItems = [];

  if (can(permissions, 'dashboard.view')) {
    mainItems.push({
      label: 'Inicio',
      icon: HomeFilledIcon,
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
        matches: selected === 'sales-history',
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
    mainItems.push({
      label: 'Ventas',
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
          label: 'Catalogo',
          matches: selected === 'catalog',
          onClick: () => onSelect('catalog'),
        },
        {
          url: '#',
          label: 'Auditoría',
          matches: selected === 'inventory-audit',
          onClick: () => onSelect('inventory-audit'),
        },
      ],
    });
  }

  if (can(permissions, 'customers.view')) {
    const subNav = [];
    if (can(permissions, 'fiado.view', 'fiado.create')) {
      subNav.push({
        url: '#',
        label: 'Fiado / Credito',
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
        matches: selected === 'suppliers',
        onClick: () => onSelect('suppliers'),
      });
    }
    if (can(permissions, 'pedidos.view')) {
      subNav.push({
        url: '#',
        label: 'Pedidos',
        matches: selected === 'pedidos',
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
      label: 'Analisis',
      icon: ChartVerticalFilledIcon,
      selected: ANALYTICS_SECTIONS.includes(selected),
      onClick: () => onSelect('analytics'),
      ...(subNav.length > 0 ? { subNavigationItems: subNav } : {}),
    });
  }

  // System section items
  const systemItems = [];

  if (can(permissions, 'roles.manage')) {
    systemItems.push({
      label: 'Usuarios y Roles',
      icon: PersonLockFilledIcon,
      selected: selected === 'roles',
      onClick: () => onSelect('roles'),
    });
  }

  if (can(permissions, 'settings.view')) {
    systemItems.push({
      label: 'Configuracion',
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
        <Navigation.Section title="Administracion" separator items={adminItems} />
      )}
      {systemItems.length > 0 && (
        <Navigation.Section separator items={systemItems} />
      )}
    </Navigation>
  );
}
