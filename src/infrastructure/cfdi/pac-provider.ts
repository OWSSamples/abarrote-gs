/**
 * CFDI PAC Provider Interface
 *
 * Abstraction layer for Proveedor Autorizado de Certificación (PAC).
 * Supports multiple PAC providers: Facturama, SW Sapien, Finkok, etc.
 *
 * Runtime config is provided by platform settings (store_config),
 * including provider, environment, auth type, and credentials.
 */

import { logger } from '@/lib/logger';

// ── Types ──
export interface CfdiEmisor {
  Rfc: string;
  Nombre: string;
  RegimenFiscal: string;
}

export interface CfdiReceptor {
  Rfc: string;
  Nombre: string;
  RegimenFiscalReceptor: string;
  DomicilioFiscalReceptor: string;
  UsoCFDI: string;
}

export interface CfdiConcepto {
  ClaveProdServ: string;
  Cantidad: number;
  ClaveUnidad: string;
  Descripcion: string;
  ValorUnitario: number;
  Importe: number;
  ObjetoImp: string;
  Traslados: {
    Base: number;
    Impuesto: string;
    TipoFactor: string;
    TasaOCuota: number;
    Importe: number;
  }[];
}

export interface CfdiPayload {
  Emisor: CfdiEmisor;
  Receptor: CfdiReceptor;
  Conceptos: CfdiConcepto[];
  Total: number;
  SubTotal: number;
  Moneda: string;
  FormaPago: string;
  MetodoPago: string;
  TipoDeComprobante: string;
}

export interface TimbradoResult {
  uuid: string;
  xmlUrl: string;
  pdfUrl: string;
  fechaTimbrado: string;
}

export interface CancelResult {
  success: boolean;
  acuse?: string;
  message: string;
}

// ── Provider Interface ──
export interface CfdiPacProvider {
  timbrar(payload: CfdiPayload): Promise<TimbradoResult>;
  cancelar(uuid: string, motivo: string, folioSustituto?: string): Promise<CancelResult>;
}

export type CfdiPacProviderId = 'none' | 'facturama' | 'sw_sapien' | 'finkok' | 'solucion_factible' | 'digicel' | 'prodigia' | 'timbrado_fiscal' | 'folios_digitales' | 'invoiceone' | 'custom';
export type CfdiPacAuthType = 'basic' | 'bearer' | 'api-key';
export type CfdiPacEnvironment = 'sandbox' | 'production';

export interface PacRuntimeConfig {
  provider: CfdiPacProviderId;
  environment: CfdiPacEnvironment;
  authType: CfdiPacAuthType;
  apiUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  cancelPath?: string;
}

const DEFAULT_TIMBRADO_URLS: Record<CfdiPacProviderId, Partial<Record<CfdiPacEnvironment, string>>> = {
  none: {},
  custom: {},
  facturama: {
    sandbox: 'https://apisandbox.facturama.mx/3/cfdis',
    production: 'https://api.facturama.mx/3/cfdis',
  },
  sw_sapien: {
    sandbox: 'https://api.test.sw.com.mx/v4/cfdi40/issue/json',
    production: 'https://api.sw.com.mx/v4/cfdi40/issue/json',
  },
  finkok: {
    sandbox: 'https://demo-facturacion.finkok.com/servicios/soap/stamp',
    production: 'https://facturacion.finkok.com/servicios/soap/stamp',
  },
  solucion_factible: {
    sandbox: 'https://testing.solucionfactible.com/ws/services/Timbrado',
    production: 'https://solucionfactible.com/ws/services/Timbrado',
  },
  digicel: {},
  prodigia: {
    sandbox: 'https://sandbox.factura.com/api/v4/cfdi40/create',
    production: 'https://api.factura.com/api/v4/cfdi40/create',
  },
  timbrado_fiscal: {},
  folios_digitales: {},
  invoiceone: {},
};

const DEFAULT_CANCEL_PATH = '/cancel';

function normalize(value: string | undefined | null): string {
  return (value ?? '').trim();
}

function resolveApiUrl(config: PacRuntimeConfig): string {
  const explicitUrl = normalize(config.apiUrl);
  if (explicitUrl) return explicitUrl;

  const defaultUrl = DEFAULT_TIMBRADO_URLS[config.provider]?.[config.environment];
  return normalize(defaultUrl);
}

function resolveCancelUrl(baseApiUrl: string, cancelPath?: string): string {
  const normalizedPath = normalize(cancelPath) || DEFAULT_CANCEL_PATH;

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  const cleanBase = baseApiUrl.replace(/\/+$/, '');
  const cleanPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  return `${cleanBase}${cleanPath}`;
}

function buildAuthHeaders(config: PacRuntimeConfig): Record<string, string> {
  const apiKey = normalize(config.apiKey);
  const apiSecret = normalize(config.apiSecret);

  if (config.authType === 'bearer') {
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  }

  if (config.authType === 'api-key') {
    return apiKey ? { 'X-API-Key': apiKey } : {};
  }

  if (!apiKey || !apiSecret) {
    return {};
  }

  return {
    Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
  };
}

export function isPacConfigured(config: PacRuntimeConfig): boolean {
  if (config.provider === 'none') return false;

  const apiUrl = resolveApiUrl(config);
  if (!apiUrl) return false;

  const apiKey = normalize(config.apiKey);
  const apiSecret = normalize(config.apiSecret);

  if (config.authType === 'basic') {
    return Boolean(apiKey && apiSecret);
  }

  return Boolean(apiKey);
}

// ── Generic PAC Provider (works with Facturama, SW Sapien, etc.) ──
class GenericPacProvider implements CfdiPacProvider {
  private readonly apiUrl: string;

  constructor(private config: PacRuntimeConfig) {
    this.apiUrl = resolveApiUrl(config);
  }

  async timbrar(payload: CfdiPayload): Promise<TimbradoResult> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(this.config),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.error('PAC timbrado failed', {
        provider: this.config.provider,
        status: response.status,
        body: body.slice(0, 500),
      });
      throw new Error(`Error del PAC (HTTP ${response.status})`);
    }

    const result = await response.json();
    return {
      uuid: result.uuid ?? result.UUID ?? result.TimbreFiscalDigital?.UUID ?? '',
      xmlUrl: result.xmlUrl ?? result.xml ?? '',
      pdfUrl: result.pdfUrl ?? result.pdf ?? '',
      fechaTimbrado: result.fechaTimbrado ?? result.FechaTimbrado ?? new Date().toISOString(),
    };
  }

  async cancelar(uuid: string, motivo: string, folioSustituto?: string): Promise<CancelResult> {
    const response = await fetch(resolveCancelUrl(this.apiUrl, this.config.cancelPath), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(this.config),
      },
      body: JSON.stringify({ uuid, motivo, folioSustituto }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.error('PAC cancelación failed', {
        provider: this.config.provider,
        status: response.status,
        body: body.slice(0, 500),
      });
      throw new Error(`Error al cancelar en PAC (HTTP ${response.status})`);
    }

    const result = await response.json();
    return {
      success: true,
      acuse: result.acuse ?? result.Acuse ?? result.acuseUrl ?? result.ackUrl ?? '',
      message: 'CFDI cancelado exitosamente',
    };
  }
}

class NullPacProvider implements CfdiPacProvider {
  async timbrar(): Promise<TimbradoResult> {
    logger.warn('PAC not configured — CFDI will be saved locally without timbrado SAT');
    return {
      uuid: 'PAC_NOT_CONFIGURED',
      xmlUrl: '',
      pdfUrl: '',
      fechaTimbrado: '',
    };
  }

  async cancelar(): Promise<CancelResult> {
    return { success: true, message: 'Cancelación local (PAC no configurado)' };
  }
}

export function createPacProvider(config: PacRuntimeConfig): CfdiPacProvider {
  if (!isPacConfigured(config)) {
    return new NullPacProvider();
  }

  return new GenericPacProvider(config);
}
