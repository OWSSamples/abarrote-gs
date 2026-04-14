'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@shopify/polaris';
import {
  HomeIcon,
  OrderIcon,
  ProductIcon,
  PersonIcon,
  ChartVerticalIcon,
} from '@shopify/polaris-icons';

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

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
    {
      id: 'analytics',
      label: 'Análisis',
      icon: ChartVerticalIcon,
      path: '/dashboard/analytics',
      exact: false,
    },
  ];

  return (
    <nav className="mbn-root" aria-label="Navegación principal">
      {navItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.path
          : pathname === item.path || pathname.startsWith(item.path + '/');

        return (
          <button
            key={item.id}
            onClick={() => router.push(item.path)}
            className={`mbn-item${isActive ? ' mbn-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
          >
            <span className="mbn-icon">
              <Icon source={item.icon} />
            </span>
            <span className="mbn-label">{item.label}</span>
            {isActive && <span className="mbn-indicator" />}
          </button>
        );
      })}

      <style jsx>{`
        .mbn-root {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: #ffffff;
          border-top: 1px solid #e1e3e5;
          z-index: 1000;
          justify-content: space-around;
          align-items: stretch;
          padding: 0 4px;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          box-shadow: 0 -1px 12px rgba(0, 0, 0, 0.06);
        }

        .mbn-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          padding: 6px 0 4px;
          gap: 2px;
          cursor: pointer;
          color: #8c9196;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          transition: color 0.15s ease;
          min-width: 0;
        }

        .mbn-item:active {
          transform: scale(0.92);
        }

        .mbn-active {
          color: #2563eb;
        }

        .mbn-icon {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mbn-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.01em;
          line-height: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .mbn-indicator {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 2px;
          border-radius: 0 0 2px 2px;
          background: #2563eb;
        }

        @media screen and (max-width: 768px) {
          .mbn-root {
            display: flex;
          }
        }
      `}</style>
    </nav>
  );
}
