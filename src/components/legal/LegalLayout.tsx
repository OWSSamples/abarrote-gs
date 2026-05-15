import { ReactNode } from 'react';
import NextLink from 'next/link';
import { LayerCard } from '@cloudflare/kumo/components/layer-card';
import { Text } from '@cloudflare/kumo/components/text';
import { SiteFooter } from '@/components/SiteFooter';

interface LegalLayoutProps {
  title: string;
  subtitle?: string;
  lastUpdated: string;
  effectiveDate: string;
  version: string;
  children: ReactNode;
}

export function LegalLayout({
  title,
  subtitle,
  lastUpdated,
  effectiveDate,
  version,
  children,
}: LegalLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col bg-kumo-canvas">
      <main className="flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {/* ── Header ── */}
          <header className="flex flex-col items-center gap-4 text-center">
            <NextLink href="/auth/login">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/login-brand.svg" alt="Kiosko" className="h-7 w-auto" />
            </NextLink>
            <div className="space-y-2">
              <Text variant="heading2" as="h1">
                {title}
              </Text>
              {subtitle ? (
                <Text variant="secondary" size="sm" as="p">
                  {subtitle}
                </Text>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <Text variant="secondary" size="xs" as="span">
                Versión {version}
              </Text>
              <Text variant="secondary" size="xs" as="span">
                Vigente desde: {effectiveDate}
              </Text>
              <Text variant="secondary" size="xs" as="span">
                Última actualización: {lastUpdated}
              </Text>
            </div>
          </header>

          {/* ── Content card ── */}
          <LayerCard className="rounded-xl p-6 shadow-[0_0_1px_0.5px_var(--color-kumo-shadow-edge),0_1px_2px_var(--color-kumo-shadow-drop)] sm:p-10">
            <article className="legal-prose space-y-6">{children}</article>
          </LayerCard>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
