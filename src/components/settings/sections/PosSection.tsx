'use client';

import JsBarcode from 'jsbarcode';
import {
  Card,
  Text,
  TextField,
  FormLayout,
  BlockStack,
  Checkbox,
  Box,
  Layout,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import { TicketTemplateSection, SAMPLE_VARS_VENTA, SAMPLE_VARS_PROVEEDOR } from './TicketTemplateSection';
import { TicketDesignerSection } from './TicketDesignerSection';
import type { SettingsSectionProps } from './types';

// ─── Ticket preview helpers ──────────────────────────────────────────────────
const TW = 40;

function center(text: string) {
  const t = text.trim();
  if (t.length >= TW) return t;
  const pad = TW - t.length;
  return ' '.repeat(Math.floor(pad / 2)) + t;
}

function wrapCenter(text: string) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const c = cur ? `${cur} ${w}` : w;
    if (c.length > TW) { if (cur) lines.push(center(cur)); cur = w; }
    else cur = c;
  }
  if (cur) lines.push(center(cur));
  return lines.join('\n');
}

const dashes = '-'.repeat(TW);

function fmtAmt(s: string) {
  return ('$ ' + s).padStart(16);
}

export function PosSection({ config, updateField }: SettingsSectionProps) {
  const footerPrev = (config.ticketFooter || '').split('\\n').map((l: string) => center(l)).join('\n');

  const previewText = `
${center(config.legalName || 'NOMBRE LEGAL')}
${center(config.address || 'DIRECCIÓN OMITIDA')}
${center(`C.P. ${config.postalCode || '00000'}, ${config.city || 'CIUDAD'}`)}
${center(`RFC: ${config.rfc || 'XAXX010101000'}`)}
${center(`TEL: ${config.phone || '000-000-0000'}`)}
${center(`REGIMEN FISCAL - ${config.regimenFiscal || 'XXX'}`)}
${wrapCenter(config.regimenDescription || 'DESCRIPCIÓN DEL REGIMEN')}
${center('ESTE COMPROBANTE NO ES VALIDO PARA')}
${center('EFECTOS FISCALES')}

${center(`TDA#${config.storeNumber || '001'} OP#CAJERO 1     TR# V-000001`)}
${center('01/01/2026              12:00:00')}
${center('RFC: SIN R.F.C.')}
${dashes}
  PRODUCTO EJEMPLO
    2 pza x $25.00    ${fmtAmt('50.00')}
  REFRESCO COLA 600ML
    1 pza x $18.00    ${fmtAmt('18.00')}
${dashes}
  SUBTOTAL            ${fmtAmt('68.00')}
  TOTAL               ${fmtAmt('68.00')}
  EFECTIVO            ${fmtAmt('68.00')}
  CAMBIO              ${fmtAmt('0.00')}

${dashes}
  IVA    ${config.ivaRate || '0'}.0%  ${fmtAmt('58.62')}${fmtAmt('9.38')}
${dashes}
  TOTAL IVA           ${fmtAmt('9.38')}

${center('ARTICULOS VENDIDOS    3')}
`;

  const previewTextAfter = `${dashes}

${footerPrev}
${center('Necesitas ayuda ahora?')}
${center(config.ticketServicePhone || 'SIN TELÉFONO')}
${dashes}
${center(`Vigencia ${config.ticketVigencia || 'N/A'}`)}
`;

  return (
    <BlockStack gap="500">
      <Layout.AnnotatedSection title="Comportamiento del checkout" description="Automatizaciones para agilizar el cobro en mostrador.">
        <Card background="bg-surface">
          <Checkbox label="Imprimir ticket automáticamente al cobrar" helpText="Elimina el paso de confirmación y despacha el recibo hacia la impresora térmica de inmediato." checked={config.printReceipts} onChange={(v) => updateField('printReceipts', v)} />
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection title="Horarios y Operación de Caja" description="Configura el cierre automático del sistema y la base de efectivo predeterminada para el cambio.">
        <Card>
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="Fondo inicial predeterminado (Base)"
                type="number"
                value={String(config.defaultStartingFund)}
                onChange={(v) => updateField('defaultStartingFund', parseFloat(v) || 0)}
                autoComplete="off"
                prefix="$"
                helpText="Dinero que usualmente le entregas al cajero para iniciar su turno."
              />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField
                label="Hora de cierre de sistema"
                type="time"
                value={config.closeSystemTime}
                onChange={(v) => updateField('closeSystemTime', v)}
                autoComplete="off"
                helpText="A esta hora el sistema dejará de permitir nuevas ventas hasta el día siguiente."
              />
              <TextField
                label="Hora de corte automático"
                type="time"
                value={config.autoCorteTime}
                onChange={(v) => updateField('autoCorteTime', v)}
                autoComplete="off"
                helpText="Hora en la que se generará el reporte de corte de caja del día de manera automática."
              />
            </FormLayout.Group>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection title="Formatos de Ticket" description="Mensajes de pie de página y estándar tecnológico para el código de barras.">
        <Card>
          <FormLayout>
            <TextField label="Mensaje del pie del ticket" value={config.ticketFooter} onChange={(v) => updateField('ticketFooter', v)} autoComplete="off" multiline={3} helpText="Agrega políticas de devolución o agradecimientos. Usa \n para saltos de línea." />
            <FormLayout.Group>
              <TextField label="Teléfono de soporte/reclamaciones" value={config.ticketServicePhone} onChange={(v) => updateField('ticketServicePhone', v)} autoComplete="off" />
              <TextField label="Límite de vigencia" value={config.ticketVigencia} onChange={(v) => updateField('ticketVigencia', v)} autoComplete="off" helpText="Ej: 30 Días / Fin de mes" />
            </FormLayout.Group>
            <Box paddingBlockStart="200">
              <FormSelect
                label="Simbología del Código de Barras"
                options={[
                  { label: 'CODE128 (estándar, alfanumérico)', value: 'CODE128' },
                  { label: 'CODE39 (clásico)', value: 'CODE39' },
                  { label: 'ITF14 (logística)', value: 'ITF14' },
                ]}
                value={config.ticketBarcodeFormat || 'CODE128'}
                onChange={(v) => updateField('ticketBarcodeFormat', v)}
                helpText="Usado en la parte inferior para identificar la transacción."
              />
            </Box>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection title="Simulador de Ticket" description="Una vista previa realista de cómo los recibos saldrán de la impresora térmica con la configuración actual.">
        <Card>
          <div style={{ background: '#fcfcfc', padding: '12px', maxWidth: '380px', margin: '0 auto', border: '1px solid #e1e3e5', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <pre style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4', margin: 0, padding: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#111' }}>
              {previewText}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', width: '100%' }}>
              <svg style={{ display: 'block', maxWidth: '100%' }} ref={(el) => {
                if (el) {
                  try {
                    JsBarcode(el, 'V-00000112345678', {
                      format: config.ticketBarcodeFormat || 'CODE128', width: 1.5, height: 40, displayValue: true, fontSize: 10, font: 'monospace', margin: 0,
                    });
                  } catch { }
                }
              }} />
            </div>
            <pre style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4', margin: 0, padding: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#111' }}>
              {previewTextAfter}
            </pre>
          </div>
        </Card>
      </Layout.AnnotatedSection>

      <TicketTemplateSection
        label="Plantilla de Ticket de Venta"
        description="Se usa al imprimir desde 'Registrar Venta' e 'Historial de Ventas'. Si no subes una plantilla, se usará el diseño POS por defecto."
        templateKey="ticketTemplateVenta"
        value={config.ticketTemplateVenta}
        onChange={(v: string | undefined) => updateField('ticketTemplateVenta', v as string)}
        sampleVars={SAMPLE_VARS_VENTA}
      />

      <TicketTemplateSection
        label="Plantilla de Ticket de Proveedor (Orden de Surtido)"
        description="Se usa al imprimir desde 'Crear / Ver Pedido'. Si no subes una plantilla, se usará el diseño POS por defecto."
        templateKey="ticketTemplateProveedor"
        value={config.ticketTemplateProveedor}
        onChange={(v: string | undefined) => updateField('ticketTemplateProveedor', v as string)}
        sampleVars={SAMPLE_VARS_PROVEEDOR}
      />

      {/* ── Ticket Designer (self-managed, auto-saves) ── */}
      <Layout.AnnotatedSection title="Diseñador de Tickets" description="Personaliza cada sección del ticket con controles visuales. Los cambios se guardan automáticamente y se reflejan en tiempo real en la vista previa.">
        <TicketDesignerSection />
      </Layout.AnnotatedSection>
    </BlockStack>
  );
}
