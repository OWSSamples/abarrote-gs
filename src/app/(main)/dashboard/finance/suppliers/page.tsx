'use client';

import { Page } from '@shopify/polaris';
import { ProveedoresManager } from '@/components/suppliers/ProveedoresManager';

export default function SuppliersPage() {
  return (
    <Page fullWidth title="Proveedores" subtitle="Gestión de red de distribuidores y control de cadena de suministro">
      <ProveedoresManager />
    </Page>
  );
}
