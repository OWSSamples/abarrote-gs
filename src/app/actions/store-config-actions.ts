'use server';

import { requireAuth, requireOwner } from '@/lib/auth/guard';
import { withLogging } from '@/lib/errors';
import { redactStoreConfigSecrets, toPublicDisplayConfig } from '@/lib/store-config-public';
import { getStoreConfig, saveStoreConfigForOwner } from '@/server/store-config-service';
import type { StoreConfig } from '@/types';

async function _fetchStoreConfig(): Promise<StoreConfig> {
  const user = await requireAuth();
  const config = await getStoreConfig();
  const safeConfig = redactStoreConfigSecrets(config);

  if (user.roleName === 'Propietario') return safeConfig;

  return {
    ...safeConfig,
    emailRecipients: undefined,
    emailCcRecipients: undefined,
    emailBccRecipients: undefined,
  };
}

async function _fetchPublicDisplayConfig() {
  const config = await getStoreConfig();
  return toPublicDisplayConfig(config);
}

async function _saveStoreConfig(data: Partial<StoreConfig>): Promise<StoreConfig> {
  const saved = await saveStoreConfigForOwner(data);
  return redactStoreConfigSecrets(saved);
}

async function _testTelegramNotification(): Promise<{ success: boolean; message: string }> {
  await requireOwner();
  const config = await getStoreConfig();

  if (!config.telegramToken || !config.telegramChatId) {
    return { success: false, message: 'Guarda primero el Token y Chat ID de Telegram.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: '<b>PRUEBA DE CONEXION</b>\n\nLa consola de abarrotes esta conectada correctamente a Telegram.',
        parse_mode: 'HTML',
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { success: false, message: 'Telegram rechazo la solicitud. Revisa las credenciales guardadas.' };
    }

    const payload: unknown = await response.json().catch(() => null);
    const accepted =
      typeof payload === 'object' && payload !== null && 'ok' in payload && (payload as { ok?: unknown }).ok === true;

    return accepted
      ? { success: true, message: 'Notificacion enviada con exito.' }
      : { success: false, message: 'Telegram no confirmo el envio. Revisa la configuracion.' };
  } catch {
    return { success: false, message: 'No fue posible conectar con Telegram.' };
  } finally {
    clearTimeout(timeout);
  }
}

export const fetchStoreConfig = withLogging('storeConfig.fetchStoreConfig', _fetchStoreConfig);
export const fetchPublicDisplayConfig = withLogging(
  'storeConfig.fetchPublicDisplayConfig',
  _fetchPublicDisplayConfig,
);
export const saveStoreConfig = withLogging('storeConfig.saveStoreConfigAction', _saveStoreConfig);
export const testTelegramNotification = withLogging(
  'storeConfig.testTelegramNotification',
  _testTelegramNotification,
);
