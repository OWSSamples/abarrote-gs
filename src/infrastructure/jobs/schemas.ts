/**
 * Job Payload Validation Schemas
 *
 * Strict Zod schemas for all QStash/cron job payloads.
 * Prevents injection attacks and malformed data from
 * reaching business logic in background job handlers.
 */

import { z } from 'zod';

// ══════════════════════════════════════════════════════════════
// Shared Primitives
// ══════════════════════════════════════════════════════════════

const sanitizedString = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .transform((s) => s.replace(/[<>&"']/g, ''));

const positiveInt = z.number().int().nonnegative();
const storeId = z.string().regex(/^(?:main|[a-f0-9]{32})$/);

// ══════════════════════════════════════════════════════════════
// Stock Alert Job
// ══════════════════════════════════════════════════════════════

export const stockAlertPayloadSchema = z.object({
  storeId,
  productName: sanitizedString,
  currentStock: positiveInt,
  minStock: positiveInt,
});

export type StockAlertPayload = z.infer<typeof stockAlertPayloadSchema>;

// ══════════════════════════════════════════════════════════════
// Notification Job
// ══════════════════════════════════════════════════════════════

export const notificationPayloadSchema = z.object({
  storeId,
  message: sanitizedString,
});

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

// ══════════════════════════════════════════════════════════════
// Payment Poll Job
// ══════════════════════════════════════════════════════════════

export const paymentPollPayloadSchema = z.object({
  storeId,
  chargeId: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[\w\-:.]+$/, 'chargeId formato inválido'),
  provider: z.enum(['conekta', 'stripe', 'clip']),
});

export type PaymentPollPayload = z.infer<typeof paymentPollPayloadSchema>;

// ══════════════════════════════════════════════════════════════
// Daily Report Job (empty or with optional date override)
// ══════════════════════════════════════════════════════════════

export const dailyReportPayloadSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido')
      .optional(),
  })
  .optional()
  .default({});

export type DailyReportPayload = z.infer<typeof dailyReportPayloadSchema>;

// ══════════════════════════════════════════════════════════════
// Unified parser
// ══════════════════════════════════════════════════════════════

/**
 * Safely parse a raw body string against a Zod schema.
 * Returns a discriminated union for safe handling.
 */
export function parseJobPayload<T>(
  schema: z.ZodType<T>,
  rawBody: string,
): { success: true; data: T } | { success: false; error: string } {
  let parsed: unknown;
  try {
    parsed = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    return { success: false, error: 'Payload JSON inválido' };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }

  return { success: true, data: result.data };
}
