'use client';

import { Card, BlockStack, InlineStack, Text, Box, Button, TextField, Divider, Banner } from '@shopify/polaris';
import { FormSelect } from '@/components/ui/FormSelect';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

export interface SaleTotalsCardProps {
  subtotal: number;
  discountType: 'amount' | 'percent';
  discount: string;
  discountAmount: number;
  discountPending: boolean;
  iva: number;
  cardSurcharge: number;
  total: number;
  onDiscountTypeChange: (type: 'amount' | 'percent') => void;
  onDiscountChange: (value: string) => void;
  onApplyDiscount: () => void;
  onRemoveDiscount: () => void;
}

export function SaleTotalsCard({
  subtotal,
  discountType,
  discount,
  discountAmount,
  discountPending,
  iva,
  cardSurcharge,
  total,
  onDiscountTypeChange,
  onDiscountChange,
  onApplyDiscount,
  onRemoveDiscount,
}: SaleTotalsCardProps) {
  const { hasPermission } = usePermissions();
  return (
    <Card>
      <BlockStack gap="300">
        {/* ── Desglose ── */}
        <Text as="h3" variant="headingSm">
          Desglose
        </Text>

        <InlineStack align="space-between">
          <Text as="span" variant="bodySm">Subtotal</Text>
          <Text as="span" variant="bodySm">{formatCurrency(subtotal)}</Text>
        </InlineStack>

        {/* Discount */}
        {discountAmount > 0 && !discountPending ? (
          <InlineStack align="space-between">
            <InlineStack gap="100" blockAlign="center">
              <Text as="span" variant="bodySm" tone="success">
                Descuento ({discountType === 'percent' ? `${discount}%` : formatCurrency(discountAmount)})
              </Text>
              <Button variant="plain" tone="critical" size="micro" onClick={onRemoveDiscount}>
                Quitar
              </Button>
            </InlineStack>
            <Text as="span" variant="bodySm" tone="success">
              − {formatCurrency(discountAmount)}
            </Text>
          </InlineStack>
        ) : (
          <BlockStack gap="200">
            <InlineStack gap="200" blockAlign="end" wrap>
              <Box minWidth="60px" maxWidth="80px">
                <FormSelect
                  label="Tipo"
                  options={[
                    { label: '$', value: 'amount' },
                    { label: '%', value: 'percent' },
                  ]}
                  value={discountType}
                  onChange={(v) => onDiscountTypeChange(v as 'amount' | 'percent')}
                />
              </Box>
              <Box minWidth="80px">
                <TextField
                  label="Descuento"
                  labelHidden
                  type="number"
                  value={discount}
                  onChange={onDiscountChange}
                  autoComplete="off"
                  prefix={discountType === 'amount' ? '$' : undefined}
                  suffix={discountType === 'percent' ? '%' : undefined}
                  placeholder="0"
                  min={0}
                  max={discountType === 'percent' ? 100 : undefined}
                  size="slim"
                />
              </Box>
              <Button size="slim" onClick={onApplyDiscount} disabled={!discount || parseFloat(discount) <= 0}>
                {hasPermission('sales.discount') ? 'Aplicar' : 'Solicitar'}
              </Button>
            </InlineStack>
            {discountPending && (
              <Banner tone="warning">
                <p>Requiere autorización de supervisor.</p>
              </Banner>
            )}
          </BlockStack>
        )}

        <InlineStack align="space-between">
          <Text as="span" variant="bodySm">IVA (16%)</Text>
          <Text as="span" variant="bodySm">{formatCurrency(iva)}</Text>
        </InlineStack>

        {cardSurcharge > 0 && (
          <InlineStack align="space-between">
            <Text as="span" variant="bodySm" tone="caution">
              Comisión tarjeta (2.5% + IVA)
            </Text>
            <Text as="span" variant="bodySm" tone="caution">
              {formatCurrency(cardSurcharge)}
            </Text>
          </InlineStack>
        )}

        <Divider />

        {/* ── Total destacado ── */}
        <Box
          background="bg-surface-active"
          padding="300"
          borderRadius="200"
        >
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" variant="headingLg" fontWeight="bold">
              TOTAL
            </Text>
            <Text as="span" variant="headingLg" fontWeight="bold">
              {formatCurrency(total)}
            </Text>
          </InlineStack>
        </Box>
      </BlockStack>
    </Card>
  );
}
