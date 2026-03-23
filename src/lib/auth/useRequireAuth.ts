'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';

export function useRequireAuth() {
  const { user, loading, getIdToken, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      if (!loading && !user) {
        router.push('/auth/login');
        return;
      }

      if (user) {
        try {
          // Attempt to get token, this will reveal if session is truly valid
          const token = await getIdToken();
          if (!token) {
            console.warn('Invalid session token detected. Kicking out...');
            await signOut();
            router.push('/auth/login');
          }
        } catch (error) {
          console.error('Session validation failed:', error);
          await signOut();
          router.push('/auth/login');
        }
      }
    };

    checkAuth();
  }, [user, loading, router, getIdToken, signOut]);

  return { user, loading };
}
