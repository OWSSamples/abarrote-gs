import type { Metadata } from 'next';
import '@shopify/polaris/build/esm/styles.css';
import './globals.css';
import { PolarisProvider } from './PolarisProvider';
import { NeonAuthProvider } from './NeonAuthProvider';

export const metadata: Metadata = {
  title: 'Dashboard de Abarrotes',
  description: 'Gestión inteligente para tiendas de abarrotes',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NeonAuthProvider>
          <PolarisProvider>{children}</PolarisProvider>
        </NeonAuthProvider>
      </body>
    </html>
  );
}
