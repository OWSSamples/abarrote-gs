'use client';

import {
  Card,
  TextField,
  FormLayout,
  BlockStack,
  Layout,
} from '@shopify/polaris';
import type { SettingsSectionProps } from './types';

export function InventorySection({ config, updateField }: SettingsSectionProps) {
  return (
    <BlockStack gap="500">
      <Layout.AnnotatedSection title="Rentabilidad" description="Define el margen de ganancia que quieres aplicar por defecto al registrar o actualizar productos. El sistema lo usará para sugerir el precio de venta a partir del costo.">
        <Card>
          <FormLayout>
            <TextField label="Margen de ganancia predeterminado" type="number" value={config.defaultMargin} onChange={(v) => updateField('defaultMargin', v)} autoComplete="off" suffix="%" helpText="Ej: 30 significa que si un producto cuesta $10, el precio de venta sugerido será $13." />
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>
      <Layout.AnnotatedSection title="Parámetros de sensibilidad" description="Decide qué tan restrictivo será el sistema para avisarte sobre la escasez o la caducidad de tus productos.">
        <Card>
          <FormLayout>
            <FormLayout.Group>
              <TextField label="Umbral crítico de stock bajo (%)" type="number" value={config.lowStockThreshold} onChange={(v) => updateField('lowStockThreshold', v)} autoComplete="off" suffix="%" helpText="Si un producto requiere mínimo 10, y el umbral es 25%, la alerta roja salta al tener ≤2 unidades." />
              <TextField label="Margen de vencimiento preventivo (días)" type="number" value={config.expirationWarningDays} onChange={(v) => updateField('expirationWarningDays', v)} autoComplete="off" suffix="días" helpText="Con cuánta anticipación deseas que el producto aparezca en la lista de revisión." />
            </FormLayout.Group>
          </FormLayout>
        </Card>
      </Layout.AnnotatedSection>
    </BlockStack>
  );
}
