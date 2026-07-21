import { NextResponse, type NextRequest } from 'next/server';
import { verifyQStashSignature } from '@/infrastructure/qstash';

/**
 * Reads the raw request body and verifies its QStash signature.
 *
 * All `/api/jobs/*` handlers are invoked by QStash and must validate the
 * `upstash-signature` header against the raw body before processing.
 *
 * Returns the raw body on success, or a ready-to-return 401 response when
 * the signature is missing/invalid.
 *
 * Usage:
 *   const verified = await readVerifiedJobBody(request);
 *   if (!verified.ok) return verified.response;
 *   const body = verified.body;
 */
export async function readVerifiedJobBody(
  request: NextRequest,
): Promise<{ ok: true; body: string } | { ok: false; response: NextResponse }> {
  const body = await request.text();
  const signature = request.headers.get('upstash-signature') ?? '';

  const isValid = await verifyQStashSignature(signature, body);
  if (!isValid) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { ok: true, body };
}
