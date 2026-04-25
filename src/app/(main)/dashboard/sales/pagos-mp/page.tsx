'use client';

import { Page, EmptyState, BlockStack } from '@shopify/polaris';
import { MercadoPagoHub } from '@/components/mercadopago/MercadoPagoHub';
import { useDashboardStore } from '@/store/dashboardStore';

export default function PagosMPPage() {
  const mpEnabled = useDashboardStore((s) => s.storeConfig.mpEnabled);

  if (!mpEnabled) {
    return (
      <Page fullWidth title="MercadoPago" backAction={{ content: 'Ventas', url: '/dashboard/sales' }}>
        <BlockStack gap="400">
          <EmptyState
            heading="Conecta tu cuenta de MercadoPago"
            image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-data.svg"
            action={{
              content: 'Ir a Configuración → Pagos',
              url: '/dashboard/settings',
            }}
          >
            <p>
              Para acceder a pagos, reembolsos, QR y links de cobro, primero vincula tu cuenta de MercadoPago desde la
              sección de pagos en Configuración.
            </p>
          </EmptyState>
        </BlockStack>
      </Page>
    );
  }

  return (
    <Page
      fullWidth
      title="MercadoPago"
      subtitle="Saldo, pagos, reembolsos, links de cobro y terminales"
      backAction={{ content: 'Ventas', url: '/dashboard/sales' }}
    >
      <MercadoPagoHub />
    </Page>
  );
}
