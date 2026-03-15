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
export async function generatePDF(
  title: string,
  data: Record<string, unknown>[],
  filename: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape' });

  // 1. Cargar el Logo desde la red y convertirlo a PNG mediante canvas
  try {
    const img = new Image();
    img.src = '/logo_for_kiosko_login.svg';
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve; // Si falla, continuamos sin logo
    });

    if (img.width > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 14, 15, 30, (30 * img.height) / img.width);
      }
    }
  } catch (err) {
    console.error('Error cargando el logo en el PDF', err);
  }

  // Título y Metadatos al estilo Shopify (Minimalista y Limpio)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15); // Tamaño mucho más profesional y sobrio
  doc.setTextColor(33, 35, 38); // Color gris oscuro carbón de Shopify

  // Dibujamos el texto un poco más a la derecha para dejar espacio al logo
  doc.text(title, 50, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(109, 113, 117); // Texto secundario gris claro
  doc.text(`Generado el: ${new Date().toLocaleString()}`, 283, 22, { align: 'right' });

  // Línea separadora elegante más compactada
  doc.setDrawColor(228, 229, 231);
  doc.setLineWidth(0.5);
  doc.line(14, 30, 283, 30);

  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    // Transformamos los títulos a MAYÚSCULAS
    const tableHeaders = headers.map(h =>
      (h.charAt(0).toUpperCase() + h.slice(1).replace(/([A-Z])/g, ' $1')).toUpperCase()
    );

    const body = data.map((item) =>
      headers.map((h) => {
        const val = item[h];
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return String(val ?? '');
      })
    );

    autoTable(doc, {
      startY: 35, // La tabla empieza más alto, ahorrando espacio
      head: [tableHeaders],
      body: body,
      theme: 'plain', // Quitamos el estilo antiguo
      styles: {
        fontSize: 8, // Letra un poco más pequeña para ahorrar espacio
        cellPadding: 1.5, // Padding hiper reducido para filas delgadas
        font: 'helvetica',
        textColor: [33, 35, 38], // Texto oscuro para el cuerpo
        lineColor: [228, 229, 231],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [244, 246, 248], // Fondo azul-grisáceo muy sutil para destacar
        textColor: [0, 68, 148], // Azul oscuro corporativo y profesional
        fontStyle: 'bold',
        lineColor: [228, 229, 231],
        lineWidth: { bottom: 0.5 } // Solo línea debajo del header
      },
      alternateRowStyles: {
        fillColor: [252, 252, 252], // Estilo cebra hiper suave
      },
      margin: { top: 40, left: 14, right: 14, bottom: 20 },
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
        // As it's async now, we call it in background (void) or handle properly, but here we can just fire and forget.
        generatePDF(titleLabel, sectionData as Record<string, unknown>[], filename);
      } else {
        const csv = generateCSV(sectionData as Record<string, unknown>[], options.includeHeaders);
        const mime = options.format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
        downloadFile(csv, filename, mime);
      }
    }
  });
}
