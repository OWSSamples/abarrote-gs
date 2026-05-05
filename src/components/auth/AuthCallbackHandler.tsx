'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, fetchAuthSession } from '@/lib/cognito';
import { logAuthEvent } from '@/lib/auth/auth-logger';
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
        const session = await fetchAuthSession({ forceRefresh: true });
        const idToken = session.tokens?.idToken?.toString();

        if (idToken) {
          const isHttps = window.location.protocol === 'https:';
          document.cookie = `__session=${idToken}; path=/; max-age=3600; SameSite=Strict${isHttps ? '; Secure' : ''}`;
        }

        void logAuthEvent({ event: 'oauth_callback_success', userId: user.userId, provider: 'microsoft' });
        router.replace('/');
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
