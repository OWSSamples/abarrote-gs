/**
 * Servicios Provider Registry
 *
 * Manages which provider is active and provides a single entry point
 * for the application to interact with the current provider.
 *
 * Architecture:
 * ┌──────────────────────────────────────────────────────┐
 * │  Server Actions (servicios-actions.ts)               │
 * │       │                                              │
 * │       ▼                                              │
 * │  getActiveProvider()                                 │
 * │       │                                              │
 * │       ├── LocalProvider  (default, no API calls)     │
 * │       ├── TuRecargaProvider  (future)                │
 * │       ├── InfopagoProvider   (future)                │
 * │       └── BillpocketProvider (future)                │
 * └──────────────────────────────────────────────────────┘
 *
 * To add a new provider:
 * 1. Create a file in ./providers/ implementing ServiciosProvider
 * 2. Register it in PROVIDER_FACTORIES below
 * 3. Add the config fields to storeConfig schema if needed
 * 4. Done — the user selects it in Settings > Servicios
 */

import 'server-only';

import { logger } from '@/lib/logger';
import type { ServiciosProvider } from './provider-adapter';
import { LocalProvider } from './providers/local-provider';
import { TuRecargaProvider } from './providers/turecarga-provider';
import { InfopagoProvider } from './providers/infopago-provider';
import { BillpocketProvider } from './providers/billpocket-provider';

export { getAvailableProviders } from './provider-catalog';
export type { ServiceCategory, ServiciosProviderCatalogEntry } from './provider-catalog';

// ══════════════════════════════════════════════════════════════
// PROVIDER REGISTRY
// ══════════════════════════════════════════════════════════════

/**
 * Configuration needed to initialize a servicios provider.
 * Each provider takes its own config shape.
 */
export interface ServiciosProviderConfig {
  /** Which provider to use */
  providerId:
    | 'taecel'
    | 'recargaki'
    | 'pagaqui'
    | 'mr-multiservicios'
    | 'turecarga'
    | 'punto-recarga'
    | 'recarganet'
    | 'conektame'
    | 'saldoexpress'
    | string;
  /** Provider-specific API key */
  apiKey?: string;
  /** Provider-specific secret */
  apiSecret?: string;
  /** Provider API base URL (some allow sandbox vs production) */
  baseUrl?: string;
  /** Whether to use sandbox/test mode */
  sandbox?: boolean;
}

/**
 * Factory map — each provider ID maps to a function that creates the provider.
 * Add new providers here as they are integrated.
 */
const PROVIDER_FACTORIES: Record<string, (config: ServiciosProviderConfig) => ServiciosProvider> = {
  local: () => new LocalProvider(),
  turecarga: (cfg) => new TuRecargaProvider(cfg.apiKey!, cfg.apiSecret!, cfg.sandbox ?? false),
  infopago: (cfg) => new InfopagoProvider(cfg.apiKey!, cfg.sandbox ?? false),
  billpocket: (cfg) => new BillpocketProvider(cfg.apiKey!, cfg.apiSecret!, cfg.sandbox ?? false),
};

/** Cached provider instance (singleton per request lifecycle) */
let _cachedProvider: ServiciosProvider | null = null;
let _cachedConfig: ServiciosProviderConfig | null = null;

function hasSameConfig(left: ServiciosProviderConfig | null, right: ServiciosProviderConfig): boolean {
  return (
    left?.providerId === right.providerId &&
    left.apiKey === right.apiKey &&
    left.apiSecret === right.apiSecret &&
    left.baseUrl === right.baseUrl &&
    left.sandbox === right.sandbox
  );
}

/**
 * Get the currently active servicios provider.
 *
 * Reads the config from the database/env and returns the appropriate adapter.
 * Falls back to LocalProvider if no provider is configured.
 */
export function getActiveProvider(config?: ServiciosProviderConfig): ServiciosProvider {
  const resolvedConfig = config ?? { providerId: 'local' };
  const providerId = resolvedConfig.providerId;

  // Credentials and environment are part of the cache identity so rotations take effect immediately.
  if (_cachedProvider && hasSameConfig(_cachedConfig, resolvedConfig)) {
    return _cachedProvider;
  }

  const factory = PROVIDER_FACTORIES[providerId];
  if (!factory) {
    logger.warn('Unknown servicios provider, falling back to local', {
      action: 'servicios_provider_fallback',
      requestedProvider: providerId,
    });
    _cachedProvider = new LocalProvider();
    _cachedConfig = { ...resolvedConfig };
    return _cachedProvider;
  }

  _cachedProvider = factory(resolvedConfig);
  _cachedConfig = { ...resolvedConfig };

  logger.info('Servicios provider initialized', {
    action: 'servicios_provider_init',
    provider: providerId,
    isLive: _cachedProvider.isLive,
  });

  return _cachedProvider;
}

/**
 * Reset cached provider. Use when config changes (e.g., user switches provider in settings).
 */
export function resetProvider(): void {
  _cachedProvider = null;
  _cachedConfig = null;
}
