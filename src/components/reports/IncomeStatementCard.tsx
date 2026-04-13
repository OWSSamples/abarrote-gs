'use client';

import { Card, Text, BlockStack, InlineStack, Badge, Box, Divider } from '@shopify/polaris';
import { formatCurrency } from '@/lib/utils';
import type { EstadoResultados } from '@/hooks/useFinancialReports';

const gastosCategoriaLabels: Record<string, string> = {
  renta: 'Renta',
  servicios: 'Servicios',
  proveedores: 'Proveedores',
  salarios: 'Salarios',
  mantenimiento: 'Mantenimiento',
  impuestos: 'Impuestos',
  otro: 'Otros',
};

interface IncomeStatementCardProps {
  estadoResultados: EstadoResultados;
}

export function IncomeStatementCard({ estadoResultados }: IncomeStatementCardProps) {
  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="100">
          <Text variant="headingMd" as="h3" fontWeight="bold">
            Estado de Resultados
          </Text>
          <Text variant="bodySm" as="p" tone="subdued">
            Desglose de ingresos, costos y utilidad del período
          </Text>
        </BlockStack>
        <Divider />

        {/* Ingresos */}
        <InlineStack align="space-between">
          <Text variant="bodyMd" as="p" fontWeight="semibold">
            Ingresos por Ventas
          </Text>
          <Text variant="bodyMd" as="p" fontWeight="semibold">
            {formatCurrency(estadoResultados.ingresos)}
          </Text>
        </InlineStack>
        <Box paddingInlineStart="400">
          <InlineStack align="space-between">
            <Text variant="bodySm" tone="subdued" as="p">
              (-) Costo de Mercancía Vendida
            </Text>
            <Text variant="bodySm" tone="critical" as="p">
              ({formatCurrency(estadoResultados.costoMercancia)})
            </Text>
          </InlineStack>
        </Box>
        <Divider />

        {/* Utilidad Bruta */}
        <InlineStack align="space-between">
          <Text variant="bodyMd" as="p" fontWeight="semibold">
            Utilidad Bruta
          </Text>
          <InlineStack gap="200" blockAlign="center">
            <Badge tone={estadoResultados.margenBruto >= 20 ? 'success' : 'warning'}>
              {`${estadoResultados.margenBruto.toFixed(1)}%`}
            </Badge>
            <Text
              variant="bodyMd"
              as="p"
              fontWeight="semibold"
              tone={estadoResultados.utilidadBruta >= 0 ? 'success' : 'critical'}
            >
              {formatCurrency(estadoResultados.utilidadBruta)}
            </Text>
          </InlineStack>
        </InlineStack>

        {/* Gastos operativos */}
        {Object.entries(estadoResultados.gastosByCategory).length > 0 && (
          <Box paddingInlineStart="400">
            <BlockStack gap="100">
              <Text variant="bodySm" tone="subdued" as="p" fontWeight="semibold">
                Gastos Operativos:
              </Text>
              {Object.entries(estadoResultados.gastosByCategory).map(([cat, monto]) => (
                <InlineStack key={cat} align="space-between">
                  <Text variant="bodySm" tone="subdued" as="p">
                    (-) {gastosCategoriaLabels[cat] || cat}
                  </Text>
                  <Text variant="bodySm" tone="critical" as="p">
                    ({formatCurrency(monto)})
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          </Box>
        )}
        <Box paddingInlineStart="400">
          <InlineStack align="space-between">
            <Text variant="bodySm" as="p" fontWeight="semibold">
              (-) Total Gastos Operativos
            </Text>
            <Text variant="bodySm" tone="critical" as="p" fontWeight="semibold">
              ({formatCurrency(estadoResultados.totalGastos)})
            </Text>
          </InlineStack>
        </Box>
        <Divider />

        {/* Utilidad Neta */}
        <Box padding="300" background={estadoResultados.utilidadNeta >= 0 ? 'bg-fill-success-secondary' : 'bg-fill-critical-secondary'} borderRadius="200">
          <InlineStack align="space-between">
            <Text variant="headingSm" as="p">
              UTILIDAD NETA
            </Text>
            <InlineStack gap="200" blockAlign="center">
              <Badge tone={estadoResultados.utilidadNeta >= 0 ? 'success' : 'critical'}>
                {`${estadoResultados.margenNeto.toFixed(1)}%`}
              </Badge>
              <Text variant="headingSm" as="p" tone={estadoResultados.utilidadNeta >= 0 ? 'success' : 'critical'}>
                {formatCurrency(estadoResultados.utilidadNeta)}
              </Text>
            </InlineStack>
          </InlineStack>
        </Box>
      </BlockStack>
    </Card>
  );
}
