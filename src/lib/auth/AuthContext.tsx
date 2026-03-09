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
  signOut: async () => { },
  getIdToken: async () => null,
});

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Sets the __session cookie with the Firebase ID token.
 * This cookie is read by server-side code (Server Actions, API routes)
 * to authenticate requests.
 */
async function syncSessionCookie(user: User | null) {
  if (user) {
    try {
      const token = await user.getIdToken();
      // Set cookie via document.cookie (httpOnly=false so JS can set it,
      // but server reads it). SameSite=Strict for CSRF protection.
      document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Strict; Secure`;
    } catch (error) {
      console.error('Error setting session cookie:', error);
    }
  } else {
    // Clear cookie on logout
    document.cookie = '__session=; path=/; max-age=0';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      setUser(user);
      setLoading(false);
      await syncSessionCookie(user);
    });
    return unsubscribe;
  }, []);

  // Refresh the token/cookie periodically (every 50 min, tokens expire at 60 min)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        await user.getIdToken(true); // Force refresh
        await syncSessionCookie(user);
      } catch {
        // Token refresh failed — user might be signed out
      }
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSignOut = useCallback(async () => {
    document.cookie = '__session=; path=/; max-age=0';
    await firebaseSignOut(auth);
    router.push('/auth/login');
  }, [router]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}
