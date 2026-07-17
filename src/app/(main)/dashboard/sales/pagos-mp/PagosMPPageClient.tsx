'use client';

import { BlockStack, EmptyState, Page } from '@shopify/polaris';
import { MercadoPagoHub } from '@/components/mercadopago/MercadoPagoHub';
import { useDashboardStore } from '@/store/dashboardStore';

export function PagosMPPageClient() {
  const mpEnabled = useDashboardStore((state) => state.storeConfig.mpEnabled);

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
              Vincula tu cuenta desde Configuración para consultar pagos, reembolsos, saldo y terminales.
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
      subtitle="Saldo, conciliación, reembolsos y terminales"
      backAction={{ content: 'Ventas', url: '/dashboard/sales' }}
    >
      <MercadoPagoHub />
    </Page>
  );
}
