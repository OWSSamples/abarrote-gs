import type { Metadata } from 'next';
import '@shopify/polaris/build/esm/styles.css';
import './globals.css';
import { PolarisProvider } from './PolarisProvider';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { OfflineProvider } from '@/components/providers/OfflineProvider';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'Kiosko',
  description: 'Gestión inteligente para tiendas de abarrotes',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <PolarisProvider>
            <OfflineProvider>{children}</OfflineProvider>
          </PolarisProvider>
        </AuthProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
