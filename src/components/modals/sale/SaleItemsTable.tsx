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
    <BlockStack gap="0">
      {/* Column header */}
      <Box paddingInline="300" paddingBlockEnd="200">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto 32px',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <Text variant="bodySm" as="span" tone="subdued" fontWeight="semibold">
            PRODUCTO
          </Text>
          <Text variant="bodySm" as="span" tone="subdued" fontWeight="semibold" alignment="center">
            CANT.
          </Text>
          <Text variant="bodySm" as="span" tone="subdued" fontWeight="semibold" alignment="end">
            SUBTOTAL
          </Text>
          <span />
        </div>
      </Box>

      <Divider />

      {/* Item rows */}
      {items.map((item, idx) => {
        const productInfo = allProducts.find((p) => p.id === item.productId);
        const stock = productInfo?.currentStock ?? 0;
        const isLowStock = stock > 0 && stock <= (productInfo?.minStock ?? 3);

        return (
          <Box
            key={item.productId}
            paddingBlock="300"
            paddingInline="300"
            background={idx % 2 === 1 ? 'bg-surface-secondary' : undefined}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto 32px',
                gap: 16,
                alignItems: 'center',
              }}
            >
              {/* Producto: image + name + sku + unit price */}
              <InlineStack gap="300" blockAlign="center" wrap={false}>
                <Box minWidth="44px" maxWidth="44px">
                  <OptimizedImage
                    source={productInfo?.imageUrl}
                    alt={item.productName}
                    size="small"
                  />
                </Box>
                <BlockStack gap="050">
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <Text as="span" variant="bodyMd" fontWeight="semibold" truncate>
                      {item.productName}
                    </Text>
                    {isLowStock && (
                      <Badge tone="warning" size="small">
                        Stock bajo
                      </Badge>
                    )}
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    {item.sku && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        {item.sku}
                      </Text>
                    )}
                    <Text as="span" variant="bodySm" tone="subdued">
                      {formatCurrency(item.unitPrice)} c/u
                    </Text>
                  </InlineStack>
                </BlockStack>
              </InlineStack>

              {/* Quantity stepper */}
              {onUpdateQuantity ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--p-color-bg-surface-secondary)',
                    border: '1px solid var(--p-color-border)',
                    borderRadius: 8,
                    padding: 2,
                  }}
                >
                  <Button
                    variant="tertiary"
                    icon={MinusIcon}
                    onClick={() => onUpdateQuantity(item.productId, -1)}
                    disabled={item.quantity <= 1}
                    accessibilityLabel="Disminuir cantidad"
                    size="micro"
                  />
                  <Box minWidth="32px">
                    <Text
                      as="span"
                      variant="bodyMd"
                      fontWeight="bold"
                      alignment="center"
                    >
                      {item.quantity}
                    </Text>
                  </Box>
                  <Button
                    variant="tertiary"
                    icon={PlusIcon}
                    onClick={() => onUpdateQuantity(item.productId, 1)}
                    disabled={item.quantity >= stock}
                    accessibilityLabel="Aumentar cantidad"
                    size="micro"
                  />
                </div>
              ) : (
                <Box minWidth="80px">
                  <Text
                    as="span"
                    variant="bodyMd"
                    fontWeight="bold"
                    alignment="center"
                  >
                    {item.quantity}
                  </Text>
                </Box>
              )}

              {/* Subtotal */}
              <Box minWidth="80px">
                <Text as="span" variant="bodyMd" fontWeight="semibold" alignment="end">
                  {formatCurrency(item.subtotal)}
                </Text>
              </Box>

              {/* Delete */}
              <Button
                variant="plain"
                icon={DeleteIcon}
                tone="critical"
                onClick={() => onRemove(item.productId)}
                accessibilityLabel={`Eliminar ${item.productName}`}
                size="micro"
              />
            </div>
          </Box>
        );
      })}
    </BlockStack>
  );
}
