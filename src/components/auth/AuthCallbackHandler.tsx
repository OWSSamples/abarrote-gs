'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/cognito';
import { synchronizeServerSession } from '@/lib/auth/session-client';
import { logAuthEvent } from '@/lib/auth/auth-logger';
import { getCurrentTenantRegistrationStatus } from '@/app/actions/register-tenant-actions';
import { Card, BlockStack, Text, Spinner, Box } from '@shopify/polaris';

/**
 * Handles the OAuth callback from Cognito Hosted UI.
 * Amplify automatically exchanges the authorization code for tokens.
 * This component waits for the exchange, syncs the session cookie, and redirects.
 */
export function AuthCallbackHandler() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        // Amplify auto-handles the code exchange from the URL params.
        // We just need to wait for the user to be available.
        const user = await getCurrentUser();
        const syncStatus = await synchronizeServerSession(false);
        if (syncStatus !== 'established') throw new Error('Server session could not be established');

        void logAuthEvent({ event: 'oauth_callback_success', userId: user.userId, provider: 'microsoft' });
        const pendingReturnTo = window.sessionStorage.getItem('opendex.authReturnTo');
        window.sessionStorage.removeItem('opendex.authReturnTo');
        const safeReturnTo = pendingReturnTo?.startsWith('/') && !pendingReturnTo.startsWith('//')
          ? pendingReturnTo
          : '/';
        if (safeReturnTo.startsWith('/auth/accept-invitation?')) {
          router.replace(safeReturnTo);
          return;
        }
        const tenantStatus = await getCurrentTenantRegistrationStatus();
        if (!tenantStatus.hasTenant) {
          window.sessionStorage.setItem('opendex.pendingSignupEmail', tenantStatus.email);
          router.replace('/auth/register?mode=verify');
          return;
        }
        router.replace(safeReturnTo);
      } catch (err) {
        console.error('OAuth callback error:', err);
        void logAuthEvent({
          event: 'oauth_callback_failure',
          provider: 'microsoft',
          errorCode: (err as { name?: string }).name,
          reason: err instanceof Error ? err.message : undefined,
        });
        setError('Error al completar la autenticación. Inténtalo de nuevo.');
        setTimeout(() => router.replace('/auth/login'), 3000);
      }
    }

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <Box width="100%" maxWidth="440px">
        <Card>
          <BlockStack gap="400" align="center">
            <Text as="p" variant="bodyMd" tone="critical">
              {error}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Redirigiendo al inicio de sesión...
            </Text>
          </BlockStack>
        </Card>
      </Box>
    );
  }

  return (
    <Box width="100%" maxWidth="440px">
      <Card>
        <BlockStack gap="400" align="center">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Spinner size="large" />
          </div>
          <Text as="p" variant="bodyMd" alignment="center">
            Completando autenticación...
          </Text>
        </BlockStack>
      </Card>
    </Box>
  );
}
