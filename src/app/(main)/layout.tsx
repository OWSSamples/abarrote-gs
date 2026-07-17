'use client';

/**
 * (main) Route Group Layout - Dashboard, Auth pages
 *
 * This layout includes AuthProvider for all authenticated routes.
 */

import { AuthProvider } from '@/lib/auth/AuthContext';
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
