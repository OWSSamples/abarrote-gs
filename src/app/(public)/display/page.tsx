'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { fetchStoreConfig } from '@/app/actions/store-config-actions';
import { DEFAULT_STORE_CONFIG } from '@/types';
import type {
  StoreConfig,
  CustomerDisplayAnimation,
  CustomerDisplayPromoAnimation,
  TransitionSpeed,
  CustomerDisplayTheme,
  MessageTextSize,
  MessageTextWeight,
  MessageStyle,
} from '@/types';
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
  Thumbnail,
} from '@shopify/polaris';
import {
  OrderIcon,
  CreditCardIcon,
  CashDollarIcon,
  CheckIcon,
  StoreIcon,
  ClockIcon,
  StarFilledIcon,
  GiftCardIcon,
} from '@shopify/polaris-icons';

// ═══════════════════════════════════════════════════════════
// Animation + Theme configuration
// ═══════════════════════════════════════════════════════════

const SPEED_MAP: Record<TransitionSpeed, number> = {
  slow: 1200,
  normal: 600,
  fast: 300,
};

interface ThemeConfig {
  bg: string;
  bgSecondary: string;
  bgGradient: string;
  text: string;
  textMuted: string;
  accent: string;
  promoBg: string;
  border: string;
  decorLine: string;
}

const THEMES: Record<CustomerDisplayTheme, ThemeConfig> = {
  light: {
    bg: '#ffffff',
    bgSecondary: '#f6f6f7',
    bgGradient: 'radial-gradient(ellipse at 50% 0%, #f0fdf4 0%, #ffffff 50%, #f8fafc 100%)',
    text: '#1a1a1a',
    textMuted: '#6d7175',
    accent: '#008060',
    promoBg: 'rgba(0, 128, 96, 0.08)',
    border: '#e1e3e5',
    decorLine: 'linear-gradient(90deg, transparent, #008060, transparent)',
  },
  dark: {
    bg: '#0f1114',
    bgSecondary: '#1a1d21',
    bgGradient: 'radial-gradient(ellipse at 50% 0%, #1e293b 0%, #0f1114 50%, #0a0c0e 100%)',
    text: '#f1f1f1',
    textMuted: '#9a9da0',
    accent: '#36d399',
    promoBg: 'rgba(54, 211, 153, 0.12)',
    border: '#2a2d31',
    decorLine: 'linear-gradient(90deg, transparent, #36d399, transparent)',
  },
  brand: {
    bg: '#0a2540',
    bgSecondary: '#123554',
    bgGradient: 'radial-gradient(ellipse at 50% 0%, #1e4d7a 0%, #0a2540 50%, #061b2e 100%)',
    text: '#ffffff',
    textMuted: '#b0c4de',
    accent: '#00d4aa',
    promoBg: 'rgba(0, 212, 170, 0.12)',
    border: '#1e4d7a',
    decorLine: 'linear-gradient(90deg, transparent, #00d4aa, transparent)',
  },
};

// ═══════════════════════════════════════════════════════════
// Message style → CSS/Polaris mappings
// ═══════════════════════════════════════════════════════════

const MSG_SIZE_TO_VARIANT: Record<MessageTextSize, 'bodySm' | 'bodyMd' | 'bodyLg' | 'headingLg' | 'heading2xl'> = {
  sm: 'bodySm',
  md: 'bodyMd',
  lg: 'bodyLg',
  xl: 'headingLg',
  '2xl': 'heading2xl',
};

const MSG_SIZE_TO_SUBTITLE_VARIANT: Record<MessageTextSize, 'bodySm' | 'bodyMd' | 'bodyMd' | 'bodyLg' | 'bodyLg'> = {
  sm: 'bodySm',
  md: 'bodySm',
  lg: 'bodyMd',
  xl: 'bodyMd',
  '2xl': 'bodyLg',
};

function msgTextStyle(ms: MessageStyle | undefined, fallbackColor?: string): React.CSSProperties {
  if (!ms) return fallbackColor ? { color: fallbackColor } : {};
  return {
    color: ms.textColor || fallbackColor || undefined,
    textTransform: ms.uppercase ? 'uppercase' : undefined,
    fontWeight: ms.textWeight === 'bold' ? 700 : ms.textWeight === 'semibold' ? 600 : undefined,
  };
}

/** Map CSS text-align values to Polaris Alignment / Align types */
function toPolarisAlign(align: string | undefined): 'start' | 'center' | 'end' {
  if (align === 'left') return 'start';
  if (align === 'right') return 'end';
  return 'center';
}

/** Build inline animation style for a given config */
function buildAnimStyle(
  animation: string,
  speedMs: number,
  delayMs: number = 0,
): React.CSSProperties {
  if (animation === 'none') return {};
  return {
    animation: `cd-${animation} ${speedMs}ms ease ${delayMs}ms both`,
  };
}

/** Build promo animation style */
function buildPromoAnimStyle(
  animation: string,
  speedMs: number,
  delayMs: number = 0,
): React.CSSProperties {
  if (animation === 'none') return {};
  const isInfinite = animation === 'pulse' || animation === 'kenBurns';
  const duration = animation === 'kenBurns' ? 8000 : animation === 'pulse' ? 2000 : speedMs;
  return {
    animation: `cd-promo-${animation} ${duration}ms ease ${delayMs}ms ${isInfinite ? 'infinite' : 'both'}`,
  };
}

// ═══════════════════════════════════════════════════════════
// Carousel hook
// ═══════════════════════════════════════════════════════════

function useCarousel(enabled: boolean, intervalSec: number, slideCount: number): number {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!enabled || slideCount <= 1) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % slideCount);
    }, intervalSec * 1000);
    return () => clearInterval(id);
  }, [enabled, intervalSec, slideCount]);
  return index;
}

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export default function CustomerDisplayPage() {
  const [storeConfig, setStoreConfig] = useState<StoreConfig>(DEFAULT_STORE_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [sale, setSale] = useState<SaleState>(EMPTY_SALE);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [animKey, setAnimKey] = useState(0);

  // Load store config
  useEffect(() => {
    let mounted = true;
    fetchStoreConfig()
      .then((config) => {
        if (mounted) {
          setStoreConfig(config);
          setConfigLoaded(true);
        }
      })
      .catch(() => {
        if (mounted) setConfigLoaded(true);
      });
    return () => { mounted = false; };
  }, []);

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
        setAnimKey((k) => k + 1);
      } else if (event.data.type === 'UPDATE_CONFIG') {
        setStoreConfig(event.data.payload as StoreConfig);
        setAnimKey((k) => k + 1);
      }
    };
    return () => channel.close();
  }, []);

  // Auto-clear finished sale (configurable)
  const autoReturnMs = (Number(storeConfig.customerDisplayAutoReturnSec) || 6) * 1000;
  useEffect(() => {
    if (sale.status === 'finished') {
      const timer = setTimeout(() => setSale(EMPTY_SALE), autoReturnMs);
      return () => clearTimeout(timer);
    }
  }, [sale.status, autoReturnMs]);

  // Sound notification on sale start
  const soundEnabled = storeConfig.customerDisplaySoundEnabled === true;
  const prevStatusRef = useRef(sale.status);
  useEffect(() => {
    if (soundEnabled && prevStatusRef.current === 'idle' && sale.status === 'active') {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.stop(ctx.currentTime + 0.15);
      } catch { /* AudioContext not available */ }
    }
    prevStatusRef.current = sale.status;
  }, [sale.status, soundEnabled]);

  // ── Derived values ──
  const storeName = storeConfig.storeName || 'Tu Tienda';
  const displayLogo = storeConfig.customerDisplayLogo || storeConfig.logoUrl || '';
  const paymentLabel = PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod;
  const welcomeMsg = storeConfig.customerDisplayWelcome || `¡Bienvenido a ${storeName}!`;
  const farewellMsg = storeConfig.customerDisplayFarewell || `${storeName} le agradece su preferencia`;
  const promoText = storeConfig.customerDisplayPromoText || '';
  const fontScale = Number(storeConfig.customerDisplayFontScale) || 1;
  const orientation = storeConfig.customerDisplayOrientation || 'landscape';
  const promoImages = useMemo(() => {
    const raw = storeConfig.customerDisplayPromoImage || '';
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === 'string' && u.length > 0);
    } catch { /* not JSON */ }
    return raw.startsWith('http') ? [raw] : [];
  }, [storeConfig.customerDisplayPromoImage]);
  const itemCount = useMemo(
    () => sale.items.reduce((sum, i) => sum + i.quantity, 0),
    [sale.items],
  );

  // ── Animation config ──
  const idleAnimation = (storeConfig.customerDisplayIdleAnimation || 'fade') as CustomerDisplayAnimation;
  const promoAnimation = (storeConfig.customerDisplayPromoAnimation || 'slideUp') as CustomerDisplayPromoAnimation;
  const transitionSpeed = (storeConfig.customerDisplayTransitionSpeed || 'normal') as TransitionSpeed;
  const theme = (storeConfig.customerDisplayTheme || 'light') as CustomerDisplayTheme;
  const showClock = storeConfig.customerDisplayShowClock !== false;
  const carouselEnabled = storeConfig.customerDisplayIdleCarousel === true;
  const carouselInterval = Number(storeConfig.customerDisplayCarouselInterval) || 5;

  const speedMs = SPEED_MAP[transitionSpeed] ?? 600;
  const baseTheme = THEMES[theme] ?? THEMES.light;
  // Override accent color if custom one is set
  const customAccent = storeConfig.customerDisplayAccentColor || '';
  const themeConfig = customAccent
    ? { ...baseTheme, accent: customAccent }
    : baseTheme;

  // Message styling
  const msgStyle = storeConfig.customerDisplayMessageStyle;
  const welcomeStyle = msgStyle?.welcome;
  const farewellStyle = msgStyle?.farewell;
  const promoStyle = msgStyle?.promo;

  // Carousel
  const carouselSlides = useMemo(() => {
    const slides: Array<string> = ['welcome'];
    if (promoText) slides.push('promo-text');
    for (let i = 0; i < promoImages.length; i++) {
      slides.push(`promo-image-${i}`);
    }
    return slides;
  }, [promoText, promoImages]);

  const carouselIndex = useCarousel(carouselEnabled, carouselInterval, carouselSlides.length);
  const activeSlide = carouselSlides[carouselIndex] ?? 'welcome';

  // Themed wrapper style
  const themedBg: React.CSSProperties = {
    background: themeConfig.bg,
    minHeight: '100vh',
    fontSize: `${fontScale}rem`,
  };

  // ════════════════════════════════════════════════════════
  // DISABLED SCREEN
  // ════════════════════════════════════════════════════════

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
        <AnimationStyles />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // IDLE SCREEN — 100% Polaris + CSS animations via inline styles
  // ════════════════════════════════════════════════════════

  if (sale.status === 'idle') {
    return (
      <div className="cd-fullscreen" style={{ background: themeConfig.bg }}>
        <div className="cd-center-col" key={carouselEnabled ? `carousel-${carouselIndex}` : `static-${animKey}`}>
          <BlockStack gap="600" inlineAlign="center">

            {/* Logo / Store icon — matches preview */}
            <div style={buildAnimStyle(idleAnimation, speedMs, 0)}>
              {displayLogo ? (
                <Thumbnail source={displayLogo} alt={storeName} size="large" />
              ) : (
                <Box padding="600" borderRadius="300" background="bg-fill-success">
                  <div style={{ color: '#fff' }}>
                    <Icon source={StoreIcon} />
                  </div>
                </Box>
              )}
            </div>

            {/* Content — carousel or static */}
            {carouselEnabled ? (
              <div style={buildAnimStyle(idleAnimation, speedMs, 100)}>
                {activeSlide === 'welcome' && (
                  <BlockStack gap="200" inlineAlign="center">
                    <Text variant={MSG_SIZE_TO_VARIANT[welcomeStyle?.textSize ?? '2xl']} as="h1" alignment={toPolarisAlign(welcomeStyle?.textAlign)}>
                      <span style={msgTextStyle(welcomeStyle, themeConfig.text)}>{welcomeMsg}</span>
                    </Text>
                    {(welcomeStyle?.subtitle ?? 'Estamos a su servicio') && (
                      <Text variant={MSG_SIZE_TO_SUBTITLE_VARIANT[welcomeStyle?.textSize ?? '2xl']} as="p" alignment={toPolarisAlign(welcomeStyle?.textAlign)}>
                        <span style={{ color: themeConfig.accent }}>{welcomeStyle?.subtitle ?? 'Estamos a su servicio'}</span>
                      </Text>
                    )}
                  </BlockStack>
                )}
                {activeSlide === 'promo-text' && (
                  <Box padding="400" borderRadius="200">
                    <InlineStack gap="200" blockAlign="center" align={toPolarisAlign(promoStyle?.textAlign)}>
                      {(promoStyle?.showIcon !== false) && <Icon source={GiftCardIcon} tone="success" />}
                      <Text variant={MSG_SIZE_TO_VARIANT[promoStyle?.textSize ?? 'lg']} as="p" alignment={toPolarisAlign(promoStyle?.textAlign)} tone="success">
                        <span style={msgTextStyle(promoStyle)}>{promoText}</span>
                      </Text>
                    </InlineStack>
                  </Box>
                )}
              </div>
            ) : (
              <BlockStack gap="400" inlineAlign="center">
                {/* Welcome text */}
                <div style={buildAnimStyle(idleAnimation, speedMs, 100)}>
                  <BlockStack gap="200" inlineAlign="center">
                    <Text variant={MSG_SIZE_TO_VARIANT[welcomeStyle?.textSize ?? '2xl']} as="h1" alignment={toPolarisAlign(welcomeStyle?.textAlign)}>
                      <span style={msgTextStyle(welcomeStyle, themeConfig.text)}>{welcomeMsg}</span>
                    </Text>
                    {(welcomeStyle?.subtitle ?? 'Estamos a su servicio') && (
                      <Text variant={MSG_SIZE_TO_SUBTITLE_VARIANT[welcomeStyle?.textSize ?? '2xl']} as="p" alignment={toPolarisAlign(welcomeStyle?.textAlign)}>
                        <span style={{ color: themeConfig.accent }}>{welcomeStyle?.subtitle ?? 'Estamos a su servicio'}</span>
                      </Text>
                    )}
                  </BlockStack>
                </div>

                {/* Promo text */}
                {promoText && (
                  <div style={buildAnimStyle(idleAnimation, speedMs, 200)}>
                    <Box padding="400" borderRadius="200">
                      <InlineStack gap="200" blockAlign="center" align={toPolarisAlign(promoStyle?.textAlign)}>
                        {(promoStyle?.showIcon !== false) && <Icon source={GiftCardIcon} tone="success" />}
                        <Text variant={MSG_SIZE_TO_VARIANT[promoStyle?.textSize ?? 'lg']} as="p" alignment={toPolarisAlign(promoStyle?.textAlign)} tone="success">
                          <span style={msgTextStyle(promoStyle)}>{promoText}</span>
                        </Text>
                      </InlineStack>
                    </Box>
                  </div>
                )}

                {/* Promo image (first one) — static mode, inline like preview */}
                {promoImages.length > 0 && (
                  <div style={buildAnimStyle(idleAnimation, speedMs, 300)}>
                    <Thumbnail source={promoImages[0]} alt="Promoción" size="large" />
                  </div>
                )}
              </BlockStack>
            )}

            {/* Clock — matches preview */}
            {showClock && (
              <div style={buildAnimStyle(idleAnimation, speedMs, carouselEnabled ? 200 : 400)}>
                <InlineStack gap="200" blockAlign="center" align="center">
                  <Icon source={ClockIcon} tone="subdued" />
                  <Text variant="headingLg" as="p">
                    <span style={{ color: themeConfig.textMuted }}>{currentTime}</span>
                  </Text>
                </InlineStack>
              </div>
            )}

          </BlockStack>
        </div>

        {/* Bottom contact */}
        {storeConfig.phone && (
          <div className="cd-idle-bottom" style={{ position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center' }}>
            <Text variant="bodySm" as="p" alignment="center">
              <span style={{ color: themeConfig.textMuted }}>
                Tel. {storeConfig.phone}
                {storeConfig.address ? ` · ${storeConfig.address}` : ''}
              </span>
            </Text>
          </div>
        )}

        {/* Full-screen promo image overlay (carousel mode) */}
        {(() => {
          if (carouselEnabled && activeSlide.startsWith('promo-image-')) {
            const imgIdx = Number(activeSlide.split('-')[2]);
            const imgUrl = promoImages[imgIdx];
            if (!imgUrl) return null;
            return (
              <div style={{ position: 'fixed', inset: 0, zIndex: 10, background: themeConfig.bg }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl}
                  alt={`Promoción ${imgIdx + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            );
          }
          return null;
        })()}

        <AnimationStyles />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // FINISHED SCREEN
  // ════════════════════════════════════════════════════════

  if (sale.status === 'finished') {
    return (
      <div className="cd-fullscreen">
        <Box padding="0" minHeight="100vh" background="bg-surface">
          <div className="cd-center-col">
            <BlockStack gap="600" inlineAlign="center">
              <div style={buildAnimStyle('bounce', 800)}>
                <Box padding="500" background="bg-fill-success-secondary" borderRadius="full">
                  <Icon source={CheckIcon} tone="success" />
                </Box>
              </div>

              <div style={buildAnimStyle('fade', 600, 200)}>
                <Text variant="heading2xl" as="h1" alignment="center" tone="success">
                  ¡Gracias por su compra!
                </Text>
              </div>

              <div style={buildAnimStyle('slideUp', 600, 300)}>
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
              </div>

              <div style={buildAnimStyle('fade', 600, 500)}>
                <BlockStack gap="100" inlineAlign="center">
                  <InlineStack gap="200" blockAlign="center" align={toPolarisAlign(farewellStyle?.textAlign)}>
                    {(farewellStyle?.showIcon !== false) && <Icon source={StarFilledIcon} tone="warning" />}
                    <Text variant={MSG_SIZE_TO_VARIANT[farewellStyle?.textSize ?? 'md']} as="p" alignment={toPolarisAlign(farewellStyle?.textAlign)}>
                      <span style={msgTextStyle(farewellStyle)}>{farewellMsg}</span>
                    </Text>
                    {(farewellStyle?.showIcon !== false) && <Icon source={StarFilledIcon} tone="warning" />}
                  </InlineStack>
                  {farewellStyle?.subtitle && (
                    <Text variant="bodySm" as="p" tone="subdued" alignment={toPolarisAlign(farewellStyle?.textAlign)}>
                      {farewellStyle.subtitle}
                    </Text>
                  )}
                </BlockStack>
              </div>
            </BlockStack>
          </div>
        </Box>
        <AnimationStyles />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // ACTIVE / PAYING SCREEN
  // ════════════════════════════════════════════════════════

  return (
    <div className="cd-fullscreen">
      <Box minHeight="100vh" background="bg-surface-secondary">
        {/* Header */}
        <Box padding="300" paddingInlineStart="500" paddingInlineEnd="500" background="bg-surface" borderBlockEndWidth="025" borderColor="border">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              {displayLogo ? (
                <Thumbnail source={displayLogo} alt={storeName} size="small" />
              ) : (
                <Box padding="200" background="bg-fill-success" borderRadius="200">
                  <div style={{ color: 'white' }}>
                    <Icon source={StoreIcon} />
                  </div>
                </Box>
              )}
              <Text variant="headingMd" as="span">{storeName}</Text>
            </InlineStack>
            <InlineStack gap="300" blockAlign="center">
              <InlineStack gap="100" blockAlign="center">
                <Icon source={ClockIcon} tone="subdued" />
                <Text variant="bodySm" as="span" tone="subdued">{currentTime}</Text>
              </InlineStack>
              <Badge tone="success">{`${itemCount} artículo${itemCount !== 1 ? 's' : ''}`}</Badge>
            </InlineStack>
          </InlineStack>
        </Box>

        {/* Body */}
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
      <AnimationStyles />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CSS Keyframes only — visual styling is via Polaris components
// ═══════════════════════════════════════════════════════════

function AnimationStyles() {
  return (
    <style>{`
      .cd-fullscreen { width: 100vw; height: 100vh; overflow: hidden; position: relative; }
      .cd-center-col {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        min-height: 100vh; padding: 40px 24px;
        position: relative;
      }
      .cd-idle-bottom { position: absolute; bottom: 24px; }
      .cd-split { display: flex; flex: 1; min-height: 0; height: calc(100vh - 52px); }
      .cd-left { flex: 1.6; overflow-y: auto; }
      .cd-right { flex: 1; display: flex; flex-direction: column; }

      .Polaris-Frame, .Polaris-Frame__Navigation,
      .Polaris-Frame__TopBar, .Polaris-TopBar { display: none !important; }
      .Polaris-Frame__Content { padding: 0 !important; margin: 0 !important; max-width: 100vw !important; }

      .cd-left::-webkit-scrollbar { width: 6px; }
      .cd-left::-webkit-scrollbar-track { background: transparent; }
      .cd-left::-webkit-scrollbar-thumb { background: var(--p-color-border); border-radius: 3px; }

      /* ═══ IDLE ANIMATIONS ═══ */
      @keyframes cd-fade {
        from { opacity: 0; } to { opacity: 1; }
      }
      @keyframes cd-slideUp {
        from { opacity: 0; transform: translateY(40px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes cd-slideDown {
        from { opacity: 0; transform: translateY(-40px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes cd-slideLeft {
        from { opacity: 0; transform: translateX(60px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes cd-slideRight {
        from { opacity: 0; transform: translateX(-60px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes cd-zoom {
        from { opacity: 0; transform: scale(0.85); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes cd-bounce {
        0%   { opacity: 0; transform: scale(0.3); }
        50%  { opacity: 1; transform: scale(1.05); }
        70%  { transform: scale(0.95); }
        100% { transform: scale(1); }
      }

      /* ═══ PROMO ANIMATIONS ═══ */
      @keyframes cd-promo-slideUp {
        from { opacity: 0; transform: translateY(30px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes cd-promo-slideLeft {
        from { opacity: 0; transform: translateX(50px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes cd-promo-slideRight {
        from { opacity: 0; transform: translateX(-50px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes cd-promo-fade {
        from { opacity: 0; } to { opacity: 1; }
      }
      @keyframes cd-promo-zoom {
        from { opacity: 0; transform: scale(0.8); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes cd-promo-pulse {
        0%   { transform: scale(1); }
        50%  { transform: scale(1.04); }
        100% { transform: scale(1); }
      }
      @keyframes cd-promo-kenBurns {
        0%   { transform: scale(1) translate(0, 0); }
        50%  { transform: scale(1.08) translate(-1%, -1%); }
        100% { transform: scale(1) translate(0, 0); }
      }
    `}</style>
  );
}
