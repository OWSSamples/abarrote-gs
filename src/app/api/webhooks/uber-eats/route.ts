import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { db } from '@/db';
import { uberWebhookEvents } from '@/db/schema-uber';
import { randomUUID } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const runtime = 'nodejs';

// Remote JWKS para validar tokens de Cognito M2M
const JWKS = env.COGNITO_JWKS_URL ? createRemoteJWKSet(new URL(env.COGNITO_JWKS_URL)) : null;

export async function POST(req: Request) {
  const requestId = randomUUID();
  const rawBody = await req.text();
  const signature = req.headers.get('x-uber-signature');
  const authHeader = req.headers.get('Authorization');

  try {
    // 1. Validar Bearer Token de Cognito (Flujo M2M)
    if (!JWKS || !authHeader?.startsWith('Bearer ')) {
      return new NextResponse(null, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: env.COGNITO_ISSUER,
    });

    // Validar Client ID y Scope de Cognito
    if (payload.client_id !== env.COGNITO_UBER_WEBHOOK_ALLOWED_CLIENT_ID) {
      return new NextResponse(null, { status: 403 });
    }

    // 2. Validar Firma HMAC de Uber
    if (!signature) return new NextResponse(null, { status: 401 });
    
    const hmac = createHmac('sha256', env.UBER_DEVELOPER_CLIENT_SECRET || '');
    const digest = hmac.update(rawBody).digest('hex');

    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
      logger.warn('Invalid Uber Webhook Signature', { requestId });
      return new NextResponse(null, { status: 401 });
    }

    const payloadJson = JSON.parse(rawBody);
    
    // 3. Persistencia e Idempotencia
    await db.insert(uberWebhookEvents).values({
      id: randomUUID(),
      externalEventId: payloadJson.event_id || requestId,
      eventType: payloadJson.event_type || 'unknown',
      uberStoreId: payloadJson.meta?.store_id,
      payload: payloadJson,
      status: 'PENDING'
    }).onConflictDoNothing();

    // 4. Responder 200 inmediatamente (Procesamiento asíncrono sigue después)
    return new NextResponse(null, { status: 200 });

  } catch (error) {
    logger.error('Uber Webhook Error', { requestId, error: (error as Error).message });
    return new NextResponse(null, { status: 500 });
  }
}