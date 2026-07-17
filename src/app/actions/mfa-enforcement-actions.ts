'use server';

import { cookies, headers } from 'next/headers';
import { verifyIdToken, getCognitoUser } from '@/lib/cognito-admin';
import { db } from '@/db';
import { userIdentities } from '@/db/schema';
import { eq } from 'drizzle-orm';

// ══════════════════════════════════════════════════════════════
// MFA ENFORCEMENT
// ══════════════════════════════════════════════════════════════

const MFA_GRACE_PERIOD_DAYS = 15;

export interface MfaEnforcementStatus {
  mfaEnabled: boolean;
  totpEnabled?: boolean;
  emailFactorEnabled?: boolean;
  daysRemaining: number | null; // null if MFA enabled
  graceExpired: boolean;
  noticeStartDate: string | null;
}

/**
 * Checks MFA enforcement status for the current authenticated user.
 * - If user doesn't have MFA: sets mfaNoticeAt (first notice) and returns days remaining.
 * - After 15 days: graceExpired = true (should force MFA setup).
 */
export async function checkMfaEnforcementAction(): Promise<MfaEnforcementStatus> {
  // Extract token from cookie
  const cookieStore = await cookies();
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : cookieStore.get('__session')?.value;

  if (!token) {
    return { mfaEnabled: true, daysRemaining: null, graceExpired: false, noticeStartDate: null };
  }

  let decoded;
  try {
    decoded = await verifyIdToken(token);
  } catch {
    return { mfaEnabled: true, daysRemaining: null, graceExpired: false, noticeStartDate: null };
  }

  const uid = decoded.sub;

  // Check user record in DB
  const rows = await db
    .select({
      mfaNoticeAt: userIdentities.mfaNoticeAt,
      cognitoSub: userIdentities.cognitoSub,
    })
    .from(userIdentities)
    .where(eq(userIdentities.cognitoSub, uid))
    .limit(1);

  if (rows.length === 0) {
    return { mfaEnabled: true, daysRemaining: null, graceExpired: false, noticeStartDate: null };
  }

  const user = rows[0];

  // Check MFA status directly from Cognito Admin API (reliable source of truth).
  // Token claims (amr, cognito:preferred_mfa_setting) are NOT included in
  // standard Cognito ID tokens without a pre-token-generation Lambda.
  let totpEnabled = false;
  let emailFactorEnabled = false;
  try {
    const cognitoUser = await getCognitoUser(uid);
    totpEnabled = cognitoUser.mfaEnabled;
    emailFactorEnabled = Boolean(cognitoUser.email && cognitoUser.emailVerified);
  } catch {
    // If we can't reach Cognito, assume MFA is enabled to avoid false enforcement
    return { mfaEnabled: true, daysRemaining: null, graceExpired: false, noticeStartDate: null };
  }

  const mfaEnabled = totpEnabled || emailFactorEnabled;

  if (mfaEnabled) {
    // User has MFA — clear notice if it was set
    if (user.mfaNoticeAt) {
      await db.update(userIdentities).set({ mfaNoticeAt: null }).where(eq(userIdentities.cognitoSub, user.cognitoSub));
    }
    return { mfaEnabled: true, totpEnabled, emailFactorEnabled, daysRemaining: null, graceExpired: false, noticeStartDate: null };
  }

  // User does NOT have MFA — enforce grace period
  const now = new Date();
  let noticeAt = user.mfaNoticeAt;

  if (!noticeAt) {
    // First time showing the notice — set the clock
    noticeAt = now;
    await db.update(userIdentities).set({ mfaNoticeAt: now }).where(eq(userIdentities.cognitoSub, user.cognitoSub));
  }

  const elapsedMs = now.getTime() - noticeAt.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, MFA_GRACE_PERIOD_DAYS - elapsedDays);
  const graceExpired = elapsedDays >= MFA_GRACE_PERIOD_DAYS;

  return {
    mfaEnabled: false,
    totpEnabled,
    emailFactorEnabled,
    daysRemaining,
    graceExpired,
    noticeStartDate: noticeAt.toISOString(),
  };
}
