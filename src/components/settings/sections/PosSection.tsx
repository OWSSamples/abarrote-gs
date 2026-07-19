'use client';

import { useState, type ReactNode } from 'react';
import {
  Badge,
  BlockStack,
  Box,
  Card,
  Checkbox,
  InlineGrid,
  InlineStack,
  Tabs,
  Text,
  TextField,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import { TicketDesignerSection } from './TicketDesignerSection';
import type { SettingsSectionProps } from './types';

type PosPanel = 'operation' | 'cash' | 'ticket' | 'design';

interface SettingsRowProps {
  title: string;
  description: string;
  status?: ReactNode;
  children: ReactNode;
}

function SettingsRow({ title, description, status, children }: SettingsRowProps) {
  return (
    <div className="pos-settings-row">
      <BlockStack gap="150">
        <InlineStack gap="200" blockAlign="center" wrap>
          <Text as="h3" variant="headingSm" fontWeight="semibold">
            {title}
          </Text>
          {status}
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">
          {description}
        </Text>
      </BlockStack>
      <div className="pos-settings-row__control">{children}</div>
    </div>
  );
}

function PanelHeading({ title, description }: { title: string; description: string }) {
  return (
    <Box paddingInline="500" paddingBlock="400" background="bg-surface-secondary">
      <BlockStack gap="100">
        <Text as="h2" variant="headingMd" fontWeight="semibold">
          {title}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {description}
        </Text>
      </BlockStack>
    </Box>
  );
}

function formatTimeLabel(value: string): string {
  const [rawHour = '0', minute = '00'] = value.split(':');
  const hour = Number(rawHour);
  const period = hour >= 12 ? 'p.m.' : 'a.m.';
  return `${hour % 12 || 12}:${minute} ${period}`;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const totalMinutes = index * 30;
  const value = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
  return { value, label: formatTimeLabel(value) };
});

const TIMEZONE_OPTIONS = [
  { value: 'America/Mexico_City', label: 'Centro de México' },
  { value: 'America/Cancun', label: 'Quintana Roo' },
  { value: 'America/Monterrey', label: 'Monterrey' },
  { value: 'America/Chihuahua', label: 'Chihuahua' },
  { value: 'America/Hermosillo', label: 'Sonora' },
  { value: 'America/Tijuana', label: 'Tijuana' },
  { value: 'America/Bogota', label: 'Bogotá' },
  { value: 'America/Lima', label: 'Lima' },
  { value: 'America/Santiago', label: 'Santiago' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
  { value: 'America/New_York', label: 'Nueva York' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles' },
];

const PANELS: PosPanel[] = ['operation', 'cash', 'ticket', 'design'];
const TABS = [
  { id: 'operation', content: 'Operación', panelID: 'pos-operation-panel' },
  { id: 'cash', content: 'Caja y corte', panelID: 'pos-cash-panel' },
  { id: 'ticket', content: 'Ticket', panelID: 'pos-ticket-panel' },
  { id: 'design', content: 'Diseño', panelID: 'pos-design-panel' },
];

export function PosSection({ config, updateField }: SettingsSectionProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  const activePanel = PANELS[selectedTab] ?? 'operation';

  const operationPanel = (
    <div id="pos-operation-panel">
      <PanelHeading
        title="Reglas de cobro"
        description="Comportamiento aplicado al confirmar cada transacción del negocio."
      />

      <SettingsRow
        title="Entrega del recibo"
        description="Selecciona si el operador confirma la impresión o si el ticket se envía directamente al dispositivo conectado."
        status={
          <Badge tone={config.printReceipts ? 'success' : undefined} size="small">
            {config.printReceipts ? 'Automática' : 'Manual'}
          </Badge>
        }
      >
        <FormSelect
          label="Modo de impresión"
          options={[
            { label: 'Solicitar confirmación', value: 'manual' },
            { label: 'Imprimir al finalizar el cobro', value: 'automatic' },
          ]}
          value={config.printReceipts ? 'automatic' : 'manual'}
          onChange={(value) => updateField('printReceipts', value === 'automatic')}
          helpText="Usa ESC/POS cuando existe una impresora conectada y conserva impresión desde navegador como respaldo."
        />
      </SettingsRow>

      <SettingsRow
        title="Cajón de efectivo"
        description="El pulso solo se envía después de una venta en efectivo confirmada. Las reimpresiones no abren el cajón."
        status={
          <Badge tone={config.openCashDrawerOnCashSale ? 'success' : undefined} size="small">
            {config.openCashDrawerOnCashSale ? 'Activo' : 'Inactivo'}
          </Badge>
        }
      >
        <Checkbox
          label="Abrir automáticamente en cobros en efectivo"
          checked={config.openCashDrawerOnCashSale}
          onChange={(value) => updateField('openCashDrawerOnCashSale', value)}
        />
      </SettingsRow>

      <SettingsRow
        title="Horario de ventas"
        description="La regla se valida nuevamente en el servidor para impedir ventas fuera de la ventana autorizada."
        status={
          <Badge tone={config.salesScheduleEnabled ? 'success' : undefined} size="small">
            {config.salesScheduleEnabled ? 'Restringido' : 'Sin restricción'}
          </Badge>
        }
      >
        <BlockStack gap="400">
          <Checkbox
            label="Aplicar horario operativo"
            checked={config.salesScheduleEnabled}
            onChange={(value) => updateField('salesScheduleEnabled', value)}
          />
          {config.salesScheduleEnabled && (
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
              <FormSelect
                label="Apertura"
                options={TIME_OPTIONS}
                value={config.salesOpenTime}
                onChange={(value) => updateField('salesOpenTime', value)}
              />
              <FormSelect
                label="Cierre"
                options={TIME_OPTIONS}
                value={config.closeSystemTime}
                onChange={(value) => updateField('closeSystemTime', value)}
              />
              <div className="pos-settings-grid-span">
                <FormSelect
                  label="Zona horaria del negocio"
                  options={TIMEZONE_OPTIONS}
                  value={config.businessTimezone}
                  onChange={(value) => updateField('businessTimezone', value)}
                />
              </div>
            </InlineGrid>
          )}
        </BlockStack>
      </SettingsRow>
    </div>
  );

  const cashPanel = (
    <div id="pos-cash-panel">
      <PanelHeading
        title="Control de caja"
        description="Parámetros utilizados en apertura, conciliación y cierre del día operativo."
      />

      <SettingsRow
        title="Fondo inicial"
        description="Importe sugerido al abrir caja. El operador puede confirmarlo antes de iniciar el turno."
      >
        <TextField
          label="Importe predeterminado"
          type="number"
          value={String(config.defaultStartingFund)}
          onChange={(value) => {
            const parsed = Number(value);
            updateField('defaultStartingFund', Number.isFinite(parsed) ? parsed : 0);
          }}
          min={0}
          max={1_000_000}
          autoComplete="off"
          prefix="$"
        />
      </SettingsRow>

      <SettingsRow
        title="Corte automático"
        description="Consolida ventas, gastos y efectivo esperado una sola vez por negocio y fecha operativa."
        status={
          <Badge tone={config.autoCorteEnabled ? 'success' : undefined} size="small">
            {config.autoCorteEnabled ? 'Programado' : 'Manual'}
          </Badge>
        }
      >
        <BlockStack gap="400">
          <Checkbox
            label="Programar cierre diario"
            checked={config.autoCorteEnabled}
            onChange={(value) => updateField('autoCorteEnabled', value)}
          />
          {config.autoCorteEnabled && (
            <FormSelect
              label="Hora del corte"
              options={TIME_OPTIONS}
              value={config.autoCorteTime}
              onChange={(value) => updateField('autoCorteTime', value)}
              helpText="Los cortes posteriores a medianoche se asignan al día operativo que acaba de terminar."
            />
          )}
        </BlockStack>
      </SettingsRow>
    </div>
  );

  const ticketPanel = (
    <div id="pos-ticket-panel">
      <PanelHeading
        title="Contenido del comprobante"
        description="Información estándar que acompaña cada ticket de venta."
      />

      <SettingsRow
        title="Mensaje institucional"
        description="Políticas, agradecimientos o información relevante para el cliente."
      >
        <TextField
          label="Mensaje del pie"
          value={config.ticketFooter}
          onChange={(value) => updateField('ticketFooter', value)}
          autoComplete="off"
          multiline={4}
          maxLength={2_000}
          showCharacterCount
        />
      </SettingsRow>

      <SettingsRow
        title="Atención y vigencia"
        description="Datos de referencia impresos al final del comprobante."
      >
        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
          <TextField
            label="Teléfono de atención"
            value={config.ticketServicePhone}
            onChange={(value) => updateField('ticketServicePhone', value)}
            autoComplete="tel"
          />
          <TextField
            label="Vigencia o política"
            value={config.ticketVigencia}
            onChange={(value) => updateField('ticketVigencia', value)}
            autoComplete="off"
          />
        </InlineGrid>
      </SettingsRow>

      <SettingsRow
        title="Identificador del folio"
        description="Simbología utilizada para representar el folio de la transacción."
      >
        <FormSelect
          label="Código de barras"
          options={[
            { label: 'CODE128 · alfanumérico', value: 'CODE128' },
            { label: 'CODE39 · compatibilidad', value: 'CODE39' },
            { label: 'ITF14 · logística', value: 'ITF14' },
          ]}
          value={config.ticketBarcodeFormat || 'CODE128'}
          onChange={(value) => updateField('ticketBarcodeFormat', value)}
        />
      </SettingsRow>
    </div>
  );

  return (
    <BlockStack gap="400">
      <Card padding="0">
        <div className="pos-settings-console">
          <Tabs tabs={TABS} selected={selectedTab} onSelect={setSelectedTab} fitted>
            {activePanel === 'operation' && operationPanel}
            {activePanel === 'cash' && cashPanel}
            {activePanel === 'ticket' && ticketPanel}
            {activePanel === 'design' && (
              <div id="pos-design-panel">
                <PanelHeading
                  title="Diseño del comprobante"
                  description="Personaliza la composición visual de cada formato y comprueba el resultado antes de imprimir."
                />
              </div>
            )}
          </Tabs>
        </div>
      </Card>
      {activePanel === 'design' && <TicketDesignerSection />}
    </BlockStack>
  );
}
