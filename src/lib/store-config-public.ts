import type { StoreConfig } from '@/types';
import { DEFAULT_STORE_CONFIG } from '@/types';

export const STORE_SECRET_MASK = '********';

export const STORE_SECRET_FIELDS = [
  'cfdiPacApiKey',
  'cfdiPacApiSecret',
  'telegramToken',
  'telegramChatId',
  'telegramWebhookSecret',
  'clipApiKey',
  'serviciosApiKey',
  'serviciosApiSecret',
  'aiApiKeyEnc',
] as const satisfies readonly (keyof StoreConfig)[];

type StoreSecretField = (typeof STORE_SECRET_FIELDS)[number];

/** Keeps configuration state useful in the UI without exposing stored credentials. */
export function redactStoreConfigSecrets(config: StoreConfig): StoreConfig {
  const redacted = { ...config };
  const secretValues = redacted as StoreConfig & Record<StoreSecretField, string | undefined>;

  for (const field of STORE_SECRET_FIELDS) {
    secretValues[field] = config[field] ? STORE_SECRET_MASK : undefined;
  }

  return redacted;
}

export type PublicDisplayConfig = Pick<
  StoreConfig,
  | 'storeName'
  | 'address'
  | 'phone'
  | 'logoUrl'
  | 'clabeNumber'
  | 'currency'
  | 'ivaRate'
  | 'pricesIncludeIva'
  | 'customerDisplayEnabled'
  | 'customerDisplayWelcome'
  | 'customerDisplayFarewell'
  | 'customerDisplayPromoText'
  | 'customerDisplayPromoImage'
  | 'customerDisplayIdleAnimation'
  | 'customerDisplayTransitionSpeed'
  | 'customerDisplayPromoAnimation'
  | 'customerDisplayShowClock'
  | 'customerDisplayTheme'
  | 'customerDisplayIdleCarousel'
  | 'customerDisplayCarouselInterval'
  | 'customerDisplayLogo'
  | 'customerDisplayFontScale'
  | 'customerDisplayAutoReturnSec'
  | 'customerDisplayAccentColor'
  | 'customerDisplaySoundEnabled'
  | 'customerDisplayOrientation'
  | 'customerDisplayMessageStyle'
>;

export interface PublicDisplayContext {
  storeId: string;
  config: PublicDisplayConfig;
}

/** Explicit allowlist for the customer-facing display payload. */
export function toPublicDisplayConfig(config: StoreConfig): PublicDisplayConfig {
  return {
    storeName: config.storeName,
    address: config.address,
    phone: config.phone,
    logoUrl: config.logoUrl,
    clabeNumber: config.clabeNumber,
    currency: config.currency,
    ivaRate: config.ivaRate,
    pricesIncludeIva: config.pricesIncludeIva,
    customerDisplayEnabled: config.customerDisplayEnabled,
    customerDisplayWelcome: config.customerDisplayWelcome,
    customerDisplayFarewell: config.customerDisplayFarewell,
    customerDisplayPromoText: config.customerDisplayPromoText,
    customerDisplayPromoImage: config.customerDisplayPromoImage,
    customerDisplayIdleAnimation: config.customerDisplayIdleAnimation,
    customerDisplayTransitionSpeed: config.customerDisplayTransitionSpeed,
    customerDisplayPromoAnimation: config.customerDisplayPromoAnimation,
    customerDisplayShowClock: config.customerDisplayShowClock,
    customerDisplayTheme: config.customerDisplayTheme,
    customerDisplayIdleCarousel: config.customerDisplayIdleCarousel,
    customerDisplayCarouselInterval: config.customerDisplayCarouselInterval,
    customerDisplayLogo: config.customerDisplayLogo,
    customerDisplayFontScale: config.customerDisplayFontScale,
    customerDisplayAutoReturnSec: config.customerDisplayAutoReturnSec,
    customerDisplayAccentColor: config.customerDisplayAccentColor,
    customerDisplaySoundEnabled: config.customerDisplaySoundEnabled,
    customerDisplayOrientation: config.customerDisplayOrientation,
    customerDisplayMessageStyle: config.customerDisplayMessageStyle,
  };
}

export const DEFAULT_PUBLIC_DISPLAY_CONFIG = toPublicDisplayConfig(DEFAULT_STORE_CONFIG);
