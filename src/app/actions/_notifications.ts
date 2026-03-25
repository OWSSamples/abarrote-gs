// Internal notification helper — not a server action, just a utility
// used by domain action modules that need to send Telegram alerts.

import { fetchStoreConfig } from './store-config-actions';
import { logger } from '@/lib/logger';

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

export async function sendNotification(message: string): Promise<void> {
  try {
    const config = await fetchStoreConfig();
    
    if (!config.enableNotifications) {
      return;
    }

    if (!config.telegramToken || !config.telegramChatId) {
      logger.warn('Telegram notifications enabled but token/chatId missing');
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
      logger.error('Telegram API error', { 
        status: response.status, 
        statusText: response.statusText,
        errorData 
      });
    }
  } catch (error: any) {
    logger.error('Error sending notification catch-block', { 
      message: error.message,
      stack: error.stack
    });
  }
}
