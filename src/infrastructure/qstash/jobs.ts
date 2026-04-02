import { getQStashClient } from './connection';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// Background Job Publisher
// ══════════════════════════════════════════════════════════════
//
// Publishes jobs to QStash which calls back to our API endpoints.
// If QStash is not available, executes the fallback function inline.
//
// Job types map to API routes:
//   'notification'     → POST /api/jobs/notification
//   'payment-poll'     → POST /api/jobs/payment-poll
//   'daily-report'     → POST /api/jobs/daily-report
//   'stock-alert'      → POST /api/jobs/stock-alert

export type JobType = 'notification' | 'payment-poll' | 'daily-report' | 'stock-alert';

const JOB_ROUTES: Record<JobType, string> = {
  'notification': '/api/jobs/notification',
  'payment-poll': '/api/jobs/payment-poll',
  'daily-report': '/api/jobs/daily-report',
  'stock-alert': '/api/jobs/stock-alert',
};

export interface PublishOptions {
  /** Delay before delivery in seconds. */
  delaySec?: number;
  /** Number of retries on failure. Default: 3. */
  retries?: number;
}

/**
 * Publishes a background job to QStash.
 *
 * The job will be delivered to the corresponding `/api/jobs/*` route
 * as a POST with JSON body. QStash handles retry with exponential backoff.
 *
 * If QStash is unavailable and a `fallback` function is provided,
 * it executes inline (fire-and-forget, non-blocking).
 *
 * @returns The QStash message ID, or `'inline'` if executed via fallback.
 */
export async function publishJob<T extends Record<string, unknown>>(
  type: JobType,
  payload: T,
  options?: PublishOptions,
  fallback?: () => Promise<void>,
): Promise<string> {
  const client = getQStashClient();
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const destination = `${baseUrl}${JOB_ROUTES[type]}`;

  if (client) {
    try {
      const result = await client.publishJSON({
        url: destination,
        body: payload,
        retries: options?.retries ?? 3,
        ...(options?.delaySec ? { delay: options.delaySec } : {}),
      });

      logger.info('QStash job published', {
        action: 'qstash_publish',
        jobType: type,
        messageId: result.messageId,
        destination,
      });

      return result.messageId;
    } catch (err) {
      logger.error('QStash publish failed — executing fallback inline', {
        action: 'qstash_publish_error',
        jobType: type,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through to inline execution
    }
  }

  // Inline fallback — fire-and-forget
  if (fallback) {
    fallback().catch((err) => {
      logger.error('Inline job fallback failed', {
        action: 'qstash_fallback_error',
        jobType: type,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return 'inline';
}

/**
 * Schedules a recurring job via QStash CRON.
 *
 * @param type — Job type (maps to API route)
 * @param cron — Cron expression (e.g. "0 22 * * *" for daily at 10 PM)
 * @param payload — JSON payload delivered on each invocation
 * @returns Schedule ID from QStash, or null if not available
 */
export async function scheduleJob<T extends Record<string, unknown>>(
  type: JobType,
  cron: string,
  payload: T,
): Promise<string | null> {
  const client = getQStashClient();
  if (!client) {
    logger.info('QStash not available — cannot create schedule', {
      action: 'qstash_schedule_skip',
      jobType: type,
      cron,
    });
    return null;
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const destination = `${baseUrl}${JOB_ROUTES[type]}`;

  try {
    const schedule = await client.schedules.create({
      destination,
      cron,
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      retries: 3,
    });

    logger.info('QStash schedule created', {
      action: 'qstash_schedule_create',
      jobType: type,
      scheduleId: schedule.scheduleId,
      cron,
    });

    return schedule.scheduleId;
  } catch (err) {
    logger.error('QStash schedule creation failed', {
      action: 'qstash_schedule_error',
      jobType: type,
      cron,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
