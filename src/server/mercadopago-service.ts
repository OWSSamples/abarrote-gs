import 'server-only';

import { z } from 'zod';
import { getMPAccessToken } from '@/lib/oauth-providers';

const PROVIDER_TIMEOUT_MS = 8_000;

const accountSchema = z.object({
  id: z.coerce.number().int().positive(),
  nickname: z.string().max(200),
  email: z.string().email().max(300),
});

const balanceSchema = z
  .object({
    available_balance: z.coerce.number().default(0),
    unavailable_balance: z.coerce.number().default(0),
    total_amount: z.coerce.number().optional(),
    currency_id: z.string().length(3).default('MXN'),
  })
  .transform((balance) => ({
    ...balance,
    total_amount: balance.total_amount ?? balance.available_balance + balance.unavailable_balance,
  }));

const deviceSchema = z.object({
  id: z.string().min(1).max(300),
  pos_id: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((value) => (value == null ? '' : String(value))),
  store_id: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((value) => (value == null ? '' : String(value))),
  external_pos_id: z.string().max(300).nullish().transform((value) => value ?? ''),
  operating_mode: z.string().max(100).nullish().transform((value) => value ?? ''),
});

const searchResultSchema = z.object({
  results: z.array(
    z.object({
      id: z.coerce.number().int().positive(),
      status: z.string().max(100),
      status_detail: z.string().max(200).default(''),
      date_created: z.string().max(100),
      date_approved: z.string().max(100).nullable().default(null),
      transaction_amount: z.coerce.number(),
      currency_id: z.string().length(3),
      payment_method_id: z.string().max(100),
      payment_type_id: z.string().max(100),
      description: z.string().max(500).nullable().default(null),
      external_reference: z.string().max(300).nullable().default(null),
      payer: z.object({ email: z.string().email().nullable().default(null) }).default({ email: null }),
      fee_details: z
        .array(z.object({ amount: z.coerce.number(), type: z.string().max(100) }))
        .default([]),
    }),
  ),
  paging: z.object({
    total: z.coerce.number().int().nonnegative(),
    limit: z.coerce.number().int().nonnegative(),
    offset: z.coerce.number().int().nonnegative(),
  }),
});

export type MPAccountBalance = {
  userId: number;
  nickname: string;
  email: string;
  balance: z.infer<typeof balanceSchema>;
};

export type MPDevice = z.infer<typeof deviceSchema>;
export type MPSearchResult = z.infer<typeof searchResultSchema>;

function toPaymentSearchDate(value: string, endOfDay = false): string {
  return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}-06:00`;
}

async function getAccessToken(storeId: string): Promise<string> {
  const accessToken = await getMPAccessToken(storeId);
  if (!accessToken) {
    throw new Error('MercadoPago no está conectado. Configura la cuenta antes de continuar.');
  }
  return accessToken;
}

async function readProviderJson(response: Response, message: string): Promise<unknown> {
  if (!response.ok) throw new Error(message);
  return response.json() as Promise<unknown>;
}

export async function createMPRefund(paymentId: string, amount: number, idempotencyKey: string, storeId: string): Promise<{
  id: string;
  status: 'approved' | 'pending' | 'rejected';
  amount: number;
}> {
  const accessToken = await getAccessToken(storeId);
  const response = await readProviderJson(
    await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ amount }),
      cache: 'no-store',
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    }),
    'MercadoPago no pudo procesar el reembolso.',
  );
  const parsed = z
    .object({
      id: z.union([z.string(), z.number()]).transform(String),
      payment_id: z.union([z.string(), z.number()]).transform(String),
      status: z.enum(['approved', 'pending', 'rejected']),
      amount: z.coerce.number().positive(),
    })
    .parse(response);
  if (parsed.payment_id !== paymentId) {
    throw new Error('MercadoPago devolvió un reembolso asociado a otro pago.');
  }

  return { id: parsed.id, status: parsed.status, amount: parsed.amount };
}

export async function fetchMPAccountBalanceFromProvider(storeId: string): Promise<MPAccountBalance> {
  const accessToken = await getAccessToken(storeId);
  const headers = { Authorization: `Bearer ${accessToken}` };
  const user = accountSchema.parse(
    await readProviderJson(
      await fetch('https://api.mercadopago.com/users/me', {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      }),
      'No se pudo obtener la cuenta de MercadoPago.',
    ),
  );
  const balance = balanceSchema.parse(
    await readProviderJson(
      await fetch(`https://api.mercadopago.com/users/${user.id}/mercadopago_account/balance`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      }),
      'No se pudo obtener el saldo de MercadoPago.',
    ),
  );
  return { userId: user.id, nickname: user.nickname, email: user.email, balance };
}

export async function fetchMPDevicesFromProvider(storeId: string): Promise<MPDevice[]> {
  const accessToken = await getAccessToken(storeId);
  const payload = await readProviderJson(
    await fetch('https://api.mercadopago.com/terminals/v1/list', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    }),
    'No se pudieron obtener las terminales de MercadoPago.',
  );
  return z
    .object({ data: z.object({ terminals: z.array(deviceSchema).default([]) }) })
    .parse(payload).data.terminals;
}

export async function searchMPPaymentsFromProvider(input: {
  status?: string;
  beginDate?: string;
  endDate?: string;
  externalReference?: string;
  offset: number;
  limit: number;
}, storeId: string): Promise<MPSearchResult> {
  const accessToken = await getAccessToken(storeId);
  const params = new URLSearchParams({
    sort: 'date_created',
    criteria: 'desc',
    offset: String(input.offset),
    limit: String(input.limit),
  });
  if (input.status) params.set('status', input.status);
  if (input.beginDate || input.endDate) params.set('range', 'date_created');
  if (input.beginDate) params.set('begin_date', toPaymentSearchDate(input.beginDate));
  if (input.endDate) params.set('end_date', toPaymentSearchDate(input.endDate, true));
  if (input.externalReference) params.set('external_reference', input.externalReference);

  const payload = await readProviderJson(
    await fetch(`https://api.mercadopago.com/v1/payments/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    }),
    'Error al buscar pagos en MercadoPago.',
  );
  return searchResultSchema.parse(payload);
}
