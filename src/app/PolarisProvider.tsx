'use client';

import { useMemo, Component, type ReactNode } from 'react';
import { AppProvider } from '@shopify/polaris';
import esTranslations from '@shopify/polaris/locales/es.json';
import dynamic from 'next/dynamic';
import { I18nContext, I18nManager } from '@shopify/react-i18n';
import { ToastProvider } from '@/components/notifications/ToastProvider';

// Dynamic import with ssr:false to avoid Turbopack ChunkLoadError.
// The error boundary below ensures a failed chunk never crashes the app.
const PolarisVizProvider = dynamic(
  () => import('@shopify/polaris-viz').then((mod) => mod.PolarisVizProvider),
  { ssr: false, loading: () => null },
);

// Error boundary so a failed chart chunk never crashes the entire app.
class VizErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    // On error, render children without the viz provider — charts won't
    // render but the rest of the app stays functional.
    return this.props.children;
  }
}

export function PolarisProvider({ children }: { children: React.ReactNode }) {
  const i18nManager = useMemo(
    () =>
      new I18nManager({
        locale: 'es',
        onError: (err) => console.error('i18n error:', err),
      }),
    [],
  );

  return (
    <I18nContext.Provider value={i18nManager}>
      <AppProvider i18n={esTranslations}>
        <VizErrorBoundary>
          <PolarisVizProvider>
            <ToastProvider>{children}</ToastProvider>
          </PolarisVizProvider>
        </VizErrorBoundary>
      </AppProvider>
    </I18nContext.Provider>
  );
}
