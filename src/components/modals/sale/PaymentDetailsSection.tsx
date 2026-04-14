'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import {
  FormLayout,
  TextField,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Card,
  Spinner,
  ProgressBar,
  Button,
  Box,
  Icon,
  Divider,
} from '@shopify/polaris';
import { ClipboardIcon } from '@shopify/polaris-icons';
import { FormSelect } from '@/components/ui/FormSelect';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { CustomCardPaymentForm } from '@/components/mercadopago/CustomCardPaymentForm';
import { formatCurrency } from '@/lib/utils';
import type { Cliente, UserRoleRecord } from '@/types';
import type { MercadoPagoConfig } from '@/lib/mercadopago';

// ── CLABE Bank Code Lookup (Mexican interbank system) ──
const CLABE_BANK_CODES: Record<string, string> = {
  '002': 'Banamex',
  '006': 'Bancomext',
  '009': 'Banobras',
  '012': 'BBVA',
  '014': 'Santander',
  '021': 'HSBC',
  '030': 'Bajío',
  '032': 'IXE',
  '036': 'Inbursa',
  '037': 'Interacciones',
  '042': 'Mifel',
  '044': 'Scotiabank',
  '058': 'Banregio',
  '059': 'Invex',
  '060': 'Bansi',
  '062': 'Afirme',
  '072': 'Banorte',
  '102': 'Royal Bank',
  '106': 'BAMSA',
  '113': 'Ve por Más',
  '127': 'Azteca',
  '128': 'Autofin',
  '130': 'Compartamos',
  '132': 'Multiva',
  '133': 'Actinver',
  '134': 'Walmart',
  '137': 'Bancoppel',
  '138': 'ABC Capital',
  '140': 'Consubanco',
  '143': 'CIBanco',
  '145': 'BBase',
  '147': 'Bankaool',
  '148': 'Pagatodo',
  '155': 'ICBC',
  '156': 'Sabadell',
  '166': 'Bansefi',
};

function getBankNameFromClabe(clabe: string): string | null {
  if (clabe.length < 3) return null;
  return CLABE_BANK_CODES[clabe.substring(0, 3)] ?? null;
}

function formatClabe(clabe: string): string {
  // Format as: XXX-XXX-XXXXXXXXXXX-X (bank-plaza-account-check)
  if (clabe.length !== 18) return clabe;
  return `${clabe.slice(0, 3)} ${clabe.slice(3, 6)} ${clabe.slice(6, 17)} ${clabe.slice(17)}`;
}

function generatePaymentReference(): string {
  // Short 8-char alphanumeric reference for the customer to include in transfer description
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `REF-${ts.slice(-4)}${rand}`.substring(0, 12);
}

/**
 * Full catalog of payment methods. Each entry includes an optional `requires`
 * field that maps to a StoreConfig boolean flag. When `requires` is set the
 * option is only shown if the corresponding flag is `true`.
 * Options without `requires` are always visible.
 */
const ALL_PAYMENT_METHOD_OPTIONS: ReadonlyArray<{
  label: string;
  value: string;
  requires?:
    | 'mpEnabled'
    | 'conektaEnabled'
    | 'stripeEnabled'
    | 'clipEnabled'
    | 'clabeNumber'
    | 'paypalConfigured'
    | 'cobrarQrUrl';
}> = [
  { label: 'Efectivo', value: 'efectivo' },
  { label: 'Tarjeta (Terminal Mercado Pago)', value: 'tarjeta', requires: 'mpEnabled' },
  { label: 'Mercado Pago Web (Lector Blando / QR)', value: 'tarjeta_web', requires: 'mpEnabled' },
  { label: 'Tarjeta (manual sin terminal)', value: 'tarjeta_manual' },
  { label: 'Transferencia bancaria', value: 'transferencia' },
  { label: 'SPEI (CLABE manual)', value: 'spei', requires: 'clabeNumber' },
  { label: 'SPEI automático (Conekta)', value: 'spei_conekta', requires: 'conektaEnabled' },
  { label: 'SPEI automático (Stripe)', value: 'spei_stripe', requires: 'stripeEnabled' },
  { label: 'OXXO (Conekta)', value: 'oxxo_conekta', requires: 'conektaEnabled' },
  { label: 'OXXO (Stripe)', value: 'oxxo_stripe', requires: 'stripeEnabled' },
  { label: 'Clip Checkout (link de pago)', value: 'tarjeta_clip', requires: 'clipEnabled' },
  { label: 'Clip Terminal (PinPad)', value: 'clip_terminal', requires: 'clipEnabled' },
  { label: 'PayPal', value: 'paypal', requires: 'paypalConfigured' },
  { label: 'QR de Cobro (CoDi / Banco)', value: 'qr_cobro', requires: 'cobrarQrUrl' },
  { label: 'Fiado (crédito a cliente)', value: 'fiado' },
  { label: 'Puntos de Lealtad (Monedero)', value: 'puntos' },
];

import type { Field } from '@shopify/react-form';

export interface PaymentDetailsSectionProps {
  currentUserRole: UserRoleRecord | null;
  paymentMethodField: Field<
    | 'efectivo'
    | 'tarjeta'
    | 'tarjeta_manual'
    | 'tarjeta_web'
    | 'transferencia'
    | 'fiado'
    | 'puntos'
    | 'spei'
    | 'paypal'
    | 'qr_cobro'
    | 'spei_conekta'
    | 'spei_stripe'
    | 'oxxo_conekta'
    | 'oxxo_stripe'
    | 'tarjeta_clip'
    | 'clip_terminal'
  >;
  clienteIdField: Field<string>;
  amountPaidField: Field<string>;
  clientes: Cliente[];
  total: number;
  subtotal: number;
  iva: number;
  cardSurcharge: number;
  change: number;
  pointsAvailable: number;
  mpConfig: MercadoPagoConfig;
  mpProcessing: boolean;
  mpStatus: string;
  mpError: string;
  mpWebSuccess: boolean;
  onCancelMPPayment: () => void;
  onMpWebSuccess: () => void;
  finishSale: (pmOverride?: string) => Promise<void>;
  showError: (msg: string) => void;
  // Datos de métodos de pago adicionales
  clabeNumber?: string;
  paypalUsername?: string;
  paypalQrUrl?: string;
  cobrarQrUrl?: string;
}

// ── QR Payment Verification sub-component ──
// Provides a timed confirmation flow with visual countdown.
// When Cobrar.io webhook is configured, polls backend for auto-verification.
function QRPaymentVerification({
  cobrarQrUrl,
  total,
  formatCurrency: fmtCurrency,
  onAutoConfirm,
}: {
  cobrarQrUrl?: string;
  total: number;
  formatCurrency: (n: number) => string;
  onAutoConfirm?: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [pollStatus, setPollStatus] = useState<'idle' | 'polling' | 'paid' | 'expired' | 'failed'>('idle');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const TIMEOUT_SECONDS = 300; // 5 minutes max wait
  const POLL_INTERVAL_MS = 3000; // 3 seconds

  // Create a charge in DB when component mounts (for webhook tracking)
  useEffect(() => {
    let cancelled = false;
    async function initCharge() {
      try {
        const { createCobrarCharge } = await import('@/app/actions/payment-provider-actions');
        const ref = `QR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        const result = await createCobrarCharge({ amount: total, reference: ref });
        if (!cancelled && result.success && result.chargeId) {
          setChargeId(result.chargeId);
          setPollStatus('polling');
        }
      } catch {
        // Charge creation failed — fall back to manual confirmation
      }
    }
    if (cobrarQrUrl && !confirmed) {
      initCharge();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobrarQrUrl]);

  // Poll for charge status (webhook updates DB → we read it)
  useEffect(() => {
    if (pollStatus !== 'polling' || !chargeId || confirmed) return;

    pollRef.current = setInterval(async () => {
      try {
        const { checkChargeStatus } = await import('@/app/actions/payment-provider-actions');
        const result = await checkChargeStatus(chargeId, 'cobrar');
        if (result.status === 'paid') {
          setPollStatus('paid');
          setConfirmed(true);
          if (timerRef.current) clearInterval(timerRef.current);
          if (pollRef.current) clearInterval(pollRef.current);
          onAutoConfirm?.();
        } else if (result.status === 'expired' || result.status === 'failed') {
          setPollStatus(result.status);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Network error — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pollStatus, chargeId, confirmed, onAutoConfirm]);

  useEffect(() => {
    if (confirmed) return;
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= TIMEOUT_SECONDS) {
          if (timerRef.current) clearInterval(timerRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [confirmed]);

  const handleConfirm = useCallback(() => {
    setConfirmed(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const handleReset = useCallback(() => {
    setConfirmed(false);
    setElapsed(0);
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
  const progress = Math.min((elapsed / TIMEOUT_SECONDS) * 100, 100);
  const timedOut = elapsed >= TIMEOUT_SECONDS;

  if (!cobrarQrUrl) {
    return (
      <Banner tone="warning">
        <p>
          No hay QR configurado. Ve a <strong>Configuración &gt; Pagos</strong> para subir la imagen de tu QR.
        </p>
      </Banner>
    );
  }

  return (
    <BlockStack gap="400">
      <Banner tone="info">
        <p>
          Muestra el <strong>QR de cobro</strong> al cliente para que escanee desde su app bancaria.
        </p>
      </Banner>

      <Card>
        <BlockStack gap="300" inlineAlign="center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cobrarQrUrl}
            alt="QR de cobro"
            style={{
              width: 220,
              height: 220,
              objectFit: 'contain',
              borderRadius: 8,
              border: confirmed ? '3px solid #22c55e' : '1px solid #e1e3e5',
              transition: 'border-color 0.3s',
            }}
          />
          <Divider />
          <InlineStack align="space-between" gap="300">
            <Text as="p" variant="bodySm" tone="subdued">
              Monto a cobrar
            </Text>
            <Text as="p" variant="headingMd" fontWeight="bold">
              {fmtCurrency(total)}
            </Text>
          </InlineStack>

          {!confirmed && !timedOut && (
            <>
              <Box paddingBlockStart="200" width="100%">
                <ProgressBar progress={progress} size="small" tone="primary" />
              </Box>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="bodySm" tone="subdued">
                  Esperando confirmación... {timeStr}
                </Text>
                {pollStatus === 'polling' && (
                  <InlineStack gap="100" blockAlign="center">
                    <Spinner size="small" />
                    <Text as="span" variant="bodySm" tone="subdued">
                      Auto-verificando
                    </Text>
                  </InlineStack>
                )}
              </InlineStack>
              <Button variant="primary" onClick={handleConfirm}>
                Confirmar pago recibido
              </Button>
            </>
          )}

          {confirmed && (
            <Banner tone="success">
              <p>
                <strong>{pollStatus === 'paid' ? 'Pago verificado automáticamente' : 'Pago confirmado'}.</strong> Puedes
                cerrar la venta.
              </p>
            </Banner>
          )}

          {timedOut && !confirmed && (
            <>
              <Banner tone="warning">
                <p>
                  <strong>Tiempo de espera agotado.</strong> Si el pago fue recibido, confírmalo manualmente. Si no,
                  cancela y reintenta.
                </p>
              </Banner>
              <InlineStack gap="200">
                <Button onClick={handleConfirm}>Confirmar de todas formas</Button>
                <Button variant="plain" onClick={handleReset}>
                  Reiniciar timer
                </Button>
              </InlineStack>
            </>
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

export function PaymentDetailsSection({
  currentUserRole,
  paymentMethodField,
  clienteIdField,
  amountPaidField,
  clientes,
  total,
  subtotal,
  iva,
  cardSurcharge,
  change,
  pointsAvailable,
  mpConfig,
  mpProcessing,
  mpStatus,
  mpError,
  mpWebSuccess,
  onCancelMPPayment,
  onMpWebSuccess,
  finishSale,
  showError,
  clabeNumber,
  paypalUsername,
  paypalQrUrl,
  cobrarQrUrl,
}: PaymentDetailsSectionProps) {
  const storeConfig = useDashboardStore((s) => s.storeConfig);

  const paymentMethodOptions = useMemo(() => {
    const flagMap: Record<string, boolean> = {
      mpEnabled: storeConfig.mpEnabled,
      conektaEnabled: storeConfig.conektaEnabled,
      stripeEnabled: storeConfig.stripeEnabled,
      clipEnabled: storeConfig.clipEnabled,
      clabeNumber: Boolean(clabeNumber),
      paypalConfigured: Boolean(paypalQrUrl || paypalUsername),
      cobrarQrUrl: Boolean(cobrarQrUrl),
    };

    return ALL_PAYMENT_METHOD_OPTIONS.map(({ label, value, requires }) => {
      const available = !requires || flagMap[requires];
      return {
        label: available ? label : `${label} — No disponible`,
        value,
        disabled: !available,
      };
    });
  }, [
    storeConfig.mpEnabled,
    storeConfig.conektaEnabled,
    storeConfig.stripeEnabled,
    storeConfig.clipEnabled,
    clabeNumber,
    paypalUsername,
    paypalQrUrl,
    cobrarQrUrl,
  ]);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const paymentRef = useMemo(() => generatePaymentReference(), []);

  const bankName = useMemo(() => (clabeNumber ? getBankNameFromClabe(clabeNumber) : null), [clabeNumber]);

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2500);
    } catch {
      // Fallback for older browsers / insecure contexts
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2500);
    }
  }, []);

  return (
    <FormLayout>
      <TextField
        label="Cajero / ID Global"
        value={currentUserRole ? currentUserRole.globalId || currentUserRole.employeeNumber || '' : ''}
        readOnly
        autoComplete="off"
        placeholder="Cargando cajero..."
        helpText="Venta vinculada automáticamente a tu ID Global de empleado"
      />
      <FormSelect
        label="Método de pago"
        options={paymentMethodOptions}
        value={paymentMethodField.value}
        onChange={(v) => {
          paymentMethodField.onChange(v as typeof paymentMethodField.value);
          if (v !== 'efectivo') amountPaidField.onChange('');
        }}
        error={paymentMethodField.error}
      />

      {/* Loyalty/Client Selection for all methods */}
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          Cliente (para lealtad o fiado)
        </Text>
        <SearchableSelect
          label="Seleccionar Cliente"
          labelHidden
          options={clientes.map((c) => ({
            label: `${c.name} — Puntos: ${Math.floor(parseFloat(String(c.points)))} — Deuda: ${formatCurrency(c.balance)}`,
            value: c.id,
          }))}
          selected={clienteIdField.value}
          onChange={clienteIdField.onChange}
          error={clienteIdField.error}
        />
        {clienteIdField.value &&
          (() => {
            const c = clientes.find((cl) => cl.id === clienteIdField.value);
            if (!c) return null;
            return (
              <Banner tone="info">
                <InlineStack align="space-between">
                  <Text as="p">Puntos disponibles:</Text>
                  <Badge tone="success">{`${Math.floor(parseFloat(String(c.points)))} pts`}</Badge>
                </InlineStack>
              </Banner>
            );
          })()}
      </BlockStack>

      {paymentMethodField.value === 'fiado' && (
        <BlockStack gap="200">
          <Banner tone="warning">
            <p>
              Esta venta se registrará como <strong>fiado</strong>. El monto se sumará a la deuda del cliente.
            </p>
          </Banner>
          {clienteIdField.value &&
            (() => {
              const c = clientes.find((cl) => cl.id === clienteIdField.value);
              if (!c) return null;
              const disponible = Math.max(0, c.creditLimit - c.balance);
              const excedeCredito = total > 0 && c.balance + total > c.creditLimit;
              return (
                <Banner tone={excedeCredito ? 'critical' : 'info'}>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm">
                      Deuda actual: <strong>{formatCurrency(c.balance)}</strong> / Límite:{' '}
                      <strong>{formatCurrency(c.creditLimit)}</strong>
                    </Text>
                    <Text as="p" variant="bodySm">
                      Crédito disponible: <strong>{formatCurrency(disponible)}</strong>
                    </Text>
                    {excedeCredito && (
                      <Text as="p" variant="bodySm" tone="critical">
                        Esta venta de {formatCurrency(total)} excede el credito disponible.
                      </Text>
                    )}
                  </BlockStack>
                </Banner>
              );
            })()}
          {clientes.length === 0 && (
            <Banner tone="info">
              <p>
                No hay clientes registrados. Agrega clientes desde la sección de <strong>Fiado / Crédito</strong>.
              </p>
            </Banner>
          )}
        </BlockStack>
      )}

      {paymentMethodField.value === 'puntos' && (
        <BlockStack gap="200">
          <Banner tone="success">
            <p>Usando puntos de lealtad como método de pago.</p>
          </Banner>
          {total > 0 && pointsAvailable < subtotal + iva + cardSurcharge && (
            <Banner tone="warning">
              <p>
                Los puntos no cubren el total. El resto ({formatCurrency(total)}) debe cobrarse por fuera o el cliente
                debe tener más puntos.
              </p>
            </Banner>
          )}
        </BlockStack>
      )}

      {paymentMethodField.value === 'tarjeta' && !mpConfig.enabled && (
        <Banner tone="warning">
          <p>
            Terminal Mercado Pago no configurada. Ve a <strong>Configuración &gt; Mercado Pago</strong> para ingresar tu
            Access Token y Device ID. O usa &quot;Tarjeta (manual sin terminal)&quot;.
          </p>
        </Banner>
      )}
      {paymentMethodField.value === 'tarjeta' && mpConfig.enabled && !mpProcessing && (
        <Banner tone="info">
          <p>
            Al cobrar, se enviará el monto de <strong>{formatCurrency(total)}</strong> a tu terminal Mercado Pago. El
            cliente pasará su tarjeta en el dispositivo.
          </p>
        </Banner>
      )}
      {mpProcessing && (
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <Spinner size="small" />
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                {mpStatus}
              </Text>
            </InlineStack>
            <ProgressBar progress={mpStatus.includes('Esperando') ? 50 : 25} tone="primary" size="small" />
            {mpError && (
              <Banner tone="critical">
                <p>{mpError}</p>
              </Banner>
            )}
            <InlineStack align="end">
              <Button tone="critical" onClick={onCancelMPPayment}>
                Cancelar cobro
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      )}

      {paymentMethodField.value === 'efectivo' && (
        <BlockStack gap="200">
          <TextField
            label="Monto recibido"
            type="number"
            value={amountPaidField.value}
            onChange={amountPaidField.onChange}
            error={amountPaidField.error}
            autoComplete="off"
            prefix="$"
            placeholder="0.00"
            helpText={total > 0 ? `Mínimo: ${formatCurrency(total)}` : undefined}
          />
          {parseFloat(amountPaidField.value) >= total && total > 0 && (
            <Banner tone="success">
              <InlineStack align="space-between">
                <Text as="span" fontWeight="bold">
                  Cambio:
                </Text>
                <Text as="span" variant="headingMd" fontWeight="bold">
                  {formatCurrency(change)}
                </Text>
              </InlineStack>
            </Banner>
          )}
        </BlockStack>
      )}

      {paymentMethodField.value === 'tarjeta_web' && (
        <BlockStack gap="400">
          <Banner tone="info">
            <p>
              El cliente puede pasar su tarjeta, pagar con saldo MercadoPago o usar código QR sin necesidad de terminal
              física.
            </p>
          </Banner>
          {!mpConfig.publicKey && (
            <Banner tone="critical">
              <p>
                Para usar esta función, necesitas configurar tu &apos;Public Key&apos; de Mercado Pago en Configuración.
              </p>
            </Banner>
          )}
          {mpConfig.publicKey && total > 0 && !mpWebSuccess && (
            <CustomCardPaymentForm
              amount={total}
              // eslint-disable-next-line react-hooks/purity -- unique reference per render is intentional
              externalReference={`venta-${Date.now()}`}
              onSuccess={() => {
                onMpWebSuccess();
                finishSale('tarjeta_web');
              }}
              onError={(e) => showError(e)}
            />
          )}
          {mpWebSuccess && (
            <Banner tone="success">
              <p>Pago procesado correctamente mediante Mercado Pago Web.</p>
            </Banner>
          )}
        </BlockStack>
      )}

      {/* ── SPEI ── */}
      {paymentMethodField.value === 'spei' && (
        <BlockStack gap="400">
          <Banner tone="info">
            <p>
              Pide al cliente que realice una <strong>transferencia SPEI</strong> desde su app bancaria. Confirma el
              depósito antes de cerrar la venta.
            </p>
          </Banner>
          {clabeNumber ? (
            <Card>
              <BlockStack gap="400">
                {/* Bank Identification */}
                {bankName && (
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="info">{bankName}</Badge>
                    <Text as="span" variant="bodySm" tone="subdued">
                      Banco receptor
                    </Text>
                  </InlineStack>
                )}

                {/* CLABE Display */}
                <Box padding="400" borderRadius="200" background="bg-surface-secondary">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">
                      CLABE Interbancaria
                    </Text>
                    <InlineStack gap="300" blockAlign="center" align="space-between">
                      <Text as="p" variant="headingLg" fontWeight="bold" breakWord>
                        {formatClabe(clabeNumber)}
                      </Text>
                      <Button
                        size="slim"
                        variant={copiedField === 'clabe' ? 'primary' : 'secondary'}
                        icon={<Icon source={ClipboardIcon} />}
                        onClick={() => copyToClipboard(clabeNumber, 'clabe')}
                      >
                        {copiedField === 'clabe' ? '¡Copiada!' : 'Copiar'}
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Box>

                <Divider />

                {/* Amount & Reference */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Monto exacto a transferir
                    </Text>
                    <Text as="p" variant="headingMd" fontWeight="bold">
                      {formatCurrency(total)}
                    </Text>
                  </BlockStack>
                  <Button
                    size="slim"
                    variant={copiedField === 'monto' ? 'primary' : 'secondary'}
                    onClick={() => copyToClipboard(total.toFixed(2), 'monto')}
                  >
                    {copiedField === 'monto' ? '¡Copiado!' : 'Copiar monto'}
                  </Button>
                </InlineStack>

                <Divider />

                {/* Reference */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Referencia (concepto de pago)
                    </Text>
                    <Text as="p" variant="headingSm" fontWeight="semibold">
                      {paymentRef}
                    </Text>
                  </BlockStack>
                  <Button
                    size="slim"
                    variant={copiedField === 'ref' ? 'primary' : 'secondary'}
                    onClick={() => copyToClipboard(paymentRef, 'ref')}
                  >
                    {copiedField === 'ref' ? '¡Copiada!' : 'Copiar'}
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          ) : (
            <Banner tone="warning">
              <p>
                No hay CLABE configurada. Ve a <strong>Configuración &gt; Pagos</strong> para ingresarla.
              </p>
            </Banner>
          )}
        </BlockStack>
      )}

      {/* ── PayPal ── */}
      {paymentMethodField.value === 'paypal' && (
        <BlockStack gap="400">
          <Banner tone="info">
            <p>
              El cliente puede pagar con <strong>PayPal</strong> escaneando el código QR o usando el enlace.
              Confirma el pago antes de cerrar la venta.
            </p>
          </Banner>
          {(paypalQrUrl || paypalUsername) ? (
            <Card>
              <BlockStack gap="400">
                {paypalQrUrl && (
                  <Box padding="400" borderRadius="200" background="bg-surface-secondary">
                    <BlockStack gap="300" inlineAlign="center">
                      <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                        Muestra este QR al cliente para que pague con PayPal
                      </Text>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={paypalQrUrl}
                        alt="QR PayPal"
                        style={{
                          width: 200,
                          height: 200,
                          objectFit: 'contain',
                          borderRadius: 8,
                          border: '1px solid #e1e3e5',
                        }}
                      />
                    </BlockStack>
                  </Box>
                )}

                {paypalUsername && (
                  <Box padding="400" borderRadius="200" background="bg-surface-secondary">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">
                        Enlace de pago PayPal
                      </Text>
                      <InlineStack gap="300" blockAlign="center" align="space-between">
                        <Text as="p" variant="headingSm" fontWeight="bold" breakWord>
                          paypal.me/{paypalUsername}/{total.toFixed(2)}
                        </Text>
                        <Button
                          size="slim"
                          variant={copiedField === 'paypal' ? 'primary' : 'secondary'}
                          icon={<Icon source={ClipboardIcon} />}
                          onClick={() =>
                            copyToClipboard(`https://paypal.me/${paypalUsername}/${total.toFixed(2)}`, 'paypal')
                          }
                        >
                          {copiedField === 'paypal' ? '¡Copiado!' : 'Copiar'}
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                )}

                <Divider />

                <InlineStack align="space-between">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Monto a cobrar
                  </Text>
                  <Text as="p" variant="headingMd" fontWeight="bold">
                    {formatCurrency(total)}
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>
          ) : (
            <Banner tone="warning">
              <p>
                No hay QR ni usuario PayPal configurado. Ve a <strong>Configuración &gt; Pagos</strong> para agregarlo.
              </p>
            </Banner>
          )}
        </BlockStack>
      )}

      {/* ── QR de Cobro ── */}
      {paymentMethodField.value === 'qr_cobro' && (
        <QRPaymentVerification
          cobrarQrUrl={cobrarQrUrl}
          total={total}
          formatCurrency={formatCurrency}
          onAutoConfirm={() => finishSale('qr_cobro')}
        />
      )}

      {/* ── SPEI Automático (Conekta) ── */}
      {paymentMethodField.value === 'spei_conekta' && (
        <BlockStack gap="400">
          <Banner tone="info">
            <p>
              <strong>SPEI automático vía Conekta.</strong> Se generará una CLABE de referencia única para esta venta.
              El pago se confirma automáticamente cuando el cliente transfiere.
            </p>
          </Banner>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued">
                  Monto a cobrar
                </Text>
                <Text as="p" variant="headingMd" fontWeight="bold">
                  {formatCurrency(total)}
                </Text>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                La CLABE de referencia se generará al confirmar la venta. El webhook de Conekta actualizará el estado
                automáticamente.
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      )}

      {/* ── SPEI Automático (Stripe) ── */}
      {paymentMethodField.value === 'spei_stripe' && (
        <BlockStack gap="400">
          <Banner tone="info">
            <p>
              <strong>SPEI automático vía Stripe.</strong> Se generará una CLABE de referencia única para esta venta. El
              pago se confirma automáticamente.
            </p>
          </Banner>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued">
                  Monto a cobrar
                </Text>
                <Text as="p" variant="headingMd" fontWeight="bold">
                  {formatCurrency(total)}
                </Text>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                La CLABE de referencia se generará al confirmar la venta. El webhook de Stripe actualizará el estado
                automáticamente.
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      )}

      {/* ── OXXO (Conekta) ── */}
      {paymentMethodField.value === 'oxxo_conekta' && (
        <BlockStack gap="400">
          <Banner tone="info">
            <p>
              <strong>Pago en OXXO vía Conekta.</strong> Se generará un código de barras para que el cliente pague en
              cualquier OXXO. El pago se confirma automáticamente (puede tardar 1-2 horas).
            </p>
          </Banner>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued">
                  Monto a cobrar
                </Text>
                <Text as="p" variant="headingMd" fontWeight="bold">
                  {formatCurrency(total)}
                </Text>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                El voucher OXXO se generará al confirmar la venta. Vigencia de hasta 72 horas.
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      )}

      {/* ── OXXO (Stripe) ── */}
      {paymentMethodField.value === 'oxxo_stripe' && (
        <BlockStack gap="400">
          <Banner tone="info">
            <p>
              <strong>Pago en OXXO vía Stripe.</strong> Se generará un voucher para que el cliente pague en tienda. La
              confirmación es automática.
            </p>
          </Banner>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued">
                  Monto a cobrar
                </Text>
                <Text as="p" variant="headingMd" fontWeight="bold">
                  {formatCurrency(total)}
                </Text>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                El voucher OXXO se generará al confirmar la venta. Vigencia de 3 días.
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      )}

      {/* ── Clip Checkout (link de pago) ── */}
      {paymentMethodField.value === 'tarjeta_clip' && (
        <BlockStack gap="400">
          <Banner tone="info">
            <p>
              <strong>Pago con tarjeta vía Clip Checkout.</strong> Se generará un link de pago seguro. El cliente puede
              pagar con tarjeta de crédito o débito desde su navegador.
            </p>
          </Banner>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued">
                  Monto a cobrar
                </Text>
                <Text as="p" variant="headingMd" fontWeight="bold">
                  {formatCurrency(total)}
                </Text>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                El link de pago se generará al confirmar la venta. Vigencia máxima de 3 días.
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      )}

      {/* ── Clip Terminal (PinPad) ── */}
      {paymentMethodField.value === 'clip_terminal' && (
        <BlockStack gap="400">
          <Banner tone="info">
            <p>
              <strong>Pago presencial con terminal Clip.</strong> Se enviará la intención de pago al lector PinPad
              conectado. El cliente pasa su tarjeta directamente en la terminal.
            </p>
          </Banner>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued">
                  Monto a cobrar
                </Text>
                <Text as="p" variant="headingMd" fontWeight="bold">
                  {formatCurrency(total)}
                </Text>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Al confirmar, el monto aparecerá en la terminal Clip para que el cliente pase su tarjeta.
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      )}
    </FormLayout>
  );
}
