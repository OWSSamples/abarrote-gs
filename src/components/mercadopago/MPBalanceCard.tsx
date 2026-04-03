'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Box,
  Banner,
  Spinner,
  Badge,
  Divider,
  Icon,
} from '@shopify/polaris';
import { RefreshIcon } from '@shopify/polaris-icons';
import { fetchMPAccountBalance, type MPAccountBalance } from '@/app/actions/mercadopago-actions';
import { formatCurrency } from '@/lib/utils';

export function MPBalanceCard() {
  const [data, setData] = useState<MPAccountBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMPAccountBalance();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar saldo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  if (loading) {
    return (
      <Card>
        <Box padding="400">
          <InlineStack align="center">
            <Spinner size="small" />
            <Text variant="bodySm" as="span" tone="subdued">Consultando saldo…</Text>
          </InlineStack>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Banner tone="warning" title="Saldo no disponible">
        <p>{error}</p>
        <Box paddingBlockStart="200">
          <Button size="slim" onClick={loadBalance}>Reintentar</Button>
        </Box>
      </Banner>
    );
  }

  if (!data) return null;

  const balance = data.balance;
  const available = balance.available_balance ?? 0;
  const unavailable = balance.unavailable_balance ?? 0;
  const total = balance.total_amount ?? available + unavailable;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Text variant="headingMd" as="h3">Cuenta MercadoPago</Text>
            <Badge tone="success">Conectada</Badge>
          </InlineStack>
          <Button
            size="slim"
            variant="plain"
            icon={<Icon source={RefreshIcon} />}
            onClick={loadBalance}
            accessibilityLabel="Actualizar saldo"
          />
        </InlineStack>

        <InlineStack gap="200">
          <Text variant="bodySm" as="span" tone="subdued">
            {data.nickname}
          </Text>
          <Text variant="bodySm" as="span" tone="subdued">•</Text>
          <Text variant="bodySm" as="span" tone="subdued">
            {data.email}
          </Text>
        </InlineStack>

        <Divider />

        <InlineStack gap="800" wrap>
          <BlockStack gap="100">
            <Text variant="bodySm" as="p" tone="subdued">Disponible</Text>
            <Text variant="headingLg" as="p" fontWeight="bold">
              {formatCurrency(available)}
            </Text>
          </BlockStack>
          <BlockStack gap="100">
            <Text variant="bodySm" as="p" tone="subdued">Retenido</Text>
            <Text variant="headingLg" as="p" tone="caution">
              {formatCurrency(unavailable)}
            </Text>
          </BlockStack>
          <BlockStack gap="100">
            <Text variant="bodySm" as="p" tone="subdued">Total</Text>
            <Text variant="headingLg" as="p">
              {formatCurrency(total)}
            </Text>
          </BlockStack>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
