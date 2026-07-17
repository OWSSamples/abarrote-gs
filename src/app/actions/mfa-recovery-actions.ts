'use server';

import { cookies, headers } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { mfaRecoveryCodes, userIdentities } from '@/db/schema';
import { verifyIdToken, adminSetUserMfaPreference, getCognitoUser } from '@/lib/cognito-admin';
import { sendEmail } from '@/lib/email';
import { mfaActivationReminderTemplate } from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import {
  getEmailDomain,
  hashIdentifierForLog,
  normalizeEmailAddress as normalizeEmailForLog,
} from '@/lib/security/redaction';
import { getStoreConfig } from '@/server/store-config-service';

// ══════════════════════════════════════════════════════════════
// MFA RECOVERY CODES
// ══════════════════════════════════════════════════════════════

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_GROUPS = 3;
const RECOVERY_CODE_GROUP_LEN = 4;

/**
 * Normalize a recovery code for comparison: uppercase, strip dashes/spaces.
 * Users may type with or without dashes — we compare on the canonical form.
 */
function normalizeCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

/** SHA-256 hex of normalized code. */
function hashCode(code: string): string {
  return createHash('sha256').update(normalizeCode(code)).digest('hex');
}

/**
 * Generate a single recovery code with format `XXXX-XXXX-XXXX`
 * using crockford-style alphabet (no I/O/0/1 to avoid confusion).
 */
function generateOneCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = randomBytes(RECOVERY_CODE_GROUPS * RECOVERY_CODE_GROUP_LEN);
  const chars: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    chars.push(alphabet[bytes[i]! % alphabet.length]);
  }
  const groups: string[] = [];
  for (let g = 0; g < RECOVERY_CODE_GROUPS; g++) {
    groups.push(chars.slice(g * RECOVERY_CODE_GROUP_LEN, (g + 1) * RECOVERY_CODE_GROUP_LEN).join(''));
  }
  return groups.join('-');
}

async function getCurrentUser(): Promise<
  | { sub: string; email: string }
  | null
> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : cookieStore.get('__session')?.value;

  if (!token) return null;
  try {
    const decoded = await verifyIdToken(token);
    return { sub: decoded.sub, email: decoded.email ?? '' };
  } catch {
    return null;
  }
}

function getClientIp(headerStore: Headers): string | null {
  const xff = headerStore.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || null;
  return headerStore.get('x-real-ip') ?? null;
}

function normalizeEmailAddress(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatMfaActivationDate(): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date());
}

// ──────────────────────────────────────────────────────────────
// PUBLIC ACTIONS
// ──────────────────────────────────────────────────────────────

export interface GenerateRecoveryCodesResult {
  ok: boolean;
  codes?: string[]; // PLAINTEXT — shown to the user only once
  error?: string;
}

/**
 * Generate a fresh batch of recovery codes for the currently authenticated
 * user. Any previous codes for the same user are deleted first (rotation).
 *
 * Returns the plaintext codes ONCE so the UI can display them. They are
 * never retrievable again — only the SHA-256 hashes are stored.
 *
 * Requires the caller to be authenticated (session cookie).
 */
export async function generateRecoveryCodesAction(): Promise<GenerateRecoveryCodesResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: 'No autenticado.' };
  }

  // Verify the user actually exists in our DB (avoid orphan rows).
  const profile = await db
    .select({ cognitoSub: userIdentities.cognitoSub, email: userIdentities.email })
    .from(userIdentities)
    .where(eq(userIdentities.cognitoSub, user.sub))
    .limit(1);

  if (profile.length === 0) {
    return { ok: false, error: 'Usuario no encontrado en el sistema.' };
  }

  const email = profile[0]!.email;
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateOneCode);

  await db.transaction(async (tx) => {
    // Rotate: delete previous (used or unused) codes for this user.
    await tx.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.cognitoSub, user.sub));
    await tx.insert(mfaRecoveryCodes).values(
      codes.map((code) => ({
        id: randomBytes(12).toString('hex'),
        cognitoSub: user.sub,
        email,
        codeHash: hashCode(code),
      })),
    );
  });

  return { ok: true, codes };
}

export interface MfaActivationReminderResult {
  ok: boolean;
  email?: string;
  skipped?: boolean;
  error?: string;
}

/**
 * Sends a security reminder to the authenticated user's profile email after
 * successful MFA activation. The email confirms activation and reminds the
 * user to store recovery codes, but never includes the recovery codes.
 */
export async function sendMfaActivationReminderAction(): Promise<MfaActivationReminderResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: 'No autenticado.' };
  }

  const profile = await db
    .select({ email: userIdentities.email, displayName: userIdentities.displayName })
    .from(userIdentities)
    .where(eq(userIdentities.cognitoSub, user.sub))
    .limit(1);

  const profileEmail = normalizeEmailAddress(profile[0]?.email || user.email);
  if (!isValidEmailAddress(profileEmail)) {
    return { ok: false, skipped: true, error: 'El perfil no tiene un correo válido para enviar el recordatorio.' };
  }

  const config = await getStoreConfig();
  if (!config.emailEnabled || !config.emailSecurityAlertEnabled) {
    return { ok: false, skipped: true, email: profileEmail, error: 'Los correos de seguridad no están habilitados.' };
  }

  const template = mfaActivationReminderTemplate({
    storeName: config.storeName,
    logoUrl: config.logoUrl || undefined,
    accentColor: config.emailAccentColor || undefined,
    displayName: profile[0]?.displayName || undefined,
    email: profileEmail,
    activatedAt: formatMfaActivationDate(),
  });

  const subject = config.emailSubjectPrefix ? `${config.emailSubjectPrefix} ${template.subject}` : template.subject;
  const normalizedProfileEmail = normalizeEmailForLog(profileEmail);
  const emailLog = {
    email_hash: await hashIdentifierForLog(normalizedProfileEmail),
    email_domain: getEmailDomain(normalizedProfileEmail),
  };
  const result = await sendEmail(
    { to: normalizedProfileEmail, subject, html: template.html, text: template.text, replyTo: config.emailReplyTo },
    config.emailFrom || undefined,
    config.emailFromName || config.storeName,
  );

  if (!result.success) {
    logger.warn('MFA activation reminder email failed', {
      action: 'mfa_activation_email_failed',
      userId: user.sub,
      ...emailLog,
      error: result.error,
    });
    return { ok: false, email: profileEmail, error: 'No se pudo enviar el recordatorio por correo.' };
  }

  logger.info('MFA activation reminder email sent', {
    action: 'mfa_activation_email_sent',
    userId: user.sub,
    ...emailLog,
    messageId: result.messageId,
    transport: result.transport,
  });

  return { ok: true, email: profileEmail };
}

export interface VerifyRecoveryCodeResult {
  ok: boolean;
  error?: string;
}

/**
 * Verify a recovery code submitted from the public MFA recovery page.
 *
 * SECURITY MODEL:
 * - This endpoint does NOT require an authenticated session (the user
 *   is locked out of MFA, that's the whole point).
 * - We require both `email` and `code` so an attacker needs to know
 *   the email AND a valid code to disable MFA.
 * - On success we DISABLE the user's TOTP MFA via Cognito Admin API
 *   so they can sign in again with email+password and re-enroll MFA.
 * - The consumed code is marked as used (one-time use).
 *
 * IMPORTANT: this is rate-limited at the proxy layer. Repeated failed
 * attempts for the same email should also be tracked in audit logs.
 */
export async function verifyRecoveryCodeAction(
  email: string,
  code: string,
): Promise<VerifyRecoveryCodeResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = normalizeCode(code);

  if (!normalizedEmail || !normalizedCode) {
    return { ok: false, error: 'Correo y código son requeridos.' };
  }
  if (normalizedCode.length !== RECOVERY_CODE_GROUPS * RECOVERY_CODE_GROUP_LEN) {
    return { ok: false, error: 'El código debe tener 12 caracteres.' };
  }

  const codeHash = hashCode(normalizedCode);

  // Look up the code by hash AND email — both must match the same row.
  const rows = await db
    .select({
      id: mfaRecoveryCodes.id,
      cognitoSub: mfaRecoveryCodes.cognitoSub,
      usedAt: mfaRecoveryCodes.usedAt,
    })
    .from(mfaRecoveryCodes)
    .where(
      and(
        eq(mfaRecoveryCodes.codeHash, codeHash),
        eq(mfaRecoveryCodes.email, normalizedEmail),
        isNull(mfaRecoveryCodes.usedAt),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return { ok: false, error: 'Código inválido o ya utilizado.' };
  }

  const match = rows[0]!;

  const headerStore = await headers();
  const usedIp = getClientIp(headerStore);

  // Mark as used FIRST (so a race condition can't double-spend it).
  const updated = await db
    .update(mfaRecoveryCodes)
    .set({ usedAt: new Date(), usedIp })
    .where(and(eq(mfaRecoveryCodes.id, match.id), isNull(mfaRecoveryCodes.usedAt)))
    .returning({ id: mfaRecoveryCodes.id });

  if (updated.length === 0) {
    // Lost the race — another request consumed it.
    return { ok: false, error: 'Código inválido o ya utilizado.' };
  }

  // Disable TOTP MFA in Cognito so the user can sign in normally and
  // be prompted to re-enroll.
  try {
    await adminSetUserMfaPreference(match.cognitoSub, false);
  } catch (err) {
    await db
      .update(mfaRecoveryCodes)
      .set({ usedAt: null, usedIp: null })
      .where(eq(mfaRecoveryCodes.id, match.id));

    console.error('[mfa-recovery] failed to disable MFA in Cognito', err);
    return {
      ok: false,
      error: 'No se pudo desactivar MFA en AWS. El código no fue consumido; intenta de nuevo o contacta al administrador.',
    };
  }

  return { ok: true };
}

export interface RecoveryCodesStatusResult {
  total: number;
  unused: number;
}

export interface MfaOptionsStatusResult {
  email: {
    available: boolean;
    enabled: boolean;
    address?: string;
    source: 'AWS Cognito';
  };
  authenticator: {
    available: boolean;
    enabled: boolean;
    source: 'AWS Cognito TOTP';
  };
  recoveryCodes: {
    available: boolean;
    enabled: boolean;
    total: number;
    unused: number;
    source: 'PostgreSQL';
  };
  sms: {
    available: boolean;
    enabled: boolean;
    reason: string;
    source: 'AWS Cognito SMS';
  };
  passkeys: {
    available: boolean;
    enabled: boolean;
    reason: string;
    source: 'WebAuthn';
  };
}

/**
 * Returns the count of remaining recovery codes for the current user.
 * Used by the security settings page to show the user how many they
 * have left and prompt regeneration when low.
 */
export async function getRecoveryCodesStatusAction(): Promise<RecoveryCodesStatusResult> {
  const user = await getCurrentUser();
  if (!user) return { total: 0, unused: 0 };

  const all = await db
    .select({ usedAt: mfaRecoveryCodes.usedAt })
    .from(mfaRecoveryCodes)
    .where(eq(mfaRecoveryCodes.cognitoSub, user.sub));

  const total = all.length;
  const unused = all.filter((r) => r.usedAt === null).length;
  return { total, unused };
}

/**
 * Returns the 2FA methods that this installation can safely present.
 * AWS Cognito is the source of truth for email/TOTP/SMS attributes; DB is
 * the source of truth for hashed one-time recovery codes.
 */
export async function getMfaOptionsStatusAction(): Promise<MfaOptionsStatusResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      email: { available: false, enabled: false, source: 'AWS Cognito' },
      authenticator: { available: true, enabled: false, source: 'AWS Cognito TOTP' },
      recoveryCodes: { available: false, enabled: false, total: 0, unused: 0, source: 'PostgreSQL' },
      sms: { available: false, enabled: false, reason: 'Sesión no autenticada.', source: 'AWS Cognito SMS' },
      passkeys: { available: false, enabled: false, reason: 'WebAuthn no está configurado en esta instalación.', source: 'WebAuthn' },
    };
  }

  const [recoveryStatus, cognitoUser] = await Promise.all([
    getRecoveryCodesStatusAction(),
    getCognitoUser(user.sub).catch(() => null),
  ]);

  const emailAddress = normalizeEmailAddress(cognitoUser?.email || user.email);
  const emailEnabled = Boolean(emailAddress && cognitoUser?.emailVerified);
  const phoneReady = Boolean(cognitoUser?.phoneNumber && cognitoUser.phoneVerified);

  return {
    email: {
      available: Boolean(emailAddress),
      enabled: emailEnabled,
      address: emailAddress || undefined,
      source: 'AWS Cognito',
    },
    authenticator: {
      available: true,
      enabled: Boolean(cognitoUser?.mfaEnabled),
      source: 'AWS Cognito TOTP',
    },
    recoveryCodes: {
      available: Boolean(cognitoUser?.mfaEnabled),
      enabled: recoveryStatus.unused > 0,
      total: recoveryStatus.total,
      unused: recoveryStatus.unused,
      source: 'PostgreSQL',
    },
    sms: {
      available: false,
      enabled: false,
      reason: phoneReady
        ? 'El teléfono está verificado, pero SMS MFA no está habilitado en el User Pool.'
        : 'Requiere teléfono verificado y configuración SMS/IAM en AWS Cognito.',
      source: 'AWS Cognito SMS',
    },
    passkeys: {
      available: false,
      enabled: false,
      reason: 'Passkeys/WebAuthn requiere configuración adicional fuera del flujo actual de Cognito.',
      source: 'WebAuthn',
    },
  };
}
