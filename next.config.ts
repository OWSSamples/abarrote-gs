import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

/** ─── Security Headers ──────────────────────────────────────────────────────
 * NOTE: Content-Security-Policy is managed by proxy.ts (supports dev/prod variants).
 * These headers are set here as a fallback layer for routes the proxy may not cover
 * (e.g. Next.js internal routes, static asset error pages).
 */
const SECURITY_HEADERS = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '0',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(self), payment=()',
  },
  {
    key: 'X-Robots-Tag',
    value: 'noindex, nofollow',
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  transpilePackages: ['@shopify/polaris', '@shopify/polaris-icons'],
  serverExternalPackages: [
    // Firebase Admin (Node-only)
    'firebase-admin',
    'firebase-admin/app',
    'firebase-admin/auth',
    // Payment SDKs
    'mercadopago',
    'stripe',
    'conekta',
    'facturapi',
    // PDF / barcode generation (heavy, server-side rendering only)
    'jspdf',
    'jspdf-autotable',
    'fflate',
    'qrcode',
    'jsbarcode',
    // AWS SDK (huge — keep out of client bundle)
    '@aws-sdk/client-s3',
    '@aws-sdk/client-sesv2',
    '@aws-sdk/s3-request-presigner',
    // Database / cache / queue
    'postgres',
    'drizzle-orm',
    '@neondatabase/serverless',
    '@upstash/redis',
    '@upstash/ratelimit',
    '@upstash/qstash',
    '@upstash/search',
    // Mail / parsers / sockets
    'nodemailer',
    'csv-parse',
    'ws',
  ],
  compress: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kiosko-blob.s3.us-east-2.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.firebasestorage.app',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'svgl.app',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.svgl.app',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.simpleicons.org',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [40, 64, 96, 128, 256],
  },
  experimental: {
    // Per-import barrel splitting — drops ~hundreds of KB of dead Polaris/icon
    // exports from each client chunk. Add any new heavy barrel libs here.
    optimizePackageImports: [
      '@shopify/polaris',
      '@shopify/polaris-icons',
      '@shopify/polaris-viz',
      '@shopify/react-i18n',
      '@shopify/react-form',
      'lucide-react',
      'date-fns',
      'recharts',
      'radix-ui',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/modifiers',
      '@dnd-kit/utilities',
      'zustand',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
    ],
  },
  async headers() {
    return [
      {
        // Apply security headers to ALL routes
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
      {
        // Long-lived immutable cache for hashed Next assets
        source: '/_next/static/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // Public icons / illustrations served from /public
        source: '/(icon|illustrations)/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: 'opendex-inc',

  project: 'javascript-nextjs',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
