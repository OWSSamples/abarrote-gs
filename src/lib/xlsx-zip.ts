/**
 * Minimal XLSX zip builder using fflate (already a dependency via jspdf).
 * Produces a valid Office Open XML (.xlsx) Blob without heavy libraries.
 */

import { escapeXml } from '@/lib/text-escape';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

function buildWorkbook(sheetName: string) {
  const escaped = escapeXml(sheetName);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escaped}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

const encoder = new TextEncoder();

export async function zipXlsx(sheetXml: string, sheetName: string): Promise<Blob> {
  // Use fflate for ZIP (already bundled by jspdf → fflate)
  const { zipSync } = await import('fflate');

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': encoder.encode(CONTENT_TYPES),
    '_rels/.rels': encoder.encode(RELS),
    'xl/_rels/workbook.xml.rels': encoder.encode(WORKBOOK_RELS),
    'xl/workbook.xml': encoder.encode(buildWorkbook(sheetName)),
    'xl/worksheets/sheet1.xml': encoder.encode(sheetXml),
  };

  const zipped = zipSync(files, { level: 6 });
  // Copy to a fresh ArrayBuffer to satisfy strict BlobPart typing
  const copy = new ArrayBuffer(zipped.byteLength);
  new Uint8Array(copy).set(zipped);
  return new Blob([copy], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
