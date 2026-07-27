import alibaba from 'thesvg/alibaba';
import amazonWebServices from 'thesvg/amazon-web-services';
import anthropic from 'thesvg/anthropic';
import apple from 'thesvg/apple';
import awsAmazonCognito from 'thesvg/aws-amazon-cognito';
import azureSendgridAccounts from 'thesvg/azure-sendgrid-accounts';
import bbva from 'thesvg/bbva';
import claude from 'thesvg/claude';
import cloudflare from 'thesvg/cloudflare';
import conekta from 'thesvg/conekta';
import deepseek from 'thesvg/deepseek';
import discord from 'thesvg/discord';
import drizzle from 'thesvg/drizzle';
import gemini from 'thesvg/gemini';
import github from 'thesvg/github';
import google from 'thesvg/google';
import googleCloud from 'thesvg/google-cloud';
import googleGemini from 'thesvg/google-gemini';
import groq from 'thesvg/groq';
import hsbc from 'thesvg/hsbc';
import microsoft from 'thesvg/microsoft';
import mistral from 'thesvg/mistral';
import neon from 'thesvg/neon';
import nextjs from 'thesvg/nextjs';
import openai from 'thesvg/openai';
import openrouter from 'thesvg/openrouter';
import postgresql from 'thesvg/postgresql';
import qwen from 'thesvg/qwen';
import react from 'thesvg/react';
import redis from 'thesvg/redis';
import resend from 'thesvg/resend';
import santander from 'thesvg/santander';
import sentry from 'thesvg/sentry';
import shopify from 'thesvg/shopify';
import slack from 'thesvg/slack';
import speiLogo from 'thesvg/spei-logo';
import stripe from 'thesvg/stripe';
import telegram from 'thesvg/telegram';
import twilio from 'thesvg/twilio';
import typescript from 'thesvg/typescript';
import upstash from 'thesvg/upstash';
import vercel from 'thesvg/vercel';
import whatsapp from 'thesvg/whatsapp';

export interface BrandLogoAsset {
  title: string;
  svg?: string;
  url?: string;
  hex?: string;
  variants?: Partial<Record<'default' | 'light' | 'dark' | 'wordmark', string>>;
}

const SHOPIFY_PAYMENT_ICON_CDN = 'https://cdn.shopify.com/shopifycloud/admin-ui-foundations/payment-icons';

const shopifyPaymentIcon = (file: string, title: string): BrandLogoAsset => ({
  title,
  url: `${SHOPIFY_PAYMENT_ICON_CDN}/${file}.svg`,
});

const PAYMENT_ICONS = {
  'american express': shopifyPaymentIcon('94ba1', 'American Express'),
  mastercard: shopifyPaymentIcon('0554e', 'Mastercard'),
  visa: shopifyPaymentIcon('ea833', 'Visa'),
  discover: shopifyPaymentIcon('d50d6', 'Discover'),
  jcb: shopifyPaymentIcon('06a40', 'JCB'),
  'diners club': shopifyPaymentIcon('267b2', 'Diners Club'),
  'dinners club': shopifyPaymentIcon('267b2', 'Diners Club'),
  maestro: shopifyPaymentIcon('0878f', 'Maestro'),
  'unionpay': shopifyPaymentIcon('b21a3', 'UnionPay'),
  'union pay': shopifyPaymentIcon('b21a3', 'UnionPay'),
  'apple pay': shopifyPaymentIcon('6620d', 'Apple Pay'),
  'google pay': shopifyPaymentIcon('5ab4c', 'Google Pay'),
  elo: shopifyPaymentIcon('10401', 'Elo'),
  hypercard: shopifyPaymentIcon('d5b54', 'HyperCard'),
  hyper: shopifyPaymentIcon('e0f7e', 'Hyper'),
  omannet: shopifyPaymentIcon('6032b', 'OmanNet'),
  mada: shopifyPaymentIcon('37bf6', 'Mada'),
  benefit: shopifyPaymentIcon('e90d6', 'Benefit'),
  paypal: shopifyPaymentIcon('4e117', 'PayPal'),
  'paypal express': shopifyPaymentIcon('4e117', 'PayPal Express'),
  'shop pay': shopifyPaymentIcon('4e117', 'Shop Pay'),
  oxxo: shopifyPaymentIcon('215bc', 'OXXO'),
  bbva: shopifyPaymentIcon('8a755', 'BBVA'),
  aplazo: shopifyPaymentIcon('1f703', 'Aplazo'),
  'circle k': shopifyPaymentIcon('d7eb8', 'Circle K'),
  'coppel pay': shopifyPaymentIcon('dde78', 'Coppel Pay'),
  'cash to pay': shopifyPaymentIcon('de58e', 'Cash to Pay'),
  'mercado pago': shopifyPaymentIcon('c8dd7', 'Mercado Pago'),
  mercadopago: shopifyPaymentIcon('c8dd7', 'Mercado Pago'),
  clip: shopifyPaymentIcon('36a9b', 'Clip'),
  santander: shopifyPaymentIcon('a07f2', 'Santander'),
  scotiabank: shopifyPaymentIcon('66e62', 'Scotiabank'),
  efectivo: shopifyPaymentIcon('ceff8', 'Efectivo'),
  klarna: shopifyPaymentIcon('274d1', 'Klarna'),
  afterpay: shopifyPaymentIcon('26374', 'Afterpay'),
  paysera: shopifyPaymentIcon('b014a', 'Paysera'),
  'uae visa credit': shopifyPaymentIcon('34d8f', 'UAE Visa Credit'),
} satisfies Record<string, BrandLogoAsset>;

const BRAND_LOGOS: Record<string, BrandLogoAsset> = {
  // Banks
  bbva,
  santander,
  hsbc,
  banorte: { title: 'Banorte', url: '/icon/banorte-logo.webp' },

  // Payments
  ...PAYMENT_ICONS,
  stripe,
  conekta,
  spei: speiLogo,
  'spei clabe': speiLogo,

  // AI
  groq,
  openrouter,
  gemini,
  'google gemini': googleGemini,
  'google ai': googleGemini,
  deepseek,
  qwen,
  'qwen ai': qwen,
  'qwen alibaba': qwen,
  'qwen (alibaba)': qwen,
  alibaba,
  'alibaba cloud': alibaba,
  openai,
  'open ai': openai,
  anthropic,
  claude,
  mistral,
  'mistral ai': mistral,

  // Cloud / infrastructure
  vercel,
  aws: amazonWebServices,
  'amazon web services': amazonWebServices,
  amazon: amazonWebServices,
  'google cloud': googleCloud,
  googlecloud: googleCloud,
  gcp: googleCloud,
  shopify,
  cognito: awsAmazonCognito,
  'aws cognito': awsAmazonCognito,
  cloudflare,
  sentry,
  upstash,
  postgres: postgresql,
  postgresql,
  'neon postgres': neon,
  neon,
  redis,

  // Tech stack
  nextjs,
  'next.js': nextjs,
  next: nextjs,
  react,
  typescript,
  drizzle,

  // Auth / OAuth
  google,
  microsoft,
  apple,
  github,

  // Messaging / notifications
  telegram,
  whatsapp,
  twilio,
  resend,
  sendgrid: azureSendgridAccounts,
  slack,
  discord,
};

export function getBrandLogo(name: string): BrandLogoAsset | null {
  if (!name) return null;
  return BRAND_LOGOS[name.trim().toLowerCase()] ?? null;
}
