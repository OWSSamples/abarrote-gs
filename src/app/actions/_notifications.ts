// Internal notification helper — not a server action, just a utility
// used by domain action modules that need to send Telegram alerts.
//
// When QStash is available, notifications are offloaded to a background
// job so the caller (e.g. createSale) returns immediately without
// waiting for the Telegram API. Falls back to inline sending otherwise.

import { fetchStoreConfig } from './store-config-actions';
import { logger } from '@/lib/logger';
import { publishJob } from '@/infrastructure/qstash';
import { telegramBreaker, CircuitOpenError } from '@/infrastructure/circuit-breaker';
import { isFeatureEnabled } from '@/infrastructure/feature-flags';

/**
 * Escapes characters that would break Telegram HTML parse mode.
 */
export function escapeHTML(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sends a Telegram notification.
 *
 * - QStash available → publishes to background job (instant return)
 * - QStash unavailable → sends inline (waits for Telegram API)
 */
export async function sendNotification(message: string): Promise<void> {
  // Feature flag gate — allows disabling all notifications
  const notificationsEnabled = await isFeatureEnabled('telegram-notifications');
  if (!notificationsEnabled) return;

  try {
    await publishJob(
      'notification',
      { message },
      { retries: 3 },
      // Inline fallback when QStash is not configured
      async () => sendNotificationInline(message),
    );
  } catch (error) {
    logger.error('Error dispatching notification', {
      action: 'notification_dispatch_error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Direct inline Telegram send — used as QStash fallback. */
async function sendNotificationInline(message: string): Promise<void> {
  const config = await fetchStoreConfig();

  if (!config.enableNotifications) return;
  if (!config.telegramToken || !config.telegramChatId) {
    logger.warn('Telegram notifications enabled but token/chatId missing');
    return;
  }

  const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;

  await telegramBreaker.execute(async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Telegram API error', {
        action: 'telegram_api_error',
        status: response.status,
        statusText: response.statusText,
        errorData,
      });
      throw new Error(`Telegram API ${response.status}: ${response.statusText}`);
    }
  });
}
