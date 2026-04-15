'use client';

import { useState } from 'react';
import { Page } from '@shopify/polaris';
import { CorteCajaModal } from '@/components/caja/CorteCajaModal';
import { CortesHistory } from '@/components/caja/CortesHistory';

export default function CortePage() {
  const [corteModalOpen, setCorteModalOpen] = useState(false);

  return (
    <>
      <Page
        fullWidth
        title="Corte de Caja"
        primaryAction={{
          content: 'Nuevo Corte',
          onAction: () => setCorteModalOpen(true),
        }}
        backAction={{ content: 'Ventas', url: '/dashboard/sales' }}
      >
        <CortesHistory />
      </Page>

      <CorteCajaModal open={corteModalOpen} onClose={() => setCorteModalOpen(false)} />
    </>
  );
}
