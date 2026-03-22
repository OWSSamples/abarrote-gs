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
// jsPDF y autoTable se importan dinámicamente en generatePDF() para evitar
// que fflate/node.cjs rompa el SSR de Next.js 16.2+

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

// Utilidad para generar PDF dinámicamente
export async function generatePDF(title: string, data: Record<string, unknown>[], filename: string) {
  try {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF();
    doc.text(title, 14, 15);

    if (data.length > 0) {
      const head = [Object.keys(data[0])];
      const body = data.map((item) =>
        Object.keys(item).map((key) => String(item[key] ?? ''))
      );

      autoTable(doc, {
        head,
        body,
        startY: 20,
        styles: { fontSize: 8 },
      });
    }

    doc.save(filename);
  } catch (error) {
    console.error('Error generando PDF:', error);
    alert('No se pudo generar el PDF. Verifica la consola.');
  }
}
