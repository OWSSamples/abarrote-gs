import Script from 'next/script';

const DEFAULT_SENTRY_CDN_LOADER_SRC = 'https://js.sentry-cdn.com/61a0806d340cda598ae45b90ded47da4.min.js';

export function SentryCdnLoader() {
  const enabled =
    process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_CDN_LOADER_ENABLED !== 'false';

  if (!enabled) return null;

  return (
    <Script
      id="sentry-cdn-loader"
      src={process.env.NEXT_PUBLIC_SENTRY_CDN_LOADER_SRC ?? DEFAULT_SENTRY_CDN_LOADER_SRC}
      strategy="lazyOnload"
      crossOrigin="anonymous"
    />
  );
}
