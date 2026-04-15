'use client';

import { Card, IndexTable, Text, Badge, ProgressBar, BlockStack, InlineStack, Box } from '@shopify/polaris';
import { InventoryAlert, Product } from '@/types';
import { formatDate, getDaysUntil, getStockStatus } from '@/lib/utils';

interface InventoryTableProps {
  alerts: InventoryAlert[];
  onProductClick?: (product: Product) => void;
}

export function InventoryTable({ alerts, onProductClick }: InventoryTableProps) {
  const getAlertBadge = (alert: InventoryAlert) => {
    switch (alert.alertType) {
      case 'expiration':
        return <Badge tone="critical">Vence pronto</Badge>;
      case 'expired':
        return <Badge tone="critical">Vencido</Badge>;
      case 'low_stock':
        return <Badge tone="warning">Stock bajo</Badge>;
      case 'merma':
        return <Badge tone="info">Merma</Badge>;
      default:
        return <Badge>{alert.alertType}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge tone="critical">Crítico</Badge>;
      case 'warning':
        return <Badge tone="warning">Advertencia</Badge>;
      case 'info':
        return <Badge tone="info">Información</Badge>;
      default:
        return <Badge>{severity}</Badge>;
    }
  };

  const rowMarkup = alerts.map((alert, index) => {
    const { product } = alert;
    const stockStatus = getStockStatus(product.currentStock, product.minStock);
    const daysUntil = product.expirationDate ? getDaysUntil(product.expirationDate) : null;

    return (
      <IndexTable.Row id={alert.id} key={alert.id} position={index} onClick={() => onProductClick?.(product)}>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="bold">
              {product.name}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {product.sku}
            </Text>
          </BlockStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Box maxWidth="140px">
            <BlockStack gap="100">
              <InlineStack align="space-between">
                <Text as="span" variant="bodySm">
                  {product.currentStock} / {product.minStock} uds
                </Text>
                <Text as="span" variant="bodySm" tone={stockStatus.status === 'critical' ? 'critical' : 'subdued'}>
                  {Math.round(stockStatus.percentage)}%
                </Text>
              </InlineStack>
              <ProgressBar
                progress={stockStatus.percentage}
                tone={stockStatus.status === 'critical' ? 'critical' : undefined}
                size="small"
              />
            </BlockStack>
          </Box>
        </IndexTable.Cell>

        <IndexTable.Cell>
          {product.expirationDate ? (
            <BlockStack gap="050">
              <Text as="span" variant="bodyMd">
                {formatDate(product.expirationDate)}
              </Text>
              {daysUntil !== null && (
                <Text as="span" variant="bodySm" tone={daysUntil <= 2 ? 'critical' : 'subdued'}>
                  {daysUntil <= 0 ? 'Vencido' : daysUntil === 1 ? 'Mañana' : `En ${daysUntil} días`}
                </Text>
              )}
            </BlockStack>
          ) : (
            <Text as="span" variant="bodyMd" tone="subdued">
              N/A
            </Text>
          )}
        </IndexTable.Cell>

        <IndexTable.Cell>{getAlertBadge(alert)}</IndexTable.Cell>

        <IndexTable.Cell>{getSeverityBadge(alert.severity)}</IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Card padding="0">
      <Box padding="400" borderBlockEndWidth="025" borderColor="border">
        <BlockStack gap="100">
          <Text as="h3" variant="headingMd" fontWeight="semibold">
            Inventario Prioritario
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {alerts.length} productos requieren atención inmediata
          </Text>
        </BlockStack>
      </Box>

      <IndexTable
        resourceName={{ singular: 'alerta', plural: 'alertas' }}
        itemCount={alerts.length}
        headings={[
          { title: 'Producto' },
          { title: 'Stock' },
          { title: 'Vencimiento' },
          { title: 'Alerta' },
          { title: 'Severidad' },
        ]}
        selectable={false}
      >
        {rowMarkup}
      </IndexTable>
    </Card>
  );
}
