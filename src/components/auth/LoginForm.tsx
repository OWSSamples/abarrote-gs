'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword, OAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Card, FormLayout, TextField, Button, BlockStack, Box, Text, InlineStack } from '@shopify/polaris';
import { useToast } from '@/components/notifications/ToastProvider';
import { BrandLogo } from '@/components/ui/BrandLogo';

function writeSessionCookie(token: string): void {
  const isHttps = window.location.protocol === 'https:';
  document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Strict${isHttps ? '; Secure' : ''}`;
}

async function ensureSessionCookie(user: User): Promise<void> {
  const token = await user.getIdToken(true);
  writeSessionCookie(token);
}

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);

  const handleMicrosoftLogin = useCallback(async () => {
    setIsMicrosoftLoading(true);
    try {
      const provider = new OAuthProvider('microsoft.com');

      const customParams: Record<string, string> = {
        prompt: 'select_account',
      };

      // Si la aplicación de Azure/Entra es de un solo inquilino (Single-Tenant), Firebase
      // necesita saber cuál es el Tenant ID para no intentar irse a "/common".
      // Lo puedes definir en tu archivo .env.local
      if (process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID) {
        customParams.tenant = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID;
      }

      provider.setCustomParameters(customParams);

      const credential = await signInWithPopup(auth, provider);
      await ensureSessionCookie(credential.user);
      toast.showSuccess('Bienvenido al sistema con Microsoft');
      router.refresh();
      router.push('/');
    } catch (error: unknown) {
      console.error('Microsoft SignIn error:', error);
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/account-exists-with-different-credential') {
        toast.showError(
          'Ya existe una cuenta con este correo. Inicia sesión con contraseña y ve a "Perfil" para vincular.',
        );
      } else if (err.message?.includes('not configured as a multi-tenant application')) {
        toast.showError(
          'Error: Configura el NEXT_PUBLIC_MICROSOFT_TENANT_ID en tu archivo .env.local, o convierte tu app de Azure en Multi-Tenant.',
        );
      } else {
        toast.showError('Error al conectarse a Microsoft. Contacta al administrador.');
      }
    } finally {
      setIsMicrosoftLoading(false);
    }
  }, [router, toast]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!email || !password) {
        toast.showError('Por favor completa todos los campos');
        return;
      }

      setIsLoading(true);
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await ensureSessionCookie(credential.user);
        toast.showSuccess('Bienvenido al sistema');
        router.refresh();
        router.push('/');
      } catch (error: unknown) {
        console.error('SignIn error:', error);
        const err = error as { code?: string };
        const errorMessage =
          err.code === 'auth/invalid-credential'
            ? 'Correo o contraseña incorrectos'
            : 'Error al iniciar sesión. Inténtalo de nuevo.';
        toast.showError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, router, toast],
  );

  return (
    <Box width="100%" maxWidth="440px">
      <Card>
        <BlockStack gap="600">
          <BlockStack gap="400" align="center">
            <div
              style={{
                padding: '24px 0 12px 0',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src="/login-brand.svg"
                alt="Logo"
                style={{
                  width: '200px',
                  height: 'auto',
                }}
              />
            </div>
            <BlockStack gap="200" align="center">
              <Text as="h1" variant="headingLg" fontWeight="bold">
                Consola de Administración
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Ingresa tus credenciales para acceder al panel
              </Text>
            </BlockStack>
          </BlockStack>

          <form onSubmit={handleSubmit}>
            <FormLayout>
              <TextField
                label="Correo electrónico"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                type="email"
                disabled={isLoading}
                placeholder="GlobalID@company.com"
              />
              <BlockStack gap="200">
                <TextField
                  label="Contraseña"
                  value={password}
                  onChange={setPassword}
                  type="password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  placeholder=""
                />
                <InlineStack align="end">
                  <Link
                    href="/auth/forgot-password"
                    style={{
                      fontSize: '13px',
                      color: '#0518d2',
                      textDecoration: 'none',
                      fontWeight: '500',
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </InlineStack>
              </BlockStack>

              <Box paddingBlockStart="300">
                <Button
                  variant="primary"
                  submit
                  fullWidth
                  loading={isLoading}
                  disabled={isMicrosoftLoading}
                  size="large"
                >
                  Iniciar Sesión
                </Button>
              </Box>
            </FormLayout>
          </form>

          <Box>
            <BlockStack gap="300">
              <div style={{ textAlign: 'center' }}>
                <Text as="p" variant="bodyMd" tone="subdued">
                  — o —
                </Text>
              </div>
              <Button
                onClick={handleMicrosoftLogin}
                fullWidth
                loading={isMicrosoftLoading}
                disabled={isLoading}
                size="large"
                icon={<BrandLogo name="Microsoft" size={18} />}
              >
                Iniciar sesión con Microsoft
              </Button>
            </BlockStack>
          </Box>

          <Box paddingBlockStart="300" borderBlockStartWidth="025" borderColor="border">
            <div style={{ textAlign: 'center' }}>
              <Text as="p" variant="bodyMd" tone="subdued">
                ¿No tienes una cuenta?{' '}
                <Link
                  href="/auth/register"
                  style={{
                    color: '#0518d2',
                    fontWeight: '600',
                    textDecoration: 'none',
                  }}
                >
                  Contacta a TI para ayuda
                </Link>
              </Text>
            </div>
          </Box>
        </BlockStack>
      </Card>
    </Box>
  );
}
