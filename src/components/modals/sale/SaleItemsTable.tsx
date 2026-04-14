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
      {/* Header row */}
      <Box paddingInline="100">
        <InlineStack align="space-between" blockAlign="center">
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
        </InlineStack>
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
            <Box paddingBlock="100" paddingInline="100">
              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                {/* Left — Product info */}
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
                      <Text as="span" variant="bodySm" tone="subdued">
                        {item.sku}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        · {formatCurrency(item.unitPrice)} c/u
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </InlineStack>

                {/* Right — Quantity + subtotal + delete */}
                <InlineStack gap="400" blockAlign="center" wrap={false}>
                  <Box minWidth="90px">
                    {onUpdateQuantity ? (
                      <InlineStack gap="100" blockAlign="center">
                        <Button
                          variant="tertiary"
                          icon={MinusIcon}
                          onClick={() => onUpdateQuantity(item.productId, -1)}
                          disabled={item.quantity <= 1}
                          accessibilityLabel="Menos"
                          size="micro"
                        />
                        <Box minWidth="28px">
                          <Text as="span" variant="bodyMd" fontWeight="bold" alignment="center">
                            {item.quantity}
                          </Text>
                        </Box>
                        <Button
                          variant="tertiary"
                          icon={PlusIcon}
                          onClick={() => onUpdateQuantity(item.productId, 1)}
                          disabled={item.quantity >= stock}
                          accessibilityLabel="Más"
                          size="micro"
                        />
                      </InlineStack>
                    ) : (
                      <Text as="span" variant="bodyMd" fontWeight="bold" alignment="center">
                        {item.quantity}
                      </Text>
                    )}
                  </Box>

                  <Box minWidth="80px">
                    <Text as="span" variant="bodyMd" fontWeight="semibold" alignment="end">
                      {formatCurrency(item.subtotal)}
                    </Text>
                  </Box>

                  <Button
                    variant="plain"
                    icon={DeleteIcon}
                    tone="critical"
                    onClick={() => onRemove(item.productId)}
                    accessibilityLabel="Eliminar"
                    size="micro"
                  />
                </InlineStack>
              </InlineStack>
            </Box>
            {!isLastItem && <Divider />}
          </div>
        );
      })}
    </BlockStack>
  );
}
