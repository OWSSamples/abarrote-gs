'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Box,
  Text,
  InlineStack,
} from '@shopify/polaris';
import { useToast } from '@/components/notifications/ToastProvider';

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.showError('Por favor completa todos los campos');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.showSuccess('Bienvenido al sistema');
      router.push('/');
    } catch (error: any) {
      console.error('SignIn error:', error);
      const errorMessage = error?.code === 'auth/invalid-credential'
        ? 'Correo o contraseña incorrectos'
        : 'Error al iniciar sesión. Inténtalo de nuevo.';
      toast.showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [email, password, router, toast]);

  return (
    <Box width="100%" maxWidth="440px">
      <Card>
        <BlockStack gap="600">
          <BlockStack gap="400" align="center">
            <div style={{
              padding: '16px 0',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img src="/logo_for_kiosko_login.svg" alt="Consola Admin Logo" style={{ width: '120px', height: 'auto' }} />
            </div>
            <BlockStack gap="200" align="center">
              <Text as="h1" variant="headingLg">
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
                  placeholder="••••••••"
                />
                <InlineStack align="end">
                  <Link
                    href="/auth/forgot-password"
                    style={{
                      fontSize: '13px',
                      color: '#0518d2',
                      textDecoration: 'none',
                      fontWeight: '500'
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
                  size="large"
                >
                  Iniciar Sesión
                </Button>
              </Box>
            </FormLayout>
          </form>

          <Box paddingBlockStart="300" borderBlockStartWidth="025" borderColor="border">
            <div style={{ textAlign: 'center' }}>
              <Text as="p" variant="bodyMd" tone="subdued">
                ¿No tienes una cuenta?{' '}
                <Link
                  href="/auth/register"
                  style={{
                    color: '#0518d2',
                    fontWeight: '600',
                    textDecoration: 'none'
                  }}
                >
                  Contacta a TI para ayuda
                </Link>
              </Text>
            </div>
          </Box>
        </BlockStack>
      </Card>

      <Box paddingBlockStart="600">
        <div style={{ textAlign: 'center' }}>
          <Text as="p" variant="bodyXs" tone="subdued">
            &copy; {new Date().getFullYear()}, Opendex Web Services, Inc. o sus empresas afiliadas. Todos los derechos reservados.
          </Text>
        </div>
      </Box>
    </Box>
  );
}
