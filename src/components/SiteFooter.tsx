'use client';

import Image from 'next/image';
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
  const { openPreferences } = useCookieConsent();
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

        <NextLink
          href="/cookies"
          onClick={(event) => {
            event.preventDefault();
            openPreferences();
          }}
          className="inline-flex items-center gap-1.5 hover:text-kumo-text-primary hover:underline"
        >
          <Image
            src="https://lx6h1myvbfcpag73.public.blob.vercel-storage.com/CDN-ASSETS/badges_trusth-Ss1QozX7JJwKeO0hoK5HDrUSuM4q7c.svg"
            alt=""
            aria-hidden="true"
            width={30}
            height={14}
            unoptimized
            className="h-3.5 w-[30px] shrink-0"
          />
          <span>Preferencias de cookies</span>
        </NextLink>

        <span aria-hidden="true" className="select-none text-gray-300">
          ·
        </span>

        <span className="whitespace-nowrap">© {year} Opendex Web Services</span>
      </nav>
    </footer>
  );
}
