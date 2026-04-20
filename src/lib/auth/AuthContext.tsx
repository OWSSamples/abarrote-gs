'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
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

/**
 * Sets the __session cookie with the Firebase ID token.
 * This cookie is read by server-side code (Server Actions, API routes)
 * to authenticate requests.
 *
 * IMPORTANT: We only SET the cookie when a user is present.
 * We DO NOT clear the cookie here - that's only done on explicit logout.
 * This prevents race conditions where a new tab briefly reports user=null
 * before Firebase auth state is restored, which would clear the shared cookie.
 */
async function syncSessionCookie(user: User | null, forceRefresh = false) {
  if (user) {
    try {
      const token = await user.getIdToken(forceRefresh);
      document.cookie = buildSessionCookie(token);
    } catch (error) {
      console.error('Error setting session cookie:', error);
    }
  }
  // NOTE: Cookie clearing is ONLY done in handleSignOut(), not here.
  // This prevents new tabs/windows from accidentally clearing the shared cookie.
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        // Force-refresh on first auth to guarantee a fresh token in the cookie.
        // Cached tokens from previous sessions may have expired or been invalidated.
        await syncSessionCookie(user, true);
      }

      setUser(user);
      setLoading(false);

      // Only manage login time when we POSITIVELY have a user.
      // We do NOT clear localStorage on user=null here because new tabs
      // may briefly report null before Firebase restores auth state.
      // Cleanup of localStorage is done only in handleSignOut().
      if (user && !localStorage.getItem('kiosko_login_time')) {
        localStorage.setItem('kiosko_login_time', Date.now().toString());
      }
    });
    return unsubscribe;
  }, []);

  // Refresh the token/cookie periodically (every 50 min, tokens expire at 60 min)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(
      async () => {
        try {
          await user.getIdToken(true); // Force refresh
          await syncSessionCookie(user);
        } catch {
          // Token refresh failed — user might be signed out
        }
      },
      50 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [user]);

  const handleSignOut = useCallback(async () => {
    clearSessionCookie();
    localStorage.removeItem('kiosko_login_time');
    await firebaseSignOut(auth);
    router.push('/auth/login');
  }, [router]);

  // Checar la expiración de sesión cada minuto (6 horas = 21600000 ms)
  useEffect(() => {
    if (!user) return;

    const checkExpiration = () => {
      const loginTimeStr = localStorage.getItem('kiosko_login_time');
      if (loginTimeStr) {
        const loginTime = parseInt(loginTimeStr, 10);
        const SIX_HOURS = 6 * 60 * 60 * 1000;

        if (Date.now() - loginTime > SIX_HOURS) {
          console.warn('La sesión ha expirado por tiempo máximo (6 horas). Cerrando sesión...');
          handleSignOut();
        }
      }
    };

    checkExpiration();
    const expInterval = setInterval(checkExpiration, 60 * 1000); // 1 min check

    return () => clearInterval(expInterval);
  }, [user, handleSignOut]);

  const getIdToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      if (!user) return null;
      try {
        const token = await user.getIdToken(forceRefresh);
        document.cookie = buildSessionCookie(token);
        return token;
      } catch {
        return null;
      }
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}
