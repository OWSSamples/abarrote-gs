'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';

export function useRequireAuth() {
  const { user, loading, refreshSession, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      if (!loading && !user) {
        router.push('/auth/login');
        return;
      }

      if (user) {
        try {
          const syncStatus = await refreshSession();
          if (syncStatus === 'unauthenticated') {
            console.warn('La sesión de Cognito ya no es válida. Cerrando sesión.');
            await signOut();
          } else if (syncStatus === 'unavailable') {
            console.warn('No fue posible sincronizar la sesión con el servidor. Se conservará la sesión actual.');
          }
        } catch (error) {
          console.error('Session validation failed:', error);
        }
      }
    };

    checkAuth();
  }, [user, loading, router, refreshSession, signOut]);

  return { user, loading };
}
