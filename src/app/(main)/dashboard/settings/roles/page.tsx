'use client';

import { Page } from '@shopify/polaris';
import { RolesManager } from '@/components/roles/RolesManager';

export default function RolesPage() {
  return (
    <Page
      fullWidth
      title="Usuarios y Accesos"
      subtitle="Administra usuarios de AWS Cognito, roles y permisos de acceso"
    >
      <RolesManager />
    </Page>
  );
}
