'use client';

import { Page } from '@shopify/polaris';
import { GastosManager } from '@/components/gastos/GastosManager';

export default function ExpensesPage() {
  return (
    <Page fullWidth title="Control de Gastos" subtitle="Administración y seguimiento de egresos operativos">
      <GastosManager />
    </Page>
  );
}
