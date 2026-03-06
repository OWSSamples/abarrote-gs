'use client';

import { useState } from 'react';
import { Button, Card, Text, BlockStack, InlineStack, Banner } from '@shopify/polaris';
import { createBackup } from '@/lib/backup';

export function BackupSection() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleBackup = async () => {
    setLoading(true);
    setMessage('');
    
    const result = await createBackup();
    
    if (result.success && result.url) {
      const link = document.createElement('a');
      link.href = result.url;
      link.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      setMessage('Backup creado exitosamente');
    } else {
      setMessage(`Error: ${result.error}`);
    }
    
    setLoading(false);
  };

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">Respaldo de Datos</Text>
        
        {message && (
          <Banner tone={message.includes('Error') ? 'critical' : 'success'}>
            {message}
          </Banner>
        )}

        <InlineStack gap="300">
          <Button onClick={handleBackup} loading={loading}>
            Crear Backup Ahora
          </Button>
          <Button variant="plain">
            Configurar Backup Automático
          </Button>
        </InlineStack>

        <Text as="p" tone="subdued">
          El backup incluye todos los productos, ventas, clientes y configuración.
          Se recomienda hacer backups diarios.
        </Text>
      </BlockStack>
    </Card>
  );
}
