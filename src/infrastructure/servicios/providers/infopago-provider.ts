/**
 * Infopago Provider — API adapter for phone topups and bill payments.
 *
 * Integrates with the Infopago API (infopago.com) for:
 * - Phone prepaid recharges (Telcel, AT&T, Movistar, Unefon, etc.)
 * - Bill payments (CFE, Telmex, Izzi, TotalPlay, etc.)
 * - Balance inquiry
 * - Transaction status queries
 *
 * Configuration:
 * - API Key from Infopago merchant dashboard
 * - Sandbox mode available for testing
 */

import { logger } from '@/lib/logger';
import { constantTimeStringEqual } from '@/lib/constant-time';
import type {
  ServiciosProvider,
  TopupRequest,
  BillPaymentRequest,
  ProviderResponse,
  ProviderBalance,
  CarrierInfo,
  ServiceInfo,
  TransactionStatus,
} from '../provider-adapter';

// ── Config ──

const PROD_BASE_URL = 'https://api.infopago.com/v2';
const SANDBOX_BASE_URL = 'https://sandbox.infopago.com/v2';

// ── Status Mapping ──

const STATUS_MAP: Record<string, TransactionStatus> = {
  success: 'completado',
  pending: 'procesando',
  error: 'fallido',
  cancelled: 'cancelado',
};

function mapStatus(apiStatus: string): TransactionStatus {
  return STATUS_MAP[apiStatus] ?? 'pendiente';
}

// ── Provider Implementation ──

export class InfopagoProvider implements ServiciosProvider {
  readonly name = 'Infopago';
  readonly id = 'infopago';
  readonly isLive = true;

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string, sandbox = false) {
    this.apiKey = apiKey;
    this.baseUrl = sandbox ? SANDBOX_BASE_URL : PROD_BASE_URL;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = (data as { message?: string }).message ?? `HTTP ${response.status}`;
        throw new Error(`Infopago API error: ${msg}`);
      }

      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Health Check ──

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.request<{ status: string }>('GET', '/ping');
      return { ok: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      logger.warn('Infopago health check failed', { action: 'infopago_health', error: msg });
      return { ok: false, message: msg };
    }
  }

  // ── Balance ──

  async getBalance(): Promise<ProviderBalance> {
    const data = await this.request<{ saldo: number }>('GET', '/saldo');
    return {
      available: data.saldo,
      currency: 'MXN',
      lastUpdated: new Date().toISOString(),
    };
  }

  // ── Carriers & Services ──

  async getCarriers(): Promise<CarrierInfo[]> {
    const data = await this.request<Array<{ id: string; nombre: string; montos: number[]; activo: boolean }>>(
      'GET',
      '/operadores',
    );
    return data.map((c) => ({
      id: c.id,
      name: c.nombre,
      availableAmounts: c.montos,
      active: c.activo,
    }));
  }

  async getServices(): Promise<ServiceInfo[]> {
    const data = await this.request<
      Array<{ id: string; nombre: string; montoFijo: boolean; montoMin: number; montoMax: number; activo: boolean }>
    >('GET', '/servicios');
    return data.map((s) => ({
      id: s.id,
      name: s.nombre,
      freeAmount: !s.montoFijo,
      minAmount: s.montoMin,
      maxAmount: s.montoMax,
      active: s.activo,
    }));
  }

  // ── Topup ──

  async processTopup(req: TopupRequest): Promise<ProviderResponse> {
    try {
      const data = await this.request<{ transactionId: string; status: string; authCode?: string; message?: string }>(
        'POST',
        '/recargas',
        {
          telefono: req.phoneNumber,
          operadorId: req.carrierId,
          monto: req.amount,
          referencia: req.folio,
        },
      );

      return {
        accepted: data.status === 'success',
        providerTransactionId: data.transactionId,
        status: mapStatus(data.status),
        authorizationCode: data.authCode,
        errorMessage: data.status !== 'success' ? data.message : undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error procesando recarga Infopago';
      logger.error('Infopago topup failed', { action: 'infopago_topup_error', error: msg });
      return { accepted: false, status: 'fallido', errorMessage: msg };
    }
  }

  // ── Bill Payment ──

  async processBillPayment(req: BillPaymentRequest): Promise<ProviderResponse> {
    try {
      const data = await this.request<{ transactionId: string; status: string; authCode?: string; message?: string }>(
        'POST',
        '/pagos',
        {
          servicioId: req.serviceId,
          referencia: req.referenceNumber,
          monto: req.amount,
          folio: req.folio,
        },
      );

      return {
        accepted: data.status === 'success',
        providerTransactionId: data.transactionId,
        status: mapStatus(data.status),
        authorizationCode: data.authCode,
        errorMessage: data.status !== 'success' ? data.message : undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error procesando pago Infopago';
      logger.error('Infopago bill payment failed', { action: 'infopago_bill_error', error: msg });
      return { accepted: false, status: 'fallido', errorMessage: msg };
    }
  }

  // ── Transaction Query ──

  async queryTransaction(transactionId: string): Promise<ProviderResponse> {
    try {
      const data = await this.request<{ transactionId: string; status: string; authCode?: string; message?: string }>(
        'GET',
        `/transacciones/${encodeURIComponent(transactionId)}`,
      );

      return {
        accepted: data.status === 'success',
        providerTransactionId: data.transactionId,
        status: mapStatus(data.status),
        authorizationCode: data.authCode,
        errorMessage: data.status !== 'success' ? data.message : undefined,
      };
    } catch (error) {
      return {
        accepted: false,
        providerTransactionId: transactionId,
        status: 'fallido',
        errorMessage: error instanceof Error ? error.message : 'Error consultando transacción',
      };
    }
  }

  // ── Webhook Verification ──

  async verifyWebhook(headers: Headers, _body: string): Promise<boolean> {
    const signature = headers.get('x-infopago-signature');
    if (!signature) return false;
    // Infopago uses Bearer token comparison
    return constantTimeStringEqual(this.apiKey, signature);
  }

  async parseWebhook(
    body: string,
  ): Promise<{
    providerTransactionId: string;
    status: TransactionStatus;
    authorizationCode?: string;
    errorMessage?: string;
  }> {
    const data = JSON.parse(body) as { transactionId?: string; status?: string; authCode?: string; error?: string };
    if (!data.transactionId || !data.status) {
      throw new Error('Invalid Infopago webhook payload: missing transactionId or status');
    }
    return {
      providerTransactionId: data.transactionId,
      status: mapStatus(data.status),
      authorizationCode: data.authCode,
      errorMessage: data.error,
    };
  }
}
