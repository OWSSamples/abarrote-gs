'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@shopify/polaris';
import {
  HomeIcon,
  OrderIcon,
  ProductIcon,
  StoreIcon
} from '@shopify/polaris-icons';

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: HomeIcon,
      path: '/dashboard',
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: OrderIcon,
      path: '/dashboard/sales',
    },
    {
      id: 'products',
      label: 'Products',
      icon: ProductIcon,
      path: '/dashboard/products',
    },
    {
      id: 'store',
      label: 'Store',
      icon: StoreIcon,
      path: '/dashboard/settings',
    },
  ];

  return (
    <div className="mobile-bottom-nav">
      {navItems.map((item) => {
        const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
        
        return (
          <button
            key={item.id}
            onClick={() => router.push(item.path)}
            className={`nav-item ${isActive ? 'active' : ''}`}
          >
            <div className="icon-wrapper">
              <Icon source={item.icon} tone={isActive ? 'success' : 'base'} />
            </div>
            <span className="label text-xs">{item.label}</span>
          </button>
        );
      })}

      <style jsx>{`
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 64px;
          background: #ffffff;
          border-top: 1px solid #e1e3e5;
          z-index: 1000;
          justify-content: space-around;
          align-items: center;
          padding-bottom: env(safe-area-inset-bottom);
          box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
        }

        .nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          padding: 8px 0;
          gap: 4px;
          cursor: pointer;
          color: #6d7175;
          transition: all 0.2s ease;
        }

        .nav-item.active {
          color: #008060;
        }

        .icon-wrapper {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .label {
          font-size: 11px;
          font-weight: 500;
        }

        @media screen and (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex;
          }
        }
      `}</style>
    </div>
  );
}
