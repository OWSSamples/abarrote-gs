/**
 * Brand logo registry — resuelve URL del logo de una marca.
 *
 * Estrategia (en orden de prioridad):
 * 1. Íconos locales en /public/icon
 * 2. Marcas regionales → S3 self-hosted
 * 3. Sin match → null (componente muestra placeholder)
 *
 * NO se usa CDN de simpleicons.org. Todos los logos viven en /public/icon.
 */

const S3_PAYMENTS = 'https://kiosko-blob.s3.us-east-2.amazonaws.com/logos/payments';

/**
 * Logos locales servidos desde /public/icon
 */
const LOCAL_ICONS: Record<string, string> = {
  // ─── Bancos MX ───
  bbva: '/icon/bbva-logo_1.webp',
  santander: '/icon/banco-santander-logo_1.webp',
  banorte: '/icon/banorte-logo.webp',
  hsbc: '/icon/hsbc-logo-2018-.webp',
  spei: '/icon/spei-logo.webp',

  // ─── Email ───
  email: '/icon/email-sender.png',
  'email sender': '/icon/email-sender.png',

  // ─── Pagos ───
  'mercado pago': '/icon/mercadopago.svg',
  mercadopago: '/icon/mercadopago.svg',
  paypal: '/icon/paypal.svg',
  stripe: '/icon/stripe.svg',

  // ─── IA ───
  groq: '/icon/groq.svg',
  openrouter: '/icon/openrouter.svg',
  'open router': '/icon/openrouter.svg',
  gemini: '/icon/gemini.svg',
  'google gemini': '/icon/gemini.svg',
  'google ai': '/icon/gemini.svg',
  deepseek: '/icon/deepseek.svg',
  qwen: '/icon/qwen.svg',
  'qwen ai': '/icon/qwen.svg',
  'qwen (alibaba)': '/icon/qwen.svg',
  alibaba: '/icon/qwen.svg',
  'alibaba cloud': '/icon/qwen.svg',
  openai: '/icon/openai.svg',
  'open ai': '/icon/openai.svg',
  anthropic: '/icon/anthropic.svg',
  claude: '/icon/claude.svg',
  mistral: '/icon/mistral.svg',
  'mistral ai': '/icon/mistral.svg',

  // ─── Cloud / Infraestructura ───
  vercel: '/icon/vercel.svg',
  aws: '/icon/aws.svg',
  'amazon web services': '/icon/aws.svg',
  amazon: '/icon/aws.svg',
  'google cloud': '/icon/google-cloud.svg',
  googlecloud: '/icon/google-cloud.svg',
  gcp: '/icon/google-cloud.svg',
  shopify: '/icon/shopify.svg',
  firebase: '/icon/firebase.svg',
  cloudflare: '/icon/cloudflare.svg',
  sentry: '/icon/sentry.svg',
  upstash: '/icon/upstash.svg',
  postgres: '/icon/postgresql.svg',
  postgresql: '/icon/postgresql.svg',
  'neon postgres': '/icon/neon.svg',
  neon: '/icon/neon.svg',
  redis: '/icon/redis.svg',

  // ─── Tech stack ───
  nextjs: '/icon/nextjs.svg',
  'next.js': '/icon/nextjs.svg',
  next: '/icon/nextjs.svg',
  react: '/icon/react.svg',
  typescript: '/icon/typescript.svg',
  drizzle: '/icon/drizzle.svg',

  // ─── Auth / OAuth ───
  google: '/icon/google.svg',
  microsoft: '/icon/microsoft.svg',
  apple: '/icon/apple.svg',
  github: '/icon/github.svg',

  // ─── Mensajería / notificaciones ───
  telegram: '/icon/telegram.svg',
  whatsapp: '/icon/whatsapp.svg',
  twilio: '/icon/twilio.svg',
  resend: '/icon/resend.svg',
  sendgrid: '/icon/sendgrid.svg',
  slack: '/icon/slack.svg',
  discord: '/icon/discord.svg',
};

/**
 * Marcas regionales sin logo local → self-hosted S3.
 */
const SELF_HOSTED: Record<string, string> = {
  clip: `${S3_PAYMENTS}/clip.png`,
  conekta: `${S3_PAYMENTS}/conekta.png`,
  codi: `${S3_PAYMENTS}/codi.png`,
};

/**
 * Resuelve la URL del logo para una marca.
 * Devuelve null si no hay match (el componente debe renderizar placeholder).
 */
export function getBrandLogoUrl(name: string): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();

  const local = LOCAL_ICONS[key];
  if (local) return local;

  const selfHosted = SELF_HOSTED[key];
  if (selfHosted) return selfHosted;

  return null;
}
