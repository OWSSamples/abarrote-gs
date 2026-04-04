import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { fetchStoreConfig } from '@/app/actions/store-config-actions';
import { escapeHTML } from '@/app/actions/_notifications';
import { checkRateLimit, getClientIp } from '@/infrastructure/redis';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

/** Allowed Telegram bot commands */
const ALLOWED_COMMANDS = new Set(['/stock', '/inventario', 'stock']);

/** Rate limit: 10 requests per minute per IP */
const RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 } as const;

/**
 * Verifies the request originates from Telegram by checking the
 * secret token header. The token is set when registering the webhook
 * via `setWebhook` with `secret_token` parameter.
 *
 * @see https://core.telegram.org/bots/api#setwebhook
 */
function verifyTelegramSecret(req: NextRequest): boolean {
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('TELEGRAM_WEBHOOK_SECRET not configured — rejecting all webhook requests');
    return false;
  }

  const headerToken = req.headers.get('x-telegram-bot-api-secret-token');
  if (!headerToken) return false;

  // Constant-time comparison to prevent timing attacks
  if (secret.length !== headerToken.length) return false;
  let mismatch = 0;
  for (let i = 0; i < secret.length; i++) {
    mismatch |= secret.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting
    const ip = getClientIp(req);
    const rl = checkRateLimit(`telegram:webhook:${ip}`, RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    // 2. Verify Telegram secret token
    if (!verifyTelegramSecret(req)) {
      logger.warn('Telegram webhook rejected — invalid or missing secret token', { ip });
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const body = await req.json();

    // Telegram sends the message in body.message
    const message = body.message;
    if (!message || !message.text) return NextResponse.json({ ok: true });

    const chatId = String(message.chat?.id ?? '');
    const text = message.text.toLowerCase().trim();

    if (!chatId) return NextResponse.json({ ok: true });

    // 3. Verify chat ID matches configured store
    const config = await fetchStoreConfig();

    if (!config.telegramChatId || chatId !== config.telegramChatId) {
      logger.warn('Telegram webhook from unauthorized chatId', {
        receivedChatId: chatId,
        configuredChatId: config.telegramChatId ?? 'NOT_SET',
      });
      return NextResponse.json({ ok: true });
    }

    // 4. Handle allowed commands only
    if (ALLOWED_COMMANDS.has(text)) {
      const allProducts = await db.select().from(products);

      const stockList = allProducts
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => {
          const isLow = p.currentStock < p.minStock;
          const status = isLow ? ' [STOCK BAJO]' : '';
          return `• ${escapeHTML(p.name)} (${escapeHTML(p.sku)}): ${p.currentStock} ${escapeHTML(p.unit)}${status}`;
        })
        .join('\n');

      const responseText =
        `<b>SOLICITUD DE EXISTENCIAS RECIBIDA</b>\n\n` +
        `Total de productos: ${allProducts.length}\n` +
        `---------------------------------\n` +
        (stockList || 'No hay productos registrados.') +
        '\n' +
        `---------------------------------\n` +
        `Reporte generado el ${new Date().toLocaleDateString('es-MX')} a las ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;

      const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: 'HTML',
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Telegram webhook error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
