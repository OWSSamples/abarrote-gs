/**
 * Environment Configuration — Validated at Startup
 *
 * Uses Zod to validate ALL required and optional environment variables
 * at module load time. If a required variable is missing, the process
 * fails fast with a clear error message rather than crashing mid-request.
 *
 * @example
 * import { env } from '@/lib/env';
 * const pool = new Pool({ connectionString: env.DATABASE_URL });
 */

import { z } from 'zod';

// ══════════════════════════════════════════════════════════════
// SCHEMA
// ══════════════════════════════════════════════════════════════

const envSchema = z.object({
  // ── Core (required) ──
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ── Auth (required for production) ──
  CRON_SECRET: z.string().min(1).optional(),

  // ── Redis / Upstash ──
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // ── QStash ──
  QSTASH_TOKEN: z.string().min(1).optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),

  // ── Payment Providers ──
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  CONEKTA_WEBHOOK_KEY: z.string().min(1).optional(),
  CLIP_WEBHOOK_SECRET: z.string().min(1).optional(),

  // ── AWS (file uploads) ──
  AWS_REGION: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  AWS_S3_BUCKET: z.string().min(1).optional(),

  // ── Telegram ──
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),

  // ── Database Pool ──
  DB_POOL_MAX: z.string().regex(/^\d+$/).optional(),

  // ── App URLs ──
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  VERCEL_URL: z.string().min(1).optional(),
});

// ══════════════════════════════════════════════════════════════
// VALIDATION
// ══════════════════════════════════════════════════════════════

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ✗ ${i.path.join('.')}: ${i.message}`)
      .join('\n');

    // In test environment, just warn — don't crash test runners
    if (process.env.NODE_ENV === 'test') {
      return envSchema.parse({
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost/test',
      });
    }

    throw new Error(
      `\n══════════════════════════════════════════════\n` +
      `  Environment validation failed:\n${formatted}\n` +
      `══════════════════════════════════════════════\n`
    );
  }

  return result.data;
}

export const env = validateEnv();

export type Env = z.infer<typeof envSchema>;

// ══════════════════════════════════════════════════════════════
// RUNTIME CHECKS (for optional integrations)
// ══════════════════════════════════════════════════════════════

/** Returns true if Stripe integration is fully configured */
export function isStripeConfigured(): boolean {
  return !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}

/** Returns true if Conekta webhook verification is configured */
export function isConektaWebhookConfigured(): boolean {
  return !!env.CONEKTA_WEBHOOK_KEY;
}

/** Returns true if Telegram notifications are configured */
export function isTelegramConfigured(): boolean {
  return !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

/** Returns true if QStash is configured for background jobs */
export function isQStashConfigured(): boolean {
  return !!(env.QSTASH_TOKEN && env.QSTASH_CURRENT_SIGNING_KEY);
}

/** Returns true if AWS S3 is configured for file uploads */
export function isS3Configured(): boolean {
  return !!(env.AWS_REGION && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET);
}
