'use client';

import { Page } from '@shopify/polaris';
import { ReportesView } from '@/components/reports/ReportesView';

export default function ReportsPage() {
  return (
    <Page fullWidth title="Reportes Financieros" subtitle="Análisis de rentabilidad, flujo de efectivo y composición de ingresos">
      <ReportesView />
    </Page>
  );
}
