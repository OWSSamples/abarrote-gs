'use client';

import { Page, Banner, Button, BlockStack, Text } from '@shopify/polaris';

export default function NotFound() {
  return (
    <Page title="Página no encontrada" fullWidth>
      <BlockStack gap="400">
        <Banner tone="warning" title="404 — No encontrado">
          <p>La página que buscas no existe o fue movida.</p>
        </Banner>
        <Text as="p" variant="bodySm" tone="subdued">
          Si crees que esto es un error, contacta al administrador del sistema.
        </Text>
        <Button url="/dashboard">Ir al Dashboard</Button>
      </BlockStack>
    </Page>
  );
}
