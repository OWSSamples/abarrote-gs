'use client';

import NextLink from 'next/link';
import { Switch } from '@cloudflare/kumo/components/switch';
import { useCookieConsent } from '@/components/cookies/CookieConsentProvider';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const LINKS: FooterLink[] = [
  { label: 'Términos y condiciones', href: '/terms' },
  { label: 'Aviso de privacidad', href: '/privacy' },
  { label: 'Política de cookies', href: '/cookies' },
];

export function SiteFooter() {
  const { preferences, openPreferences } = useCookieConsent();
  const enabled =
    preferences.functional || preferences.analytics || preferences.marketing;
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="w-full border-t border-gray-200/60 bg-kumo-canvas px-4 py-4 sm:px-6"
    >
      <nav
        aria-label="Pie de página"
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-kumo-text-secondary"
      >
        {LINKS.map((link, i) => (
          <span key={link.href} className="flex items-center gap-x-3">
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-kumo-text-primary hover:underline"
              >
                {link.label}
              </a>
            ) : (
              <NextLink
                href={link.href}
                className="hover:text-kumo-text-primary hover:underline"
              >
                {link.label}
              </NextLink>
            )}
            {i < LINKS.length - 1 ? (
              <span aria-hidden="true" className="select-none text-gray-300">
                ·
              </span>
            ) : null}
          </span>
        ))}

        <span aria-hidden="true" className="select-none text-gray-300">
          ·
        </span>

        <Switch
          checked={enabled}
          label="Preferencias de cookies"
          size="sm"
          onCheckedChange={openPreferences}
          className="shrink-0"
        />

        <span aria-hidden="true" className="select-none text-gray-300">
          ·
        </span>

        <span className="whitespace-nowrap">© {year} Opendex Web Services</span>
      </nav>
    </footer>
  );
}
