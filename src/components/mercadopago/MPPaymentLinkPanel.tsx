'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Banner,
  Box,
  Divider,
  Link,
} from '@shopify/polaris';
import { generateMPPaymentLink, type MPPaymentLink } from '@/app/actions/mercadopago-actions';
import { formatCurrency } from '@/lib/utils';

export function MPPaymentLinkPanel() {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<MPPaymentLink | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Ingresa un monto válido mayor a $0');
      return;
    }
    if (!description.trim()) {
      setError('Ingresa una descripción del cobro');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedLink(null);

    try {
      const link = await generateMPPaymentLink({
        amount: numAmount,
        description: description.trim(),
      });
      setGeneratedLink(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar link');
    } finally {
      setLoading(false);
    }
  }, [amount, description]);

  const handleCopy = useCallback(async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink.initPoint);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError('No se pudo copiar al portapapeles');
    }
  }, [generatedLink]);

  const handleReset = useCallback(() => {
    setAmount('');
    setDescription('');
    setGeneratedLink(null);
    setError(null);
    setCopied(false);
  }, []);

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">Link de cobro / QR</Text>
        <Text variant="bodySm" as="p" tone="subdued">
          Genera un link de pago que puedes compartir por WhatsApp, SMS o mostrar como QR. El
          cliente paga directo desde MercadoPago.
        </Text>

        <Divider />

        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            <p>{error}</p>
          </Banner>
        )}

        {!generatedLink ? (
          <BlockStack gap="300">
            <TextField
              label="Monto a cobrar"
              type="number"
              value={amount}
              onChange={setAmount}
              autoComplete="off"
              prefix="$"
              placeholder="0.00"
            />
            <TextField
              label="Descripción"
              value={description}
              onChange={setDescription}
              autoComplete="off"
              placeholder="Ej: Pedido #123, Servicio de reparación…"
              maxLength={200}
              showCharacterCount
            />
            <InlineStack align="end">
              <Button
                variant="primary"
                onClick={handleGenerate}
                loading={loading}
              >
                Generar link de cobro
              </Button>
            </InlineStack>
          </BlockStack>
        ) : (
          <BlockStack gap="400">
            <Banner tone="success">
              <p>
                Link generado por <strong>{formatCurrency(parseFloat(amount))}</strong> —{' '}
                {description}
              </p>
            </Banner>

            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" tone="subdued">Link de pago</Text>
                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <Text variant="bodySm" as="p" breakWord>
                    {generatedLink.initPoint}
                  </Text>
                </Box>

                <InlineStack gap="200">
                  <Button onClick={handleCopy} size="slim">
                    {copied ? '✓ Copiado' : 'Copiar link'}
                  </Button>
                  <Button
                    size="slim"
                    url={`https://wa.me/?text=${encodeURIComponent(`Paga aquí: ${generatedLink.initPoint}`)}`}
                    external
                  >
                    Enviar por WhatsApp
                  </Button>
                </InlineStack>

                <Divider />

                <Text variant="bodySm" as="p" tone="subdued">
                  ID: {generatedLink.preferenceId} • Ref: {generatedLink.externalReference}
                </Text>
              </BlockStack>
            </Card>

            <InlineStack align="end">
              <Button onClick={handleReset}>Generar otro link</Button>
            </InlineStack>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
