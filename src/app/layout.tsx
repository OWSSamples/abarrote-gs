import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@shopify/polaris/build/esm/styles.css';
import './globals.css';
import { PolarisProvider } from './PolarisProvider';
import { CookieConsentProvider } from '@/components/cookies/CookieConsentProvider';
import {
  CookieBanner,
  CookiePreferencesModal,
} from '@/components/cookies/CookieBanner';
import { ConditionalAnalytics } from '@/components/cookies/ConditionalAnalytics';

// Self-hosted, subset, swap'd Inter — eliminates render-blocking external
// CSS request to cdn.shopify.com and avoids extra DNS/TLS handshake.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: 'Kiosko',
  description: 'Gestión inteligente para tiendas de abarrotes',
};

export const viewport: Viewport = {
  themeColor: '#202223',
  width: 'device-width',
  initialScale: 1,
};

/**
 * Root Layout - Minimal shared wrapper
 *
 * Route-specific providers:
 * - (main) group: AuthProvider + OfflineProvider
 * - (public) group: No auth (customer display)
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body suppressHydrationWarning>
        <CookieConsentProvider>
          <PolarisProvider>{children}</PolarisProvider>
          <CookieBanner />
          <CookiePreferencesModal />
          <ConditionalAnalytics />
        </CookieConsentProvider>
      </body>
    </html>
  );
}
