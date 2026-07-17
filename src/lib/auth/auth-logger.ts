/**
 * Structured logging for authentication lifecycle events.
 *
 * Captures sign-in attempts, failures, password resets, etc. into the
 * application logger and (when applicable) the audit log table.
 *
 * Used by: AuthContext, LoginForm, AuthCallbackHandler, guard.ts.
 */

import { logger } from '@/lib/logger';
import { hashIdentifierForLog } from '@/lib/security/redaction';

export type AuthEvent =
  | 'sign_in_attempt'
  | 'sign_in_success'
  | 'sign_in_failure'
  | 'sign_in_challenge'
  | 'sign_out'
  | 'session_refresh'
  | 'session_expired'
  | 'password_reset_request'
  | 'password_reset_request_accepted'
  | 'password_reset_success'
  | 'password_reset_failure'
  | 'oauth_redirect'
  | 'oauth_callback_success'
  | 'oauth_callback_failure'
  | 'force_password_change'
  | 'mfa_recovery_attempt'
  | 'unauthorized_access';

export interface AuthLogContext {
  event: AuthEvent;
  userId?: string;
  email?: string;
  provider?: 'cognito' | 'microsoft' | 'google';
  reason?: string;
  errorCode?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Logs an auth event with PII-safe redaction. Email is hashed; userId is kept
 * (Cognito sub is already a UUID so it's safe).
 */
export async function logAuthEvent(ctx: AuthLogContext): Promise<void> {
  const emailHash = ctx.email ? await hashIdentifierForLog(ctx.email) : undefined;
  const failure = ctx.event.endsWith('_failure') || ctx.event === 'unauthorized_access';
  const challenge = ctx.event === 'sign_in_challenge' || ctx.event === 'force_password_change';

  const payload = {
    auth_event: ctx.event,
    user_id: ctx.userId,
    email_hash: emailHash,
    provider: ctx.provider ?? 'cognito',
    reason: ctx.reason,
    error_code: ctx.errorCode,
    ip: ctx.ipAddress,
    ua: ctx.userAgent,
  };

  if (failure) {
    logger.warn(`auth.${ctx.event}`, payload);
  } else if (challenge) {
    logger.info(`auth.${ctx.event}`, payload);
  } else {
    logger.info(`auth.${ctx.event}`, payload);
  }
}
