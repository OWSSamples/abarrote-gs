'use client';

import NextLink from 'next/link';
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

        {/* Abre el modal de preferencias */}
        <button
          type="button"
          aria-label="Abrir preferencias de cookies"
          onClick={openPreferences}
          className="group inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <span
            aria-hidden="true"
            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded transition-colors ${
              enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-2.5 w-3 transform rounded-sm bg-white shadow transition-transform ${
                enabled ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
            />
          </span>
          Preferencias de cookies
        </button>

        <span aria-hidden="true" className="select-none text-gray-300">
          ·
        </span>

        <span className="whitespace-nowrap">© {year} Opendex Web Services</span>
      </nav>
    </footer>
  );
}
