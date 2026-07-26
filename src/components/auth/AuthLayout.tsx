'use client';

import { ReactNode } from 'react';
import { SiteFooter } from '@/components/SiteFooter';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  children: ReactNode;
  layered?: boolean;
  wide?: boolean;
}

export function AuthLayout({ children, layered = false, wide = false }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col bg-kumo-canvas">
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className={`${styles.shell} ${wide ? styles.wide : ''} space-y-6`}>
          {/* ── Logo ── */}
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/login-brand.svg" alt="Kiosko" className="h-8 w-auto" />
          </div>

          {/* ── Card ── */}
          <div className={`${styles.card} ${layered ? styles.layered : styles.padded}`}>
            {children}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
