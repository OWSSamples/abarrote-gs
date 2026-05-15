/**
 * Design System Tokens
 *
 * Centralized design tokens for Kiosko.
 * Maps to Polaris spacing/color tokens and adds brand-specific values.
 */

// ── Brand Colors ──
export const color = {
  brand: {
    primary: 'var(--blue-zodiac-500)',
    primaryHover: 'var(--blue-zodiac-800)',
    secondary: 'var(--atoll-500)',
    accent: 'var(--feijoa-500)',
  },
  status: {
    success: 'var(--p-color-text-success)',
    warning: 'var(--p-color-text-warning)',
    critical: 'var(--p-color-text-critical)',
    info: 'var(--p-color-text-info)',
  },
  surface: {
    default: 'var(--p-color-bg-surface)',
    subdued: 'var(--p-color-bg-surface-secondary)',
    hover: 'var(--p-color-bg-surface-hover)',
    active: 'var(--p-color-bg-surface-active)',
  },
} as const;

// ── Breakpoints (px) ──
export const breakpoint = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

// ── Polaris spacing tokens mapped for consistency ──
export const spacing = {
  '0': '0',
  '050': 'var(--p-space-050)',
  '100': 'var(--p-space-100)',
  '200': 'var(--p-space-200)',
  '300': 'var(--p-space-300)',
  '400': 'var(--p-space-400)',
  '500': 'var(--p-space-500)',
  '600': 'var(--p-space-600)',
  '800': 'var(--p-space-800)',
  '1000': 'var(--p-space-1000)',
  '1200': 'var(--p-space-1200)',
} as const;

// ── Typography scales ──
export const typography = {
  heading: {
    '2xl': { variant: 'heading2xl' as const, as: 'h1' as const },
    xl: { variant: 'headingXl' as const, as: 'h2' as const },
    lg: { variant: 'headingLg' as const, as: 'h3' as const },
    md: { variant: 'headingMd' as const, as: 'h4' as const },
    sm: { variant: 'headingSm' as const, as: 'h5' as const },
    xs: { variant: 'headingXs' as const, as: 'h6' as const },
  },
  body: {
    lg: { variant: 'bodyLg' as const },
    md: { variant: 'bodyMd' as const },
    sm: { variant: 'bodySm' as const },
    xs: { variant: 'bodyXs' as const },
  },
} as const;

// ── Z-index layers ──
export const zIndex = {
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  toast: 600,
  topBar: 700,
} as const;

// ── Animation durations ──
export const duration = {
  instant: 0,
  fast: 100,
  normal: 200,
  slow: 300,
  deliberate: 500,
} as const;

// ── Badge tone mapping by domain ──
export const badgeTone = {
  sale: {
    completed: 'success',
    pending: 'attention',
    cancelled: 'critical',
    refunded: 'warning',
  },
  stock: {
    ok: 'success',
    low: 'attention',
    critical: 'critical',
    expired: 'critical',
  },
  payment: {
    paid: 'success',
    pending: 'attention',
    failed: 'critical',
    refunded: 'warning',
  },
} as const;

export type BadgeToneMap = typeof badgeTone;
