/**
 * Billpocket Provider — API adapter for card payments and service billing.
 *
 * Integrates with the Billpocket API (billpocket.com) for:
 * - Phone prepaid recharges via Billpocket's recharge API
 * - Bill payments (CFE, Telmex, Sky, etc.)
 * - Balance inquiry
 * - Transaction status queries
 *
 * Configuration:
 * - Merchant ID + API Key from Billpocket dashboard
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

const PROD_BASE_URL = 'https://api.billpocket.com/v1';
const SANDBOX_BASE_URL = 'https://sandbox.billpocket.com/v1';

// ── Status Mapping ──

const STATUS_MAP: Record<string, TransactionStatus> = {
  approved: 'completado',
  pending: 'procesando',
  declined: 'fallido',
  cancelled: 'cancelado',
  reversed: 'cancelado',
};

function mapStatus(apiStatus: string): TransactionStatus {
  return STATUS_MAP[apiStatus] ?? 'pendiente';
}

// ── Provider Implementation ──

export class BillpocketProvider implements ServiciosProvider {
  readonly name = 'Billpocket';
  readonly id = 'billpocket';
  readonly isLive = true;

  private readonly baseUrl: string;
  private readonly merchantId: string;
  private readonly apiKey: string;

  constructor(merchantId: string, apiKey: string, sandbox = false) {
    this.merchantId = merchantId;
    this.apiKey = apiKey;
    this.baseUrl = sandbox ? SANDBOX_BASE_URL : PROD_BASE_URL;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Merchant-Id': this.merchantId,
      'X-Api-Key': this.apiKey,
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
        const msg = (data as { error?: string }).error ?? `HTTP ${response.status}`;
        throw new Error(`Billpocket API error: ${msg}`);
      }

      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Health Check ──

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.request<{ ok: boolean }>('GET', '/health');
      return { ok: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      logger.warn('Billpocket health check failed', { action: 'billpocket_health', error: msg });
      return { ok: false, message: msg };
    }
  }

  // ── Balance ──

  async getBalance(): Promise<ProviderBalance> {
    const data = await this.request<{ balance: number; updatedAt: string }>('GET', '/balance');
    return {
      available: data.balance,
      currency: 'MXN',
      lastUpdated: data.updatedAt ?? new Date().toISOString(),
    };
  }

  // ── Carriers & Services ──

  async getCarriers(): Promise<CarrierInfo[]> {
    const data = await this.request<Array<{ carrierId: string; name: string; amounts: number[]; active: boolean }>>(
      'GET',
      '/carriers',
    );
    return data.map((c) => ({
      id: c.carrierId,
      name: c.name,
      availableAmounts: c.amounts,
      active: c.active,
    }));
  }

  async getServices(): Promise<ServiceInfo[]> {
    const data = await this.request<
      Array<{
        serviceId: string;
        name: string;
        fixedAmount: boolean;
        minAmount: number;
        maxAmount: number;
        active: boolean;
      }>
    >('GET', '/services');
    return data.map((s) => ({
      id: s.serviceId,
      name: s.name,
      freeAmount: !s.fixedAmount,
      minAmount: s.minAmount,
      maxAmount: s.maxAmount,
      active: s.active,
    }));
  }

  // ── Topup ──

  async processTopup(req: TopupRequest): Promise<ProviderResponse> {
    try {
      const data = await this.request<{ txId: string; status: string; authCode?: string; errorMsg?: string }>(
        'POST',
        '/topups',
        {
          phone: req.phoneNumber,
          carrierId: req.carrierId,
          amount: req.amount,
          reference: req.folio,
        },
      );

      return {
        accepted: data.status === 'approved',
        providerTransactionId: data.txId,
        status: mapStatus(data.status),
        authorizationCode: data.authCode,
        errorMessage: data.status !== 'approved' ? data.errorMsg : undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error procesando recarga Billpocket';
      logger.error('Billpocket topup failed', { action: 'billpocket_topup_error', error: msg });
      return { accepted: false, status: 'fallido', errorMessage: msg };
    }
  }

  // ── Bill Payment ──

  async processBillPayment(req: BillPaymentRequest): Promise<ProviderResponse> {
    try {
      const data = await this.request<{ txId: string; status: string; authCode?: string; errorMsg?: string }>(
        'POST',
        '/payments',
        {
          serviceId: req.serviceId,
          reference: req.referenceNumber,
          amount: req.amount,
          folio: req.folio,
        },
      );

      return {
        accepted: data.status === 'approved',
        providerTransactionId: data.txId,
        status: mapStatus(data.status),
        authorizationCode: data.authCode,
        errorMessage: data.status !== 'approved' ? data.errorMsg : undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error procesando pago Billpocket';
      logger.error('Billpocket bill payment failed', { action: 'billpocket_bill_error', error: msg });
      return { accepted: false, status: 'fallido', errorMessage: msg };
    }
  }

  // ── Transaction Query ──

  async queryTransaction(transactionId: string): Promise<ProviderResponse> {
    try {
      const data = await this.request<{ txId: string; status: string; authCode?: string; errorMsg?: string }>(
        'GET',
        `/transactions/${encodeURIComponent(transactionId)}`,
      );

      return {
        accepted: data.status === 'approved',
        providerTransactionId: data.txId,
        status: mapStatus(data.status),
        authorizationCode: data.authCode,
        errorMessage: data.status !== 'approved' ? data.errorMsg : undefined,
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

  // ── Cancel Transaction ──

  async cancelTransaction(transactionId: string): Promise<ProviderResponse> {
    try {
      const data = await this.request<{ txId: string; status: string; message?: string }>(
        'POST',
        `/transactions/${encodeURIComponent(transactionId)}/cancel`,
        {},
      );

      return {
        accepted: data.status === 'cancelled' || data.status === 'reversed',
        providerTransactionId: data.txId,
        status: mapStatus(data.status),
        errorMessage: data.message,
      };
    } catch (error) {
      return {
        accepted: false,
        providerTransactionId: transactionId,
        status: 'fallido',
        errorMessage: error instanceof Error ? error.message : 'Error cancelando transacción',
      };
    }
  }

  // ── Webhook ──

  async verifyWebhook(headers: Headers, body: string): Promise<boolean> {
    const signature = headers.get('x-billpocket-signature');
    if (!signature) return false;

    // Billpocket uses HMAC-SHA256 on body with API key
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.apiKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return constantTimeStringEqual(expected, signature);
  }

  async parseWebhook(
    body: string,
  ): Promise<{
    providerTransactionId: string;
    status: TransactionStatus;
    authorizationCode?: string;
    errorMessage?: string;
  }> {
    const data = JSON.parse(body) as { txId?: string; status?: string; authCode?: string; error?: string };
    if (!data.txId || !data.status) {
      throw new Error('Invalid Billpocket webhook payload: missing txId or status');
    }
    return {
      providerTransactionId: data.txId,
      status: mapStatus(data.status),
      authorizationCode: data.authCode,
      errorMessage: data.error,
    };
  }
}
