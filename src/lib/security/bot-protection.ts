import 'server-only';

import { checkBotId } from 'botid/server';
import { ForbiddenError, InfrastructureError } from '@/lib/errors';

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
      advancedOptions: { checkLevel: 'basic' },
    });
  } catch {
    throw new InfrastructureError('No fue posible verificar la seguridad de la solicitud. Intenta de nuevo.');
  }

  if (!verification.isHuman || verification.isBot) {
    throw new ForbiddenError('La solicitud no pudo ser verificada. Recarga la página e intenta de nuevo.');
  }
}
