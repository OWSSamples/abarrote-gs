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

import { logger } from '@/lib/logger';
import type { ServiciosProvider } from './provider-adapter';
import { LocalProvider } from './providers/local-provider';
import { TuRecargaProvider } from './providers/turecarga-provider';
import { InfopagoProvider } from './providers/infopago-provider';
import { BillpocketProvider } from './providers/billpocket-provider';

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
let _cachedProviderId: string | null = null;

/**
 * Get the currently active servicios provider.
 *
 * Reads the config from the database/env and returns the appropriate adapter.
 * Falls back to LocalProvider if no provider is configured.
 */
export function getActiveProvider(config?: ServiciosProviderConfig): ServiciosProvider {
  const providerId = config?.providerId ?? 'local';

  // Return cached if same provider
  if (_cachedProvider && _cachedProviderId === providerId) {
    return _cachedProvider;
  }

  const factory = PROVIDER_FACTORIES[providerId];
  if (!factory) {
    logger.warn('Unknown servicios provider, falling back to local', {
      action: 'servicios_provider_fallback',
      requestedProvider: providerId,
    });
    _cachedProvider = new LocalProvider();
    _cachedProviderId = 'local';
    return _cachedProvider;
  }

  _cachedProvider = factory(config ?? { providerId: 'local' });
  _cachedProviderId = providerId;

  logger.info('Servicios provider initialized', {
    action: 'servicios_provider_init',
    provider: providerId,
    isLive: _cachedProvider.isLive,
  });

  return _cachedProvider;
}

/**
 * Categorías de servicios soportadas.
 */
export type ServiceCategory =
  | 'recargas_telefonicas'
  | 'servicios_publicos'
  | 'pines_electronicos'
  | 'tarjetas_lealtad'
  | 'tv_streaming'
  | 'transporte';

/**
 * List all available providers with their display info, capacidades y soporte de categorías.
 */
export function getAvailableProviders(): Array<{
  id: string;
  name: string;
  status: 'disponible' | 'próximamente';
  description: string;
  /** Categorías de servicios que cubre el proveedor */
  categories: ServiceCategory[];
  /** Cobertura geográfica principal */
  coverage: string;
  /** Tipo de comisión (porcentaje, fija, etc.) */
  commission: string;
  /** Settlement / liquidación */
  settlement: string;
  /** Documentación oficial */
  docsUrl?: string;
  /** URL para registrarse y obtener la API key */
  apiKeyUrl?: string;
  /** Pasos para obtener la API key (resumen) */
  apiKeySteps?: string[];
}> {
  return [
    {
      id: 'taecel',
      name: 'TAECEL',
      status: 'disponible',
      description:
        'Distribuidor mayorista #1 de recargas en México. Más de 100,000 puntos activos. API REST documentada.',
      categories: ['recargas_telefonicas', 'servicios_publicos', 'pines_electronicos', 'tv_streaming'],
      coverage: 'México · Telcel, Movistar, AT&T, Unefon, Bait + CFE, Telmex, Izzi, Sky',
      commission: '4 – 8 % de bonificación según volumen',
      settlement: 'Saldo prepagado · recarga vía SPEI o efectivo',
      docsUrl: 'https://taecel.com/integracion-api',
      apiKeyUrl: 'https://taecel.com/registro',
      apiKeySteps: [
        'Regístrate en taecel.com/registro',
        'Realiza tu primer depósito (mínimo $300 MXN)',
        'En el panel ve a "Mi cuenta → API" y copia tu Token',
      ],
    },
    {
      id: 'recargaki',
      name: 'Recargaki',
      status: 'disponible',
      description:
        'Plataforma mexicana con API REST para recargas, pagos de servicios y pines electrónicos.',
      categories: ['recargas_telefonicas', 'servicios_publicos', 'pines_electronicos', 'tv_streaming'],
      coverage: 'México · todas las telcos + CFE, Telmex, Izzi, Totalplay, Megacable',
      commission: '3 – 7 % según volumen',
      settlement: 'Saldo prepagado · recarga vía SPEI',
      docsUrl: 'https://recargaki.com.mx/api-docs',
      apiKeyUrl: 'https://recargaki.com.mx/registro',
      apiKeySteps: [
        'Crea tu cuenta en recargaki.com.mx',
        'Sube tu RFC y comprobante de domicilio',
        'Activa el módulo API en "Configuración → Integraciones"',
        'Copia tu API Key y Secret',
      ],
    },
    {
      id: 'pagaqui',
      name: 'Pagaqui',
      status: 'disponible',
      description:
        'Red mexicana con +12,000 puntos. API SOAP/REST para pagos de servicios y recargas.',
      categories: [
        'recargas_telefonicas',
        'servicios_publicos',
        'pines_electronicos',
        'tv_streaming',
        'transporte',
      ],
      coverage: 'México · 12,000+ puntos · CFE, agua, Telmex, Izzi, Totalplay',
      commission: '2 – 4 % + IVA',
      settlement: 'Saldo prepagado',
      docsUrl: 'https://pagaqui.com/desarrolladores',
      apiKeyUrl: 'https://pagaqui.com/contacto',
      apiKeySteps: [
        'Solicita una cuenta empresarial en pagaqui.com/contacto',
        'Firma contrato y completa onboarding KYC',
        'Recibirás credenciales (usuario + token) por correo',
      ],
    },
    {
      id: 'mr-multiservicios',
      name: 'MR Multiservicios',
      status: 'disponible',
      description:
        'Mayorista mexicano con API REST para recargas, pago de servicios y tarjetas regalo.',
      categories: ['recargas_telefonicas', 'servicios_publicos', 'pines_electronicos', 'tv_streaming'],
      coverage: 'México · todas las telcos + servicios públicos',
      commission: '4 – 7 %',
      settlement: 'Saldo prepagado · recarga vía SPEI',
      docsUrl: 'https://www.mst.com.mx/api',
      apiKeyUrl: 'https://www.mst.com.mx/registro',
      apiKeySteps: [
        'Regístrate en mst.com.mx',
        'Deposita saldo inicial',
        'Activa el acceso API desde el panel y copia tu Token',
      ],
    },
    {
      id: 'turecarga',
      name: 'TuRecarga',
      status: 'disponible',
      description:
        'API mexicana para que tu tienda acepte pagos de luz (CFE), agua, internet, telefonía y recargas.',
      categories: ['recargas_telefonicas', 'servicios_publicos', 'pines_electronicos', 'tv_streaming'],
      coverage: 'México · CFE, Telmex, Izzi, Totalplay, Megacable, Sky',
      commission: '2 – 5 % por transacción',
      settlement: 'Saldo prepagado · recarga vía SPEI',
      docsUrl: 'https://turecarga.com/api',
      apiKeyUrl: 'https://turecarga.com/registro',
      apiKeySteps: [
        'Regístrate en turecarga.com',
        'Activa tu cuenta con depósito mínimo',
        'Ve a "Mi cuenta → API" y genera tu API Key',
      ],
    },
    {
      id: 'punto-recarga',
      name: 'Punto Recarga',
      status: 'próximamente',
      description:
        'Red mexicana con API SOAP para distribución de tiempo aire y pagos de servicios.',
      categories: ['recargas_telefonicas', 'servicios_publicos', 'pines_electronicos'],
      coverage: 'México · todas las telcos',
      commission: '4 – 6 %',
      settlement: 'Saldo prepagado',
      docsUrl: 'https://www.puntorecarga.com.mx',
      apiKeyUrl: 'https://www.puntorecarga.com.mx/registro',
    },
    {
      id: 'recarganet',
      name: 'Recarganet',
      status: 'próximamente',
      description:
        'Plataforma mexicana con API web para recargas y pagos de servicios públicos.',
      categories: ['recargas_telefonicas', 'servicios_publicos', 'pines_electronicos', 'tv_streaming'],
      coverage: 'México',
      commission: '3 – 5 %',
      settlement: 'Saldo prepagado · recarga vía SPEI',
      docsUrl: 'https://recarganet.com',
      apiKeyUrl: 'https://recarganet.com/registro',
    },
    {
      id: 'conektame',
      name: 'Conektame',
      status: 'próximamente',
      description:
        'API mexicana para recargas, pago de servicios y pines de gaming/streaming en un solo endpoint.',
      categories: ['recargas_telefonicas', 'servicios_publicos', 'pines_electronicos', 'tv_streaming'],
      coverage: 'México',
      commission: '3 – 5 %',
      settlement: 'Saldo prepagado',
      docsUrl: 'https://conektame.com/api',
      apiKeyUrl: 'https://conektame.com/registro',
    },
    {
      id: 'saldoexpress',
      name: 'Saldo Express',
      status: 'próximamente',
      description:
        'Distribuidor mayorista mexicano con API para tiempo aire y servicios básicos.',
      categories: ['recargas_telefonicas', 'pines_electronicos'],
      coverage: 'México · enfoque telefonía',
      commission: '5 – 8 %',
      settlement: 'Saldo prepagado',
      docsUrl: 'https://saldoexpress.com.mx',
      apiKeyUrl: 'https://saldoexpress.com.mx/registro',
    },
  ];
}

/**
 * Reset cached provider. Use when config changes (e.g., user switches provider in settings).
 */
export function resetProvider(): void {
  _cachedProvider = null;
  _cachedProviderId = null;
}
