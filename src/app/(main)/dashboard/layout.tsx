'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@cloudflare/kumo/components/sidebar';
import { useDashboardStore } from '@/store/dashboardStore';
import { SidebarNav } from '@/components/navigation/SidebarNav';
import { CustomTopBar } from '@/components/navigation/CustomTopBar';
import { UserMenu } from '@/components/auth/UserMenu';
import { MfaEnforcementBanner } from '@/components/auth/MfaEnforcementBanner';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { ProductDetailModal } from '@/components/modals/ProductDetailModal';
import { sectionToPath } from '@/lib/navigation';
import { useSyncEngine } from '@/hooks/useSyncEngine';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();

  const isLoading = useDashboardStore((s) => s.isLoading);
  const error = useDashboardStore((s) => s.error);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);
  const getUserRole = useDashboardStore((s) => s.getUserRole);
  const checkMidnightCorte = useDashboardStore((s) => s.checkMidnightCorte);
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const kpiData = useDashboardStore((s) => s.kpiData);
  const inventoryAlerts = useDashboardStore((s) => s.inventoryAlerts);

  const [, setMobileNavActive] = useState(false);
  const layoutSelectedProduct = useDashboardStore((s) => s.layoutSelectedProduct);
  const isProductDetailActive = useDashboardStore((s) => s.isProductDetailActive);
  const openProductDetail = useDashboardStore((s) => s.openProductDetail);
  const closeProductDetail = useDashboardStore((s) => s.closeProductDetail);
  const { markSessionExpired } = useAuth();

  const { syncStatus } = useSyncEngine(!!user && !authLoading);

  useEffect(() => {
    if (user) {
      getUserRole(user.userId);
    }
  }, [user, getUserRole]);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(
      () => {
        const now = new Date();
        const currentH = now.getHours().toString().padStart(2, '0');
        const currentM = now.getMinutes().toString().padStart(2, '0');
        const currentTime = `${currentH}:${currentM}`;

        if (storeConfig.autoCorteTime && currentTime >= storeConfig.autoCorteTime) {
          checkMidnightCorte();
        }
      },
      1000 * 60 * 10,
    );

    return () => clearInterval(interval);
  }, [user, storeConfig.autoCorteTime, checkMidnightCorte]);

  useEffect(() => {
    if (!error) return;

    const AUTH_ERROR_PATTERNS = [
      'Tu sesion ha expirado',
      'Error de autenticacion',
      'Autenticacion requerida',
      'Usuario no registrado',
      'Tu cuenta ha sido desactivada',
    ];

    const isAuthExpired = AUTH_ERROR_PATTERNS.some((pattern) => error.includes(pattern));

    if (isAuthExpired) {
      markSessionExpired('dashboard_auth_error');
    }
  }, [error, markSessionExpired]);

  const toggleMobileNav = useCallback(() => {
    setMobileNavActive((prev) => !prev);
  }, []);

  const handleSectionSelect = useCallback(
    (section: string) => {
      router.push(sectionToPath(section));
      setMobileNavActive(false);
    },
    [router],
  );

  const handleProductClick = useCallback(
    (product: { id: string; name: string; sku: string; barcode: string; category: string; imageUrl?: string; unitPrice?: number; currentStock?: number; minStock?: number }) => {
      const products = useDashboardStore.getState().products;
      const full = products.find((p) => p.id === product.id);
      if (full) openProductDetail(full);
    },
    [openProductDetail],
  );

  const criticalAlerts = inventoryAlerts.filter((alert) => alert.severity === 'critical');

  if (authLoading || !user) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#f6f6f7',
          zIndex: 10000,
        }}
      />
    );
  }

  return (
    <>
      <Sidebar.Provider
        animationDuration={180}
        className="odx-sidebar-provider"
        contained
        defaultOpen
        collapsible="none"
        mobileBreakpoint={0}
        style={{ '--sidebar-width': '260px' } as React.CSSProperties}
        variant="sidebar"
      >
        <SidebarNav
          onSelect={handleSectionSelect}
          badges={{
            lowStock: kpiData?.lowStockProducts,
            notifications: criticalAlerts.length,
          }}
        />

        <div className="odx-main-area">
          <div className="odx-topbar">
            <CustomTopBar
              userMenu={<UserMenu />}
              onNavigationToggle={toggleMobileNav}
              onSectionSelect={handleSectionSelect}
              onProductClick={handleProductClick}
            />
          </div>

          <div className="odx-content">
            {!syncStatus.isOnline && (
              <div className="odx-banner odx-banner-warning">
                Sin conexion. Las operaciones requieren acceso al servidor y no se guardaran localmente.
              </div>
            )}
            {syncStatus.circuitOpen && syncStatus.isOnline && (
              <div className="odx-banner odx-banner-critical">
                Problemas de sincronizacion detectados. Reintentando automaticamente...
              </div>
            )}
            <MfaEnforcementBanner />

            {isLoading && (
              <div className="odx-loading">
                <div className="odx-spinner" />
              </div>
            )}

            {error ? (
              <div className="odx-error-page">
                <h2>{storeConfig.storeName || 'Mi Tienda'}</h2>
                <div className="odx-banner odx-banner-critical">
                  <strong>Hubo un problema al cargar los datos</strong>
                  <p>{error}</p>
                  <button type="button" className="odx-btn" onClick={fetchDashboardData}>
                    Reintentar
                  </button>
                </div>
              </div>
            ) : isLoading ? (
              <div className="odx-skeleton">
                <div className="odx-skeleton-line" style={{ width: '40%' }} />
                <div className="odx-skeleton-line" />
                <div className="odx-skeleton-line" />
                <div className="odx-skeleton-line" style={{ width: '60%' }} />
                <div className="odx-skeleton-line" />
                <div className="odx-skeleton-line" style={{ width: '80%' }} />
              </div>
            ) : (
              children
            )}

            {isProductDetailActive && layoutSelectedProduct && (
              <ProductDetailModal
                product={layoutSelectedProduct}
                open={true}
                isInline={false}
                onClose={() => {
                  closeProductDetail();
                }}
              />
            )}
          </div>
        </div>
      </Sidebar.Provider>
    </>
  );
}
