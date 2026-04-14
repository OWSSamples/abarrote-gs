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

  // ── Payment Providers: Stripe ──
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  // ── Payment Providers: Conekta ──
  CONEKTA_PRIVATE_KEY: z.string().min(1).optional(),
  CONEKTA_WEBHOOK_KEY: z.string().min(1).optional(),
  CONEKTA_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

  // ── Payment Providers: Clip ──
  CLIP_API_KEY: z.string().min(1).optional(),
  CLIP_SECRET_KEY: z.string().min(1).optional(),
  CLIP_SERIAL_NUMBER: z.string().min(1).optional(),
  CLIP_WEBHOOK_SECRET: z.string().min(1).optional(),

  // ── Payment Providers: MercadoPago ──
  MP_APP_ID: z.string().min(1).optional(),
  MP_CLIENT_SECRET: z.string().min(1).optional(),
  MP_ACCESS_TOKEN: z.string().min(1).optional(),
  MP_WEBHOOK_SECRET: z.string().min(1).optional(),

  // ── AWS (file uploads + SES email) ──
  AWS_REGION: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  AWS_S3_BUCKET: z.string().min(1).optional(),
  SES_FROM_EMAIL: z.string().email().optional(),

  // ── Telegram ──
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),

  // ── Firebase Admin ──
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),

  // ── Encryption ──
  OAUTH_ENCRYPTION_KEY: z.string().min(1).optional(),

  // ── CFDI / PAC ──
  CFDI_PAC_URL: z.string().url().optional(),
  CFDI_PAC_USER: z.string().min(1).optional(),
  CFDI_PAC_PASSWORD: z.string().min(1).optional(),

  // ── Database Pool ──
  DB_POOL_MAX: z.string().regex(/^\d+$/).optional(),

  // ── App URLs ──
  BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  VERCEL_URL: z.string().min(1).optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().min(1).optional(),

  // ── Observability ──
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),

  // ── Firebase Client (NEXT_PUBLIC) ──
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1).optional(),
});

// ══════════════════════════════════════════════════════════════
// VALIDATION
// ══════════════════════════════════════════════════════════════

function validateEnv() {
  // Strip empty strings from process.env — Zod .optional() allows undefined
  // but not "", and many deployment platforms set unset vars to "".
  const cleaned = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));

  const result = envSchema.safeParse(cleaned);

  if (!result.success) {
    const formatted = result.error.issues.map((i) => `  ✗ ${i.path.join('.')}: ${i.message}`).join('\n');

    // In test environment, just warn — don't crash test runners
    if (process.env.NODE_ENV === 'test') {
      // Remove invalid URL values that fail z.string().url() in test env
      const testCleaned = { ...cleaned };
      const urlFields = ['BASE_URL', 'NEXT_PUBLIC_APP_URL', 'CFDI_PAC_URL'];
      for (const field of urlFields) {
        if (testCleaned[field]) {
          try {
            new URL(testCleaned[field] as string);
          } catch {
            delete testCleaned[field];
          }
        }
      }
      return envSchema.parse({
        ...testCleaned,
        DATABASE_URL: testCleaned.DATABASE_URL || 'postgresql://test:test@localhost/test',
      });
    }

    throw new Error(
      `\n══════════════════════════════════════════════\n` +
        `  Environment validation failed:\n${formatted}\n` +
        `══════════════════════════════════════════════\n`,
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

/** Returns true if Clip payment integration is configured */
export function isClipConfigured(): boolean {
  return !!(env.CLIP_API_KEY && env.CLIP_SECRET_KEY);
}

/** Returns true if MercadoPago integration is configured */
export function isMercadoPagoConfigured(): boolean {
  return !!(env.MP_APP_ID && env.MP_CLIENT_SECRET);
}

/** Returns the resolved base URL for webhook registrations */
export function getBaseUrl(): string {
  return (
    env.BASE_URL ?? env.NEXT_PUBLIC_APP_URL ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'http://localhost:3000')
  );
}

/** Returns the resolved public app URL for customer-facing links */
export function getAppUrl(): string {
  return (
    env.NEXT_PUBLIC_APP_URL ??
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : getBaseUrl())
  );
}
