'use client';

import './CustomTopBar.css';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Icon, Popover, Tooltip } from '@shopify/polaris';
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
  CalendarIcon,
  CartIcon,
  AlertCircleIcon,
  XCircleIcon,
  SidekickIcon,
} from '@shopify/polaris-icons';
import Image from 'next/image';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { HelpDrawer } from '@/components/support/HelpDrawer';

interface CustomTopBarProps {
  userMenu: React.ReactNode;
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

export function CustomTopBar({ userMenu, onNavigationToggle, onSectionSelect, onProductClick }: CustomTopBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const products = useDashboardStore((s) => s.products);
  const inventoryAlerts = useDashboardStore((s) => s.inventoryAlerts);
  const _shortcutLabel = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

  const TelegramIcon = (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style={{ display: 'block' }}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.14-.257.257-.527.257l.215-3.048 5.548-5.013c.24-.213-.054-.334-.373-.121l-6.86 4.316-2.955-.924c-.642-.2-.654-.642.133-.949l11.55-4.45c.535-.194 1.003.125.768.96z" />
    </svg>
  );

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
  const showDropdown = isFocused && (query.length >= 1 || isFocused);

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
        setIsNotificationsOpen(false);
      }
      // Open help with ? key (only when not typing in an input)
      if (e.key === '?' && !isFocused && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setIsHelpOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFocused]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    if (isFocused) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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

  const formatNotificationTime = useCallback((createdAt: string) => {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';
    const now = Date.now();
    const diff = Math.floor((now - date.getTime()) / 60000);
    if (diff < 1) return 'ahora';
    if (diff < 60) return `hace ${diff}m`;
    if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }, []);

  const alertTypeLabel: Record<string, string> = {
    low_stock: 'Stock bajo',
    expiration: 'Por vencer',
    expired: 'Vencido',
    merma: 'Merma',
  };

  const alertIcon: Record<string, typeof InventoryIcon> = {
    low_stock: InventoryIcon,
    expiration: CalendarIcon,
    expired: XCircleIcon,
    merma: CartIcon,
  };

  const alertSeverityStyle: Record<string, { dot: string; bg: string; border: string }> = {
    critical: { dot: '#ff4d4d', bg: 'rgba(255,77,77,0.08)', border: 'rgba(255,77,77,0.15)' },
    warning: { dot: '#f5a623', bg: 'rgba(245,166,35,0.08)', border: 'rgba(245,166,35,0.15)' },
    info: { dot: '#4a9eff', bg: 'rgba(74,158,255,0.08)', border: 'rgba(74,158,255,0.15)' },
  };

  const criticalCount = inventoryAlerts.filter((a) => a.severity === 'critical').length;
  const warningCount = inventoryAlerts.filter((a) => a.severity === 'warning').length;

  const buildAlertDescription = useCallback((alert: (typeof inventoryAlerts)[number]) => {
    if (alert.alertType === 'low_stock') {
      return `Stock: ${alert.product.currentStock} / Mínimo: ${alert.product.minStock}`;
    }
    if ((alert.alertType === 'expiration' || alert.alertType === 'expired') && alert.product.expirationDate) {
      return `Caduca: ${new Date(alert.product.expirationDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return alert.message;
  }, []);

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
        <div className="ctb-search-box" ref={dropdownRef}>
          <div
            className={`ctb-search-input-row${isFocused ? ' focused' : ''}${showDropdown && totalResults > 0 ? ' open-dd' : ''}`}
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

          {showDropdown && (totalResults > 0 || query.length >= 2) && (
            <div className="ctb-dropdown">
              {filteredActions.length > 0 && (
                <div>
                  <div className="ctb-dd-section-label">{query.length < 2 ? 'Accesos rápidos' : 'Secciones'}</div>
                  {filteredActions.map((action, i) => (
                    <button
                      key={action.section}
                      className={`ctb-dd-item${selectedIndex === i ? ' active' : ''}`}
                      onClick={() => handleSelect('action', i)}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      <div className="ctb-dd-item-icon">
                        <Icon source={action.icon} tone="inherit" />
                      </div>
                      <span>{action.label}</span>
                      <span className="ctb-dd-item-arrow">↵</span>
                    </button>
                  ))}
                </div>
              )}

              {filteredProducts.length > 0 && (
                <div>
                  {filteredActions.length > 0 && <div className="ctb-dd-sep" />}
                  <div className="ctb-dd-section-label">Productos ({filteredProducts.length})</div>
                  {filteredProducts.map((product, i) => {
                    const idx = filteredActions.length + i;
                    return (
                      <button
                        key={product.id}
                        className={`ctb-dd-item${selectedIndex === idx ? ' active' : ''}`}
                        onClick={() => handleSelect('product', i)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <OptimizedImage source={product.imageUrl} alt={product.name} size="extraSmall" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: '#e4e4e7',
                            }}
                          >
                            {product.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#52525b' }}>
                            {product.sku} · {product.category}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#6ee7b7' }}>
                            {formatCurrency(product.unitPrice)}
                          </div>
                          <div
                            style={{
                              fontSize: '10.5px',
                              color: product.currentStock <= product.minStock ? '#f87171' : '#52525b',
                            }}
                          >
                            {product.currentStock} uds
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {query.length >= 2 && totalResults === 0 && (
                <div className="ctb-dd-empty">
                  <div style={{ color: '#52525b', fontSize: '13px' }}>Sin resultados para &quot;{query}&quot;</div>
                </div>
              )}

              <div className="ctb-dd-footer">
                <span>↑↓ navegar</span>
                <span>↵ seleccionar</span>
                <span>esc cerrar</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="ctb-actions">
        <Tooltip content="Soporte y Ayuda" dismissOnMouseOut>
          <button className="ctb-icon-btn" onClick={openLiveChat} aria-label="Soporte">
            <Icon source={SidekickIcon} tone="inherit" />
          </button>
        </Tooltip>

        <div className="ctb-sep-v" />

        <Popover
          active={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          preferredAlignment="right"
          preferredPosition="below"
          activator={
            <Tooltip
              content={`Alertas vía Telegram${inventoryAlerts.length > 0 ? ` (${inventoryAlerts.length})` : ''}`}
              dismissOnMouseOut
            >
              <button
                className={`ctb-icon-btn${isNotificationsOpen ? ' active' : ''}`}
                onClick={() => setIsNotificationsOpen((p) => !p)}
                aria-label="Alertas de Telegram"
              >
                <div style={{ color: 'inherit' }}>{TelegramIcon}</div>
                {criticalCount > 0 && <span className="ctb-badge">{criticalCount > 9 ? '9+' : criticalCount}</span>}
                {criticalCount === 0 && warningCount > 0 && (
                  <span className="ctb-badge warn">{warningCount > 9 ? '9+' : warningCount}</span>
                )}
              </button>
            </Tooltip>
          }
        >
          <div className="ctb-notif-panel">
            <div className="ctb-notif-header">
              <span className="ctb-notif-title">Alertas de inventario</span>
              <div className="ctb-notif-counters">
                {criticalCount > 0 && (
                  <span className="ctb-notif-count critical">
                    <span className="ctb-notif-dot" style={{ background: '#f87171' }} />
                    {criticalCount} crítica{criticalCount !== 1 ? 's' : ''}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="ctb-notif-count warning">
                    <span className="ctb-notif-dot" style={{ background: '#fbbf24' }} />
                    {warningCount} advertencia{warningCount !== 1 ? 's' : ''}
                  </span>
                )}
                {inventoryAlerts.length === 0 && <span className="ctb-notif-count neutral">Sin alertas</span>}
              </div>
            </div>

            <div className="ctb-notif-list">
              {inventoryAlerts.length === 0 ? (
                <div className="ctb-notif-empty">
                  <div style={{ marginBottom: '8px', color: '#52525b', display: 'flex', justifyContent: 'center' }}>
                    {TelegramIcon}
                  </div>
                  Todo en orden. No hay alertas activas en Telegram.
                </div>
              ) : (
                inventoryAlerts.map((alert) => {
                  const sev = alertSeverityStyle[alert.severity] ?? alertSeverityStyle.info;
                  const AIcon = alertIcon[alert.alertType] ?? AlertCircleIcon;
                  return (
                    <div
                      key={alert.id}
                      className="ctb-notif-item"
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        onProductClick?.(alert.product);
                      }}
                    >
                      <div
                        className="ctb-notif-icon-wrap"
                        style={{ background: sev.bg, border: `1px solid ${sev.border}` }}
                      >
                        <div style={{ color: sev.dot, display: 'flex' }}>
                          <Icon source={AIcon} tone="inherit" />
                        </div>
                      </div>
                      <div className="ctb-notif-body">
                        <div className="ctb-notif-type" style={{ color: sev.dot }}>
                          {alertTypeLabel[alert.alertType] ?? alert.alertType}
                        </div>
                        <div className="ctb-notif-name">{alert.product.name}</div>
                        <div className="ctb-notif-desc">{buildAlertDescription(alert)}</div>
                      </div>
                      <div className="ctb-notif-time">{formatNotificationTime(alert.createdAt)}</div>
                    </div>
                  );
                })
              )}
            </div>

            {inventoryAlerts.length > 0 && (
              <div className="ctb-notif-footer">
                {inventoryAlerts.length} alerta{inventoryAlerts.length !== 1 ? 's' : ''} en total
              </div>
            )}
          </div>
        </Popover>

        <div className="ctb-sep-v" />

        {userMenu}
      </div>

      <HelpDrawer open={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
