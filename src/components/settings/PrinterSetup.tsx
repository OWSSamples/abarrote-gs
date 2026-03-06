'use client';

import { useState } from 'react';
import { Button, Card, Text, BlockStack, InlineStack, Banner } from '@shopify/polaris';
import { printer } from '@/lib/printer';

export function PrinterSetup() {
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');

  const handleConnect = async () => {
    const success = await printer.connect();
    setConnected(success);
    setMessage(success ? 'Impresora conectada' : 'Error al conectar');
  };

  const handleTest = async () => {
    try {
      await printer.printTicket('=== PRUEBA ===\nImpresora funcionando\ncorrectamente\n');
      setMessage('Ticket de prueba enviado');
    } catch (error) {
      setMessage('Error al imprimir');
    }
  };

  const handleOpenDrawer = async () => {
    try {
      await printer.openCashDrawer();
      setMessage('Cajón abierto');
    } catch (error) {
      setMessage('Error al abrir cajón');
    }
  };

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">Impresora Térmica</Text>
        
        {message && (
          <Banner tone={message.includes('Error') ? 'critical' : 'success'}>
            {message}
          </Banner>
        )}

        <InlineStack gap="300">
          <Button onClick={handleConnect} disabled={connected}>
            {connected ? 'Conectada' : 'Conectar Impresora'}
          </Button>
          <Button onClick={handleTest} disabled={!connected}>
            Imprimir Prueba
          </Button>
          <Button onClick={handleOpenDrawer} disabled={!connected}>
            Abrir Cajón
          </Button>
        </InlineStack>

        <Text as="p" tone="subdued">
          Requiere navegador compatible con Web Serial API (Chrome, Edge).
          Conecta tu impresora térmica vía USB.
        </Text>
      </BlockStack>
    </Card>
  );
}
