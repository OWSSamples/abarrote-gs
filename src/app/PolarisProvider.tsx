'use client';

import { useMemo } from 'react';
import { AppProvider } from '@shopify/polaris';
import esTranslations from '@shopify/polaris/locales/es.json';
import { I18nContext, I18nManager } from '@shopify/react-i18n';
import { ToastProvider } from '@/components/notifications/ToastProvider';

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
        <ToastProvider>{children}</ToastProvider>
      </AppProvider>
    </I18nContext.Provider>
  );
}
