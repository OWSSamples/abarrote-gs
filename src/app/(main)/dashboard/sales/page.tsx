'use client';

import { Page } from '@shopify/polaris';
import { useState } from 'react';
import { SalesHistory } from '@/components/sales/SalesHistory';
import { GenericExportModal } from '@/components/inventory/ShopifyModals';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { generateCSV, downloadFile, generatePDF } from '@/components/export/ExportModal';
import { useRouter } from 'next/navigation';

export default function SalesPage() {
  const router = useRouter();
  const saleRecords = useDashboardStore((s) => s.saleRecords);
  const [isExportOpen, setIsExportOpen] = useState(false);

  return (
    <>
      <Page
        fullWidth
        title="Ventas"
        secondaryActions={[
          {
            content: 'Exportar',
            onAction: () => setIsExportOpen(true),
          },
          {
            content: 'Corte de Caja',
            onAction: () => router.push('/dashboard/sales/corte'),
          },
        ]}
      >
        <SalesHistory />
      </Page>

      <GenericExportModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Exportar ventas"
        exportName="ventas"
        onExport={(format) => {
          const exportData = saleRecords.map((s) => ({
            Folio: s.folio,
            Fecha: new Date(s.date).toLocaleDateString('es-MX'),
            Hora: new Date(s.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            Cajero: s.cajero,
            'Total Artículos': s.items.length,
            Total: s.total,
            'Método': s.paymentMethod,
          }));
          const filename = `Ventas_${new Date().toISOString().split('T')[0]}`;
          if (format === 'pdf') {
            generatePDF('Reporte de Ventas', exportData as Record<string, unknown>[], `${filename}.pdf`);
          } else {
            const csvContent = generateCSV(exportData as Record<string, unknown>[], true);
            downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
          }
        }}
      />
    </>
  );
}
