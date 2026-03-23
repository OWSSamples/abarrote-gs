'use client';

import { useEffect, useState, useCallback } from 'react';
import { Frame, Loading, Page, Banner, Button, SkeletonPage, Layout, SkeletonBodyText, Box, BlockStack, Text } from '@shopify/polaris';
import { useDashboardStore } from '@/store/dashboardStore';
import { SidebarNav } from '@/components/navigation/SidebarNav';
import { CustomTopBar } from '@/components/navigation/CustomTopBar';
import { UserMenu } from '@/components/auth/UserMenu';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { Product } from '@/types';
import { ProductDetailModal } from '@/components/modals/ProductDetailModal';
import { sectionToPath } from '@/lib/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();

  const isLoading = useDashboardStore((s) => s.isLoading);
  const error = useDashboardStore((s) => s.error);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);
  const kpiData = useDashboardStore((s) => s.kpiData);
  const inventoryAlerts = useDashboardStore((s) => s.inventoryAlerts);

  const [mobileNavActive, setMobileNavActive] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductDetailActive, setIsProductDetailActive] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false); // New lock state

  const { signOut } = useAuth(); // Access signOut from AuthContext

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  // Handle Auth Expiration: FORCE REDIRECT - NO VISUALIZATION ALLOWED
  useEffect(() => {
    if (error && (error.includes('sesión ha expirado') || error.includes('autenticación'))) {
      console.error('CRITICAL: AUTH EXPIRED. KICKING OUT USER.');
      signOut().then(() => {
        // Full page reload redirect to ensure absolutely NO dashboard state remains
        window.location.href = '/auth/login';
      });
    }
  }, [error, signOut]);

  // Prevent ANY visualization if loading or no user
  if (authLoading || !user) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        backgroundColor: '#f6f6f7', // Shopify Neutral BG
        zIndex: 10000 
      }} />
    );
  }

  const toggleMobileNav = useCallback(() => {
    setMobileNavActive((prev) => !prev);
  }, []);

  const handleSectionSelect = useCallback((section: string) => {
    router.push(sectionToPath(section));
    setMobileNavActive(false);
  }, [router]);

  const handleProductClick = useCallback((product: Product) => {
    setSelectedProduct(product);
    setIsProductDetailActive(true);
  }, []);

  const criticalAlerts = inventoryAlerts.filter(
    (alert) => alert.severity === 'critical'
  );

  const topBarMarkup = (
    <CustomTopBar
      userMenu={<UserMenu />}
      onNavigationToggle={toggleMobileNav}
      onSectionSelect={handleSectionSelect}
      onProductClick={(product) => {
        setSelectedProduct(product);
        setIsProductDetailActive(true);
      }}
    />
  );

  const navigationMarkup = (
    <SidebarNav
      onSelect={handleSectionSelect}
      badges={{
        lowStock: kpiData?.lowStockProducts,
        notifications: criticalAlerts.length,
      }}
    />
  );

  return (
    <>
      <Frame
        topBar={topBarMarkup}
        navigation={navigationMarkup}
        showMobileNavigation={mobileNavActive}
        onNavigationDismiss={toggleMobileNav}
      >
        {isLoading && <Loading />}
        {error ? (
          <Page title="Error" fullWidth>
            <Banner tone="critical" title="Error">
              <p>{error}</p>
              <Button onClick={fetchDashboardData}>Reintentar</Button>
            </Banner>
          </Page>
        ) : isLoading ? (
          <SkeletonPage title="Dashboard" fullWidth>
            <Layout>
              <Layout.Section>
                <SkeletonBodyText lines={10} />
              </Layout.Section>
            </Layout>
          </SkeletonPage>
        ) : (
          <Box padding="600" minHeight="calc(100vh - 56px)">
            {children}
          </Box>
        )}

        {isProductDetailActive && selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            open={true}
            isInline={false}
            onClose={() => {
              setIsProductDetailActive(false);
              setSelectedProduct(null);
            }}
            onSave={async () => {
              setIsProductDetailActive(false);
              setSelectedProduct(null);
            }}
          />
        )}
      </Frame>
    </>
  );
}
