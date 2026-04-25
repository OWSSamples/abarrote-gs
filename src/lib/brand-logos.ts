/**
 * Brand logo registry — resuelve URL del logo de una marca.
 *
 * Estrategia (en orden de prioridad):
 * 1. Íconos locales en /public/icon (bancos MX, SPEI, etc.)
 * 2. Marcas regionales → S3 self-hosted
 * 3. Marcas globales → simpleicons.org CDN
 * 4. Sin match → null (componente muestra placeholder)
 */

const S3_PAYMENTS = 'https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/payments';

/**
 * Logos locales servidos desde /public/icon
 */
const LOCAL_ICONS: Record<string, string> = {
  // Bancos MX
  bbva: '/icon/bbva-logo_1.webp',
  santander: '/icon/banco-santander-logo_1.webp',
  banorte: '/icon/banorte-logo.webp',
  hsbc: '/icon/hsbc-logo-2018-.webp',
  spei: '/icon/spei-logo.webp',
  email: '/icon/email-sender.png',
  'email sender': '/icon/email-sender.png',

  // IA providers (logos oficiales locales)
  groq: '/icon/groq.svg',
  openrouter: '/icon/openrouter.svg',
  'open router': '/icon/openrouter.svg',
  gemini: '/icon/gemini.svg',
  'google gemini': '/icon/gemini.svg',
  'google ai': '/icon/gemini.svg',
  deepseek: '/icon/deepseek.svg',
  qwen: '/icon/qwen.svg',
  'qwen ai': '/icon/qwen.svg',
  alibaba: '/icon/qwen.svg',

  // Pagos (logos oficiales locales)
  'mercado pago': '/icon/mercadopago.svg',
  mercadopago: '/icon/mercadopago.svg',
  paypal: '/icon/paypal.svg',
  stripe: '/icon/stripe.svg',
};

/**
 * Slugs de Simple Icons (https://simpleicons.org).
 * URL: https://cdn.simpleicons.org/{slug}/{hex?}
 * Si se omite color, se usa el oficial de la marca.
 */
const SIMPLE_ICONS: Record<string, { slug: string; color?: string }> = {
  // Pagos globales
  stripe: { slug: 'stripe' },
  paypal: { slug: 'paypal' },
  mercadopago: { slug: 'mercadopago' },
  'mercado pago': { slug: 'mercadopago' },

  // Mensajería / notificaciones
  telegram: { slug: 'telegram' },
  whatsapp: { slug: 'whatsapp' },
  twilio: { slug: 'twilio' },
  resend: { slug: 'resend' },
  sendgrid: { slug: 'sendgrid' },
  slack: { slug: 'slack' },
  discord: { slug: 'discord' },

  // Auth / OAuth
  google: { slug: 'google' },
  microsoft: { slug: 'microsoft' },
  apple: { slug: 'apple' },
  github: { slug: 'github' },

  // IA
  openai: { slug: 'openai' },
  anthropic: { slug: 'anthropic' },
  groq: { slug: 'groq' },
  mistral: { slug: 'mistralai' },
  'mistral ai': { slug: 'mistralai' },
  deepseek: { slug: 'deepseek' },
  qwen: { slug: 'alibabacloud' },
  'google ai': { slug: 'google' },
  gemini: { slug: 'googlegemini' },

  // Cloud / infra
  vercel: { slug: 'vercel' },
  aws: { slug: 'amazonwebservices' },
  'amazon web services': { slug: 'amazonwebservices' },
  s3: { slug: 'amazons3' },
  firebase: { slug: 'firebase' },
  sentry: { slug: 'sentry' },
  cloudflare: { slug: 'cloudflare' },

  // Tech stack
  nextjs: { slug: 'nextdotjs' },
  'next.js': { slug: 'nextdotjs' },
  react: { slug: 'react' },
  typescript: { slug: 'typescript' },
  drizzle: { slug: 'drizzle' },
  postgresql: { slug: 'postgresql' },
  postgres: { slug: 'postgresql' },
  redis: { slug: 'redis' },
  upstash: { slug: 'upstash' },

  // Bancos MX (presentes en simpleicons)
  bbva: { slug: 'bbva' },
  santander: { slug: 'santander' },
  hsbc: { slug: 'hsbc' },
  scotiabank: { slug: 'scotiabank' },
  banamex: { slug: 'citi' }, // Citibanamex
  citi: { slug: 'citi' },
};

/**
 * Marcas regionales sin presencia en simpleicons → self-hosted S3.
 */
const SELF_HOSTED: Record<string, string> = {
  clip: `${S3_PAYMENTS}/clip.png`,
  conekta: `${S3_PAYMENTS}/conekta.png`,
  codi: `${S3_PAYMENTS}/codi.png`,
};

/**
 * Resuelve la URL del logo para una marca.
 * Devuelve null si no hay match.
 */
export function getBrandLogoUrl(name: string): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();

  // 1. Íconos locales (máxima prioridad — son los oficiales)
  const local = LOCAL_ICONS[key];
  if (local) return local;

  // 2. Marcas regionales en S3
  const selfHosted = SELF_HOSTED[key];
  if (selfHosted) return selfHosted;

  // 3. Simple Icons CDN
  const entry = SIMPLE_ICONS[key];
  if (entry) {
    const color = entry.color ? `/${entry.color}` : '';
    return `https://cdn.simpleicons.org/${entry.slug}${color}`;
  }

  return null;
}
