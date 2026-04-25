'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Box,
  Banner,
  Spinner,
  Divider,
  Icon,
  IndexTable,
  EmptyState,
} from '@shopify/polaris';
import { RefreshIcon } from '@shopify/polaris-icons';
import { fetchMPDevices, type MPDevice } from '@/app/actions/mercadopago-actions';

export function MPDevicesPanel() {
  const [devices, setDevices] = useState<MPDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMPDevices();
      setDevices(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar dispositivos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  if (loading) {
    return (
      <Card>
        <Box padding="400">
          <InlineStack align="center">
            <Spinner size="small" />
            <Text variant="bodySm" as="span" tone="subdued">
              Cargando dispositivos…
            </Text>
          </InlineStack>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Banner tone="warning" title="Error al cargar dispositivos">
        <p>{error}</p>
        <Box paddingBlockStart="200">
          <Button size="slim" onClick={loadDevices}>
            Reintentar
          </Button>
        </Box>
      </Banner>
    );
  }

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Text variant="headingMd" as="h3">
              Terminales Point
            </Text>
            <Badge>{String(devices.length)}</Badge>
          </InlineStack>
          <Button
            size="slim"
            variant="plain"
            icon={<Icon source={RefreshIcon} />}
            onClick={loadDevices}
            accessibilityLabel="Actualizar dispositivos"
          />
        </InlineStack>

        <Divider />

        {devices.length === 0 ? (
          <EmptyState heading="Sin terminales registradas" image="https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/illustrations/empty-data.svg">
            <p>
              Conecta una terminal MercadoPago Point desde la app de MercadoPago para cobrar con tarjetas físicas. Las
              terminales vinculadas a tu cuenta aparecerán aquí.
            </p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: 'terminal', plural: 'terminales' }}
            itemCount={devices.length}
            headings={[{ title: 'ID Dispositivo' }, { title: 'POS ID' }, { title: 'Tienda' }, { title: 'Modo' }]}
            selectable={false}
          >
            {devices.map((device, index) => (
              <IndexTable.Row id={device.id} key={device.id} position={index}>
                <IndexTable.Cell>
                  <Text variant="bodyMd" fontWeight="semibold" as="span">
                    {device.id}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodySm" as="span">
                    {device.pos_id}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodySm" as="span">
                    {device.store_id || '—'}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={device.operating_mode === 'PDV' ? 'success' : 'info'}>
                    {device.operating_mode || 'Standalone'}
                  </Badge>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}
      </BlockStack>
    </Card>
  );
}
