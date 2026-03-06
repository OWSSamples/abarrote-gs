'use client';

import {
  Card,
  IndexTable,
  Text,
  Badge,
  ProgressBar,
  BlockStack,
  InlineStack,
} from '@shopify/polaris';
import { InventoryAlert, Product } from '@/types';
import { formatDate, getDaysUntil, getStockStatus } from '@/lib/utils';

interface InventoryTableProps {
  alerts: InventoryAlert[];
  onProductClick?: (product: Product) => void;
}

export function InventoryTable({ alerts, onProductClick }: InventoryTableProps) {
  const selectedItems: string[] = [];
  
  const getAlertBadge = (alert: InventoryAlert) => {
    switch (alert.alertType) {
      case 'expiration':
        return <Badge tone="critical">Por vencer</Badge>;
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
        return <Badge tone="info">Info</Badge>;
      default:
        return <Badge>{severity}</Badge>;
    }
  };

  const rowMarkup = alerts.map((alert, index) => {
    const { product } = alert;
    const stockStatus = getStockStatus(product.currentStock, product.minStock);
    const daysUntil = product.expirationDate 
      ? getDaysUntil(product.expirationDate)
      : null;

    return (
      <IndexTable.Row
        id={alert.id}
        key={alert.id}
        selected={selectedItems.includes(alert.id)}
        position={index}
        onClick={() => onProductClick?.(product)}
      >
        <IndexTable.Cell>
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            {product.name}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {product.sku}
          </Text>
        </IndexTable.Cell>
        
        <IndexTable.Cell>
          <BlockStack gap="100">
            <InlineStack align="space-between">
              <Text as="p" variant="bodySm">
                {product.currentStock} / {product.minStock} unidades
              </Text>
              <Text as="p" variant="bodySm" tone={stockStatus.status === 'critical' ? 'critical' : 'subdued'}>
                {Math.round(stockStatus.percentage)}%
              </Text>
            </InlineStack>
            <ProgressBar
              progress={stockStatus.percentage}
              tone={stockStatus.status === 'critical' ? 'critical' : undefined}
              size="small"
            />
          </BlockStack>
        </IndexTable.Cell>
        
        <IndexTable.Cell>
          {product.expirationDate ? (
            <BlockStack gap="100">
              <Text as="p" variant="bodyMd">
                {formatDate(product.expirationDate)}
              </Text>
              {daysUntil !== null && (
                <Text as="p" variant="bodySm" tone={daysUntil <= 2 ? 'critical' : 'subdued'}>
                  {daysUntil <= 0 
                    ? 'Vencido' 
                    : daysUntil === 1 
                    ? 'Vence mañana' 
                    : `En ${daysUntil} días`}
                </Text>
              )}
            </BlockStack>
          ) : (
            <Text as="p" variant="bodyMd" tone="subdued">
              N/A
            </Text>
          )}
        </IndexTable.Cell>
        
        <IndexTable.Cell>
          {getAlertBadge(alert)}
        </IndexTable.Cell>
        
        <IndexTable.Cell>
          {getSeverityBadge(alert.severity)}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="100">
          <Text as="h3" variant="headingMd">
            Inventario Prioritario
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {alerts.length} productos requieren atención inmediata
          </Text>
        </BlockStack>

        <IndexTable
          itemCount={alerts.length}
          headings={[
            { title: 'Producto' },
            { title: 'Stock' },
            { title: 'Vencimiento' },
            { title: 'Tipo Alerta' },
            { title: 'Severidad' },
          ]}
          selectable={false}
        >
          {rowMarkup}
        </IndexTable>
      </BlockStack>
    </Card>
  );
}
