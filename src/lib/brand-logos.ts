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
import mercadoPago from 'thesvg/mercado-pago';
import microsoft from 'thesvg/microsoft';
import mistral from 'thesvg/mistral';
import neon from 'thesvg/neon';
import nextjs from 'thesvg/nextjs';
import openai from 'thesvg/openai';
import openrouter from 'thesvg/openrouter';
import paypal from 'thesvg/paypal';
import postgresql from 'thesvg/postgresql';
import qwen from 'thesvg/qwen';
import react from 'thesvg/react';
import redis from 'thesvg/redis';
import resend from 'thesvg/resend';
import santander from 'thesvg/santander';
import sentry from 'thesvg/sentry';
import shopify from 'thesvg/shopify';
import slack from 'thesvg/slack';
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

const BRAND_LOGOS: Record<string, BrandLogoAsset> = {
  // Banks
  bbva,
  santander,
  hsbc,
  banorte: { title: 'Banorte', url: '/icon/banorte-logo.webp' },

  // Payments
  'mercado pago': mercadoPago,
  mercadopago: mercadoPago,
  paypal,
  stripe,
  conekta,
  spei: { title: 'SPEI', url: '/icon/spei-logo.webp' },
  'spei clabe': { title: 'SPEI', url: '/icon/spei-logo.webp' },

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
