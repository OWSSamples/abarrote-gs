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
} from '@shopify/polaris-icons';

interface SidebarNavProps {
  selected: string;
  onSelect: (section: string) => void;
  badges?: {
    lowStock?: number;
  };
}

const SALES_SECTIONS = ['sales', 'sales-history', 'sales-corte'];
const PRODUCT_SECTIONS = ['inventory', 'catalog'];
const CUSTOMER_SECTIONS = ['customers', 'fiado'];
const FINANCE_SECTIONS = ['expenses', 'suppliers', 'pedidos'];
const ANALYTICS_SECTIONS = ['analytics', 'reports'];

export function SidebarNav({ selected, onSelect, badges }: SidebarNavProps) {
  return (
    <Navigation location="/">
      <Navigation.Section
        items={[
          {
            label: 'Inicio',
            icon: HomeFilledIcon,
            selected: selected === 'overview',
            onClick: () => onSelect('overview'),
          },
          {
            label: 'Ventas',
            icon: OrderIcon,
            selected: SALES_SECTIONS.includes(selected),
            onClick: () => onSelect('sales'),
            subNavigationItems: [
              {
                url: '#',
                label: 'Historial',
                matches: selected === 'sales-history',
                onClick: () => onSelect('sales-history'),
              },
              {
                url: '#',
                label: 'Corte de Caja',
                matches: selected === 'sales-corte',
                onClick: () => onSelect('sales-corte'),
              },
            ],
          },
          {
            label: 'Productos',
            icon: ProductIcon,
            badge: badges?.lowStock ? String(badges.lowStock) : undefined,
            selected: PRODUCT_SECTIONS.includes(selected),
            onClick: () => onSelect('inventory'),
            subNavigationItems: [
              {
                url: '#',
                label: 'Catálogo',
                matches: selected === 'catalog',
                onClick: () => onSelect('catalog'),
              },
            ],
          },
          {
            label: 'Clientes',
            icon: PersonIcon,
            selected: CUSTOMER_SECTIONS.includes(selected),
            onClick: () => onSelect('customers'),
            subNavigationItems: [
              {
                url: '#',
                label: 'Fiado / Crédito',
                matches: selected === 'fiado',
                onClick: () => onSelect('fiado'),
              },
            ],
          },
        ]}
        fill
      />
      <Navigation.Section
        title="Administración"
        separator
        items={[
          {
            label: 'Finanzas',
            icon: FinanceIcon,
            selected: FINANCE_SECTIONS.includes(selected),
            onClick: () => onSelect('expenses'),
            subNavigationItems: [
              {
                url: '#',
                label: 'Proveedores',
                matches: selected === 'suppliers',
                onClick: () => onSelect('suppliers'),
              },
              {
                url: '#',
                label: 'Pedidos',
                matches: selected === 'pedidos',
                onClick: () => onSelect('pedidos'),
              },
            ],
          },
          {
            label: 'Análisis',
            icon: ChartVerticalFilledIcon,
            selected: ANALYTICS_SECTIONS.includes(selected),
            onClick: () => onSelect('analytics'),
            subNavigationItems: [
              {
                url: '#',
                label: 'Reportes',
                matches: selected === 'reports',
                onClick: () => onSelect('reports'),
              },
            ],
          },
        ]}
      />
      <Navigation.Section
        separator
        items={[
          {
            label: 'Configuración',
            icon: SettingsIcon,
            selected: selected === 'settings',
            onClick: () => onSelect('settings'),
          },
        ]}
      />
    </Navigation>
  );
}
