'use client';

import { BlockStack, InlineStack, Text, Button, TextField, Icon } from '@shopify/polaris';
import { BarcodeIcon } from '@shopify/polaris-icons';
import { CameraScanner } from '@/components/scanner/CameraScanner';
import { useState } from 'react';

export interface BarcodeScannerCardProps {
  barcodeInput: string;
  onBarcodeInputChange: (value: string) => void;
  barcodeError: string;
  onScan: (code: string) => void;
}

export function BarcodeScannerCard({
  barcodeInput,
  onBarcodeInputChange,
  barcodeError,
  onScan,
}: BarcodeScannerCardProps) {
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <BlockStack gap="200">
      {/* Primary input — always visible, compact */}
      <div
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (e.repeat || !barcodeInput.trim()) return;
            const code = barcodeInput;
            onBarcodeInputChange('');
            onScan(code);
          }
        }}
      >
        <TextField
          label="Escanear"
          labelHidden
          value={barcodeInput}
          onChange={onBarcodeInputChange}
          autoComplete="off"
          placeholder="Escanea o escribe código de barras / SKU..."
          prefix={<Icon source={BarcodeIcon} tone="subdued" />}
          error={barcodeError || undefined}
          connectedRight={
            <InlineStack gap="100">
              <Button onClick={() => onScan(barcodeInput)} disabled={!barcodeInput.trim()}>
                Buscar
              </Button>
              <Button
                variant={cameraOpen ? 'primary' : 'secondary'}
                onClick={() => setCameraOpen(!cameraOpen)}
              >
                {cameraOpen ? 'Cerrar cámara' : 'Cámara'}
              </Button>
            </InlineStack>
          }
        />
      </div>

      {/* Camera — collapsible, only when user needs it */}
      {cameraOpen && (
        <BlockStack gap="100">
          <CameraScanner onScan={onScan} continuous buttonLabel="Escanear con cámara" />
          <Text as="p" variant="bodySm" tone="subdued">
            Apunta al código de barras. Se detecta automáticamente.
          </Text>
        </BlockStack>
      )}
    </BlockStack>
  );
}
