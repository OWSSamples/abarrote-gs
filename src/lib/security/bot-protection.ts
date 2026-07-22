import 'server-only';

import { checkBotId } from 'botid/server';
import { ForbiddenError, InfrastructureError } from '@/lib/errors';
import { BOT_ID_CHECK_LEVEL } from '@/lib/security/bot-protection-config';

export interface BotProtectionFailure {
  message: string;
  status: 403 | 503;
}

/**
 * Fails closed for sensitive mutations when BotID cannot verify the request.
 * BotID bypasses verification as human in local development by design.
 */
export async function assertHumanRequest(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  let verification: Awaited<ReturnType<typeof checkBotId>>;

  try {
    verification = await checkBotId({
      advancedOptions: { checkLevel: BOT_ID_CHECK_LEVEL },
    });
  } catch {
    throw new InfrastructureError('No fue posible verificar la seguridad de la solicitud. Intenta de nuevo.');
  }

  if (!verification.isHuman || verification.isBot) {
    throw new ForbiddenError('La solicitud no pudo ser verificada. Recarga la página e intenta de nuevo.');
  }
}

export function getBotProtectionFailure(error: unknown): BotProtectionFailure | null {
  if (error instanceof ForbiddenError) {
    return { message: error.message, status: 403 };
  }
  if (error instanceof InfrastructureError) {
    return { message: error.message, status: 503 };
  }
  return null;
}
