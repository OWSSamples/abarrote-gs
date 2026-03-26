import React, { useState, useEffect } from 'react';
import { Modal, Text, BlockStack, InlineStack, Button, Box, InlineGrid, Banner, Icon } from '@shopify/polaris';
import { DeleteIcon, CheckCircleIcon, AlertCircleIcon } from '@shopify/polaris-icons';
import { useDashboardStore } from '@/store/dashboardStore';
import { PermissionKey } from '@/types';

interface PinPadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (authorizedByUid: string, userDisplayName: string) => void;
  requiredPermission: PermissionKey;
  title?: string;
  label?: string; // Nuevo: etiqueta dinámica tipo Shopify API
  masked?: boolean; // Nuevo: opción de enmascaramiento
  minLen?: number;
}

export function PinPadModal({ 
  open, 
  onClose, 
  onSuccess, 
  requiredPermission, 
  title = 'Seguridad POS',
  label = 'Ingresa PIN de autorización',
  masked = true,
  minLen = 4
}: PinPadModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const authorizePin = useDashboardStore((s) => s.authorizePin);

  // Limpiar estado al cerrar
  useEffect(() => {
    if (!open) {
      setPin('');
      setError('');
      setIsShaking(false);
    }
  }, [open]);

  const handleKeyPress = (num: string) => {
    setError('');
    setIsShaking(false);
    if (pin.length < 8) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setError('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length < minLen) {
      setError(`Mínimo ${minLen} dígitos necesarios.`);
      triggerShake();
      return;
    }

    setLoading(true);
    setError('');

    const res = await authorizePin(pin, requiredPermission);
    setLoading(false);

    if (res.success && res.authorizedByUid) {
      setPin('');
      onSuccess(res.authorizedByUid, res.userDisplayName || 'Supervisor');
    } else {
      setError(res.error || 'PIN incorrecto o sin permisos');
      triggerShake();
      setPin('');
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <InlineStack gap="200" blockAlign="center">
          <Icon source={CheckCircleIcon} tone="base" />
          <Text as="h2" variant="headingMd">{title}</Text>
        </InlineStack>
      }
    >
      <Modal.Section>
        <div style={{
          transform: isShaking ? 'translateX(0)' : 'none',
          animation: isShaking ? 'idp-shake 0.4s cubic-bezier(.36,.07,.19,.97) both' : 'none'
        }}>
          <BlockStack gap="500" align="center" inlineAlign="center">
            <Text as="p" alignment="center" variant="bodyMd" tone="subdued">
              {label}
            </Text>

            {/* Display Estilo Shopify */}
            <Box 
              padding="600" 
              background="bg-surface-tertiary" 
              borderRadius="300" 
              minWidth="260px"
              borderWidth="025"
              borderColor={error ? 'border-critical' : 'border-transparent'}
              shadow="inset-sm"
            >
              <InlineStack align="center" gap="400">
                {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: i < pin.length ? 'var(--p-color-text)' : 'var(--p-color-text-subdued)',
                      opacity: i < pin.length ? 1 : 0.2,
                      transition: 'all 0.1s ease',
                      transform: i === pin.length - 1 ? 'scale(1.3)' : 'scale(1)'
                    }}
                  />
                ))}
              </InlineStack>
            </Box>

            {error && (
              <InlineStack gap="100" blockAlign="center">
                <Icon source={AlertCircleIcon} tone="critical" />
                <Text as="p" variant="bodySm" tone="critical" fontWeight="semibold">{error}</Text>
              </InlineStack>
            )}

            {/* Numpad Grado Industrial */}
            <Box maxWidth="280px">
              <InlineGrid columns={3} gap="300">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button 
                    key={num} 
                    className="idp-num-btn"
                    onClick={() => handleKeyPress(num.toString())}
                    disabled={loading}
                  >
                    {num}
                  </button>
                ))}
                <button className="idp-num-btn clear" onClick={() => setPin('')} disabled={loading}>C</button>
                <button className="idp-num-btn" onClick={() => handleKeyPress('0')} disabled={loading}>0</button>
                <button className="idp-num-btn back" onClick={handleBackspace} disabled={loading}>
                   <Icon source={DeleteIcon} tone="inherit" />
                </button>
              </InlineGrid>
            </Box>

            <div style={{ width: '100%', marginTop: '12px' }}>
              <Button 
                size="large" 
                variant="primary" 
                fullWidth 
                onClick={handleSubmit} 
                loading={loading}
                disabled={pin.length < minLen}
              >
                AUTORIZAR OPERACIÓN
              </Button>
            </div>
          </BlockStack>
        </div>

        <style>{`
          .idp-num-btn {
            height: 60px;
            width: 70px;
            border-radius: 12px;
            border: 1px solid var(--p-color-border-subdued);
            background: var(--p-color-bg-surface);
            font-size: 20px;
            font-weight: 600;
            color: var(--p-color-text);
            cursor: pointer;
            transition: all 0.1s active;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .idp-num-btn:hover { background: var(--p-color-bg-surface-hover); }
          .idp-num-btn:active { background: var(--p-color-bg-surface-active); transform: scale(0.95); }
          .idp-num-btn.clear { color: var(--p-color-text-critical); }
          .idp-num-btn.back { color: var(--p-color-text-subdued); }

          @keyframes idp-shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
            40%, 60% { transform: translate3d(4px, 0, 0); }
          }
        `}</style>
      </Modal.Section>
    </Modal>
  );
}
