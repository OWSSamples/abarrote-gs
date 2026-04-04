import { Receiver } from '@upstash/qstash';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

// ══════════════════════════════════════════════════════════════
// QStash Signature Verification
// ══════════════════════════════════════════════════════════════
//
// Every POST from QStash carries an `Upstash-Signature` header.
// We verify it using the current + next signing keys (supports
// key rotation without downtime).

let _receiver: Receiver | null = null;

function getReceiver(): Receiver | null {
  if (_receiver) return _receiver;

  const currentKey = env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentKey || !nextKey) {
    logger.warn('QStash signing keys not configured — cannot verify signatures', {
      action: 'qstash_receiver_skip',
    });
    return null;
  }

  _receiver = new Receiver({
    currentSigningKey: currentKey,
    nextSigningKey: nextKey,
  });

  return _receiver;
}

/**
 * Verifies that an incoming request was sent by QStash.
 *
 * @param signature — Value of the `Upstash-Signature` header
 * @param body — Raw request body as string
 * @returns `true` if signature is valid, `false` otherwise
 */
export async function verifyQStashSignature(
  signature: string,
  body: string,
): Promise<boolean> {
  const receiver = getReceiver();

  if (!receiver) {
    // In development without keys, allow all (log warning)
    if (process.env.NODE_ENV === 'development') {
      logger.warn('QStash signature verification skipped in dev — signing keys not set', {
        action: 'qstash_verify_skip_dev',
      });
      return true;
    }
    return false;
  }

  try {
    const isValid = await receiver.verify({
      signature,
      body,
    });

    return isValid;
  } catch (err) {
    logger.error('QStash signature verification failed', {
      action: 'qstash_verify_error',
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
