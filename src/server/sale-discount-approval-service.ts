import 'server-only';

import crypto from 'crypto';
import { buildKey, getRedisClient, REDIS_PREFIXES } from '@/infrastructure/redis';
import type { SaleDiscountApprovalContext } from '@/lib/validation/schemas';
import { AppError } from '@/lib/errors';

const APPROVAL_TTL_MS = 2 * 60_000;

const CONSUME_APPROVAL_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local decoded = cjson.decode(current)
if decoded.nonce ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
return 1
`;

interface SaleDiscountApprovalRecord {
  requesterUid: string;
  authorizedByUid: string;
  storeId: string;
  requestId: string;
  contextFingerprint: string;
  expiresAt: number;
  nonce: string;
}

function contextFingerprint(context: SaleDiscountApprovalContext): string {
  const quantities = new Map<string, number>();
  for (const item of context.items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  const normalized = {
    discountValue: Math.round(context.discountValue * 10_000),
    discountType: context.discountType,
    items: [...quantities.entries()].sort(([left], [right]) => left.localeCompare(right)),
  };

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function approvalKey(token: string): string {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return buildKey(REDIS_PREFIXES.APPROVAL, 'sale-discount', tokenHash);
}

export async function issueSaleDiscountApproval(params: {
  requesterUid: string;
  authorizedByUid: string;
  storeId: string;
  context: SaleDiscountApprovalContext;
}): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const record: SaleDiscountApprovalRecord = {
    requesterUid: params.requesterUid,
    authorizedByUid: params.authorizedByUid,
    storeId: params.storeId,
    requestId: params.context.clientRequestId,
    contextFingerprint: contextFingerprint(params.context),
    expiresAt: Date.now() + APPROVAL_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const redis = getRedisClient();
  if (!redis) {
    throw new AppError(
      'APPROVAL_SERVICE_UNAVAILABLE',
      'La autorización segura no está disponible temporalmente.',
      503,
    );
  }

  const key = approvalKey(token);
  try {
    await redis.set(key, JSON.stringify(record), { ex: Math.ceil(APPROVAL_TTL_MS / 1000) });
  } catch {
    throw new AppError(
      'APPROVAL_SERVICE_UNAVAILABLE',
      'La autorización segura no está disponible temporalmente.',
      503,
    );
  }
  return token;
}

export async function consumeSaleDiscountApproval(params: {
  token: string;
  requesterUid: string;
  storeId: string;
  context: SaleDiscountApprovalContext;
}): Promise<{ authorizedByUid: string } | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(params.token)) return null;

  const redis = getRedisClient();
  if (!redis) {
    throw new AppError(
      'APPROVAL_SERVICE_UNAVAILABLE',
      'La autorizacion segura no esta disponible temporalmente.',
      503,
    );
  }

  const key = approvalKey(params.token);
  let record: SaleDiscountApprovalRecord | null;
  try {
    record = await redis.get<SaleDiscountApprovalRecord>(key);
  } catch {
    throw new AppError(
      'APPROVAL_SERVICE_UNAVAILABLE',
      'La autorizacion segura no esta disponible temporalmente.',
      503,
    );
  }
  if (
    !record ||
    record.expiresAt <= Date.now() ||
    record.requesterUid !== params.requesterUid ||
    record.storeId !== params.storeId ||
    record.requestId !== params.context.clientRequestId ||
    record.contextFingerprint !== contextFingerprint(params.context)
  ) {
    return null;
  }

  try {
    const consumed = await redis.eval<[string], number>(CONSUME_APPROVAL_SCRIPT, [key], [record.nonce]);
    return consumed === 1 ? { authorizedByUid: record.authorizedByUid } : null;
  } catch {
    throw new AppError(
      'APPROVAL_SERVICE_UNAVAILABLE',
      'La autorizacion segura no esta disponible temporalmente.',
      503,
    );
  }
}
