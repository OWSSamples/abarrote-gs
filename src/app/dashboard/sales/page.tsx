'use client';

import { Page } from '@shopify/polaris';
import { SalesHistory } from '@/components/sales/SalesHistory';

export default function SalesPage() {
  return (
    <Page fullWidth title="Ventas">
      <SalesHistory />
    </Page>
  );
}
