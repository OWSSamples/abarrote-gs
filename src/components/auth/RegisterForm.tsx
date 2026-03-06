'use client';

import Link from 'next/link';
import {
  Card,
  Button,
  BlockStack,
  Box,
  Text,
  Banner,
  List,
  Icon,
} from '@shopify/polaris';
import { PersonAddIcon, LockIcon } from '@shopify/polaris-icons';

export function RegisterForm() {
  return (
    <Box width="100%" maxWidth="480px">
      <Card>
        <BlockStack gap="600">
          {/* Logo Section */}
          <div style={{
            padding: '8px 0',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img
              src="/logo_for_kiosko_login.svg"
              alt="Kiosko"
              style={{ width: '130px', height: 'auto' }}
            />
          </div>

          {/* Eye-catching Banner */}
          <Banner
            title="Bienvenido a la Plataforma"
            tone="info"
          >
            <Text as="p" variant="bodyMd">
              Estás a un paso de acceder a la consola de gestión líder en la industria.
            </Text>
          </Banner>

          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="h1" variant="headingLg">
                Solicitud de Acceso
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Para mantener la seguridad proactiva de <span style={{ color: '#005bd3', fontWeight: 'bold' }}>Opendex Web Services</span>, la creación de perfiles es gestionada por el Departamento de TI.
              </Text>
            </BlockStack>

            <Box
              padding="400"
              background="bg-surface-secondary"
              borderRadius="300"
            >
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  Sigue estos pasos para comenzar:
                </Text>
                <List type="bullet">
                  <List.Item>Contacta a tu administrador de sistemas local.</List.Item>
                  <List.Item>Presenta tu **GlobalID** corporativo válido.</List.Item>
                  <List.Item>Confirma tus niveles de acceso requeridos.</List.Item>
                </List>
              </BlockStack>
            </Box>

            <Banner tone="warning" icon={LockIcon}>
              <Text as="p" variant="bodySm">
                La seguridad es nuestra prioridad. Nunca compartas tus llaves de acceso.
              </Text>
            </Banner>
          </BlockStack>

          <BlockStack gap="200">
            <Link href="/auth/login" style={{ textDecoration: 'none' }}>
              <Button variant="primary" fullWidth size="large" icon={PersonAddIcon}>
                Volver al Portal de Acceso
              </Button>
            </Link>
          </BlockStack>
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
