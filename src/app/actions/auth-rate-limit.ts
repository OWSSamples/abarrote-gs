'use server';

/**
 * Server Action that pre-checks rate limits before initiating an auth flow.
 *
 * Why a server action vs trusting Cognito's built-in throttling:
 *  - Cognito's user pool throttling is generous (50-200 req/sec/pool) and not per-user.
 *  - Per-IP throttling at the application layer prevents credential stuffing attacks
 *    even before requests reach Cognito.
 *  - Logs failed attempts to our auth-logger for observability.
 *
 * Used by LoginForm and ForgotPasswordForm before calling Amplify signIn/resetPassword.
 */

import { headers } from 'next/headers';
import { checkRateLimitAsync } from '@/infrastructure/redis/rate-limit';
import { logAuthEvent } from '@/lib/auth/auth-logger';

const TIERS = {
  // Login: 5 attempts per 15 minutes per IP+email combo
  login: { limit: 5, windowMs: 15 * 60_000 },
  // Password reset: 3 requests per hour per IP+email
  password_reset: { limit: 3, windowMs: 60 * 60_000 },
  // Microsoft OAuth redirect: 10 per minute (UI button spam)
  oauth: { limit: 10, windowMs: 60_000 },
} as const;

export type AuthAction = keyof typeof TIERS;

export interface AuthRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    'unknown'
  );
}

export async function checkAuthRateLimit(action: AuthAction, email?: string): Promise<AuthRateLimitResult> {
  const ip = await getClientIp();
  const normalizedEmail = email?.toLowerCase().trim() || 'anon';
  const identifier = `auth:${action}:${ip}:${normalizedEmail}`;
  const tier = TIERS[action];

  const result = await checkRateLimitAsync(identifier, tier);

  if (!result.allowed) {
    void logAuthEvent({
      event: action === 'password_reset' ? 'password_reset_failure' : 'sign_in_failure',
      email,
      ipAddress: ip,
      reason: `rate_limit_${action}`,
      errorCode: 'RateLimitExceeded',
    });
    const resetMs = result.reset.getTime();
    return {
      allowed: false,
      remaining: 0,
      resetAt: resetMs,
      retryAfterSeconds: Math.max(1, Math.ceil((resetMs - Date.now()) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: result.remaining,
    resetAt: result.reset.getTime(),
  };
}
