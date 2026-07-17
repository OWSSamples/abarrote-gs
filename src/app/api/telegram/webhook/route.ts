import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { products } from '@/db/schema';
import { getStoreConfigForStore } from '@/server/store-config-service';
import { escapeHTML } from '@/app/actions/_notifications';
import { checkRateLimit, getClientIp } from '@/infrastructure/redis';
import { logger } from '@/lib/logger';
import { constantTimeStringEqual } from '@/lib/constant-time';
import { readTextBodyWithLimit } from '@/lib/http/read-limited-body';
import { and, eq, isNull } from 'drizzle-orm';

/** Allowed Telegram bot commands */
const ALLOWED_COMMANDS = new Set(['/stock', '/inventario', 'stock']);

/** Rate limit: 10 requests per minute per IP */
const RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 } as const;
const MAX_WEBHOOK_BYTES = 32 * 1024;
const storeIdSchema = z.string().regex(/^(?:main|[a-f0-9]{32})$/);

const telegramUpdateSchema = z
  .object({
    message: z
      .object({
        text: z.string().max(1000).optional(),
        chat: z
          .object({
            id: z.union([z.string(), z.number()]).optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/**
 * Verifies the request originates from Telegram by checking the
 * secret token header. The token is set when registering the webhook
 * via `setWebhook` with `secret_token` parameter.
 *
 * @see https://core.telegram.org/bots/api#setwebhook
 */
function verifyTelegramSecret(req: NextRequest, secret: string | undefined): boolean {
  if (!secret) {
    logger.error('Telegram webhook secret not configured in platform settings');
    return false;
  }

  const headerToken = req.headers.get('x-telegram-bot-api-secret-token');
  if (!headerToken) return false;

  return constantTimeStringEqual(secret, headerToken);
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting
    const ip = getClientIp(req);
    const rl = checkRateLimit(`telegram:webhook:${ip}`, RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const url = new URL(req.url);
    const parsedStoreId = storeIdSchema.safeParse(url.searchParams.get('store'));
    if (!parsedStoreId.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const storeId = parsedStoreId.data;
    const config = await getStoreConfigForStore(storeId);
    if (!config) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    // 2. Verify Telegram secret token
    if (!verifyTelegramSecret(req, config.telegramWebhookSecret)) {
      logger.warn('Telegram webhook rejected — invalid or missing secret token', { ip });
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const body = await readTextBodyWithLimit(req, MAX_WEBHOOK_BYTES);
    if (body === null) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const parsed = telegramUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Telegram sends the message in body.message
    const message = parsed.data.message;
    if (!message || !message.text) return NextResponse.json({ ok: true });

    const chatId = String(message.chat?.id ?? '');
    const text = message.text.toLowerCase().trim();

    if (!chatId) return NextResponse.json({ ok: true });

    if (!config.telegramChatId || chatId !== config.telegramChatId) {
      logger.warn('Telegram webhook from unauthorized chatId', {
        hasReceivedChatId: Boolean(chatId),
        hasConfiguredChatId: Boolean(config.telegramChatId),
      });
      return NextResponse.json({ ok: true });
    }

    // 4. Handle allowed commands only
    if (ALLOWED_COMMANDS.has(text)) {
      const allProducts = await db
        .select()
        .from(products)
        .where(and(eq(products.storeId, storeId), isNull(products.deletedAt)));

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
