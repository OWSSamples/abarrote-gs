/**
 * TuRecarga Provider — Real API adapter for phone topups and bill payments.
 *
 * Integrates with the TuRecarga API (turecarga.com) for:
 * - Phone prepaid recharges (Telcel, AT&T, Movistar, etc.)
 * - Bill payments (CFE, Telmex, etc.)
 * - Balance inquiry
 * - Transaction status queries
 *
 * Configuration:
 * - API Key + Secret from TuRecarga merchant dashboard
 * - Sandbox mode available for testing
 *
 * @see https://turecarga.com/docs
 */

import { logger } from '@/lib/logger';
import { constantTimeStringEqual } from '@/lib/constant-time';
import { requestJson } from './http-client';
import type {
  ServiciosProvider,
  TopupRequest,
  BillPaymentRequest,
  ProviderResponse,
  ProviderBalance,
  CarrierInfo,
  ServiceInfo,
} from '../provider-adapter';

// ── Config ──

const PROD_BASE_URL = 'https://api.turecarga.com/v1';
const SANDBOX_BASE_URL = 'https://sandbox.turecarga.com/v1';

interface _TuRecargaConfig {
  apiKey: string;
  apiSecret: string;
  sandbox: boolean;
}

// ── API Response Types ──

interface TuRecargaApiError {
  code: string;
  message: string;
}

interface TuRecargaTopupResponse {
  id: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  authorization_code?: string;
  error?: TuRecargaApiError;
}

interface TuRecargaBalanceResponse {
  balance: number;
  currency: string;
  last_updated: string;
}

interface TuRecargaCarrier {
  id: string;
  name: string;
  amounts: number[];
  min_amount?: number;
  max_amount?: number;
  active: boolean;
}

interface TuRecargaService {
  id: string;
  name: string;
  free_amount: boolean;
  min_amount: number;
  max_amount: number;
  active: boolean;
}

// ── Provider Implementation ──

export class TuRecargaProvider implements ServiciosProvider {
  readonly name = 'TuRecarga';
  readonly id = 'turecarga';
  readonly isLive = true;

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(apiKey: string, apiSecret: string, sandbox = false) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = sandbox ? SANDBOX_BASE_URL : PROD_BASE_URL;
  }

  // ── Helpers ──

  private request<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T> {
    return requestJson<T>({
      method,
      url: `${this.baseUrl}${path}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
        'X-Api-Secret': this.apiSecret,
      },
      body,
      formatError: (status, data) =>
        (data as { error?: TuRecargaApiError }).error?.message ?? `TuRecarga API error: HTTP ${status}`,
    });
  }

  private mapStatus(apiStatus: string): ProviderResponse['status'] {
    switch (apiStatus) {
      case 'completed':
        return 'completado';
      case 'pending':
        return 'procesando';
      case 'failed':
        return 'fallido';
      case 'cancelled':
        return 'cancelado';
      default:
        return 'pendiente';
    }
  }

  // ── ServiciosProvider ──

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    try {
      const balance = await this.getBalance();
      return {
        ok: true,
        message: `TuRecarga conectado. Saldo: $${balance.available.toFixed(2)} MXN`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      logger.error('TuRecarga healthCheck failed', { error: msg });
      return { ok: false, message: `Error de conexión con TuRecarga: ${msg}` };
    }
  }

  async getBalance(): Promise<ProviderBalance> {
    const data = await this.request<TuRecargaBalanceResponse>('GET', '/balance');
    return {
      available: data.balance,
      currency: 'MXN',
      lastUpdated: data.last_updated,
    };
  }

  async getCarriers(): Promise<CarrierInfo[]> {
    const data = await this.request<{ carriers: TuRecargaCarrier[] }>('GET', '/carriers');
    return data.carriers.map((c) => ({
      id: c.id,
      name: c.name,
      availableAmounts: c.amounts,
      minAmount: c.min_amount,
      maxAmount: c.max_amount,
      active: c.active,
    }));
  }

  async getServices(): Promise<ServiceInfo[]> {
    const data = await this.request<{ services: TuRecargaService[] }>('GET', '/services');
    return data.services.map((s) => ({
      id: s.id,
      name: s.name,
      freeAmount: s.free_amount,
      minAmount: s.min_amount,
      maxAmount: s.max_amount,
      active: s.active,
    }));
  }

  async processTopup(request: TopupRequest): Promise<ProviderResponse> {
    try {
      const data = await this.request<TuRecargaTopupResponse>('POST', '/topup', {
        carrier_id: request.carrierId,
        phone_number: request.phoneNumber,
        amount: request.amount,
        external_id: request.folio,
      });

      logger.info('TuRecarga topup processed', {
        action: 'turecarga_topup',
        folio: request.folio,
        status: data.status,
        providerTxId: data.id,
      });

      return {
        accepted: data.status !== 'failed',
        providerTransactionId: data.id,
        status: this.mapStatus(data.status),
        authorizationCode: data.authorization_code,
        errorMessage: data.error?.message,
        errorCode: data.error?.code,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      logger.error('TuRecarga topup failed', {
        action: 'turecarga_topup_error',
        folio: request.folio,
        error: msg,
      });
      return {
        accepted: false,
        status: 'fallido',
        errorMessage: msg,
      };
    }
  }

  async processBillPayment(request: BillPaymentRequest): Promise<ProviderResponse> {
    try {
      const data = await this.request<TuRecargaTopupResponse>('POST', '/bill-payment', {
        service_id: request.serviceId,
        reference: request.referenceNumber,
        amount: request.amount,
        external_id: request.folio,
      });

      logger.info('TuRecarga bill payment processed', {
        action: 'turecarga_bill_payment',
        folio: request.folio,
        status: data.status,
        providerTxId: data.id,
      });

      return {
        accepted: data.status !== 'failed',
        providerTransactionId: data.id,
        status: this.mapStatus(data.status),
        authorizationCode: data.authorization_code,
        errorMessage: data.error?.message,
        errorCode: data.error?.code,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      logger.error('TuRecarga bill payment failed', {
        action: 'turecarga_bill_error',
        folio: request.folio,
        error: msg,
      });
      return {
        accepted: false,
        status: 'fallido',
        errorMessage: msg,
      };
    }
  }

  async queryTransaction(providerTransactionId: string): Promise<ProviderResponse> {
    try {
      const data = await this.request<TuRecargaTopupResponse>(
        'GET',
        `/transactions/${encodeURIComponent(providerTransactionId)}`,
      );

      return {
        accepted: data.status !== 'failed',
        providerTransactionId: data.id,
        status: this.mapStatus(data.status),
        authorizationCode: data.authorization_code,
        errorMessage: data.error?.message,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      return {
        accepted: false,
        status: 'fallido',
        providerTransactionId,
        errorMessage: msg,
      };
    }
  }

  async cancelTransaction(providerTransactionId: string): Promise<ProviderResponse> {
    try {
      const data = await this.request<TuRecargaTopupResponse>(
        'POST',
        `/transactions/${encodeURIComponent(providerTransactionId)}/cancel`,
      );

      return {
        accepted: true,
        providerTransactionId: data.id,
        status: this.mapStatus(data.status),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      return {
        accepted: false,
        status: 'fallido',
        providerTransactionId,
        errorMessage: msg,
      };
    }
  }

  async verifyWebhook(headers: Headers, body: string): Promise<boolean> {
    // TuRecarga uses HMAC-SHA256 signature verification
    const signature = headers.get('x-turecarga-signature');
    if (!signature) return false;

    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.apiSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      const expected = Array.from(new Uint8Array(signed))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return constantTimeStringEqual(expected, signature);
    } catch {
      return false;
    }
  }

  async parseWebhook(body: string): Promise<{
    providerTransactionId: string;
    status: ProviderResponse['status'];
    authorizationCode?: string;
    errorMessage?: string;
  }> {
    const data = JSON.parse(body) as {
      transaction_id: string;
      status: string;
      authorization_code?: string;
      error?: { message: string };
    };

    return {
      providerTransactionId: data.transaction_id,
      status: this.mapStatus(data.status),
      authorizationCode: data.authorization_code,
      errorMessage: data.error?.message,
    };
  }
}
