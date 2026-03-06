'use client';

import { useState } from 'react';
import {
  Modal,
  BlockStack,
  ChoiceList,
  Text,
  Banner,
  Button,
  InlineStack,
  Checkbox,
} from '@shopify/polaris';
import { ExportIcon } from '@shopify/polaris-icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  includeHeaders: boolean;
  sections: string[];
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
}

const sectionOptions = [
  { label: 'Inventario Completo', value: 'inventory' },
  { label: 'Productos con Stock Bajo', value: 'lowStock' },
  { label: 'Productos por Vencer', value: 'expiring' },
  { label: 'Historial de Mermas', value: 'shrinkage' },
  { label: 'Ventas del Día', value: 'dailySales' },
  { label: 'Productos Más Vendidos', value: 'topProducts' },
];

const formatOptions = [
  { label: 'CSV (Compatible con Excel)', value: 'csv' },
  { label: 'Excel (.xlsx)', value: 'excel' },
  { label: 'Documento PDF (.pdf)', value: 'pdf' },
];

export function ExportModal({ open, onClose, onExport }: ExportModalProps) {
  const [format, setFormat] = useState<string[]>(['csv']);
  const [sections, setSections] = useState<string[]>(['inventory']);
  const [includeHeaders, setIncludeHeaders] = useState(true);

  const handleExport = () => {
    onExport({
      format: format[0] as 'csv' | 'excel' | 'pdf',
      includeHeaders,
      sections,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exportar Datos"
      primaryAction={{
        content: 'Exportar',
        icon: ExportIcon,
        onAction: handleExport,
        disabled: sections.length === 0,
      }}
      secondaryActions={[
        {
          content: 'Cancelar',
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Banner tone="info">
            <p>
              Selecciona los datos que deseas exportar. El archivo se descargará automáticamente.
            </p>
          </Banner>

          <ChoiceList
            title="Formato de Exportación"
            choices={formatOptions}
            selected={format}
            onChange={setFormat}
          />

          <ChoiceList
            title="Secciones a Exportar"
            choices={sectionOptions}
            selected={sections}
            onChange={setSections}
            allowMultiple
          />

          <Checkbox
            label="Incluir encabezados de columna"
            checked={includeHeaders}
            onChange={setIncludeHeaders}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// Utilidad para generar CSV
export function generateCSV(data: Record<string, unknown>[], headers: boolean = true): string {
  if (data.length === 0) return '';

  const keys = Object.keys(data[0]);
  const rows: string[] = [];

  if (headers) {
    rows.push(keys.join(','));
  }

  data.forEach((item) => {
    const values = keys.map((key) => {
      const value = item[key];
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return String(value ?? '');
    });
    rows.push(values.join(','));
  });

  return rows.join('\n');
}

// Utilidad para descargar archivo
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Utilidad para generar PDF
export function generatePDF(
  title: string,
  data: Record<string, unknown>[],
  filename: string
): void {
  const doc = new jsPDF();

  // Título y Metadatos
  doc.setFontSize(18);
  doc.setTextColor(5, 24, 210); // Color azul solicitado #0518d2
  doc.text(title, 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Reporte generado el: ${new Date().toLocaleString()}`, 14, 30);

  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    // Mapear headers a nombres más legibles si es necesario, pero por ahora usamos las llaves
    const tableHeaders = headers.map(h => h.charAt(0).toUpperCase() + h.slice(1).replace(/([A-Z])/g, ' $1'));

    const body = data.map((item) =>
      headers.map((h) => {
        const val = item[h];
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return String(val ?? '');
      })
    );

    autoTable(doc, {
      startY: 35,
      head: [tableHeaders],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [5, 24, 210] }, // #0518d2
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { top: 35 },
    });
  }

  doc.save(filename);
}

// Función para exportar datos del dashboard
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
        generatePDF(titleLabel, sectionData as Record<string, unknown>[], filename);
      } else {
        const csv = generateCSV(sectionData as Record<string, unknown>[], options.includeHeaders);
        const mime = options.format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
        downloadFile(csv, filename, mime);
      }
    }
  });
}
