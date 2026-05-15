'use client';

import { ReactNode } from 'react';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { SiteFooter } from '@/components/SiteFooter';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col bg-kumo-canvas">
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-[420px] space-y-6">
          {/* ── Logo ── */}
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/login-brand.svg" alt="Kiosko" className="h-8 w-auto" />
          </div>

          {/* ── Card ── */}
          <LayerCard className="rounded-xl p-6 shadow-[0_0_1px_0.5px_var(--color-kumo-shadow-edge),0_1px_2px_var(--color-kumo-shadow-drop)]">
            {children}
          </LayerCard>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
