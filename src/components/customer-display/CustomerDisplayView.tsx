'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@shopify/polaris';
import {
  CashDollarIcon,
  CheckIcon,
  CreditCardIcon,
  RefreshIcon,
  StoreIcon,
} from '@shopify/polaris-icons';
import type { PublicDisplayConfig } from '@/lib/store-config-public';
import type { CustomerDisplaySale } from './customer-display.types';
import { CUSTOMER_DISPLAY_PAYMENT_LABELS } from './customer-display.types';
import styles from './CustomerDisplayView.module.css';

type DisplayLoadState = 'loading' | 'ready' | 'error';

interface CustomerDisplayViewProps {
  config: PublicDisplayConfig;
  sale: CustomerDisplaySale;
  currentTime: string;
  currentDate: string;
  loadState: DisplayLoadState;
  onRetry: () => void;
}

interface ThemeTokens {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentInk: string;
}

type DisplayCssProperties = React.CSSProperties & {
  '--cd-background': string;
  '--cd-surface': string;
  '--cd-surface-muted': string;
  '--cd-text': string;
  '--cd-muted': string;
  '--cd-border': string;
  '--cd-accent': string;
  '--cd-accent-ink': string;
  '--cd-font-scale': string;
  '--cd-transition-ms': string;
};

const THEME_TOKENS: Record<string, ThemeTokens> = {
  light: {
    background: '#f4f5f3',
    surface: '#ffffff',
    surfaceMuted: '#eceeeb',
    text: '#171918',
    muted: '#636865',
    border: '#d8dcd8',
    accent: '#0b7a53',
    accentInk: '#ffffff',
  },
  dark: {
    background: '#101211',
    surface: '#191c1a',
    surfaceMuted: '#222623',
    text: '#f4f7f5',
    muted: '#a7aea9',
    border: '#343a36',
    accent: '#5ee0a5',
    accentInk: '#082719',
  },
  brand: {
    background: '#0d1821',
    surface: '#14232f',
    surfaceMuted: '#1b2d3a',
    text: '#f7fafc',
    muted: '#afbec8',
    border: '#2a4354',
    accent: '#31d49b',
    accentInk: '#08271c',
  },
};

const TRANSITION_DURATION: Record<string, number> = {
  slow: 650,
  normal: 360,
  fast: 180,
};

const IDLE_MOTION_CLASSES: Readonly<Record<string, string>> = {
  none: styles.motionNone,
  fade: styles.motionFade,
  slideUp: styles.motionSlideUp,
  slideDown: styles.motionSlideDown,
  slideLeft: styles.motionSlideLeft,
  slideRight: styles.motionSlideRight,
  zoom: styles.motionZoom,
  bounce: styles.motionBounce,
};

const PROMO_MOTION_CLASSES: Readonly<Record<string, string>> = {
  none: styles.motionNone,
  fade: styles.motionFade,
  slideUp: styles.motionSlideUp,
  slideLeft: styles.motionSlideLeft,
  slideRight: styles.motionSlideRight,
  zoom: styles.motionZoom,
  pulse: styles.motionPulse,
  kenBurns: styles.motionKenBurns,
};

const BANK_CODES: Readonly<Record<string, string>> = {
  '002': 'Banamex',
  '012': 'BBVA',
  '014': 'Santander',
  '021': 'HSBC',
  '036': 'Inbursa',
  '044': 'Scotiabank',
  '058': 'Banregio',
  '062': 'Afirme',
  '072': 'Banorte',
  '127': 'Banco Azteca',
  '137': 'Bancoppel',
};

function useCarousel(enabled: boolean, intervalSeconds: number, slideCount: number): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled || slideCount <= 1) {
      setIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slideCount);
    }, intervalSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [enabled, intervalSeconds, slideCount]);

  return index;
}

function getAccentColor(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function getAccentInk(hex: string, fallback: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return fallback;
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 150 ? '#111412' : '#ffffff';
}

function parsePromoImages(raw: string | undefined): string[] {
  if (!raw) return [];

  let candidates: unknown[] = [raw];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) candidates = parsed;
  } catch {
    // A single URL is a valid legacy value.
  }

  return candidates.filter((candidate): candidate is string => {
    if (typeof candidate !== 'string' || candidate.length > 2_000) return false;
    if (candidate.startsWith('/')) return true;
    try {
      const url = new URL(candidate);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  });
}

function formatCurrency(value: number, currency: string): string {
  const normalizedCurrency = currency.toUpperCase();
  const safeCurrency = /^[A-Z]{3}$/.test(normalizedCurrency) ? normalizedCurrency : 'MXN';
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value);
  }
}

function formatClabe(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 18) return raw;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 17)} ${digits.slice(17)}`;
}

function getBankName(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 3 ? BANK_CODES[digits.slice(0, 3)] ?? null : null;
}

function getMessageStyle(
  config: PublicDisplayConfig,
  target: 'welcome' | 'farewell' | 'promo',
): React.CSSProperties {
  const messageStyle = config.customerDisplayMessageStyle?.[target];
  return {
    color: messageStyle?.textColor || undefined,
    fontWeight:
      messageStyle?.textWeight === 'bold' ? 700 : messageStyle?.textWeight === 'semibold' ? 600 : undefined,
    textAlign: messageStyle?.textAlign || undefined,
    textTransform: messageStyle?.uppercase ? 'uppercase' : undefined,
  };
}

function StoreIdentity({ logo, storeName }: { logo: string; storeName: string }) {
  return (
    <div className={styles.identity}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.logo} src={logo} alt={`Logotipo de ${storeName}`} />
      ) : (
        <span className={styles.logoFallback} aria-hidden="true">
          <Icon source={StoreIcon} />
        </span>
      )}
      <span className={styles.storeName}>{storeName}</span>
    </div>
  );
}

function LoadingScreen({ style }: { style: DisplayCssProperties }) {
  return (
    <main className={styles.root} style={style} aria-busy="true" aria-label="Preparando pantalla del cliente">
      <header className={styles.header}>
        <div className={`${styles.skeleton} ${styles.skeletonBrand}`} />
        <div className={`${styles.skeleton} ${styles.skeletonMeta}`} />
      </header>
      <div className={styles.checkoutLayout}>
        <section className={styles.receiptPanel}>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          <div className={styles.skeletonRows}>
            {Array.from({ length: 5 }, (_, index) => (
              <div className={`${styles.skeleton} ${styles.skeletonRow}`} key={index} />
            ))}
          </div>
        </section>
        <aside className={styles.summaryPanel}>
          <div className={`${styles.skeleton} ${styles.skeletonSummary}`} />
          <div className={`${styles.skeleton} ${styles.skeletonSummaryLarge}`} />
        </aside>
      </div>
    </main>
  );
}

function StatusScreen({
  style,
  title,
  description,
  retry,
}: {
  style: DisplayCssProperties;
  title: string;
  description: string;
  retry?: () => void;
}) {
  return (
    <main className={`${styles.root} ${styles.statusScreen}`} style={style}>
      <div className={styles.statusMark} aria-hidden="true">
        <Icon source={StoreIcon} />
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
      {retry && (
        <button className={styles.retryButton} type="button" onClick={retry}>
          <Icon source={RefreshIcon} />
          Reintentar
        </button>
      )}
    </main>
  );
}

export function CustomerDisplayView({
  config,
  sale,
  currentTime,
  currentDate,
  loadState,
  onRetry,
}: CustomerDisplayViewProps) {
  const lastItemRef = useRef<HTMLDivElement | null>(null);
  const theme = THEME_TOKENS[config.customerDisplayTheme] ?? THEME_TOKENS.light;
  const accent = getAccentColor(config.customerDisplayAccentColor, theme.accent);
  const fontScale = Math.min(1.2, Math.max(0.9, Number(config.customerDisplayFontScale) || 1));
  const transitionMs = TRANSITION_DURATION[config.customerDisplayTransitionSpeed] ?? 360;
  const rootStyle: DisplayCssProperties = {
    '--cd-background': theme.background,
    '--cd-surface': theme.surface,
    '--cd-surface-muted': theme.surfaceMuted,
    '--cd-text': theme.text,
    '--cd-muted': theme.muted,
    '--cd-border': theme.border,
    '--cd-accent': accent,
    '--cd-accent-ink': getAccentInk(accent, theme.accentInk),
    '--cd-font-scale': String(fontScale),
    '--cd-transition-ms': `${transitionMs}ms`,
  };

  const storeName = config.storeName || 'Tienda';
  const displayLogo = config.customerDisplayLogo || config.logoUrl || '';
  const currency = config.currency || 'MXN';
  const paymentLabel = CUSTOMER_DISPLAY_PAYMENT_LABELS[sale.paymentMethod] ?? 'Método seleccionado';
  const itemCount = sale.items.reduce((total, item) => total + item.quantity, 0);
  const promoImages = useMemo(() => parsePromoImages(config.customerDisplayPromoImage), [config.customerDisplayPromoImage]);
  const carouselEnabled = config.customerDisplayIdleCarousel === true;
  const carouselInterval = Math.min(30, Math.max(3, Number(config.customerDisplayCarouselInterval) || 5));
  const promoSlides = useMemo(() => {
    const slides: Array<{ type: 'welcome' | 'text' | 'image'; value?: string }> = [{ type: 'welcome' }];
    if (config.customerDisplayPromoText) slides.push({ type: 'text', value: config.customerDisplayPromoText });
    promoImages.forEach((image) => slides.push({ type: 'image', value: image }));
    return slides;
  }, [config.customerDisplayPromoText, promoImages]);
  const activeSlideIndex = useCarousel(carouselEnabled, carouselInterval, promoSlides.length);
  const activeSlide = promoSlides[carouselEnabled ? activeSlideIndex : 0] ?? promoSlides[0];
  const motionClass =
    activeSlide.type === 'welcome'
      ? IDLE_MOTION_CLASSES[config.customerDisplayIdleAnimation] ?? styles.motionFade
      : PROMO_MOTION_CLASSES[config.customerDisplayPromoAnimation] ?? styles.motionFade;
  const orientationClass = config.customerDisplayOrientation === 'portrait' ? styles.portrait : '';
  const bankName = config.clabeNumber ? getBankName(config.clabeNumber) : null;

  useEffect(() => {
    lastItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [sale.items.length, sale.items.at(-1)?.productName, sale.items.at(-1)?.subtotal]);

  if (loadState === 'loading') return <LoadingScreen style={rootStyle} />;
  if (loadState === 'error') {
    return (
      <StatusScreen
        style={rootStyle}
        title="No fue posible preparar la pantalla"
        description="Solicita apoyo al personal de la tienda o intenta nuevamente."
        retry={onRetry}
      />
    );
  }

  if (!config.customerDisplayEnabled) {
    return (
      <StatusScreen
        style={rootStyle}
        title="Pantalla no disponible"
        description="Solicita apoyo al personal para continuar con tu compra."
      />
    );
  }

  if (sale.status === 'idle') {
    const welcomeMessage = config.customerDisplayWelcome || `Bienvenido a ${storeName}`;
    return (
      <main className={`${styles.root} ${styles.idleScreen} ${orientationClass}`} style={rootStyle}>
        <header className={styles.header}>
          <StoreIdentity logo={displayLogo} storeName={storeName} />
          {config.customerDisplayShowClock !== false && (
            <div className={styles.dateTime}>
              <strong>{currentTime}</strong>
              <span>{currentDate}</span>
            </div>
          )}
        </header>

        <section className={`${styles.idleContent} ${activeSlide.type === 'image' ? styles.idleWithMedia : ''}`}>
          <div
            className={`${styles.welcomeContent} ${motionClass} ${
              !carouselEnabled && promoImages[0] ? styles.welcomeContentWithMedia : ''
            }`}
            key={`${activeSlide.type}-${activeSlideIndex}`}
          >
            {activeSlide.type === 'welcome' && (
              <>
                <div className={styles.welcomeCopy}>
                  <span className={styles.eyebrow}>Caja disponible</span>
                  <h1 style={getMessageStyle(config, 'welcome')}>{welcomeMessage}</h1>
                  <p>{config.customerDisplayMessageStyle?.welcome.subtitle || 'Tu compra aparecerá aquí al comenzar.'}</p>
                  {!carouselEnabled && config.customerDisplayPromoText && (
                    <span className={styles.staticPromoText} style={getMessageStyle(config, 'promo')}>
                      {config.customerDisplayPromoText}
                    </span>
                  )}
                </div>
                {!carouselEnabled && promoImages[0] && (
                  <div
                    className={`${styles.promoMedia} ${
                      PROMO_MOTION_CLASSES[config.customerDisplayPromoAnimation] ?? styles.motionFade
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={promoImages[0]} alt="Promoción vigente de la tienda" />
                  </div>
                )}
              </>
            )}
            {activeSlide.type === 'text' && (
              <>
                <span className={styles.eyebrow}>Información de la tienda</span>
                <h1 style={getMessageStyle(config, 'promo')}>{activeSlide.value}</h1>
                <p>{config.customerDisplayMessageStyle?.promo.subtitle || storeName}</p>
              </>
            )}
            {activeSlide.type === 'image' && activeSlide.value && (
              <div className={styles.promoMedia}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeSlide.value} alt="Promoción vigente de la tienda" />
              </div>
            )}
          </div>

          {promoSlides.length > 1 && carouselEnabled && (
            <div className={styles.carouselPosition} aria-label={`Contenido ${activeSlideIndex + 1} de ${promoSlides.length}`}>
              {promoSlides.map((_, index) => (
                <span className={index === activeSlideIndex ? styles.carouselDotActive : styles.carouselDot} key={index} />
              ))}
            </div>
          )}
        </section>

        {(config.phone || config.address) && (
          <footer className={styles.idleFooter}>
            {config.address && <span>{config.address}</span>}
            {config.phone && <span>Atención: {config.phone}</span>}
          </footer>
        )}
      </main>
    );
  }

  if (sale.status === 'finished') {
    const farewell = config.customerDisplayFarewell || `${storeName} agradece tu preferencia`;
    return (
      <main className={`${styles.root} ${styles.finishedScreen}`} style={rootStyle} aria-live="polite">
        <section className={`${styles.finishedContent} ${styles.motionFade}`}>
          <div className={styles.successMark} aria-hidden="true">
            <Icon source={CheckIcon} />
          </div>
          <span className={styles.eyebrow}>Compra completada</span>
          <h1>Gracias por tu compra</h1>
          <p style={getMessageStyle(config, 'farewell')}>{farewell}</p>

          <div className={styles.finishedReceipt}>
            <div className={styles.finishedTotal}>
              <span>Total pagado</span>
              <strong>{formatCurrency(sale.total, currency)}</strong>
            </div>
            <dl className={styles.finishedDetails}>
              <div>
                <dt>Método</dt>
                <dd>{paymentLabel}</dd>
              </div>
              {sale.folio && (
                <div>
                  <dt>Folio</dt>
                  <dd>{sale.folio}</dd>
                </div>
              )}
              {sale.change > 0 && (
                <div className={styles.changeRow}>
                  <dt>Tu cambio</dt>
                  <dd>{formatCurrency(sale.change, currency)}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>
      </main>
    );
  }

  const isTransfer = sale.paymentMethod.startsWith('spei') || sale.paymentMethod === 'transferencia';
  return (
    <main className={`${styles.root} ${styles.checkoutScreen} ${orientationClass}`} style={rootStyle}>
      <header className={styles.header}>
        <StoreIdentity logo={displayLogo} storeName={storeName} />
        <div className={styles.checkoutMeta}>
          <span>{sale.status === 'paying' ? 'Confirmando pago' : 'Compra en curso'}</span>
          <strong>{itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}</strong>
          {config.customerDisplayShowClock !== false && <time>{currentTime}</time>}
        </div>
      </header>

      <div className={styles.checkoutLayout}>
        <section className={styles.receiptPanel} aria-label="Productos de la compra">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Detalle de compra</span>
              <h1>Productos registrados</h1>
            </div>
            <span className={styles.lineCount}>{sale.items.length} {sale.items.length === 1 ? 'línea' : 'líneas'}</span>
          </div>

          <div className={styles.itemTableHeader} aria-hidden="true">
            <span>Cant.</span>
            <span>Producto</span>
            <span>Precio</span>
            <span>Importe</span>
          </div>
          <div className={styles.itemList}>
            {sale.items.length === 0 ? (
              <div className={styles.emptyItems}>
                <span className={styles.scanLine} aria-hidden="true" />
                <h2>Esperando el primer producto</h2>
                <p>El detalle se actualizará conforme avance la compra.</p>
              </div>
            ) : (
              sale.items.map((item, index) => {
                const isLatest = index === sale.items.length - 1;
                return (
                  <div
                    className={`${styles.itemRow} ${isLatest ? styles.itemRowLatest : ''}`}
                    key={`${item.productName}-${index}`}
                    ref={isLatest ? lastItemRef : undefined}
                  >
                    <span className={styles.quantity}>{item.quantity}</span>
                    <div className={styles.productName}>
                      <strong>{item.productName}</strong>
                      {isLatest && <span>Último agregado</span>}
                    </div>
                    <span>{formatCurrency(item.unitPrice, currency)}</span>
                    <strong className={styles.lineTotal}>{formatCurrency(item.subtotal, currency)}</strong>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <aside className={styles.summaryPanel} aria-label="Resumen y pago">
          <div className={styles.summaryTop}>
            <span className={styles.eyebrow}>Resumen</span>
            <dl className={styles.amountRows}>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatCurrency(sale.subtotal, currency)}</dd>
              </div>
              {sale.discountAmount > 0 && (
                <div className={styles.discountRow}>
                  <dt>Descuento</dt>
                  <dd>-{formatCurrency(sale.discountAmount, currency)}</dd>
                </div>
              )}
              <div>
                <dt>{config.pricesIncludeIva ? `IVA incluido (${config.ivaRate}%)` : `IVA (${config.ivaRate}%)`}</dt>
                <dd>{formatCurrency(sale.iva, currency)}</dd>
              </div>
              {sale.cardSurcharge > 0 && (
                <div>
                  <dt>Cargo por pago</dt>
                  <dd>{formatCurrency(sale.cardSurcharge, currency)}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className={styles.totalBlock} aria-live="polite">
            <span>Total</span>
            <strong>{formatCurrency(sale.total, currency)}</strong>
          </div>

          {sale.status === 'paying' ? (
            <div className={`${styles.paymentState} ${styles.paymentProcessing}`} role="status">
              <span className={styles.processingIndicator} aria-hidden="true" />
              <div>
                <strong>Confirmando el pago</strong>
                <span>{paymentLabel}</span>
              </div>
            </div>
          ) : isTransfer && config.clabeNumber ? (
            <div className={styles.transferDetails}>
              <span>Transferencia SPEI</span>
              <strong>{formatClabe(config.clabeNumber)}</strong>
              <div>
                {bankName && <span>{bankName}</span>}
                <span>A nombre de {storeName}</span>
              </div>
              <p>Monto exacto: {formatCurrency(sale.total, currency)}</p>
            </div>
          ) : (
            <div className={styles.paymentState}>
              <span className={styles.paymentIcon} aria-hidden="true">
                <Icon source={sale.paymentMethod === 'efectivo' ? CashDollarIcon : CreditCardIcon} />
              </span>
              <div>
                <span>Método de pago</span>
                <strong>{paymentLabel}</strong>
              </div>
            </div>
          )}

          {sale.paymentMethod === 'efectivo' && sale.amountPaid > 0 && (
            <dl className={styles.cashDetails}>
              <div>
                <dt>Recibido</dt>
                <dd>{formatCurrency(sale.amountPaid, currency)}</dd>
              </div>
              <div>
                <dt>Cambio</dt>
                <dd>{formatCurrency(sale.change, currency)}</dd>
              </div>
            </dl>
          )}

          {config.customerDisplayPromoText && (
            <p className={styles.checkoutMessage} style={getMessageStyle(config, 'promo')}>
              {config.customerDisplayPromoText}
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
