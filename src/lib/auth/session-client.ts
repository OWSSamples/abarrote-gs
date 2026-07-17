'use client';

import { fetchAuthSession } from '@/lib/cognito';

export type SessionSyncStatus = 'established' | 'unauthenticated' | 'unavailable';

let synchronizationInFlight: Promise<SessionSyncStatus> | null = null;

function isUnauthenticatedError(error: unknown): boolean {
  const name = (error as { name?: string })?.name;
  return name === 'UserUnAuthenticatedException' || name === 'NotAuthorizedException';
}

async function performServerSessionSynchronization(forceRefresh: boolean): Promise<SessionSyncStatus> {
  try {
    const session = await fetchAuthSession({ forceRefresh });
    const token = session.tokens?.idToken?.toString();
    if (!token) return 'unauthenticated';

    const response = await fetch('/api/auth/session', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (response.ok) return 'established';
    if (response.status === 401) return 'unauthenticated';

    // Rate limits, origin/configuration failures and server outages must not
    // destroy a valid Cognito session. The caller can retry synchronization.
    return 'unavailable';
  } catch (error) {
    return isUnauthenticatedError(error) ? 'unauthenticated' : 'unavailable';
  }
}

export function synchronizeServerSession(forceRefresh = false): Promise<SessionSyncStatus> {
  if (synchronizationInFlight) return synchronizationInFlight;

  const request = performServerSessionSynchronization(forceRefresh).finally(() => {
    if (synchronizationInFlight === request) synchronizationInFlight = null;
  });
  synchronizationInFlight = request;
  return request;
}

export async function clearServerSession(): Promise<void> {
  try {
    await fetch('/api/auth/session', {
      method: 'DELETE',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    // Cognito sign-out still proceeds; an expired server cookie is rejected by token verification.
  }
}
