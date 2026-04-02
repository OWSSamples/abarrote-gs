import { Client } from '@upstash/qstash';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// QStash Connection — Singleton client for background job publishing
// ══════════════════════════════════════════════════════════════

let _client: Client | null = null;
let _initialized = false;

/**
 * Returns the QStash client singleton, or null if not configured.
 *
 * Consumers should always handle `null` — the system must work
 * without QStash (direct execution fallback).
 */
export function getQStashClient(): Client | null {
  if (_initialized) return _client;
  _initialized = true;

  const token = process.env.QSTASH_TOKEN;

  if (!token) {
    logger.info('QStash not configured — background jobs will execute inline', {
      action: 'qstash_connection_skip',
    });
    return null;
  }

  try {
    _client = new Client({ token });
    logger.info('QStash client initialized', { action: 'qstash_connection_init' });
  } catch (err) {
    logger.error('Failed to initialize QStash client', {
      action: 'qstash_connection_error',
      error: err instanceof Error ? err.message : String(err),
    });
    _client = null;
  }

  return _client;
}

/**
 * Returns true if QStash is configured and client can be created.
 */
export function isQStashAvailable(): boolean {
  return getQStashClient() !== null;
}
