'use client';

import { Page } from '@shopify/polaris';
import { RolesManager } from '@/components/roles/RolesManager';

export function RolesPageClient() {
  return (
    <Page
      fullWidth
      title="Usuarios y Accesos"
      subtitle="Administra usuarios, roles y permisos de acceso del negocio"
    >
      <RolesManager />
    </Page>
  );
}
