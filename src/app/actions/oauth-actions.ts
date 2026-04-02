'use server';

import { requireOwner } from '@/lib/auth/guard';
import {
  generateMPAuthorizationUrl,
  disconnectProvider,
  getProviderConnectionStatus,
} from '@/lib/oauth-providers';
import { logAudit } from '@/lib/audit';

/**
 * Initiates MercadoPago OAuth flow.
 * Returns the authorization URL to redirect the user to.
 */
export async function initiateMPOAuth(): Promise<{ url: string }> {
  const user = await requireOwner();

  const { url, state } = await generateMPAuthorizationUrl();

  await logAudit({
    userId: user.uid,
    userEmail: user.email,
    action: 'create',
    entity: 'oauth_connection',
    entityId: state,
    changes: { after: { provider: 'mercadopago', action: 'initiate_oauth' } },
  });

  return { url };
}

/**
 * Disconnects MercadoPago OAuth connection.
 * Clears encrypted tokens from DB.
 */
export async function disconnectMPOAuth(): Promise<void> {
  const user = await requireOwner();

  await disconnectProvider('mercadopago');

  await logAudit({
    userId: user.uid,
    userEmail: user.email,
    action: 'delete',
    entity: 'oauth_connection',
    entityId: 'mercadopago',
    changes: { after: { provider: 'mercadopago', action: 'disconnect' } },
  });
}

/**
 * Returns current connection status for MercadoPago.
 */
export async function getMPConnectionStatus() {
  return getProviderConnectionStatus('mercadopago');
}
