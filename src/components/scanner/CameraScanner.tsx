'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button, Banner, BlockStack, Text, InlineStack } from '@shopify/polaris';
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

/** Check if the current page is a secure context (HTTPS or localhost). */
function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext) return true;
  // Fallback for older browsers
  const { protocol, hostname } = window.location;
  return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
}

/** Pre-request camera permission so the browser shows its native prompt. */
async function requestCameraPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  // 1) Try Permissions API first (non-blocking query)
  if (navigator.permissions) {
    try {
      const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
      if (status.state === 'granted') return 'granted';
      if (status.state === 'denied') return 'denied';
    } catch {
      // Permissions API may not support 'camera' — fall through
    }
  }

  // 2) Actually request via getUserMedia to trigger the browser prompt
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    // Got permission — stop the stream immediately (html5-qrcode will open its own)
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.name : String(err);
    if (msg === 'NotAllowedError' || msg === 'PermissionDeniedError') return 'denied';
    // NotFoundError, OverconstrainedError, etc. — device issue, not permission
    throw err;
  }
}

export function CameraScanner({
  onScan,
  continuous = false,
  buttonLabel = 'Escanear con cámara',
  compact = false,
}: CameraScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const [_lastScanned, setLastScanned] = useState('');
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'denied'>('idle');
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

    // 1) Secure context check
    if (!isSecureContext()) {
      setError(
        'La cámara requiere conexión HTTPS. ' +
          'Si estás en red local, accede a tu app con https:// o usa localhost. ' +
          'En producción (Vercel) esto funciona automáticamente.',
      );
      return;
    }

    // 2) Check for camera API support
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Tu navegador no soporta acceso a la cámara. Usa Chrome, Safari o Firefox actualizados.');
      return;
    }

    // 3) Request permission proactively
    setPermissionState('requesting');
    try {
      const perm = await requestCameraPermission();
      if (perm === 'denied') {
        setPermissionState('denied');
        setError(
          'Permiso de cámara denegado. Para habilitarlo:\n' +
            '1. Toca el ícono 🔒 junto a la URL\n' +
            '2. Busca "Cámara" y cambia a "Permitir"\n' +
            '3. Recarga la página',
        );
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotFoundError') || msg.includes('device')) {
        setError('No se encontró una cámara en este dispositivo.');
      } else {
        setError(`Error al acceder a la cámara: ${msg}`);
      }
      setPermissionState('idle');
      return;
    }

    setPermissionState('idle');
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
          () => {},
        );
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setPermissionState('denied');
          setError(
            'Permiso de cámara denegado. Para habilitarlo:\n' +
              '1. Toca el ícono 🔒 junto a la URL\n' +
              '2. Busca "Cámara" y cambia a "Permitir"\n' +
              '3. Recarga la página',
          );
        } else if (msg.includes('NotFoundError') || msg.includes('device')) {
          setError('No se encontró una cámara en este dispositivo.');
        } else {
          setError(`Error al iniciar la cámara: ${msg}`);
        }
        setIsOpen(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState();
          if (state === 2 || state === 3) {
            html5QrCodeRef.current
              .stop()
              .catch(() => {})
              .finally(() => {
                html5QrCodeRef.current?.clear();
              });
          }
        } catch {
          /* ignore */
        }
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
            <Button
              size="slim"
              icon={CameraIcon}
              onClick={startScanner}
              loading={permissionState === 'requesting'}
            >
              {permissionState === 'requesting' ? 'Solicitando permiso...' : buttonLabel}
            </Button>
          ) : (
            <Button
              icon={CameraIcon}
              onClick={startScanner}
              fullWidth
              loading={permissionState === 'requesting'}
            >
              {permissionState === 'requesting' ? 'Solicitando permiso de cámara...' : buttonLabel}
            </Button>
          )}
        </div>
      )}

      {isOpen && (
        <div
          style={{
            border: '2px solid #2c6ecb',
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative',
            background: '#000',
          }}
        >
          {/* Scan guide overlay */}
          <div
            style={{
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
            }}
          >
            Apunta al código de barras del producto
          </div>

          <div id={containerId.current} ref={scannerRef} style={{ width: '100%', minHeight: '200px' }} />

          <div
            style={{
              padding: '8px',
              background: '#1a1a1a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
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
        <Banner tone="critical" onDismiss={() => { setError(''); setPermissionState('idle'); }}>
          <BlockStack gap="200">
            <p style={{ whiteSpace: 'pre-line' }}>{error}</p>
            {permissionState === 'denied' && (
              <InlineStack gap="200">
                <Button size="slim" onClick={() => window.location.reload()}>
                  Recargar página
                </Button>
                <Button size="slim" variant="plain" onClick={() => { setError(''); setPermissionState('idle'); }}>
                  Intentar de nuevo
                </Button>
              </InlineStack>
            )}
          </BlockStack>
        </Banner>
      )}
    </BlockStack>
  );
}
