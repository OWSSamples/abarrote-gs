'use client';

import type { ComponentType } from 'react';
import { useState } from 'react';
import { Sidebar } from '@cloudflare/kumo';
import { Button } from '@cloudflare/kumo/components/button';
import { Badge } from '@cloudflare/kumo/components/badge';
import {
  Apps24Filled,
  Apps24Regular,
  Bot24Regular,
  Box24Filled,
  Box24Regular,
  BuildingRetail24Filled,
  BuildingRetail24Regular,
  BuildingShop24Regular,
  Cart24Filled,
  Cart24Regular,
  Channel24Regular,
  ChartMultiple24Filled,
  ChartMultiple24Regular,
  Home24Filled,
  Home24Regular,
  Money24Filled,
  Money24Regular,
  People24Filled,
  People24Regular,
  PersonLock24Filled,
  PersonLock24Regular,
  PlugConnected24Regular,
  Settings24Filled,
  Settings24Regular,
  ArrowDown24Regular,
} from '@fluentui/react-icons';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useDashboardStore } from '@/store/dashboardStore';
import './SidebarNav.css';

// ─── Types ──────────────────────────────────────────────────────────────────
interface SidebarNavProps {
  onSelect: (section: string) => void;
  badges?: {
    lowStock?: number;
    notifications?: number;
  };
}

type SidebarIcon = ComponentType<{ className?: string }>;

interface SidebarChildItem {
  label: string;
  active: boolean;
  onClick: () => void;
}

interface SidebarItem {
  label: string;
  icon: SidebarIcon;
  active?: boolean;
  badge?: string;
  onClick: () => void;
  children?: SidebarChildItem[];
}

interface SidebarGroup {
  title?: string;
  items: SidebarItem[];
  fill?: boolean;
}

// ─── Path helpers ────────────────────────────────────────────────────────────
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
const OTHERS_PATHS = ['/dashboard/others/promotions', '/dashboard/others/categories'];

function iconFor(active: boolean, filled: SidebarIcon, regular: SidebarIcon): SidebarIcon {
  return active ? filled : regular;
}

// ─── Menu renderers ──────────────────────────────────────────────────────────
function renderBadge(value?: string) {
  if (!value) return null;
  return <Sidebar.MenuBadge>{value}</Sidebar.MenuBadge>;
}

function renderMenuItem(item: SidebarItem) {
  const isActive = Boolean(item.active);

  if (item.children?.length) {
    return (
      <Sidebar.MenuItem key={item.label}>
        <Sidebar.Collapsible defaultOpen={isActive} autoScrollOnOpen>
          <Sidebar.CollapsibleTrigger
            render={
              <Sidebar.MenuButton
                active={isActive}
                aria-current={isActive ? 'page' : undefined}
                icon={item.icon}
                onClick={item.onClick}
                tooltip={item.label}
                type="button"
              >
                {item.label}
                {renderBadge(item.badge)}
                <Sidebar.MenuChevron />
              </Sidebar.MenuButton>
            }
          />
          <Sidebar.CollapsibleContent>
            <Sidebar.MenuSub>
              {item.children.map((child) => (
                <Sidebar.MenuSubButton
                  key={child.label}
                  active={child.active}
                  aria-current={child.active ? 'page' : undefined}
                  onClick={child.onClick}
                  type="button"
                >
                  {child.label}
                </Sidebar.MenuSubButton>
              ))}
            </Sidebar.MenuSub>
          </Sidebar.CollapsibleContent>
        </Sidebar.Collapsible>
      </Sidebar.MenuItem>
    );
  }

  return (
    <Sidebar.MenuButton
      key={item.label}
      active={isActive}
      aria-current={isActive ? 'page' : undefined}
      icon={item.icon}
      onClick={item.onClick}
      tooltip={item.label}
      type="button"
    >
      {item.label}
      {renderBadge(item.badge)}
    </Sidebar.MenuButton>
  );
}

function renderGroup(group: SidebarGroup) {
  if (group.items.length === 0) return null;

  return (
    <Sidebar.Group
      key={group.title ?? 'primary'}
      className={group.fill ? 'odx-sidebar__group--fill' : undefined}
    >
      {group.title ? <Sidebar.GroupLabel>{group.title}</Sidebar.GroupLabel> : null}
      <Sidebar.Menu>{group.items.map(renderMenuItem)}</Sidebar.Menu>
    </Sidebar.Group>
  );
}

// ─── App store modal (native — no Polaris) ───────────────────────────────────
interface AppSuggestion {
  title: string;
  description: string;
  rating: string;
  builtBy?: string;
  group: 'recommended' | 'needed' | 'kiosko';
}

const APP_STORE_SUGGESTIONS: AppSuggestion[] = [
  {
    title: 'Abastecimiento inteligente',
    description: 'Sugerencias de compra y reposición automática.',
    rating: '4.6',
    builtBy: 'Built for Kiosko',
    group: 'recommended',
  },
  {
    title: 'Marketing email y SMS',
    description: 'Campañas automáticas para clientes nuevos y recurrentes.',
    rating: '4.7',
    builtBy: 'Built for Kiosko',
    group: 'recommended',
  },
  {
    title: 'Mercado Libre',
    description: 'Publica productos, sincroniza inventario y centraliza pedidos.',
    rating: 'Nuevo',
    group: 'needed',
  },
  {
    title: 'Google & YouTube',
    description: 'Conecta tu tienda con Google Shopping y campañas de descubrimiento.',
    rating: '4.5',
    group: 'needed',
  },
  {
    title: 'Reseñas de productos',
    description: 'Aumenta las ventas con reseñas y confianza social.',
    rating: '5.0',
    builtBy: 'Built for Kiosko',
    group: 'kiosko',
  },
];

function AppStoreModal({
  open,
  onClose,
  onOpenMarketplace,
}: {
  open: boolean;
  onClose: () => void;
  onOpenMarketplace: () => void;
}) {
  if (!open) return null;

  const recommended = APP_STORE_SUGGESTIONS.filter((a) => a.group === 'recommended');
  const needed = APP_STORE_SUGGESTIONS.filter((a) => a.group === 'needed');
  const kiosko = APP_STORE_SUGGESTIONS.filter((a) => a.group === 'kiosko');

  return (
    <div className="odx-appstore-overlay" onClick={onClose}>
      <div className="odx-appstore-modal" onClick={(e) => e.stopPropagation()}>
        <div className="odx-appstore-header">
          <h2>Seleccionado para ti</h2>
          <button type="button" className="odx-appstore-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="odx-appstore-body">
          {[
            { label: 'Recomendado', apps: recommended },
            { label: 'Más apps que podrías necesitar', apps: needed },
            { label: 'Hecha para Kiosko', apps: kiosko },
          ].map(({ label, apps }) =>
            apps.length === 0 ? null : (
              <div key={label} className="odx-appstore-section">
                <p className="odx-appstore-section-title">{label}</p>
                <div className="odx-appstore-grid">
                  {apps.map((app) => (
                    <div key={app.title} className="odx-appstore-card">
                      <div className="odx-appstore-card-info">
                        <strong>{app.title}</strong>
                        <span>{app.description}</span>
                        <div className="odx-appstore-rating">
                          <span>{app.rating}</span>
                          {app.rating !== 'Nuevo' && <span>★</span>}
                          {app.builtBy && <Badge variant="teal-subtle">{app.builtBy}</Badge>}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        icon={<ArrowDown24Regular />}
                        onClick={onOpenMarketplace}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="odx-appstore-footer">
          <span>Descubre más integraciones en el Marketplace de Kiosko.</span>
          <Button type="button" size="sm" variant="ghost" onClick={onOpenMarketplace}>
            Abrir Marketplace
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export function SidebarNav({ onSelect, badges }: SidebarNavProps) {
  const { hasAnyPermission, isLoaded } = usePermissions();
  const pathname = usePathname();
  const mpEnabled = useDashboardStore((s) => s.storeConfig.mpEnabled);
  const [appStoreOpen, setAppStoreOpen] = useState(false);

  const isPath = (path: string) => pathname === path;
  const isAnyPath = (paths: string[]) => paths.some((p) => pathname === p);

  /** Show all items while permissions are still loading. */
  const can = (...keys: Parameters<typeof hasAnyPermission>) => !isLoaded || hasAnyPermission(...keys);

  // ── Main navigation ──
  const mainItems: SidebarItem[] = [];

  if (can('dashboard.view')) {
    const active = isPath('/dashboard');
    mainItems.push({
      label: 'Inicio',
      icon: iconFor(active, Home24Filled, Home24Regular),
      active,
      onClick: () => onSelect('overview'),
    });
  }

  if (can('sales.create', 'sales.view')) {
    const children: SidebarChildItem[] = [];
    if (can('corte.create', 'corte.view')) {
      children.push({
        label: 'Corte de caja',
        active: isPath('/dashboard/sales/corte'),
        onClick: () => onSelect('sales-corte'),
      });
    }
    if (mpEnabled) {
      children.push({
        label: 'MercadoPago',
        active: isPath('/dashboard/sales/pagos-mp'),
        onClick: () => onSelect('pagos-mp'),
      });
    }
    const active = isAnyPath(SALES_PATHS);
    mainItems.push({
      label: 'Ventas',
      icon: iconFor(active, Cart24Filled, Cart24Regular),
      active,
      onClick: () => onSelect('sales-history'),
      ...(children.length > 0 ? { children } : {}),
    });
  }

  if (can('inventory.view')) {
    const active = isAnyPath(PRODUCT_PATHS);
    mainItems.push({
      label: 'Productos',
      icon: iconFor(active, Box24Filled, Box24Regular),
      active,
      badge: badges?.lowStock ? String(badges.lowStock) : undefined,
      onClick: () => onSelect('catalog'),
      children: [
        {
          label: 'Inventario general',
          active: isPath('/dashboard/products/inventory'),
          onClick: () => onSelect('inventory'),
        },
        {
          label: 'Reposición (pedidos)',
          active: isPath('/dashboard/products/pedidos'),
          onClick: () => onSelect('pedidos'),
        },
        {
          label: 'Mermas',
          active: isPath('/dashboard/products/mermas'),
          onClick: () => onSelect('mermas'),
        },
        {
          label: 'Prioridad',
          active: isPath('/dashboard/products/priority'),
          onClick: () => onSelect('inventory-priority'),
        },
      ],
    });
  }

  if (can('customers.view')) {
    const children: SidebarChildItem[] = [];
    if (can('fiado.view', 'fiado.create')) {
      children.push({
        label: 'Fiado / crédito',
        active: isPath('/dashboard/customers/fiado'),
        onClick: () => onSelect('fiado'),
      });
    }
    const active = isAnyPath(CUSTOMER_PATHS);
    mainItems.push({
      label: 'Clientes',
      icon: iconFor(active, People24Filled, People24Regular),
      active,
      onClick: () => onSelect('customers'),
      ...(children.length > 0 ? { children } : {}),
    });
  }

  // ── Admin navigation ──
  const adminItems: SidebarItem[] = [];

  if (can('expenses.view', 'suppliers.view', 'pedidos.view')) {
    const children: SidebarChildItem[] = [];
    if (can('suppliers.view')) {
      children.push({
        label: 'Proveedores',
        active: isPath('/dashboard/finance/suppliers'),
        onClick: () => onSelect('suppliers'),
      });
    }
    const active = isAnyPath(FINANCE_PATHS);
    adminItems.push({
      label: 'Finanzas',
      icon: iconFor(active, Money24Filled, Money24Regular),
      active,
      onClick: () => onSelect('expenses'),
      ...(children.length > 0 ? { children } : {}),
    });
  }

  if (can('analytics.view', 'reports.view')) {
    const children: SidebarChildItem[] = [];
    if (can('reports.view')) {
      children.push({
        label: 'Reportes',
        active: isPath('/dashboard/analytics/reports'),
        onClick: () => onSelect('reports'),
      });
    }
    const active = isAnyPath(ANALYTICS_PATHS);
    adminItems.push({
      label: 'Análisis integral',
      icon: iconFor(active, ChartMultiple24Filled, ChartMultiple24Regular),
      active,
      onClick: () => onSelect('analytics'),
      ...(children.length > 0 ? { children } : {}),
    });
  }

  if (can('inventory.view', 'inventory.edit')) {
    const active = isAnyPath(OTHERS_PATHS);
    adminItems.push({
      label: 'Otros',
      icon: iconFor(active, Apps24Filled, Apps24Regular),
      active,
      onClick: () => onSelect('promotions'),
      children: [
        {
          label: 'Promociones',
          active: isPath('/dashboard/others/promotions'),
          onClick: () => onSelect('promotions'),
        },
        {
          label: 'Categorías',
          active: isPath('/dashboard/others/categories'),
          onClick: () => onSelect('categories'),
        },
      ],
    });
  }

  // ── Sales channels ──
  const salesChannelItems: SidebarItem[] = [
    {
      label: 'Tienda online',
      icon: BuildingShop24Regular,
      onClick: () => onSelect('settings'),
    },
    {
      label: 'Agéntico',
      icon: Bot24Regular,
      onClick: () => onSelect('analytics'),
    },
    {
      label: 'Point of Sale',
      icon: iconFor(isAnyPath(SALES_PATHS), BuildingRetail24Filled, BuildingRetail24Regular),
      active: isAnyPath(SALES_PATHS),
      onClick: () => onSelect('sales-history'),
    },
    {
      label: 'Mercado Libre',
      icon: Channel24Regular,
      onClick: () => setAppStoreOpen(true),
    },
  ];

  // ── Apps ──
  const appItems: SidebarItem[] = [
    {
      label: 'Agregar apps',
      icon: PlugConnected24Regular,
      onClick: () => setAppStoreOpen(true),
    },
  ];

  // ── System ──
  const systemItems: SidebarItem[] = [];

  if (can('roles.manage')) {
    const active = isPath('/dashboard/settings/roles');
    systemItems.push({
      label: 'Usuarios y accesos',
      icon: iconFor(active, PersonLock24Filled, PersonLock24Regular),
      active,
      onClick: () => onSelect('roles'),
    });
  }

  if (can('settings.view')) {
    const active = isPath('/dashboard/settings');
    systemItems.push({
      label: 'Configuración avanzada',
      icon: iconFor(active, Settings24Filled, Settings24Regular),
      active,
      onClick: () => onSelect('settings'),
    });
  }

  const groups: SidebarGroup[] = [
    { items: mainItems },
    { title: 'Administración financiera', items: adminItems },
    { title: 'Canales de ventas', items: salesChannelItems },
    { title: 'Apps', items: appItems, fill: true },
    { title: 'Sistema', items: systemItems },
  ];

  const openFullMarketplace = () => {
    setAppStoreOpen(false);
    onSelect('settings');
  };

  return (
    <>
      {/* No search in sidebar — search lives in the top bar */}
      <Sidebar className="odx-sidebar" contentClassName="odx-sidebar__surface">
        <Sidebar.Content>{groups.map(renderGroup)}</Sidebar.Content>
        <Sidebar.Footer>
          <Sidebar.Rail aria-label="Contraer o expandir navegación" />
        </Sidebar.Footer>
      </Sidebar>

      <AppStoreModal
        open={appStoreOpen}
        onClose={() => setAppStoreOpen(false)}
        onOpenMarketplace={openFullMarketplace}
      />
    </>
  );
}