import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// Job Handlers — Pure execution logic for background jobs
// ══════════════════════════════════════════════════════════════
//
// These functions are called by the /api/jobs/* routes.
// They contain the actual work — no auth/verification logic.

/**
 * Sends a Telegram notification directly.
 * Used by job handlers to avoid circular imports with server actions.
 */
export async function sendNotificationDirect(message: string): Promise<void> {
  // Lazy import to avoid pulling DB at module level
  const { fetchStoreConfig } = await import('@/app/actions/store-config-actions');
  const config = await fetchStoreConfig();

  if (!config.enableNotifications) return;
  if (!config.telegramToken || !config.telegramChatId) {
    logger.warn('Telegram not configured — skipping notification', {
      action: 'handler_notification_skip',
    });
    return;
  }

  const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
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
    logger.error('Telegram API error in job handler', {
      action: 'handler_telegram_error',
      status: response.status,
      errorData,
    });
    throw new Error(`Telegram API returned ${response.status}`);
  }

  logger.info('Telegram notification sent via background job', {
    action: 'handler_notification_sent',
  });
}
