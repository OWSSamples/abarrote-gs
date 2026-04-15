'use client';

import { useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@shopify/polaris';
import {
  HomeIcon,
  OrderIcon,
  ProductIcon,
  PersonIcon,
  MenuIcon,
  XIcon,
  FinanceIcon,
  ChartVerticalIcon,
  SettingsIcon,
  AppsIcon,
  PersonLockIcon,
} from '@shopify/polaris-icons';

/* ─── Grouped sections for the "Más" drawer ─── */
const MORE_GROUPS = [
  {
    title: 'Finanzas',
    items: [
      { label: 'Gastos', icon: FinanceIcon, path: '/dashboard/finance/expenses' },
      { label: 'Proveedores', icon: FinanceIcon, path: '/dashboard/finance/suppliers' },
    ],
  },
  {
    title: 'Análisis',
    items: [
      { label: 'Análisis Integral', icon: ChartVerticalIcon, path: '/dashboard/analytics' },
      { label: 'Reportes', icon: ChartVerticalIcon, path: '/dashboard/analytics/reports' },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { label: 'Configuración', icon: SettingsIcon, path: '/dashboard/settings' },
      { label: 'Usuarios y Roles', icon: PersonLockIcon, path: '/dashboard/settings/roles' },
    ],
  },
  {
    title: 'Otros',
    items: [
      { label: 'Promociones', icon: AppsIcon, path: '/dashboard/others/promotions' },
      { label: 'Categorías', icon: AppsIcon, path: '/dashboard/others/categories' },
      { label: 'Servicios', icon: AppsIcon, path: '/dashboard/others/servicios' },
    ],
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    {
      id: 'home',
      label: 'Inicio',
      icon: HomeIcon,
      path: '/dashboard',
      exact: true,
    },
    {
      id: 'sales',
      label: 'Ventas',
      icon: OrderIcon,
      path: '/dashboard/sales',
      exact: false,
    },
    {
      id: 'products',
      label: 'Productos',
      icon: ProductIcon,
      path: '/dashboard/products',
      exact: false,
    },
    {
      id: 'customers',
      label: 'Clientes',
      icon: PersonIcon,
      path: '/dashboard/customers',
      exact: false,
    },
  ];

  /* Check if current path belongs to a "Más" group */
  const isMoreActive = MORE_GROUPS.some((g) =>
    g.items.some((item) => pathname === item.path || pathname.startsWith(item.path + '/')),
  );

  const handleDrawerNav = useCallback(
    (path: string) => {
      router.push(path);
      setDrawerOpen(false);
    },
    [router],
  );

  return (
    <>
      {/* ── Drawer overlay ── */}
      {drawerOpen && (
        <div className="mbn-overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      {/* ── Drawer panel ── */}
      <div className={`mbn-drawer${drawerOpen ? ' mbn-drawer-open' : ''}`} role="dialog" aria-label="Más opciones">
        <div className="mbn-drawer-header">
          <span className="mbn-drawer-title">Más opciones</span>
          <button className="mbn-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Cerrar">
            <Icon source={XIcon} />
          </button>
        </div>
        <div className="mbn-drawer-body">
          {MORE_GROUPS.map((group) => (
            <div key={group.title} className="mbn-group">
              <span className="mbn-group-title">{group.title}</span>
              {group.items.map((item) => {
                const active = pathname === item.path || pathname.startsWith(item.path + '/');
                return (
                  <button
                    key={item.path}
                    className={`mbn-drawer-item${active ? ' mbn-drawer-item-active' : ''}`}
                    onClick={() => handleDrawerNav(item.path)}
                  >
                    <span className="mbn-drawer-item-icon">
                      <Icon source={item.icon} />
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom tab bar ── */}
      <nav className="mbn-root" aria-label="Navegación principal">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.path
            : pathname === item.path || pathname.startsWith(item.path + '/');

          return (
            <button
              key={item.id}
              onClick={() => {
                setDrawerOpen(false);
                router.push(item.path);
              }}
              className={`mbn-item${isActive && !drawerOpen ? ' mbn-active' : ''}`}
              aria-current={isActive && !drawerOpen ? 'page' : undefined}
              aria-label={item.label}
            >
              {isActive && !drawerOpen && <span className="mbn-pill" />}
              <span className="mbn-icon">
                <Icon source={item.icon} />
              </span>
              <span className="mbn-label">{item.label}</span>
            </button>
          );
        })}

        {/* ── Más tab ── */}
        <button
          onClick={() => setDrawerOpen((v) => !v)}
          className={`mbn-item${isMoreActive || drawerOpen ? ' mbn-active' : ''}`}
          aria-label="Más opciones"
          aria-expanded={drawerOpen}
        >
          {(isMoreActive || drawerOpen) && <span className="mbn-pill" />}
          <span className="mbn-icon">
            <Icon source={drawerOpen ? XIcon : MenuIcon} />
          </span>
          <span className="mbn-label">Más</span>
        </button>
      </nav>

      <style jsx>{`
        /* ── Bottom bar ── */
        .mbn-root {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 64px;
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border-top: 0.5px solid rgba(0, 0, 0, 0.08);
          z-index: 1001;
          justify-content: space-around;
          align-items: center;
          padding: 0 2px;
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }

        .mbn-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          padding: 4px 0 6px;
          gap: 3px;
          cursor: pointer;
          color: #6d7175;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          transition: color 0.2s ease;
          min-width: 0;
          outline: none;
        }

        .mbn-item:active {
          transform: scale(0.9);
          transition: transform 0.1s ease;
        }

        .mbn-active {
          color: #0055cf;
        }

        .mbn-pill {
          position: absolute;
          top: 2px;
          width: 52px;
          height: 28px;
          border-radius: 14px;
          background: rgba(0, 85, 207, 0.1);
          z-index: 0;
          pointer-events: none;
        }

        .mbn-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 1;
        }

        .mbn-active .mbn-icon :global(.Polaris-Icon) {
          color: #0055cf;
        }

        .mbn-label {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.02em;
          line-height: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          position: relative;
          z-index: 1;
        }

        .mbn-active .mbn-label {
          font-weight: 700;
        }

        /* ── Overlay ── */
        .mbn-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 999;
          animation: mbn-fade-in 0.2s ease;
        }

        /* ── Drawer ── */
        .mbn-drawer {
          display: none;
          position: fixed;
          bottom: 64px;
          bottom: calc(64px + env(safe-area-inset-bottom, 0px));
          left: 0;
          right: 0;
          max-height: 70vh;
          background: #ffffff;
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
          box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12);
          z-index: 1000;
          overflow-y: auto;
          transform: translateY(100%);
          transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .mbn-drawer-open {
          transform: translateY(0);
        }

        .mbn-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 8px;
          position: sticky;
          top: 0;
          background: #ffffff;
          z-index: 1;
        }

        .mbn-drawer-title {
          font-size: 17px;
          font-weight: 700;
          color: #202223;
          letter-spacing: -0.01em;
        }

        .mbn-drawer-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: none;
          background: #f6f6f7;
          cursor: pointer;
          color: #6d7175;
          -webkit-tap-highlight-color: transparent;
        }

        .mbn-drawer-close:active {
          background: #e1e3e5;
        }

        .mbn-drawer-body {
          padding: 4px 16px 20px;
        }

        .mbn-group {
          margin-bottom: 8px;
        }

        .mbn-group-title {
          display: block;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #8c9196;
          padding: 12px 4px 6px;
        }

        .mbn-drawer-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px;
          border: none;
          background: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          color: #303030;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.15s ease;
        }

        .mbn-drawer-item:active {
          background: #f1f2f4;
        }

        .mbn-drawer-item-active {
          background: rgba(0, 85, 207, 0.08);
          color: #0055cf;
          font-weight: 600;
        }

        .mbn-drawer-item-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .mbn-drawer-item-active .mbn-drawer-item-icon :global(.Polaris-Icon) {
          color: #0055cf;
        }

        @keyframes mbn-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media screen and (max-width: 768px) {
          .mbn-root {
            display: flex;
          }
          .mbn-overlay {
            display: block;
          }
          .mbn-drawer {
            display: block;
          }
        }
      `}</style>
    </>
  );
}
