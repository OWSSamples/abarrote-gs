'use client';

import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react/ui';
import { authClient } from '@/lib/auth/client';

export function NeonAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      defaultTheme="light"
      redirectTo="/"
    >
      {children}
    </NeonAuthUIProvider>
  );
}
