'use client';

import { BlockStack, InlineStack, Text, Button, Badge, Box, Divider } from '@shopify/polaris';
import { DeleteIcon, MinusIcon, PlusIcon } from '@shopify/polaris-icons';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { formatCurrency } from '@/lib/utils';
import type { SaleItem, Product } from '@/types';

export interface SaleItemsTableProps {
  items: SaleItem[];
  allProducts: Product[];
  onRemove: (productId: string) => void;
  onUpdateQuantity?: (productId: string, delta: number) => void;
}

export function SaleItemsTable({ items, allProducts, onRemove, onUpdateQuantity }: SaleItemsTableProps) {
  if (items.length === 0) return null;

  return (
    <BlockStack gap="200">
      {/* Header — hidden on mobile via CSS */}
      <Box paddingInline="100">
        <div className="sale-items-header">
          <Text variant="bodySm" as="span" tone="subdued" fontWeight="semibold">
            PRODUCTO
          </Text>
          <InlineStack gap="600">
            <Box minWidth="90px">
              <Text variant="bodySm" as="span" tone="subdued" fontWeight="semibold" alignment="center">
                CANT.
              </Text>
            </Box>
            <Box minWidth="80px">
              <Text variant="bodySm" as="span" tone="subdued" fontWeight="semibold" alignment="end">
                SUBTOTAL
              </Text>
            </Box>
            <Box minWidth="24px" />
          </InlineStack>
        </div>
      </Box>

      <Divider />

      {/* Item rows */}
      {items.map((item, idx) => {
        const productInfo = allProducts.find((p) => p.id === item.productId);
        const stock = productInfo?.currentStock ?? 0;
        const isLowStock = stock > 0 && stock <= (productInfo?.minStock ?? 3);
        const isLastItem = idx === items.length - 1;

        return (
          <div key={item.productId}>
            <Box paddingBlock="150" paddingInline="100">
              {/* Desktop layout */}
              <div className="sale-item-desktop">
                <InlineStack align="space-between" blockAlign="center" wrap={false}>
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <Box minWidth="36px" maxWidth="36px">
                      <OptimizedImage source={productInfo?.imageUrl} alt={item.productName} size="small" />
                    </Box>
                    <BlockStack gap="0">
                      <InlineStack gap="100" blockAlign="center">
                        <Text as="span" variant="bodyMd" fontWeight="semibold" truncate>
                          {item.productName}
                        </Text>
                        {isLowStock && <Badge tone="warning" size="small">Bajo</Badge>}
                      </InlineStack>
                      <InlineStack gap="100">
                        <Text as="span" variant="bodySm" tone="subdued">{item.sku}</Text>
                        <Text as="span" variant="bodySm" tone="subdued">· {formatCurrency(item.unitPrice)} c/u</Text>
                      </InlineStack>
                    </BlockStack>
                  </InlineStack>

                  <InlineStack gap="400" blockAlign="center" wrap={false}>
                    <Box minWidth="90px">
                      {onUpdateQuantity ? (
                        <InlineStack gap="100" blockAlign="center">
                          <Button variant="tertiary" icon={MinusIcon} onClick={() => onUpdateQuantity(item.productId, -1)} disabled={item.quantity <= 1} accessibilityLabel="Menos" size="micro" />
                          <Box minWidth="28px">
                            <Text as="span" variant="bodyMd" fontWeight="bold" alignment="center">{item.quantity}</Text>
                          </Box>
                          <Button variant="tertiary" icon={PlusIcon} onClick={() => onUpdateQuantity(item.productId, 1)} disabled={item.quantity >= stock} accessibilityLabel="Más" size="micro" />
                        </InlineStack>
                      ) : (
                        <Text as="span" variant="bodyMd" fontWeight="bold" alignment="center">{item.quantity}</Text>
                      )}
                    </Box>
                    <Box minWidth="80px">
                      <Text as="span" variant="bodyMd" fontWeight="semibold" alignment="end">{formatCurrency(item.subtotal)}</Text>
                    </Box>
                    <Button variant="plain" icon={DeleteIcon} tone="critical" onClick={() => onRemove(item.productId)} accessibilityLabel="Eliminar" size="micro" />
                  </InlineStack>
                </InlineStack>
              </div>

              {/* Mobile layout — stacked */}
              <div className="sale-item-mobile">
                <BlockStack gap="200">
                  {/* Row 1: Product info + delete */}
                  <InlineStack align="space-between" blockAlign="start" wrap={false}>
                    <InlineStack gap="200" blockAlign="center" wrap={false}>
                      <Box minWidth="32px" maxWidth="32px">
                        <OptimizedImage source={productInfo?.imageUrl} alt={item.productName} size="small" />
                      </Box>
                      <BlockStack gap="0">
                        <InlineStack gap="100" blockAlign="center">
                          <Text as="span" variant="bodyMd" fontWeight="semibold" truncate>
                            {item.productName}
                          </Text>
                          {isLowStock && <Badge tone="warning" size="small">Bajo</Badge>}
                        </InlineStack>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {formatCurrency(item.unitPrice)} c/u
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    <Button variant="plain" icon={DeleteIcon} tone="critical" onClick={() => onRemove(item.productId)} accessibilityLabel="Eliminar" />
                  </InlineStack>

                  {/* Row 2: Quantity controls + subtotal */}
                  <InlineStack align="space-between" blockAlign="center">
                    {onUpdateQuantity ? (
                      <div className="sale-item-qty-controls">
                        <Button icon={MinusIcon} onClick={() => onUpdateQuantity(item.productId, -1)} disabled={item.quantity <= 1} accessibilityLabel="Menos" size="slim" />
                        <Text as="span" variant="headingSm" fontWeight="bold" alignment="center">
                          {item.quantity}
                        </Text>
                        <Button icon={PlusIcon} onClick={() => onUpdateQuantity(item.productId, 1)} disabled={item.quantity >= stock} accessibilityLabel="Más" size="slim" />
                      </div>
                    ) : (
                      <Text as="span" variant="headingSm" fontWeight="bold">{item.quantity}</Text>
                    )}
                    <Text as="span" variant="headingSm" fontWeight="bold">
                      {formatCurrency(item.subtotal)}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </div>
            </Box>
            {!isLastItem && <Divider />}
          </div>
        );
      })}

      <style jsx>{`
        .sale-items-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .sale-item-desktop {
          display: block;
        }
        .sale-item-mobile {
          display: none;
        }
        .sale-item-qty-controls {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #f6f6f7;
          border-radius: 8px;
          padding: 4px 8px;
        }
        @media screen and (max-width: 520px) {
          .sale-items-header {
            display: none;
          }
          .sale-item-desktop {
            display: none;
          }
          .sale-item-mobile {
            display: block;
          }
        }
      `}</style>
    </BlockStack>
  );
}
