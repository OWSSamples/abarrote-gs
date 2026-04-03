'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Select,
  Banner,
  Spinner,
  Badge,
  Box,
  Divider,
  Icon,
} from '@shopify/polaris';
import { LockIcon, CreditCardIcon, CheckCircleIcon } from '@shopify/polaris-icons';
import { formatCurrency } from '@/lib/utils';

interface CardFormProps {
  amount: number;
  externalReference: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

// ── Tipos del SDK ─────────────────────────────────────────────────────────
interface SecureField {
  mount: (elementId: string) => void;
  unmount: () => void;
  on: (event: string, callback: (event: any) => void) => void;
  update: (options: any) => void;
}

interface MPInstance {
  fields: {
    create: (type: string, options?: any) => SecureField;
    createCardToken: (options: {
      cardholderName: string;
      identificationType?: string;
      identificationNumber?: string;
    }) => Promise<{ id: string }>;
  };
  getPaymentMethods: (params: { bin: string }) => Promise<{ results: any[] }>;
  getInstallments: (params: { amount: string; bin: string }) => Promise<any[]>;
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale: string }) => MPInstance;
  }
}

// ── Estilos CSS integrados ────────────────────────────────────────────────
const MP_STYLES = `
  .mp-secure-field {
    width: 100%;
    height: 36px;
    border: 1px solid #c9cccf;
    border-radius: 8px;
    padding: 0 12px;
    background: #ffffff;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }
  .mp-secure-field.mp-focus {
    border-color: #005bd3;
    box-shadow: 0 0 0 3px rgba(0, 91, 211, 0.15);
  }
  .mp-secure-field.mp-error {
    border-color: #d82c0d;
    background-color: #fff4f4;
  }
`;

export function CustomCardPaymentForm({
  amount,
  externalReference,
  onSuccess,
  onError,
}: CardFormProps) {
  // Estado de carga y config
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Estado del formulario
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardholderName, setCardholderName] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Estado dinámico detectado por BIN
  const [paymentMethodName, setPaymentMethodName] = useState('');
  const [paymentMethodThumb, setPaymentMethodThumb] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [issuerId, setIssuerId] = useState('');
  const [installmentOptions, setInstallmentOptions] = useState<{ label: string; value: string }[]>([]);
  const [selectedInstallments, setSelectedInstallments] = useState('1');

  // Referencias
  const mpInstance = useRef<MPInstance | null>(null);
  const cardNumberField = useRef<SecureField | null>(null);
  const securityCodeField = useRef<SecureField | null>(null);
  const expirationDateField = useRef<SecureField | null>(null);

  // 1. Obtener la publicKey del backend de forma independiente
  useEffect(() => {
    fetch('/api/mercadopago/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.publicKey) {
          setPublicKey(data.publicKey);
          if (data.email) setEmail(data.email); // Opcional, pre-fill
        } else {
          setConfigError('Falta configurar MercadoPago.');
        }
      })
      .catch(() => setConfigError('Error al cargar configuración de pagos.'));
  }, []);

  // 2. Cargar SDK
  useEffect(() => {
    if (window.MercadoPago) {
      setIsSdkLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => setIsSdkLoaded(true);
    script.onerror = () => setConfigError('Error de red al cargar el procesador.');
    document.body.appendChild(script);
  }, []);

  // 3. Montar Secure Fields cuando SDK y PublicKey estén listos
  useEffect(() => {
    if (!isSdkLoaded || !publicKey || !window.MercadoPago) return;

    try {
      mpInstance.current = new window.MercadoPago(publicKey, { locale: 'es-MX' });
      
      const themeData = {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '14px',
        color: '#202223',
        placeholderColor: '#6d7175'
      };

      // Crear campos
      cardNumberField.current = mpInstance.current.fields.create('cardNumber', {
        placeholder: '1234 5678 9012 3456',
        style: themeData
      });
      
      securityCodeField.current = mpInstance.current.fields.create('securityCode', {
        placeholder: 'CVV',
        style: themeData
      });

      expirationDateField.current = mpInstance.current.fields.create('expirationDate', {
        placeholder: 'MM/AA',
        style: themeData
      });

      // Montarlos
      cardNumberField.current.mount('form-checkout__cardNumber');
      securityCodeField.current.mount('form-checkout__securityCode');
      expirationDateField.current.mount('form-checkout__expirationDate');

      // Escuchar eventos de cambio de BIN (6 primeros digitos) para detectar tarjeta
      cardNumberField.current.on('binChange', async (data: any) => {
        if (!data.bin) {
          setPaymentMethodName('');
          setPaymentMethodThumb('');
          setPaymentMethodId('');
          setInstallmentOptions([]);
          return;
        }

        try {
          if (!mpInstance.current) return;
          const pm = await mpInstance.current.getPaymentMethods({ bin: data.bin });
          if (pm?.results?.length > 0) {
            const method = pm.results[0];
            setPaymentMethodName(method.name);
            setPaymentMethodThumb(method.secure_thumbnail || method.thumbnail);
            setPaymentMethodId(method.id);

            // Obtener cuotas
            const inst = await mpInstance.current.getInstallments({
              amount: amount.toString(),
              bin: data.bin
            });
            
            if (inst?.length > 0) {
              setIssuerId(inst[0].issuer?.id || '');
              const opts = inst[0].payer_costs.map((cost: any) => ({
                label: cost.recommended_message,
                value: String(cost.installments)
              }));
              setInstallmentOptions(opts);
              setSelectedInstallments(opts[0]?.value || '1');
            }
          }
        } catch (err) {
          console.error("Error al obtener método de pago", err);
        }
      });

      // Manejar foco/blur/error visualmente en los divs contenedores
      ['cardNumber', 'securityCode', 'expirationDate'].forEach((type) => {
        const field = type === 'cardNumber' ? cardNumberField.current : 
                      type === 'securityCode' ? securityCodeField.current : 
                      expirationDateField.current;
        const div = document.getElementById(`form-checkout__${type}`);
        
        field?.on('focus', () => div?.classList.add('mp-focus'));
        field?.on('blur', () => div?.classList.remove('mp-focus'));
        field?.on('validityChange', (result: any) => {
          if (result.error) {
            div?.classList.add('mp-error');
          } else {
            div?.classList.remove('mp-error');
            setErrorMsg('');
          }
        });
      });

    } catch (err) {
      console.error(err);
      setConfigError('Error inicializando campos seguros.');
    }

    return () => {
      cardNumberField.current?.unmount();
      securityCodeField.current?.unmount();
      expirationDateField.current?.unmount();
    };
  }, [isSdkLoaded, publicKey, amount]);

  // Manejar el submit (Tokenizar -> Backend)
  const handleSubmit = async () => {
    if (!cardholderName.trim()) { 
      setErrorMsg('Falta el nombre del titular'); 
      return; 
    }
    
    setIsProcessing(true);
    setErrorMsg('');

    try {
      if (!mpInstance.current) throw new Error("Instancia MP no disponible");
      
      const tokenResult = await mpInstance.current.fields.createCardToken({
        cardholderName,
      });

      if (!tokenResult?.id) {
        throw new Error('Revisa que los datos de la tarjeta sean correctos.');
      }

      // Enviar el token a tu backend para procesar
      const checkoutRes = await fetch('/api/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_payment',
          transaction_amount: amount,
          description: `Venta #${externalReference}`,
          payment_method_id: paymentMethodId || 'visa', // Fallback
          token: tokenResult.id,
          installments: parseInt(selectedInstallments, 10) || 1,
          issuer_id: issuerId,
          payer: {
            email: email || 'cliente@pos.local',
          },
          external_reference: externalReference,
        }),
      });

      const backendResult = await checkoutRes.json();

      if (backendResult.status === 'approved' || backendResult.status === 'in_process') {
        onSuccess();
      } else {
        const msg = backendResult.message || backendResult.error || 'Pago rechazado o devuelto por banco.';
        // Traducir algunos errores comunes
        let uiMsg = msg;
        if (msg.includes('cc_rejected_insufficient_amount')) uiMsg = 'Fondos insuficientes o saldo excedido.';
        if (msg.includes('cc_rejected_bad_filled_security_code')) uiMsg = 'CVV incorrecto.';
        if (msg.includes('cc_rejected_bad_filled_date')) uiMsg = 'Fecha de expiración incorrecta.';
        if (msg.includes('cc_rejected_other_reason')) uiMsg = 'La tarjeta fue rechazada por el banco emisor.';
        
        setErrorMsg(uiMsg);
        onError(uiMsg);
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al procesar el pago.');
      if (err.message && !err.message.includes('No route')) {
        onError(err.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (configError) {
    return <Banner tone="critical"><p>{configError}</p></Banner>;
  }

  return (
    <>
      <style>{MP_STYLES}</style>

      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            {/* Cabecera */}
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={CreditCardIcon} />
                <Text as="h3" variant="headingMd" fontWeight="bold">
                  Tarjeta de Crédito o Débito
                </Text>
              </InlineStack>
              <InlineStack gap="200" blockAlign="center">
                {paymentMethodThumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={paymentMethodThumb} alt={paymentMethodName} style={{ height: 24, objectFit: 'contain' }} />
                )}
                <Badge tone="success">
                  <InlineStack gap="100" blockAlign="center">
                    <Icon source={LockIcon} />
                    <span>Protegido</span>
                  </InlineStack>
                </Badge>
              </InlineStack>
            </InlineStack>

            <Divider />

            {(!isSdkLoaded || !publicKey) && !configError && (
              <InlineStack gap="200" blockAlign="center">
                <Spinner size="small" />
                <Text as="p" variant="bodySm" tone="subdued">Cargando campos seguros...</Text>
              </InlineStack>
            )}

            {/* Formulario */}
            <BlockStack gap="400" align="start">
              <BlockStack gap="100" inlineAlign="start">
                <Text as="p" variant="bodySm" fontWeight="medium">Número de tarjeta</Text>
                <div id="form-checkout__cardNumber" className="mp-secure-field" />
              </BlockStack>

              <TextField
                label="Nombre del titular"
                value={cardholderName}
                onChange={setCardholderName}
                autoComplete="off"
                placeholder="Como aparece en la tarjeta"
              />

              <InlineStack gap="400" align="start">
                <Box width="50%">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" fontWeight="medium">Caducidad</Text>
                    <div id="form-checkout__expirationDate" className="mp-secure-field" />
                  </BlockStack>
                </Box>
                <Box width="50%">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" fontWeight="medium">Código de seguridad (CVV)</Text>
                    <div id="form-checkout__securityCode" className="mp-secure-field" />
                  </BlockStack>
                </Box>
              </InlineStack>

            </BlockStack>
          </BlockStack>
        </Card>

        {/* Cuotas y extras */}
        {(installmentOptions.length > 1 || !email) && (
          <Card>
            <BlockStack gap="300">
             {installmentOptions.length > 1 && (
                <Select
                  label="Meses sin intereses / Cuotas"
                  options={installmentOptions}
                  value={selectedInstallments}
                  onChange={setSelectedInstallments}
                />
              )}
              <TextField
                label="Correo de confirmación (Para ticket)"
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
                placeholder="opcional@email.com"
              />
            </BlockStack>
          </Card>
        )}

        {/* Resumen */}
        <Card background="bg-surface-secondary">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" variant="bodyMd" tone="subdued">A cobrar ahora</Text>
            <Text as="p" variant="headingLg" fontWeight="bold">
              {formatCurrency(amount)}
            </Text>
          </InlineStack>
        </Card>

        {errorMsg && (
          <Banner tone="critical">
            <p>{errorMsg}</p>
          </Banner>
        )}

        <Button
          variant="primary"
          size="large"
          fullWidth
          loading={isProcessing}
          disabled={!isSdkLoaded || !publicKey || isProcessing}
          onClick={handleSubmit}
          icon={CheckCircleIcon}
        >
          {isProcessing ? 'Procesando pago...' : `Pagar ${formatCurrency(amount)}`}
        </Button>

        <InlineStack align="center" gap="100">
          <Icon source={LockIcon} tone="subdued" />
          <Text as="p" variant="bodySm" tone="subdued">
            Procesado con encripción End-to-End
          </Text>
        </InlineStack>
      </BlockStack>
    </>
  );
}
