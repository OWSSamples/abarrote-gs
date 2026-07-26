'use client';

import { useState } from 'react';
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  Icon,
  InlineGrid,
  InlineStack,
  Modal,
  Navigation,
  Text,
} from '@shopify/polaris';
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
  ArrowDownIcon,
  EmailIcon,
  ImportIcon,
  LogoGoogleIcon,
  LogoInstagramIcon,
  LogoPinterestIcon,
  MarketsIcon,
  MegaphoneIcon,
  PlusCircleIcon,
  PointOfSaleIcon,
  SearchIcon,
  StarFilledIcon,
  StoreIcon,
  StoreOnlineIcon,
} from '@shopify/polaris-icons';
import { usePermissions } from '@/hooks/usePermissions';
import { useDashboardStore } from '@/store/dashboardStore';

type AppStoreIcon = typeof AppsIcon;

interface AppStoreSuggestion {
  title: string;
  description: string;
  icon: AppStoreIcon;
  rating: string;
  builtBy?: string;
  group: 'recommended' | 'needed' | 'shopify';
}

const APP_STORE_SUGGESTIONS: AppStoreSuggestion[] = [
  {
    title: 'Abastecimiento inteligente',
    description: 'Busca productos nuevos, sugerencias de compra y reposición automática para tu tienda.',
    icon: ImportIcon,
    rating: '4.6',
    builtBy: 'Built for Kiosko',
    group: 'recommended',
  },
  {
    title: 'Instagram Feed',
    description: 'Personaliza tu tienda, muestra contenido social y destaca promociones visuales.',
    icon: LogoInstagramIcon,
    rating: '4.9',
    builtBy: 'Built for Kiosko',
    group: 'recommended',
  },
  {
    title: 'Marketing email y SMS',
    description: 'Encuentra clientes nuevos y haz que vuelvan con campañas automáticas.',
    icon: EmailIcon,
    rating: '4.7',
    builtBy: 'Built for Kiosko',
    group: 'recommended',
  },
  {
    title: 'Mercado Libre',
    description: 'Publica productos, sincroniza inventario y centraliza pedidos desde Mercado Libre.',
    icon: MarketsIcon,
    rating: 'Nuevo',
    group: 'needed',
  },
  {
    title: 'Google & YouTube',
    description: 'Conecta tu tienda con Google Shopping, YouTube y campañas de descubrimiento.',
    icon: LogoGoogleIcon,
    rating: '4.5',
    group: 'needed',
  },
  {
    title: 'Pinterest',
    description: 'Permite que compradores descubran tus productos en Pinterest.',
    icon: LogoPinterestIcon,
    rating: '4.2',
    group: 'needed',
  },
  {
    title: 'Reseñas de productos',
    description: 'Aumenta las ventas con reseñas, fotos y confianza social.',
    icon: StarFilledIcon,
    rating: '5.0',
    builtBy: 'Built for Kiosko',
    group: 'needed',
  },
  {
    title: 'Búsqueda y recomendaciones',
    description: 'Personaliza búsqueda, filtros y recomendaciones de productos.',
    icon: SearchIcon,
    rating: '2.8',
    group: 'shopify',
  },
  {
    title: 'Mensajería para clientes',
    description: 'Herramientas de mensajes diseñadas para crecer sin programar.',
    icon: MegaphoneIcon,
    rating: '4.7',
    group: 'shopify',
  },
];

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
  const [appStoreOpen, setAppStoreOpen] = useState(false);

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

  const salesChannelItems = [
    {
      url: '#',
      label: 'Tienda online',
      icon: StoreOnlineIcon,
      onClick: () => onSelect('settings'),
    },
    {
      url: '#',
      label: 'Agéntico',
      icon: StoreIcon,
      onClick: () => onSelect('analytics'),
    },
    {
      url: '#',
      label: 'Point of Sale',
      icon: PointOfSaleIcon,
      selected: isAnyPath(SALES_PATHS),
      onClick: () => onSelect('sales-history'),
    },
    {
      url: '#',
      label: 'Mercado Libre',
      icon: MarketsIcon,
      onClick: () => setAppStoreOpen(true),
    },
  ];

  const appItems = [
    {
      url: '#',
      label: 'Agregar',
      icon: PlusCircleIcon,
      onClick: () => setAppStoreOpen(true),
    },
  ];

  const openFullMarketplace = () => {
    setAppStoreOpen(false);
    onSelect('settings');
  };

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
    <>
      <Navigation location={pathname}>
        {mainItems.length > 0 && <Navigation.Section items={mainItems} />}
        {adminItems.length > 0 && <Navigation.Section title="Administración Financiera" separator items={adminItems} />}
        <Navigation.Section title="Canales de ventas" separator items={salesChannelItems} />
        <Navigation.Section title="Apps" items={appItems} fill />
        {systemItems.length > 0 && <Navigation.Section title="Sistema" separator items={systemItems} />}
      </Navigation>
      <AppStoreModal
        open={appStoreOpen}
        onClose={() => setAppStoreOpen(false)}
        onOpenMarketplace={openFullMarketplace}
      />
    </>
  );
}

function AppStoreModal({
  open,
  onClose,
  onOpenMarketplace,
}: {
  open: boolean;
  onClose: () => void;
  onOpenMarketplace: () => void;
}) {
  const recommended = APP_STORE_SUGGESTIONS.filter((app) => app.group === 'recommended');
  const needed = APP_STORE_SUGGESTIONS.filter((app) => app.group === 'needed');
  const shopify = APP_STORE_SUGGESTIONS.filter((app) => app.group === 'shopify');

  return (
    <Modal open={open} onClose={onClose} title="Seleccionado para ti" size="large">
      <Modal.Section>
        <BlockStack gap="500">
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
            {recommended.map((app) => (
              <FeaturedAppCard key={app.title} app={app} onInstall={onOpenMarketplace} />
            ))}
          </InlineGrid>

          <BlockStack gap="300">
            <Text as="h3" variant="headingSm" fontWeight="semibold">
              Más apps que tu negocio podría necesitar
            </Text>
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              {needed.map((app) => (
                <CompactAppCard key={app.title} app={app} onInstall={onOpenMarketplace} />
              ))}
            </InlineGrid>
          </BlockStack>

          <BlockStack gap="300">
            <Text as="h3" variant="headingSm" fontWeight="semibold">
              Hecha para Kiosko
            </Text>
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              {shopify.map((app) => (
                <CompactAppCard key={app.title} app={app} onInstall={onOpenMarketplace} />
              ))}
            </InlineGrid>
          </BlockStack>

          <Divider />
          <InlineStack align="space-between" blockAlign="center" gap="300">
            <Text as="p" variant="bodySm" tone="subdued">
              Descubre más integraciones, permisos y estados de instalación en el Marketplace de Kiosko.
            </Text>
            <Button variant="plain" onClick={onOpenMarketplace}>
              Abrir Marketplace
            </Button>
          </InlineStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

function FeaturedAppCard({ app, onInstall }: { app: AppStoreSuggestion; onInstall: () => void }) {
  return (
    <Card padding="0">
      <BlockStack gap="0">
        <Box padding="400">
          <BlockStack gap="200">
            <Text as="h4" variant="headingSm" fontWeight="semibold">
              {app.title}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {app.description}
            </Text>
          </BlockStack>
        </Box>
        <Box padding="400" background="bg-surface-secondary">
          <InlineStack align="space-between" blockAlign="center" gap="300">
            <InlineStack gap="300" blockAlign="center" wrap={false}>
              <AppIcon icon={app.icon} />
              <BlockStack gap="050">
                <Text as="p" variant="bodySm" fontWeight="medium">
                  {app.title}
                </Text>
                <RatingLine app={app} />
              </BlockStack>
            </InlineStack>
            <Button accessibilityLabel={`Instalar ${app.title}`} icon={ArrowDownIcon} onClick={onInstall} />
          </InlineStack>
        </Box>
      </BlockStack>
    </Card>
  );
}

function CompactAppCard({ app, onInstall }: { app: AppStoreSuggestion; onInstall: () => void }) {
  return (
    <Card>
      <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <AppIcon icon={app.icon} />
          <BlockStack gap="050">
            <Text as="p" variant="bodyMd" fontWeight="medium">
              {app.title}
            </Text>
            <RatingLine app={app} />
            <Text as="p" variant="bodySm" tone="subdued">
              {app.description}
            </Text>
          </BlockStack>
        </InlineStack>
        <Button accessibilityLabel={`Instalar ${app.title}`} icon={ArrowDownIcon} onClick={onInstall} />
      </InlineStack>
    </Card>
  );
}

function AppIcon({ icon }: { icon: AppStoreIcon }) {
  return (
    <Box padding="200" background="bg-surface-secondary" borderRadius="200">
      <Icon source={icon} tone="base" />
    </Box>
  );
}

function RatingLine({ app }: { app: AppStoreSuggestion }) {
  return (
    <InlineStack gap="100" blockAlign="center">
      <Text as="span" variant="bodySm" tone="subdued">
        {app.rating}
      </Text>
      <Icon source={StarFilledIcon} tone="subdued" />
      {app.builtBy ? <Badge>{app.builtBy}</Badge> : null}
    </InlineStack>
  );
}
