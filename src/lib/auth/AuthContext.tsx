'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { fetchAuthSession, getCurrentUser, signOut as cognitoSignOut } from '@/lib/cognito';
import { useRouter } from 'next/navigation';
import { Hub } from 'aws-amplify/utils';
import { logAuthEvent } from '@/lib/auth/auth-logger';

// Cross-tab broadcast channel name. All app tabs receiving the same `signOut`/`signIn`
// message will react accordingly so the user is never left in an inconsistent state.
const AUTH_CHANNEL = 'kiosko-auth';
const AUTH_LOGIN_TIME_KEY = 'kiosko_login_time';

type AuthBroadcast = { type: 'signOut' } | { type: 'signIn'; userId: string };

export interface CognitoUser {
  userId: string;
  username: string;
  email?: string;
  displayName?: string;
}

interface AuthContextType {
  user: CognitoUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  getIdToken: async () => null,
});

export function useAuth() {
  return useContext(AuthContext);
}

function buildSessionCookie(token: string): string {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  return `__session=${token}; path=/; max-age=3600; SameSite=Strict${isHttps ? '; Secure' : ''}`;
}

function clearSessionCookie(): void {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  document.cookie = `__session=; path=/; max-age=0; SameSite=Strict${isHttps ? '; Secure' : ''}`;
}

async function syncSessionCookie(forceRefresh = false): Promise<string | null> {
  try {
    const session = await fetchAuthSession({ forceRefresh });
    const idToken = session.tokens?.idToken?.toString();
    if (idToken) {
      document.cookie = buildSessionCookie(idToken);
      return idToken;
    }
  } catch (error) {
    console.error('Error syncing session cookie:', error);
  }
  return null;
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
  const router = useRouter();
  const channelRef = useRef<BroadcastChannel | null>(null);

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
        clearSessionCookie();
        localStorage.removeItem(AUTH_LOGIN_TIME_KEY);
        void logAuthEvent({ event: 'sign_out', reason: 'cross_tab_broadcast' });
        router.push('/auth/login');
      } else if (msg.type === 'signIn') {
        // Another tab signed in — refresh our state.
        void resolveUser().then((resolved) => {
          if (resolved) {
            setUser(resolved);
            void syncSessionCookie(true);
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
      const resolved = await resolveUser();
      if (resolved) {
        await syncSessionCookie(true);
      }
      setUser(resolved);
      setLoading(false);

      if (resolved && !localStorage.getItem(AUTH_LOGIN_TIME_KEY)) {
        localStorage.setItem(AUTH_LOGIN_TIME_KEY, Date.now().toString());
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
            await syncSessionCookie(true);
            localStorage.setItem(AUTH_LOGIN_TIME_KEY, Date.now().toString());
            channelRef.current?.postMessage({ type: 'signIn', userId: resolved.userId } satisfies AuthBroadcast);
          }
          setUser(resolved);
          setLoading(false);
          break;
        }
        case 'signedOut':
          setUser(null);
          clearSessionCookie();
          localStorage.removeItem(AUTH_LOGIN_TIME_KEY);
          channelRef.current?.postMessage({ type: 'signOut' } satisfies AuthBroadcast);
          break;
        case 'tokenRefresh':
          await syncSessionCookie(true);
          void logAuthEvent({ event: 'session_refresh' });
          break;
      }
    });
    return unsubscribe;
  }, []);

  // Refresh token/cookie every 50 min (Cognito tokens expire at 60 min)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(
      async () => {
        await syncSessionCookie(true);
      },
      50 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [user]);

  const handleSignOut = useCallback(async () => {
    void logAuthEvent({ event: 'sign_out', userId: user?.userId, email: user?.email });
    clearSessionCookie();
    localStorage.removeItem(AUTH_LOGIN_TIME_KEY);
    channelRef.current?.postMessage({ type: 'signOut' } satisfies AuthBroadcast);
    await cognitoSignOut();
    router.push('/auth/login');
  }, [router, user]);

  // Session expiration check (6 hours)
  useEffect(() => {
    if (!user) return;

    const checkExpiration = () => {
      const loginTimeStr = localStorage.getItem(AUTH_LOGIN_TIME_KEY);
      if (loginTimeStr) {
        const loginTime = parseInt(loginTimeStr, 10);
        const SIX_HOURS = 6 * 60 * 60 * 1000;

        if (Date.now() - loginTime > SIX_HOURS) {
          console.warn(
            'La sesión ha expirado por tiempo máximo (6 horas). Cerrando sesión...',
          );
          void logAuthEvent({ event: 'session_expired', userId: user?.userId, reason: 'absolute_lifetime' });
          handleSignOut();
        }
      }
    };

    checkExpiration();
    const expInterval = setInterval(checkExpiration, 60 * 1000);
    return () => clearInterval(expInterval);
  }, [user, handleSignOut]);

  const getIdToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      if (!user) return null;
      return syncSessionCookie(forceRefresh);
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}
