'use client';

import './CustomTopBar.css';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ActionList, Icon, Popover, Tooltip } from '@shopify/polaris';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import {
  MenuIcon,
  SearchIcon,
  ProductIcon,
  OrderIcon,
  FinanceIcon,
  SettingsIcon,
  HomeIcon,
  InventoryIcon,
  SidekickIcon,
} from '@shopify/polaris-icons';
import Image from 'next/image';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { HelpDrawer } from '@/components/support/HelpDrawer';

interface CustomTopBarProps {
  userMenu: React.ReactNode;
  storeSelector?: React.ReactNode;
  onNavigationToggle?: () => void;
  onSectionSelect?: (section: string) => void;
  onProductClick?: (product: { id: string; name: string; sku: string; barcode: string; category: string }) => void;
}

const QUICK_ACTIONS = [
  { label: 'Inicio', section: 'overview', icon: HomeIcon, keywords: 'inicio dashboard resumen principal' },
  { label: 'Punto de Venta', section: 'sales', icon: OrderIcon, keywords: 'venta cobrar ticket pos punto' },
  { label: 'Inventario', section: 'inventory', icon: InventoryIcon, keywords: 'inventario stock productos almacen' },
  { label: 'Productos', section: 'catalog', icon: ProductIcon, keywords: 'catalogo productos lista articulos' },
  {
    label: 'Historial de Ventas',
    section: 'sales-history',
    icon: OrderIcon,
    keywords: 'historial ventas registros transacciones',
  },
  { label: 'Gastos', section: 'expenses', icon: FinanceIcon, keywords: 'gastos egresos pagos finanzas' },
  { label: 'Proveedores', section: 'suppliers', icon: FinanceIcon, keywords: 'proveedores distribuidores compras' },
  {
    label: 'Analíticas',
    section: 'analytics',
    icon: FinanceIcon,
    keywords: 'analiticas reportes estadisticas graficas',
  },
  {
    label: 'Configuración',
    section: 'settings',
    icon: SettingsIcon,
    keywords: 'configuracion ajustes preferencias tienda',
  },
  { label: 'Corte de Caja', section: 'sales-corte', icon: FinanceIcon, keywords: 'corte caja cierre turno' },
];

export function CustomTopBar({
  userMenu,
  storeSelector,
  onNavigationToggle,
  onSectionSelect,
  onProductClick,
}: CustomTopBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const products = useDashboardStore((s) => s.products);
  const _shortcutLabel = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

  const filteredProducts = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.category.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [query, products]);

  const filteredActions = useMemo(() => {
    if (!query.trim()) return QUICK_ACTIONS.slice(0, 5);
    const q = query.toLowerCase();
    return QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(q) || a.keywords.includes(q)).slice(0, 5);
  }, [query]);

  const totalResults = filteredProducts.length + filteredActions.length;
  const shouldShowSearchPopover = isFocused && (query.length >= 1 || isFocused);
  const searchPopoverActive = shouldShowSearchPopover && (totalResults > 0 || query.length >= 2);

  /* eslint-disable react-hooks/set-state-in-effect -- reset on query change */
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur();
        setIsFocused(false);
      }
      // Open help with ? key (only when not typing in an input)
      if (e.key === '?' && !isFocused && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setIsHelpOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFocused]);

  // === SOPORTE Y ASISTENCIA ===
  const openLiveChat = useCallback(() => {
    setIsHelpOpen(true);
  }, []);

  useEffect(() => {
    const win = window as Window & { shopify?: { support?: { registerHandler: (fn: () => void) => void } } };
    if (typeof window !== 'undefined' && win.shopify?.support) {
      win.shopify.support.registerHandler(() => {
        openLiveChat();
      });
    }
  }, [openLiveChat]);

  const handleSelect = useCallback(
    (type: 'product' | 'action', index: number) => {
      if (type === 'action') {
        const action = filteredActions[index];
        if (action && onSectionSelect) onSectionSelect(action.section);
      } else {
        const product = filteredProducts[index];
        if (product && onProductClick) onProductClick(product);
      }
      setQuery('');
      setIsFocused(false);
      inputRef.current?.blur();
    },
    [filteredActions, filteredProducts, onSectionSelect, onProductClick],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, totalResults - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && totalResults > 0) {
        e.preventDefault();
        if (selectedIndex < filteredActions.length) {
          handleSelect('action', selectedIndex);
        } else {
          handleSelect('product', selectedIndex - filteredActions.length);
        }
      }
    },
    [totalResults, selectedIndex, filteredActions.length, handleSelect],
  );

  const actionItems = useMemo(
    () =>
      filteredActions.map((action, index) => ({
        content: action.label,
        prefix: <Icon source={action.icon} tone="subdued" />,
        suffix: selectedIndex === index ? '↵' : undefined,
        active: selectedIndex === index,
        onAction: () => handleSelect('action', index),
      })),
    [filteredActions, handleSelect, selectedIndex],
  );

  const productItems = useMemo(
    () =>
      filteredProducts.map((product, index) => {
        const itemIndex = filteredActions.length + index;
        return {
          content: product.name,
          helpText: `${product.sku} · ${product.category}`,
          prefix: <OptimizedImage source={product.imageUrl} alt={product.name} size="extraSmall" />,
          suffix: (
            <span className="ctb-result-suffix">
              <strong>{formatCurrency(product.unitPrice)}</strong>
              <span className={product.currentStock <= product.minStock ? 'critical' : undefined}>
                {product.currentStock} uds
              </span>
            </span>
          ),
          active: selectedIndex === itemIndex,
          onAction: () => handleSelect('product', index),
        };
      }),
    [filteredActions.length, filteredProducts, handleSelect, selectedIndex],
  );

  const searchActivator = (
    <div
      className={`ctb-search-input-row${isFocused ? ' focused' : ''}`}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="ctb-search-icon">
        <Icon source={SearchIcon} tone="inherit" />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar"
        className="ctb-search-native"
      />
      {!isFocused && (
        <div className="ctb-kbd">
          <span>CTRL</span>
          <span>K</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="ctb-root">
      {/* Left */}
      {onNavigationToggle && (
        <button className="ctb-ham" onClick={onNavigationToggle} aria-label="Abrir menú">
          <Icon source={MenuIcon} tone="inherit" />
        </button>
      )}
      <div className="ctb-logo">
        <Image
          src="/logo.svg"
          alt="Logo"
          width={110}
          height={28}
          priority
          style={{ display: 'block', filter: 'brightness(0) invert(1)', opacity: 0.9 }}
        />
      </div>

      {/* Center: Search */}
      <div className="ctb-search-wrap">
        <div className="ctb-search-box">
          <Popover
            active={searchPopoverActive}
            activator={searchActivator}
            onClose={() => setIsFocused(false)}
            fullWidth
            preferredAlignment="center"
            preferredPosition="below"
            preventFocusOnClose
          >
            <Popover.Pane fixed>
              {actionItems.length > 0 && (
                <ActionList
                  actionRole="menuitem"
                  sections={[
                    {
                      title: query.length < 2 ? 'Accesos rápidos' : 'Secciones',
                      items: actionItems,
                    },
                  ]}
                />
              )}
              {productItems.length > 0 && (
                <ActionList
                  actionRole="menuitem"
                  sections={[
                    {
                      title: `Productos (${filteredProducts.length})`,
                      items: productItems,
                    },
                  ]}
                />
              )}
              {query.length >= 2 && totalResults === 0 && (
                <Popover.Section>
                  <div className="ctb-dd-empty">Sin resultados para &quot;{query}&quot;</div>
                </Popover.Section>
              )}
              <Popover.Section>
                <div className="ctb-dd-footer">
                  <span>↑↓ navegar</span>
                  <span>↵ seleccionar</span>
                  <span>esc cerrar</span>
                </div>
              </Popover.Section>
            </Popover.Pane>
          </Popover>
        </div>
      </div>

      {/* Right */}
      <div className="ctb-actions">
        {storeSelector}

        <Tooltip content="Soporte y Ayuda" dismissOnMouseOut>
          <button className="ctb-icon-btn" onClick={openLiveChat} aria-label="Soporte">
            <Icon source={SidekickIcon} tone="inherit" />
          </button>
        </Tooltip>

        <div className="ctb-sep-v" />

        {userMenu}
      </div>

      <HelpDrawer open={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
