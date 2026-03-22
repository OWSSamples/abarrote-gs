'use client';

import {
  Card,
  Text,
  TextField,
  FormLayout,
  BlockStack,
  Layout,
  Checkbox,
} from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import type { SettingsSectionProps } from './types';

export function FiscalSection({ config, updateField }: SettingsSectionProps) {
  return (
    <BlockStack gap="500">
      <Layout.AnnotatedSection title="Información Contable" description="Datos esenciales para el desglose de ventas e impuestos.">
        <Card>
          <FormLayout>
            <TextField label="Registro Federal de Contribuyentes (RFC)" value={config.rfc} onChange={(v) => updateField('rfc', v)} autoComplete="off" />
            <FormLayout.Group>
              <TextField label="Clave del Régimen Fiscal" value={config.regimenFiscal} onChange={(v) => updateField('regimenFiscal', v)} autoComplete="off" helpText="Ej: 612, 626" />
              <TextField label="Descripción del Régimen" value={config.regimenDescription} onChange={(v) => updateField('regimenDescription', v)} autoComplete="off" helpText="Ej: RESICO" />
            </FormLayout.Group>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>

      <Layout.AnnotatedSection title="Moneda y Tasas" description="Moneda por defecto y porcentaje de impuesto al valor agregado.">
        <Card>
          <FormLayout>
            <FormLayout.Group>
              <TextField label="Tasa de IVA global (%)" type="number" value={config.ivaRate} onChange={(v) => updateField('ivaRate', v)} autoComplete="off" suffix="%" helpText="Aplicado a la base gravable" />
              <FormSelect
                label="Moneda principal"
                options={[{ label: 'Peso Mexicano (MXN)', value: 'MXN' }, { label: 'Dólar Americano (USD)', value: 'USD' }]}
                value={config.currency}
                onChange={(v) => updateField('currency', v)}
              />
            </FormLayout.Group>
            <Checkbox
              label="Los precios de los productos ya incluyen IVA"
              checked={config.pricesIncludeIva}
              onChange={(value) => updateField('pricesIncludeIva', value)}
              helpText="Si está marcado, el IVA se extraerá del total (Total / 1.16). Si no está marcado, se sumará al subtotal (Subtotal + 16%)."
            />
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );
}
