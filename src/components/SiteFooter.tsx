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
            <svg
              className={`absolute h-3.5 w-4 transition-transform ${
                enabled ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
              viewBox="0 0 30 14"
              aria-hidden="true"
            >
              <path
                d="M7.4 12.8h6.8l3.1-11.6H7.4C4.2 1.2 1.6 3.8 1.6 7s2.6 5.8 5.8 5.8"
                fillRule="evenodd"
                clipRule="evenodd"
                fill="#fff"
              />
              <path
                d="M22.6 0H7.4c-3.9 0-7 3.1-7 7s3.1 7 7 7h15.2c3.9 0 7-3.1 7-7s-3.2-7-7-7m-21 7c0-3.2 2.6-5.8 5.8-5.8h9.9l-3.1 11.6H7.4c-3.2 0-5.8-2.6-5.8-5.8"
                fillRule="evenodd"
                clipRule="evenodd"
                fill="#06f"
              />
              <path
                d="M24.6 4c.2.2.2.6 0 .8L22.5 7l2.2 2.2c.2.2.2.6 0 .8s-.6.2-.8 0l-2.2-2.2-2.2 2.2c-.2.2-.6.2-.8 0s-.2-.6 0-.8L20.8 7l-2.2-2.2c-.2-.2-.2-.6 0-.8s.6-.2.8 0l2.2 2.2L23.8 4c.2-.2.6-.2.8 0"
                fill="#fff"
              />
              <path
                d="M12.7 4.1c.2.2.3.6.1.8L8.6 9.8c-.1.1-.2.2-.3.2-.2.1-.5.1-.7-.1L5.4 7.7c-.2-.2-.2-.6 0-.8s.6-.2.8 0L8 8.6l3.8-4.5c.2-.2.6-.2.9 0"
                fill="#06f"
              />
            </svg>
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
