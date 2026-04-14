// Internal notification helper — not a server action, just a utility
// used by domain action modules that need to send Telegram + Email alerts.
//
// When QStash is available, notifications are offloaded to a background
// job so the caller (e.g. createSale) returns immediately without
// waiting for the Telegram API. Falls back to inline sending otherwise.
//
// Email notifications run in parallel alongside Telegram (fire-and-forget).

import { fetchStoreConfig } from './store-config-actions';
import { logger } from '@/lib/logger';
import { publishJob } from '@/infrastructure/qstash';
import { telegramBreaker } from '@/infrastructure/circuit-breaker';
import { isFeatureEnabled } from '@/infrastructure/feature-flags';
import { sendEmail } from '@/lib/email';
import { alertEmailTemplate, type AlertEmailData } from '@/lib/email-templates';

/**
 * Escapes characters that would break Telegram HTML parse mode.
 */
export function escapeHTML(text: string): string {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

// ══════════════════════════════════════════════════════════════
// EMAIL CHANNEL
// ══════════════════════════════════════════════════════════════

/**
 * Sends an email notification to all configured recipients.
 * Uses store config for from, recipients, and branding.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function sendEmailAlert(alertData: Omit<AlertEmailData, 'storeName' | 'logoUrl' | 'accentColor'>): Promise<void> {
  try {
    const config = await fetchStoreConfig();

    if (!config.emailEnabled || !config.emailFrom || !config.emailRecipients) return;

    const recipients = config.emailRecipients
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (recipients.length === 0) return;

    const template = alertEmailTemplate({
      ...alertData,
      storeName: config.storeName,
      logoUrl: config.logoUrl,
      accentColor: config.emailAccentColor,
    });

    const fromName = config.emailFromName || config.storeName;

    await Promise.allSettled(
      recipients.map((to) =>
        sendEmail(
          { to, subject: template.subject, html: template.html, text: template.text, replyTo: config.emailReplyTo },
          config.emailFrom!,
          fromName,
        ),
      ),
    );
  } catch (error) {
    logger.error('Email alert dispatch failed', {
      action: 'email_alert_error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
