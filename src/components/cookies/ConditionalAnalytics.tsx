'use client';

import { useCookieConsent } from '@/components/cookies/CookieConsentProvider';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

/**
 * Carga condicional de scripts de analítica.
 * Solo se renderizan si el usuario aceptó cookies de analítica.
 * Si revoca el consentimiento, los componentes se desmontan y dejan de enviar datos.
 */
export function ConditionalAnalytics() {
  const { isReady, preferences } = useCookieConsent();

  // No renderizar nada hasta saber si hay consentimiento
  if (!isReady) return null;

  // Solo cargar si el usuario aceptó cookies analíticas
  if (!preferences.analytics) return null;

  return (
    <>
      <SpeedInsights />
      <Analytics />
    </>
  );
}
