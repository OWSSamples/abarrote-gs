'use client';

import { useState } from 'react';
import { BlockStack, Tabs } from '@shopify/polaris';
import { MPBalanceCard } from './MPBalanceCard';
import { PagosReembolsosPanel } from './PagosReembolsosPanel';
import { MPPaymentLinkPanel } from './MPPaymentLinkPanel';
import { MPSearchPanel } from './MPSearchPanel';
import { MPDevicesPanel } from './MPDevicesPanel';

const HUB_TABS = [
  { id: 'overview', content: 'Pagos y Reembolsos', accessibilityLabel: 'Pagos y reembolsos' },
  { id: 'links', content: 'Link de Cobro / QR', accessibilityLabel: 'Links de cobro y QR' },
  { id: 'search', content: 'Buscar en MP', accessibilityLabel: 'Buscar pagos en MercadoPago' },
  { id: 'devices', content: 'Terminales', accessibilityLabel: 'Terminales Point' },
];

export function MercadoPagoHub() {
  const [tabIndex, setTabIndex] = useState(0);

  return (
    <BlockStack gap="500">
      <MPBalanceCard />

      <Tabs tabs={HUB_TABS} selected={tabIndex} onSelect={setTabIndex}>
        <div style={{ paddingTop: '16px' }}>
          {tabIndex === 0 && <PagosReembolsosPanel />}
          {tabIndex === 1 && <MPPaymentLinkPanel />}
          {tabIndex === 2 && <MPSearchPanel />}
          {tabIndex === 3 && <MPDevicesPanel />}
        </div>
      </Tabs>
    </BlockStack>
  );
}
