'use client';

import { useMemo } from 'react';
import { AppProvider } from '@shopify/polaris';
import esTranslations from '@shopify/polaris/locales/es.json';
import dynamic from 'next/dynamic';
import { I18nContext, I18nManager } from '@shopify/react-i18n';
import { ToastProvider } from '@/components/notifications/ToastProvider';

const PolarisVizProvider = dynamic(
  () => import('@shopify/polaris-viz').then((mod) => mod.PolarisVizProvider),
  { ssr: false }
);

export function PolarisProvider({ children }: { children: React.ReactNode }) {
  const i18nManager = useMemo(() => new I18nManager({
    locale: 'es',
    onError: (err) => console.error('i18n error:', err),
  }), []);

  return (
    <I18nContext.Provider value={i18nManager}>
      <AppProvider i18n={esTranslations}>
        <PolarisVizProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </PolarisVizProvider>
      </AppProvider>
    </I18nContext.Provider>
  );
}
