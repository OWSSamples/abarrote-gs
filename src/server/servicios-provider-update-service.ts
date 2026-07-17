import 'server-only';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { servicios } from '@/db/schema';
import { logger } from '@/lib/logger';
import type { ServicioEstado } from '@/types';

const VALID_TRANSITIONS: Record<ServicioEstado, ReadonlySet<ServicioEstado>> = {
  pendiente: new Set(['procesando', 'completado', 'fallido', 'cancelado']),
  procesando: new Set(['completado', 'fallido', 'cancelado']),
  completado: new Set(),
  fallido: new Set(),
  cancelado: new Set(),
};

/** Applies a verified provider event with provider binding and compare-and-set semantics. */
export async function updateServicioFromProvider(input: {
  storeId: string;
  providerId: string;
  providerTransactionId: string;
  status: ServicioEstado;
  authorizationCode?: string;
  errorMessage?: string;
}): Promise<'updated' | 'duplicate' | 'unknown' | 'rejected'> {
  const matches = await db
    .select()
    .from(servicios)
    .where(
      and(
        eq(servicios.storeId, input.storeId),
        eq(servicios.providerId, input.providerId),
        eq(servicios.providerTransactionId, input.providerTransactionId),
      ),
    )
    .limit(2);

  const [current] = matches;

  if (!current) {
    logger.warn('Webhook for unknown provider transaction', {
      action: 'servicios_webhook_unknown',
      provider: input.providerId,
      providerTransactionId: input.providerTransactionId,
    });
    return 'unknown';
  }

  if (matches.length > 1) {
    logger.error('Ambiguous provider transaction detected', {
      action: 'servicios_webhook_ambiguous_transaction',
      provider: input.providerId,
      providerTransactionId: input.providerTransactionId,
    });
    return 'rejected';
  }

  if (current.estado === input.status) return 'duplicate';

  const currentStatus = current.estado as ServicioEstado;
  if (!VALID_TRANSITIONS[currentStatus]?.has(input.status)) {
    logger.warn('Invalid servicios state transition attempted', {
      action: 'servicios_invalid_transition',
      id: current.id,
      provider: input.providerId,
      from: current.estado,
      to: input.status,
    });
    return 'rejected';
  }

  const [updated] = await db
    .update(servicios)
    .set({
      estado: input.status,
      providerAuthCode: input.authorizationCode ?? current.providerAuthCode,
      providerError: input.errorMessage ?? current.providerError,
      providerRespondedAt: new Date(),
    })
    .where(
      and(
        eq(servicios.id, current.id),
        eq(servicios.storeId, input.storeId),
        eq(servicios.providerId, input.providerId),
        eq(servicios.providerTransactionId, input.providerTransactionId),
        eq(servicios.estado, current.estado),
      ),
    )
    .returning({ id: servicios.id, folio: servicios.folio });

  if (!updated) {
    const [latest] = await db
      .select({ estado: servicios.estado })
      .from(servicios)
      .where(
        and(
          eq(servicios.id, current.id),
          eq(servicios.storeId, input.storeId),
          eq(servicios.providerId, input.providerId),
          eq(servicios.providerTransactionId, input.providerTransactionId),
        ),
      )
      .limit(1);

    if (latest?.estado === input.status) return 'duplicate';

    logger.warn('Concurrent servicios state transition blocked', {
      action: 'servicios_concurrent_transition',
      id: current.id,
      provider: input.providerId,
      attemptedStatus: input.status,
    });
    return 'rejected';
  }

  logger.info('Servicio status updated from provider', {
    action: 'servicios_status_update',
    id: updated.id,
    folio: updated.folio,
    provider: input.providerId,
    from: current.estado,
    to: input.status,
  });

  revalidatePath('/dashboard');
  return 'updated';
}
