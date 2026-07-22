'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { fetchAuthSession, getCurrentUser, signOut as cognitoSignOut } from '@/lib/cognito';
import { useRouter } from 'next/navigation';
import { Hub } from 'aws-amplify/utils';
import { logAuthEvent } from '@/lib/auth/auth-logger';
import {
  clearServerSession,
  synchronizeServerSession,
  type SessionSyncStatus,
} from '@/lib/auth/session-client';
import { SessionExpiredScreen } from '@/components/auth/SessionExpiredScreen';

// Cross-tab broadcast channel name. All app tabs receiving the same `signOut`/`signIn`
// message will react accordingly so the user is never left in an inconsistent state.
const AUTH_CHANNEL = 'kiosko-auth';
const AUTH_LOGIN_TIME_KEY = 'kiosko_login_time';
const AUTH_LAST_ACTIVITY_KEY = 'kiosko_last_activity';
const SESSION_IDLE_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const ACTIVITY_WRITE_INTERVAL_MS = 30 * 1000;

type AuthBroadcast =
  | { type: 'signOut' }
  | { type: 'signIn'; userId: string }
  | { type: 'sessionExpired' };

export interface CognitoUser {
  userId: string;
  username: string;
  email?: string;
  displayName?: string;
}

interface AuthContextType {
  user: CognitoUser | null;
  loading: boolean;
  sessionExpired: boolean;
  signOut: () => Promise<void>;
  refreshSession: (forceRefresh?: boolean) => Promise<SessionSyncStatus>;
  markSessionExpired: (reason?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  sessionExpired: false,
  signOut: async () => {},
  refreshSession: async () => 'unauthenticated',
  markSessionExpired: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function resolveUser(): Promise<CognitoUser | null> {
  try {
    const cognitoUser = await getCurrentUser();
    const session = await fetchAuthSession();
    const payload = session.tokens?.idToken?.payload;

    return {
      userId: cognitoUser.userId,
      username: cognitoUser.username,
      email: (payload?.email as string) || undefined,
      displayName:
        (payload?.['custom:display_name'] as string) || (payload?.name as string) || undefined,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [reauthenticating, setReauthenticating] = useState(false);
  const router = useRouter();
  const channelRef = useRef<BroadcastChannel | null>(null);
  const sessionExpiredRef = useRef(false);

  const markSessionExpired = useCallback(
    (reason = 'session_invalid') => {
      if (sessionExpiredRef.current) return;
      sessionExpiredRef.current = true;
      setSessionExpired(true);
      void logAuthEvent({ event: 'session_expired', userId: user?.userId, reason });
      channelRef.current?.postMessage({ type: 'sessionExpired' } satisfies AuthBroadcast);
    },
    [user?.userId],
  );

  // Cross-tab broadcast channel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (e: MessageEvent<AuthBroadcast>) => {
      const msg = e.data;
      if (msg.type === 'signOut') {
        // Another tab signed out — clear local state and redirect.
        setUser(null);
        void clearServerSession();
        localStorage.removeItem(AUTH_LOGIN_TIME_KEY);
        localStorage.removeItem(AUTH_LAST_ACTIVITY_KEY);
        sessionExpiredRef.current = false;
        setSessionExpired(false);
        void logAuthEvent({ event: 'sign_out', reason: 'cross_tab_broadcast' });
        router.push('/auth/login');
      } else if (msg.type === 'sessionExpired') {
        sessionExpiredRef.current = true;
        setSessionExpired(true);
      } else if (msg.type === 'signIn') {
        // Another tab signed in — refresh our state.
        void resolveUser().then((resolved) => {
          if (resolved) {
            setUser(resolved);
            sessionExpiredRef.current = false;
            setSessionExpired(false);
            localStorage.setItem(AUTH_LAST_ACTIVITY_KEY, Date.now().toString());
            void synchronizeServerSession(false);
          }
        });
      }
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [router]);

  // Initial auth check
  useEffect(() => {
    async function checkAuth() {
      let resolved = await resolveUser();
      if (resolved) {
        const syncStatus = await synchronizeServerSession(false);
        if (syncStatus === 'unauthenticated') resolved = null;
      }
      setUser(resolved);
      setLoading(false);

      if (resolved && !localStorage.getItem(AUTH_LOGIN_TIME_KEY)) {
        localStorage.setItem(AUTH_LOGIN_TIME_KEY, Date.now().toString());
      }
      if (resolved && !localStorage.getItem(AUTH_LAST_ACTIVITY_KEY)) {
        localStorage.setItem(AUTH_LAST_ACTIVITY_KEY, Date.now().toString());
      }
    }
    checkAuth();
  }, []);

  // Listen for Amplify Hub auth events
  useEffect(() => {
    const unsubscribe = Hub.listen('auth', async ({ payload }) => {
      switch (payload.event) {
        case 'signedIn': {
          const resolved = await resolveUser();
          if (resolved) {
            const syncStatus = await synchronizeServerSession(false);
            if (syncStatus === 'unauthenticated') {
              setUser(null);
              setLoading(false);
              break;
            }
            localStorage.setItem(AUTH_LOGIN_TIME_KEY, Date.now().toString());
            localStorage.setItem(AUTH_LAST_ACTIVITY_KEY, Date.now().toString());
            sessionExpiredRef.current = false;
            setSessionExpired(false);
            channelRef.current?.postMessage({ type: 'signIn', userId: resolved.userId } satisfies AuthBroadcast);
          }
          setUser(resolved);
          setLoading(false);
          break;
        }
        case 'signedOut':
          setUser(null);
          await clearServerSession();
          localStorage.removeItem(AUTH_LOGIN_TIME_KEY);
          localStorage.removeItem(AUTH_LAST_ACTIVITY_KEY);
          sessionExpiredRef.current = false;
          setSessionExpired(false);
          channelRef.current?.postMessage({ type: 'signOut' } satisfies AuthBroadcast);
          break;
        case 'tokenRefresh': {
          // Amplify already refreshed the token before emitting this event.
          // Forcing another refresh here creates a tokenRefresh feedback loop.
          const syncStatus = await synchronizeServerSession(false);
          if (syncStatus === 'established') {
            void logAuthEvent({ event: 'session_refresh' });
          }
          break;
        }
      }
    });
    return unsubscribe;
  }, []);

  const handleSignOut = useCallback(async () => {
    void logAuthEvent({ event: 'sign_out', userId: user?.userId, email: user?.email });
    await clearServerSession();
    localStorage.removeItem(AUTH_LOGIN_TIME_KEY);
    localStorage.removeItem(AUTH_LAST_ACTIVITY_KEY);
    channelRef.current?.postMessage({ type: 'signOut' } satisfies AuthBroadcast);
    await cognitoSignOut();
    router.push('/auth/login');
  }, [router, user]);

  // Refresh token/cookie every 50 min (Cognito tokens expire at 60 min).
  // Temporary network or rate-limit failures preserve the current session.
  useEffect(() => {
    if (!user || sessionExpired) return;
    const interval = setInterval(
      async () => {
        const syncStatus = await synchronizeServerSession(true);
        if (syncStatus === 'unauthenticated') markSessionExpired('token_refresh_failed');
      },
      50 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [user, sessionExpired, markSessionExpired]);

  // Track real user activity so active sessions are not closed by an absolute timer.
  useEffect(() => {
    if (!user || sessionExpired) return;

    let lastWrite = 0;
    const recordActivity = () => {
      const now = Date.now();
      const previousActivity = Number(
        localStorage.getItem(AUTH_LAST_ACTIVITY_KEY) ??
          localStorage.getItem(AUTH_LOGIN_TIME_KEY) ??
          now,
      );

      if (
        Number.isFinite(previousActivity) &&
        now - previousActivity >= SESSION_IDLE_TIMEOUT_MS
      ) {
        markSessionExpired('idle_timeout');
        return;
      }

      if (now - lastWrite < ACTIVITY_WRITE_INTERVAL_MS) return;
      lastWrite = now;
      localStorage.setItem(AUTH_LAST_ACTIVITY_KEY, now.toString());
    };

    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, recordActivity, { passive: true }),
    );

    const checkExpiration = () => {
      const lastActivity = Number(
        localStorage.getItem(AUTH_LAST_ACTIVITY_KEY) ??
          localStorage.getItem(AUTH_LOGIN_TIME_KEY) ??
          Date.now(),
      );

      if (Number.isFinite(lastActivity) && Date.now() - lastActivity >= SESSION_IDLE_TIMEOUT_MS) {
        markSessionExpired('idle_timeout');
      }
    };

    checkExpiration();
    const expInterval = setInterval(checkExpiration, 60 * 1000);
    return () => {
      clearInterval(expInterval);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
    };
  }, [user, sessionExpired, markSessionExpired]);

  // Validate when the user returns to a backgrounded tab instead of waiting for the next interval.
  useEffect(() => {
    if (!user || sessionExpired) return;

    const validateOnResume = async () => {
      if (document.visibilityState !== 'visible') return;
      const syncStatus = await synchronizeServerSession(false);
      if (syncStatus === 'unauthenticated') markSessionExpired('resume_validation_failed');
    };

    document.addEventListener('visibilitychange', validateOnResume);
    window.addEventListener('focus', validateOnResume);
    return () => {
      document.removeEventListener('visibilitychange', validateOnResume);
      window.removeEventListener('focus', validateOnResume);
    };
  }, [user, sessionExpired, markSessionExpired]);

  const refreshSession = useCallback(
    async (forceRefresh = false): Promise<SessionSyncStatus> => {
      if (!user) return 'unauthenticated';
      return synchronizeServerSession(forceRefresh);
    },
    [user],
  );

  const handleReauthentication = useCallback(async () => {
    if (reauthenticating) return;
    setReauthenticating(true);

    const returnTo = `${window.location.pathname}${window.location.search}`;
    const loginUrl = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

    try {
      await clearServerSession();
      await cognitoSignOut();
    } catch {
      // The local redirect remains available even if the upstream sign-out is unavailable.
    } finally {
      localStorage.removeItem(AUTH_LOGIN_TIME_KEY);
      localStorage.removeItem(AUTH_LAST_ACTIVITY_KEY);
      window.location.assign(loginUrl);
    }
  }, [reauthenticating]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionExpired,
        signOut: handleSignOut,
        refreshSession,
        markSessionExpired,
      }}
    >
      {children}
      {sessionExpired ? (
        <SessionExpiredScreen
          loading={reauthenticating}
          onReauthenticate={handleReauthentication}
        />
      ) : null}
    </AuthContext.Provider>
  );
}
