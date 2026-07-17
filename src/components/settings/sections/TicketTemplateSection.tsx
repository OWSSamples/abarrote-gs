'use client';

import { useState, useCallback, useRef } from 'react';
import { Card, Text, BlockStack, InlineStack, Button, Banner, Divider, Layout } from '@shopify/polaris';
import { PrintIcon } from '@shopify/polaris-icons';

// ─── Template variable docs ───────────────────────────────────────────────────
export const SAMPLE_VARS_VENTA = [
  { var: '{{storeName}}', desc: 'Nombre de la tienda' },
  { var: '{{folio}}', desc: 'Número de folio' },
  { var: '{{fecha}}', desc: 'Fecha y hora de la venta' },
  { var: '{{cajero}}', desc: 'Nombre / ID del cajero' },
  { var: '{{metodoPago}}', desc: 'Método de pago usado' },
  { var: '{{items}}', desc: 'Bloque de productos (nombre, cant, precio, subtotal)' },
  { var: '{{subtotal}}', desc: 'Subtotal sin IVA' },
  { var: '{{iva}}', desc: 'Monto de IVA' },
  { var: '{{total}}', desc: 'Total a pagar' },
  { var: '{{cambio}}', desc: 'Cambio dado al cliente' },
  { var: '{{recibido}}', desc: 'Monto recibido en efectivo' },
  { var: '{{footer}}', desc: 'Pie del ticket configurado en ajustes' },
];

export const SAMPLE_VARS_PROVEEDOR = [
  { var: '{{storeName}}', desc: 'Nombre de la tienda' },
  { var: '{{storeAddress}}', desc: 'Dirección completa de la tienda' },
  { var: '{{storePhone}}', desc: 'Teléfono de la tienda' },
  { var: '{{folio}}', desc: 'Número de folio del pedido' },
  { var: '{{fecha}}', desc: 'Fecha del pedido' },
  { var: '{{proveedor}}', desc: 'Nombre del proveedor' },
  { var: '{{destino}}', desc: 'Nombre del destino / tienda' },
  { var: '{{destinoAddress}}', desc: 'Dirección del destino' },
  { var: '{{terminosPago}}', desc: 'Condiciones de pago' },
  { var: '{{moneda}}', desc: 'Moneda del pedido' },
  { var: '{{items}}', desc: 'Bloque HTML de productos (nombre, SKU, cant, precio, total)' },
  { var: '{{subtotal}}', desc: 'Subtotal del pedido (ej: $1,250.00)' },
  { var: '{{total}}', desc: 'Total estimado (ej: $1,250.00)' },
  { var: '{{totalArticulos}}', desc: 'Total de piezas en el pedido' },
  { var: '{{notas}}', desc: 'Notas adicionales del pedido' },
  { var: '{{impreso}}', desc: 'Fecha y hora de impresión' },
];

// ─── TicketTemplateSection component ─────────────────────────────────────────
interface TicketTemplateSectionProps {
  label: string;
  description: string;
  templateKey: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  sampleVars: { var: string; desc: string }[];
}

export function TicketTemplateSection({ label, description, value, onChange, sampleVars }: TicketTemplateSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasTemplate = !!value;

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.endsWith('.html') && file.type !== 'text/html') {
        alert('Solo se aceptan archivos .html');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        onChange(content);
      };
      reader.readAsText(file, 'utf-8');
      // Reset input so same file can be re-uploaded
      e.target.value = '';
    },
    [onChange],
  );

  const handleDownloadSample = useCallback(() => {
    const _sampleRows = sampleVars
      .map((v) => `  <div class="row"><span class="label">${v.desc}</span><span class="val">${v.var}</span></div>`)
      .join('\n');
    const sample = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Mi Plantilla de Ticket</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:ui-monospace,'Courier New',monospace;font-size:12px;color:#000;background:#fff;-webkit-print-color-adjust:exact;}
    .ticket{width:72mm;margin:0 auto;padding:5mm 3mm;}
    .center{text-align:center;}
    .bold{font-weight:700;}
    .store-name{font-size:15px;font-weight:700;text-align:center;}
    .dash{border:none;border-top:1px dashed #888;margin:5px 0;}
    .solid{border:none;border-top:2px solid #000;margin:5px 0;}
    .row{display:flex;justify-content:space-between;font-size:11px;padding:1px 0;}
    .label{color:#555;}
    .val{font-weight:600;}
    .items-block{font-size:11px;}
    .total-main{font-size:14px;font-weight:700;display:flex;justify-content:space-between;padding:4px 0;}
    .footer-line{font-size:10px;text-align:center;color:#555;line-height:1.6;}
    @media print{@page{size:80mm auto;margin:0;}}
  </style>
</head>
<body>
<div class="ticket">
  <div class="store-name">{{storeName}}</div>
  <hr class="dash"/>
  <div class="row"><span class="label">Folio</span><span class="val">{{folio}}</span></div>
  <div class="row"><span class="label">Fecha</span><span class="val">{{fecha}}</span></div>
  <hr class="dash"/>
  <div class="items-block">{{items}}</div>
  <hr class="solid"/>
  <div class="total-main"><span>TOTAL</span><span>{{total}}</span></div>
  <hr class="dash"/>
  <div class="footer-line">{{footer}}</div>
</div>
</body>
</html>`;
    const blob = new Blob([sample], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-ticket-ejemplo.html';
    a.click();
    URL.revokeObjectURL(url);
  }, [sampleVars]);

  const handlePreview = useCallback(() => {
    if (!value) return;
    setPreviewOpen(true);
  }, [value]);

  const handleRemove = useCallback(() => {
    onChange(undefined);
    setPreviewOpen(false);
  }, [onChange]);

  return (
    <Layout.AnnotatedSection title={label} description={description}>
      <Card>
        <BlockStack gap="400">
          {/* Variable reference table */}
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              Variables disponibles
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Usa estas variables en tu plantilla HTML y serán reemplazadas automáticamente al imprimir.
            </Text>
            <div
              style={{
                background: '#f6f6f7',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '4px 16px',
              }}
            >
              {sampleVars.map((sv) => (
                <div key={sv.var} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', fontSize: '12px' }}>
                  <code
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      background: '#e3e5e7',
                      borderRadius: '4px',
                      padding: '1px 5px',
                      fontSize: '11px',
                      color: '#1a1a1a',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sv.var}
                  </code>
                  <span style={{ color: '#6d7175', fontSize: '11px' }}>{sv.desc}</span>
                </div>
              ))}
            </div>
          </BlockStack>

          <Divider />

          {/* Upload area */}
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,text/html"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <Button variant="primary" icon={PrintIcon} onClick={() => fileInputRef.current?.click()}>
              {hasTemplate ? 'Reemplazar plantilla' : 'Subir plantilla (.html)'}
            </Button>
            <Button onClick={handleDownloadSample}>Descargar plantilla de ejemplo</Button>
            {hasTemplate && (
              <>
                <Button onClick={handlePreview}>Vista previa</Button>
                <Button tone="critical" variant="plain" onClick={handleRemove}>
                  Eliminar plantilla
                </Button>
              </>
            )}
          </InlineStack>

          {hasTemplate ? (
            <Banner tone="success">
              <p>Plantilla personalizada cargada. Esta reemplazará el diseño por defecto al imprimir.</p>
            </Banner>
          ) : (
            <Banner tone="info">
              <p>No hay plantilla personalizada. Se usará el diseño POS estándar al imprimir.</p>
            </Banner>
          )}
        </BlockStack>
      </Card>

      {/* Preview modal */}
      {previewOpen && value && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setPreviewOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '420px',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e1e3e5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text as="h2" variant="headingMd">
                Vista previa de plantilla
              </Text>
              <Button variant="plain" onClick={() => setPreviewOpen(false)}>
                Cerrar
              </Button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '16px', background: '#f9fafb' }}>
              <iframe
                srcDoc={value}
                sandbox=""
                referrerPolicy="no-referrer"
                style={{
                  width: '100%',
                  minHeight: '500px',
                  border: 'none',
                  background: '#fff',
                  borderRadius: '4px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                }}
                title="Vista previa del ticket"
              />
            </div>
          </div>
        </div>
      )}
    </Layout.AnnotatedSection>
  );
}
