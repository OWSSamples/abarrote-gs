'use server';

import { requireOwner, requirePermission } from '@/lib/auth/guard';
import { withLogging } from '@/lib/errors';
import { generateMPAuthorizationUrl, disconnectProvider, getProviderConnectionStatus } from '@/lib/oauth-providers';
import { logAudit } from '@/lib/audit';
import { sendNotification } from './_notifications';
import { providerConnectionEvent } from './_notification-events';
import { requireStoreScope } from '@/lib/auth/store-scope';

/**
 * Initiates MercadoPago OAuth flow.
 * Returns the authorization URL to redirect the user to.
 */
async function _initiateMPOAuth(): Promise<{ url: string }> {
  const user = await requireOwner();
  const { storeId } = await requireStoreScope();

  const { url, state } = await generateMPAuthorizationUrl(storeId);

  await logAudit({
    storeId,
    userId: user.uid,
    userEmail: user.email,
    action: 'create',
    entity: 'oauth_connection',
    entityId: state,
    changes: { after: { provider: 'mercadopago', action: 'initiate_oauth' } },
  });

  sendNotification(providerConnectionEvent({ provider: 'MercadoPago', action: 'connect', userEmail: user.email ?? '' }), storeId).catch(() => {});

  return { url };
}

/**
 * Disconnects MercadoPago OAuth connection.
 * Clears encrypted tokens from DB.
 */
async function _disconnectMPOAuth(): Promise<void> {
  const user = await requireOwner();
  const { storeId } = await requireStoreScope();

  await disconnectProvider('mercadopago', storeId);

  await logAudit({
    storeId,
    userId: user.uid,
    userEmail: user.email,
    action: 'delete',
    entity: 'oauth_connection',
    entityId: 'mercadopago',
    changes: { after: { provider: 'mercadopago', action: 'disconnect' } },
  });
  sendNotification(providerConnectionEvent({ provider: 'MercadoPago', action: 'disconnect', userEmail: user.email ?? '' }), storeId).catch(() => {});
}

/**
 * Returns current connection status for MercadoPago.
 */
async function _getMPConnectionStatus() {
  await requirePermission('settings.view');
  const { storeId } = await requireStoreScope();
  return getProviderConnectionStatus('mercadopago', storeId);
}

// ==================== EXPORTS WITH LOGGING ====================

export const initiateMPOAuth = withLogging('oauth.initiateMPOAuth', _initiateMPOAuth);
export const disconnectMPOAuth = withLogging('oauth.disconnectMPOAuth', _disconnectMPOAuth);
export const getMPConnectionStatus = withLogging('oauth.getMPConnectionStatus', _getMPConnectionStatus);
