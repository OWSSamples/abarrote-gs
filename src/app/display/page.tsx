'use client';

import { useEffect, useState, useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import {
  Box,
  Text,
  BlockStack,
  InlineStack,
  Card,
  Divider,
  Badge,
  Icon,
  Spinner,
  IndexTable,
  EmptyState,
  Banner,
} from '@shopify/polaris';
import {
  OrderIcon,
  CreditCardIcon,
  CashDollarIcon,
  CheckIcon,
  StoreIcon,
  ClockIcon,
} from '@shopify/polaris-icons';

// ── Types ──

interface DisplayItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface SaleState {
  items: DisplayItem[];
  total: number;
  subtotal: number;
  iva: number;
  cardSurcharge: number;
  discountAmount: number;
  paymentMethod: string;
  status: 'idle' | 'active' | 'paying' | 'finished';
  folio?: string;
  change?: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta (Terminal MP)',
  tarjeta_web: 'MercadoPago Web',
  tarjeta_manual: 'Tarjeta',
  transferencia: 'Transferencia',
  spei: 'SPEI',
  spei_conekta: 'SPEI (Conekta)',
  spei_stripe: 'SPEI (Stripe)',
  oxxo_conekta: 'OXXO (Conekta)',
  oxxo_stripe: 'OXXO (Stripe)',
  tarjeta_clip: 'Clip Checkout',
  clip_terminal: 'Clip Terminal',
  paypal: 'PayPal',
  qr_cobro: 'QR de Cobro',
  fiado: 'Crédito',
  puntos: 'Puntos de Lealtad',
};

const EMPTY_SALE: SaleState = {
  items: [],
  total: 0,
  subtotal: 0,
  iva: 0,
  cardSurcharge: 0,
  discountAmount: 0,
  paymentMethod: 'efectivo',
  status: 'idle',
};

// ── Component ──

export default function CustomerDisplayPage() {
  const storeConfig = useDashboardStore((s) => s.storeConfig);
  const [sale, setSale] = useState<SaleState>(EMPTY_SALE);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // Clock
  useEffect(() => {
    function tick() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      );
      setCurrentDate(
        now.toLocaleDateString('es-MX', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      );
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // BroadcastChannel listener
  useEffect(() => {
    const channel = new BroadcastChannel('customer_display');
    channel.onmessage = (event) => {
      if (event.data.type === 'UPDATE_SALE') {
        setSale(event.data.payload as SaleState);
      }
    };
    return () => channel.close();
  }, []);

  // Auto-clear finished sale
  useEffect(() => {
    if (sale.status === 'finished') {
      const timer = setTimeout(() => setSale(EMPTY_SALE), 6000);
      return () => clearTimeout(timer);
    }
  }, [sale.status]);

  const storeName = storeConfig.storeName || 'Tu Tienda';

  // ── Gate: display must be enabled in settings ──
  if (!storeConfig.customerDisplayEnabled) {
    return (
      <div className="cd-fullscreen">
        <Box padding="0" minHeight="100vh" background="bg-surface">
          <div className="cd-center-col">
            <BlockStack gap="400" inlineAlign="center">
              <Box padding="500" background="bg-surface-secondary" borderRadius="full">
                <Icon source={StoreIcon} tone="subdued" />
              </Box>
              <Text variant="headingLg" as="h1" alignment="center">
                Pantalla del cliente desactivada
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued" alignment="center">
                Actívala desde Configuración → Pantalla del Cliente
              </Text>
            </BlockStack>
          </div>
        </Box>
        <DisplayStyles />
      </div>
    );
  }

  const logoUrl = storeConfig.logoUrl;
  const paymentLabel = PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod;
  const welcomeMsg = storeConfig.customerDisplayWelcome || `¡Bienvenido a ${storeName}!`;
  const farewellMsg = storeConfig.customerDisplayFarewell || `${storeName} le agradece su preferencia`;
  const promoText = storeConfig.customerDisplayPromoText || '';
  const promoImage = storeConfig.customerDisplayPromoImage || '';
  const itemCount = useMemo(
    () => sale.items.reduce((sum, i) => sum + i.quantity, 0),
    [sale.items],
  );

  // ── IDLE SCREEN ──
  if (sale.status === 'idle') {
    return (
      <div className="cd-fullscreen">
        <Box padding="0" minHeight="100vh" background="bg-surface">
          <div className="cd-center-col">
            <BlockStack gap="800" inlineAlign="center">
              {logoUrl ? (
                <img src={logoUrl} alt={storeName} style={{ maxWidth: 200, maxHeight: 120, objectFit: 'contain' }} />
              ) : (
                <Box padding="600" background="bg-fill-success" borderRadius="400">
                  <Icon source={StoreIcon} tone="textInverse" />
                </Box>
              )}

              <BlockStack gap="200" inlineAlign="center">
                <Text variant="heading2xl" as="h1" alignment="center">
                  {welcomeMsg}
                </Text>
                <Text variant="headingMd" as="p" tone="subdued" alignment="center">
                  Estamos a su servicio
                </Text>
              </BlockStack>

              {promoText && (
                <Box padding="400" background="bg-fill-success-secondary" borderRadius="300" maxWidth="600px">
                  <Text variant="bodyLg" as="p" alignment="center" tone="success">
                    {promoText}
                  </Text>
                </Box>
              )}

              {promoImage && (
                <Box borderRadius="300" overflow="hidden" maxWidth="500px">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={promoImage}
                    alt="Promoción"
                    style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 12 }}
                  />
                </Box>
              )}

              <BlockStack gap="100" inlineAlign="center">
                <Text variant="heading3xl" as="p" tone="subdued" fontWeight="regular">
                  {currentTime}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued" alignment="center">
                  {currentDate}
                </Text>
              </BlockStack>
            </BlockStack>

            {storeConfig.phone && (
              <div className="cd-idle-bottom">
                <Text variant="bodySm" as="p" tone="subdued" alignment="center">
                  Tel. {storeConfig.phone}
                  {storeConfig.address ? ` · ${storeConfig.address}` : ''}
                </Text>
              </div>
            )}
          </div>
        </Box>
        <DisplayStyles />
      </div>
    );
  }

  // ── FINISHED SCREEN ──
  if (sale.status === 'finished') {
    return (
      <div className="cd-fullscreen">
        <Box padding="0" minHeight="100vh" background="bg-surface">
          <div className="cd-center-col">
            <BlockStack gap="600" inlineAlign="center">
              <Box padding="500" background="bg-fill-success-secondary" borderRadius="full">
                <Icon source={CheckIcon} tone="success" />
              </Box>

              <Text variant="heading2xl" as="h1" alignment="center" tone="success">
                ¡Gracias por su compra!
              </Text>

              <Box maxWidth="460px" width="100%">
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text variant="bodyLg" as="span" tone="subdued">Total pagado</Text>
                      <Text variant="headingXl" as="span" fontWeight="bold">
                        {formatCurrency(sale.total)}
                      </Text>
                    </InlineStack>

                    <Divider />

                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="span" tone="subdued">Método</Text>
                      <Badge>{paymentLabel}</Badge>
                    </InlineStack>

                    {sale.folio && (
                      <InlineStack align="space-between">
                        <Text variant="bodyMd" as="span" tone="subdued">Folio</Text>
                        <Text variant="bodyMd" as="span" fontWeight="semibold">{sale.folio}</Text>
                      </InlineStack>
                    )}

                    {sale.change != null && sale.change > 0 && (
                      <>
                        <Divider />
                        <InlineStack align="space-between">
                          <Text variant="bodyLg" as="span" tone="subdued">Su cambio</Text>
                          <Text variant="headingLg" as="span" fontWeight="bold" tone="caution">
                            {formatCurrency(sale.change)}
                          </Text>
                        </InlineStack>
                      </>
                    )}
                  </BlockStack>
                </Card>
              </Box>

              <Text variant="bodyMd" as="p" tone="subdued" alignment="center">
                {farewellMsg}
              </Text>
            </BlockStack>
          </div>
        </Box>
        <DisplayStyles />
      </div>
    );
  }

  // ── ACTIVE / PAYING SCREEN ──
  return (
    <div className="cd-fullscreen">
      <Box minHeight="100vh" background="bg-surface-secondary">
        {/* Header */}
        <Box padding="300" paddingInlineStart="500" paddingInlineEnd="500" background="bg-surface" borderBlockEndWidth="025" borderColor="border">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              {logoUrl ? (
                <img src={logoUrl} alt={storeName} style={{ height: 28, objectFit: 'contain' }} />
              ) : (
                <Box padding="200" background="bg-fill-success" borderRadius="200">
                  <Icon source={StoreIcon} tone="textInverse" />
                </Box>
              )}
              <Text variant="headingMd" as="span">{storeName}</Text>
            </InlineStack>

            <InlineStack gap="300" blockAlign="center">
              <InlineStack gap="100" blockAlign="center">
                <Icon source={ClockIcon} tone="subdued" />
                <Text variant="bodySm" as="span" tone="subdued">{currentTime}</Text>
              </InlineStack>
              <Badge tone="success">{itemCount} artículo{itemCount !== 1 ? 's' : ''}</Badge>
            </InlineStack>
          </InlineStack>
        </Box>

        {/* Body: items + totals */}
        <div className="cd-split">
          {/* Left: Items */}
          <div className="cd-left">
            <Box padding="500">
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={OrderIcon} tone="subdued" />
                  <Text variant="headingSm" as="h2" tone="subdued">SU COMPRA</Text>
                </InlineStack>

                {sale.items.length === 0 ? (
                  <Box paddingBlockStart="1200">
                    <EmptyState heading="Escaneando productos…" image="">
                      <p>Los productos aparecerán aquí conforme se escanean.</p>
                    </EmptyState>
                  </Box>
                ) : (
                  <Card padding="0">
                    <IndexTable
                      resourceName={{ singular: 'producto', plural: 'productos' }}
                      itemCount={sale.items.length}
                      headings={[
                        { title: 'Cant.' },
                        { title: 'Producto' },
                        { title: 'P. Unit.' },
                        { title: 'Subtotal' },
                      ]}
                      selectable={false}
                    >
                      {sale.items.map((item, idx) => (
                        <IndexTable.Row
                          id={`${item.productName}-${idx}`}
                          key={`${item.productName}-${idx}`}
                          position={idx}
                        >
                          <IndexTable.Cell>
                            <Badge tone="success">{String(item.quantity)}</Badge>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text variant="bodyMd" as="span" fontWeight="semibold">
                              {item.productName}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text variant="bodySm" as="span" tone="subdued">
                              {formatCurrency(item.unitPrice)}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text variant="bodyMd" as="span" fontWeight="semibold">
                              {formatCurrency(item.subtotal)}
                            </Text>
                          </IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  </Card>
                )}
              </BlockStack>
            </Box>
          </div>

          {/* Right: Totals */}
          <div className="cd-right">
            <Box padding="500">
              <BlockStack gap="500">
                {/* Totals card */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text variant="bodyLg" as="span">Subtotal</Text>
                      <Text variant="bodyLg" as="span">{formatCurrency(sale.subtotal)}</Text>
                    </InlineStack>

                    {sale.discountAmount > 0 && (
                      <InlineStack align="space-between">
                        <Text variant="bodyLg" as="span" tone="success">Descuento</Text>
                        <Text variant="bodyLg" as="span" tone="success">
                          −{formatCurrency(sale.discountAmount)}
                        </Text>
                      </InlineStack>
                    )}

                    <InlineStack align="space-between">
                      <Text variant="bodySm" as="span" tone="subdued">IVA (16%)</Text>
                      <Text variant="bodySm" as="span" tone="subdued">{formatCurrency(sale.iva)}</Text>
                    </InlineStack>

                    {sale.cardSurcharge > 0 && (
                      <InlineStack align="space-between">
                        <Text variant="bodySm" as="span" tone="caution">Comisión tarjeta</Text>
                        <Text variant="bodySm" as="span" tone="caution">
                          +{formatCurrency(sale.cardSurcharge)}
                        </Text>
                      </InlineStack>
                    )}

                    <Divider />

                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingXl" as="span">TOTAL</Text>
                      <Text variant="heading2xl" as="span" fontWeight="bold">
                        {formatCurrency(sale.total)}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </Card>

                {/* Payment status */}
                {sale.status === 'paying' ? (
                  <Banner tone="warning">
                    <InlineStack gap="300" blockAlign="center">
                      <Spinner size="small" />
                      <BlockStack gap="100">
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          Procesando pago…
                        </Text>
                        <Text variant="bodySm" as="p">{paymentLabel}</Text>
                      </BlockStack>
                    </InlineStack>
                  </Banner>
                ) : (
                  <Card>
                    <BlockStack gap="200" inlineAlign="center">
                      <Text variant="bodySm" as="p" tone="subdued">Método de pago</Text>
                      <InlineStack gap="200" blockAlign="center">
                        <Icon
                          source={sale.paymentMethod === 'efectivo' ? CashDollarIcon : CreditCardIcon}
                          tone="subdued"
                        />
                        <Text variant="headingMd" as="p" fontWeight="bold">{paymentLabel}</Text>
                      </InlineStack>
                    </BlockStack>
                  </Card>
                )}

                {/* Footer */}
                <Box paddingBlockStart="200">
                  <Text variant="bodySm" as="p" tone="subdued" alignment="center">
                    Gracias por su preferencia
                  </Text>
                </Box>
              </BlockStack>
            </Box>
          </div>
        </div>
      </Box>
      <DisplayStyles />
    </div>
  );
}

// ── Minimal layout styles (only structural, Polaris handles visual) ──

function DisplayStyles() {
  return (
    <style>{`
      .cd-fullscreen { width:100vw; height:100vh; overflow:hidden; }
      .cd-center-col { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; padding:40px 24px; position:relative; }
      .cd-idle-bottom { position:absolute; bottom:24px; }
      .cd-split { display:flex; flex:1; min-height:0; height:calc(100vh - 52px); }
      .cd-left { flex:1.6; overflow-y:auto; }
      .cd-right { flex:1; display:flex; flex-direction:column; }

      /* Hide Polaris frame chrome in fullscreen display */
      .Polaris-Frame,.Polaris-Frame__Navigation,.Polaris-Frame__TopBar,.Polaris-TopBar { display:none !important; }
      .Polaris-Frame__Content { padding:0 !important; margin:0 !important; max-width:100vw !important; }

      .cd-left::-webkit-scrollbar { width:6px; }
      .cd-left::-webkit-scrollbar-track { background:transparent; }
      .cd-left::-webkit-scrollbar-thumb { background:var(--p-color-border); border-radius:3px; }
    `}</style>
  );
}
