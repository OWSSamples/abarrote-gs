'use client';

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
import { TicketDesignerSection } from './TicketDesignerSection';
import type { SettingsSectionProps } from './types';

export function PosSection({ config, updateField }: SettingsSectionProps) {
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

      {/* ── Ticket Designer (self-managed, auto-saves) ── */}
      <Layout.AnnotatedSection title="Diseñador de Tickets" description="Personaliza cada sección del ticket con controles visuales y vista previa en tiempo real. Soporta tickets de venta, corte de caja y órdenes de proveedor.">
        <TicketDesignerSection />
      </Layout.AnnotatedSection>
    </BlockStack>
  );
}
