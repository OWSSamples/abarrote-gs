'use client';

import './CustomTopBar.css';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Toolbar }    from '@cloudflare/kumo/components/toolbar';
import { InputGroup } from '@cloudflare/kumo/components/input';
import { Text }       from '@cloudflare/kumo/components/text';
import { Tooltip }    from '@cloudflare/kumo/components/tooltip';
import {
  QuestionCircle24Regular,
  Search24Regular,
  Sparkle24Regular,
  Home24Regular,
  Cart24Regular,
  Box24Regular,
  People24Regular,
  Money24Regular,
  Settings24Regular,
  ChartMultiple24Regular,
} from '@fluentui/react-icons';
import Image from 'next/image';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency }    from '@/lib/utils';
import { OptimizedImage }    from '@/components/ui/OptimizedImage';

// ─── Tipos ────────────────────────────────────────────────────────────────
interface CustomTopBarProps {
  userMenu: React.ReactNode;
  onNavigationToggle?: () => void;
  onSectionSelect?: (section: string) => void;
  onProductClick?: (product: {
    id: string; name: string; sku: string; barcode: string;
    category: string; imageUrl?: string; unitPrice?: number;
    currentStock?: number; minStock?: number;
  }) => void;
}

// ─── Accesos rápidos ──────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Inicio',           section: 'overview',      icon: Home24Regular,         keywords: 'inicio dashboard resumen principal' },
  { label: 'Punto de venta',   section: 'sales',         icon: Cart24Regular,          keywords: 'venta cobrar ticket pos punto' },
  { label: 'Inventario',       section: 'inventory',     icon: Box24Regular,           keywords: 'inventario stock productos almacen' },
  { label: 'Historial ventas', section: 'sales-history', icon: Cart24Regular,          keywords: 'historial ventas registros transacciones' },
  { label: 'Gastos',           section: 'expenses',      icon: Money24Regular,         keywords: 'gastos egresos pagos finanzas' },
  { label: 'Proveedores',      section: 'suppliers',     icon: People24Regular,        keywords: 'proveedores distribuidores compras' },
  { label: 'Analíticas',       section: 'analytics',     icon: ChartMultiple24Regular, keywords: 'analiticas reportes estadisticas graficas' },
  { label: 'Configuración',    section: 'settings',      icon: Settings24Regular,      keywords: 'configuracion ajustes preferencias tienda' },
];

// ─── Componente ───────────────────────────────────────────────────────────
export function CustomTopBar({
  userMenu,
  onNavigationToggle,
  onSectionSelect,
  onProductClick,
}: CustomTopBarProps) {
  const [query,         setQuery]         = useState('');
  const [isFocused,     setIsFocused]     = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const products = useDashboardStore((s) => s.products ?? []);

  // ── Filtros ───────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    return products
      .filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.includes(q) ||
        p.category?.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [query, products]);

  const filteredActions = useMemo(() => {
    if (!query.trim()) return QUICK_ACTIONS.slice(0, 5);
    const q = query.toLowerCase();
    return QUICK_ACTIONS.filter(
      (a) => a.label.toLowerCase().includes(q) || a.keywords.includes(q),
    ).slice(0, 5);
  }, [query]);

  const totalResults = filteredProducts.length + filteredActions.length;
  const showDropdown = isFocused && totalResults > 0;

  // ── Atajos globales ───────────────────────────────────────────────────
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
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Click fuera ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Selección ─────────────────────────────────────────────────────────
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

  // ── Teclado ───────────────────────────────────────────────────────────
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
    // Header nativo — Toolbar de Kumo es w-fit y no sirve como topbar completo
    <header className="ctb-root" role="banner">

      {/* ── Hamburguesa móvil ── */}
      {onNavigationToggle && (
        <button
          type="button"
          className="ctb-ham"
          onClick={onNavigationToggle}
          aria-label="Abrir menú"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M3 7h18M3 12h18M3 17h18" />
          </svg>
        </button>
      )}

      {/* ── Logo — alineado con el ancho del sidebar ── */}
      <div className="ctb-logo">
        <Image
          src="/icon/cloudflare.svg"
          alt="Opendex"
          width={26}
          height={15}
          priority
          className="ctb-logo-mark"
        />
        <Text as="span" className="ctb-logo-name">
          Opendex
        </Text>
      </div>

      {/* ── Buscador centrado — InputGroup de Kumo ── */}
      <div className="ctb-search-wrap" ref={dropdownRef}>
        <InputGroup
          size="sm"
          className={`ctb-search-ig${isFocused ? ' ctb-search-ig--focused' : ''}`}
          onClick={() => inputRef.current?.focus()}
        >
          <InputGroup.Addon className="ctb-search-addon">
            <Search24Regular aria-hidden="true" />
          </InputGroup.Addon>

          <InputGroup.Input
            ref={inputRef}
            id="global-search"
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar productos, acciones..."
            className="ctb-search-input"
            autoComplete="off"
            spellCheck={false}
            aria-label="Buscar productos, clientes o secciones"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? 'search-results' : undefined}
          />

          {!isFocused && (
            <InputGroup.Addon align="end" className="ctb-search-kbd-addon">
              <div className="ctb-kbd" aria-hidden="true">
                <kbd>Ctrl</kbd><kbd>K</kbd>
              </div>
            </InputGroup.Addon>
          )}
        </InputGroup>

        {/* Dropdown */}
        {showDropdown && (
          <div id="search-results" className="ctb-dropdown" role="listbox" aria-label="Resultados">

            {filteredActions.length > 0 && (
              <div className="ctb-dd-section">
                <p className="ctb-dd-label">{query.length < 2 ? 'Accesos rápidos' : 'Secciones'}</p>
                {filteredActions.map((action, index) => {
                  const Icon = action.icon;
                  const active = selectedIndex === index;
                  return (
                    <button
                      key={action.section}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`ctb-dd-item${active ? ' ctb-dd-item--active' : ''}`}
                      onClick={() => handleSelect('action', index)}
                    >
                      <span className="ctb-dd-icon"><Icon /></span>
                      <span className="ctb-dd-text">{action.label}</span>
                      {active && <span className="ctb-dd-enter" aria-hidden="true">⏎</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredProducts.length > 0 && (
              <div className="ctb-dd-section">
                <p className="ctb-dd-label">Productos ({filteredProducts.length})</p>
                {filteredProducts.map((product, index) => {
                  const itemIndex = filteredActions.length + index;
                  const active = selectedIndex === itemIndex;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`ctb-dd-item${active ? ' ctb-dd-item--active' : ''}`}
                      onClick={() => handleSelect('product', index)}
                    >
                      <span className="ctb-dd-icon">
                        <OptimizedImage source={product.imageUrl || '/placeholder.png'} alt={product.name} size="extraSmall" />
                      </span>
                      <span className="ctb-dd-content">
                        <span className="ctb-dd-text">{product.name}</span>
                        <span className="ctb-dd-meta">{product.sku} · {product.category}</span>
                      </span>
                      <span className="ctb-dd-price">
                        <strong>{formatCurrency(product.unitPrice ?? 0)}</strong>
                        <span className={(product.currentStock ?? 0) <= (product.minStock ?? 0) ? 'ctb-dd-critical' : ''}>
                          {product.currentStock ?? 0} uds
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {query.length >= 2 && totalResults === 0 && (
              <p className="ctb-dd-empty">Sin resultados para &quot;{query}&quot;</p>
            )}

            <div className="ctb-dd-footer" aria-hidden="true">
              <span>↑↓ navegar</span>
              <span>⏎ seleccionar</span>
              <span>Esc cerrar</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Acciones derechas — Toolbar de Kumo para el grupo de botones ── */}
      <div className="ctb-actions">
        {/* Toolbar de Kumo: aquí sí aplica porque es un grupo compacto de botones */}
        <Toolbar size="sm" className="ctb-toolbar-actions">
          <Tooltip content="Asistente de IA">
            <Toolbar.Button type="button" className="ctb-action-btn" aria-label="Asistente de IA">
              <Sparkle24Regular />
              <span className="ctb-action-label">Ask AI</span>
            </Toolbar.Button>
          </Tooltip>
          <Tooltip content="Centro de ayuda">
            <Toolbar.Button type="button" className="ctb-action-btn" aria-label="Centro de ayuda">
              <QuestionCircle24Regular />
              <span className="ctb-action-label">Ayuda</span>
            </Toolbar.Button>
          </Tooltip>
        </Toolbar>

        {userMenu}
      </div>
    </header>
  );
}
