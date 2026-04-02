'use client';

import { Page } from '@shopify/polaris';
import { PagosReembolsosPanel } from '@/components/mercadopago/PagosReembolsosPanel';

export default function PagosMPPage() {
  return (
    <Page
      fullWidth
      title="Pagos MercadoPago"
      subtitle="Consulta pagos procesados y gestiona reembolsos"
      backAction={{ content: 'Ventas', url: '/dashboard/sales' }}
    >
      <PagosReembolsosPanel />
    </Page>
  );
}
