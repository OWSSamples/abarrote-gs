'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button, Banner, BlockStack, InlineStack, Text } from '@shopify/polaris';
import { CameraIcon } from '@shopify/polaris-icons';

interface CameraScannerProps {
  /** Called when a barcode is detected */
  onScan: (code: string) => void;
  /** If true, camera stays open after a scan (for continuous scanning) */
  continuous?: boolean;
  /** Label for the scan button */
  buttonLabel?: string;
  /** Compact mode — smaller button, inline */
  compact?: boolean;
}

export function CameraScanner({
  onScan,
  continuous = false,
  buttonLabel = 'Escanear con cámara',
  compact = false,
}: CameraScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const [lastScanned, setLastScanned] = useState('');
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const containerId = useRef(`camera-scanner-${Math.random().toString(36).slice(2, 9)}`);

  const stopScanner = useCallback(async () => {
    try {
      if (html5QrCodeRef.current) {
        const state = html5QrCodeRef.current.getState();
        // State 2 = SCANNING, State 3 = PAUSED
        if (state === 2 || state === 3) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    } catch {
      // ignore cleanup errors
    }
    setIsOpen(false);
  }, []);

  const startScanner = useCallback(async () => {
    setError('');
    setLastScanned('');
    setIsOpen(true);
  }, []);

  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Actually start the scanner once isOpen becomes true and the container is in the DOM
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const init = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        // Wait for the container to be in the DOM
        await new Promise((r) => setTimeout(r, 150));

        if (cancelled) return;
        const el = document.getElementById(containerId.current);
        if (!el) {
          setError('Error interno: contenedor no encontrado');
          setIsOpen(false);
          return;
        }

        const scanner = new Html5Qrcode(containerId.current);
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 120 },
            aspectRatio: 1.5,
          },
          (decodedText: string) => {
            setLastScanned((prev) => {
              if (prev === decodedText) return prev;
              onScanRef.current(decodedText);
              return decodedText;
            });
            setTimeout(() => setLastScanned(''), 2000);
            if (!continuous) {
              setTimeout(() => stopScanner(), 300);
            }
          },
          () => { }
        );
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setError('Permiso de camara denegado. Habilitalo en la configuracion de tu navegador.');
        } else if (msg.includes('NotFoundError') || msg.includes('device')) {
          setError('No se encontro una camara en este dispositivo.');
        } else {
          setError(`Error al iniciar la camara: ${msg}`);
        }
        setIsOpen(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      // Stop the scanner dynamically to prevent runaway zombie scanner instances
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState();
          if (state === 2 || state === 3) {
            html5QrCodeRef.current.stop().catch(() => { }).finally(() => {
              html5QrCodeRef.current?.clear();
            });
          }
        } catch { /* ignore */ }
      }
    };
  }, [isOpen, continuous, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState();
          if (state === 2 || state === 3) {
            html5QrCodeRef.current.stop().then(() => {
              html5QrCodeRef.current?.clear();
            });
          }
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return (
    <BlockStack gap="200">
      {!isOpen && (
        <div>
          {compact ? (
            <Button size="slim" icon={CameraIcon} onClick={startScanner}>
              {buttonLabel}
            </Button>
          ) : (
            <Button icon={CameraIcon} onClick={startScanner} fullWidth>
              {buttonLabel}
            </Button>
          )}
        </div>
      )}

      {isOpen && (
        <div style={{
          border: '2px solid #2c6ecb',
          borderRadius: '8px',
          overflow: 'hidden',
          position: 'relative',
          background: '#000',
        }}>
          {/* Scan guide overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            textAlign: 'center',
            padding: '6px 8px',
            fontSize: '12px',
          }}>
            Apunta al codigo de barras del producto
          </div>

          <div
            id={containerId.current}
            ref={scannerRef}
            style={{ width: '100%', minHeight: '200px' }}
          />

          <div style={{
            padding: '8px',
            background: '#1a1a1a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Text as="span" variant="bodySm" tone="text-inverse">
              {continuous ? 'Escaneo continuo activo' : 'Esperando código...'}
            </Text>
            <Button variant="primary" tone="critical" size="slim" onClick={stopScanner}>
              Cerrar cámara
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Banner tone="critical" onDismiss={() => setError('')}>
          <p>{error}</p>
        </Banner>
      )}
    </BlockStack>
  );
}
