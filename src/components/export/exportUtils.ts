// Utilidades de exportación que NO importan jspdf estáticamente.
// generatePDF se carga dinámicamente solo cuando el usuario elige PDF.

import { generateCSV, downloadFile } from './ExportModal';

interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  includeHeaders: boolean;
  sections: string[];
}

const sectionOptions = [
  { label: 'Inventario Completo', value: 'inventory' },
  { label: 'Productos con Stock Bajo', value: 'lowStock' },
  { label: 'Productos por Vencer', value: 'expiring' },
  { label: 'Historial de Mermas', value: 'shrinkage' },
  { label: 'Ventas del Día', value: 'dailySales' },
  { label: 'Productos Más Vendidos', value: 'topProducts' },
];

export function exportDashboardData(
  options: ExportOptions,
  data: {
    inventory?: unknown[];
    lowStock?: unknown[];
    expiring?: unknown[];
    shrinkage?: unknown[];
    dailySales?: unknown[];
    topProducts?: unknown[];
  }
): void {
  const timestamp = new Date().toISOString().split('T')[0];

  options.sections.forEach((section) => {
    const sectionData = data[section as keyof typeof data];
    if (sectionData && sectionData.length > 0) {
      const filename = `${section}_${timestamp}.${options.format}`;

      if (options.format === 'pdf') {
        const titleLabel = sectionOptions.find(o => o.value === section)?.label || section;
        import('./generatePDF').then(({ generatePDF }) => {
          generatePDF(titleLabel, sectionData as Record<string, unknown>[], filename);
        });
      } else {
        const csv = generateCSV(sectionData as Record<string, unknown>[], options.includeHeaders);
        const mime = options.format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
        downloadFile(csv, filename, mime);
      }
    }
  });
}
