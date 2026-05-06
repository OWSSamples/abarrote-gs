'use client';

import { Page } from '@shopify/polaris';
import { CognitoUsersManager } from '@/components/admin/CognitoUsersManager';

export default function CognitoUsersPage() {
  return (
    <Page
      fullWidth
      title="Administración de Cognito"
      subtitle="Lista, crea, deshabilita y reinicia contraseñas de usuarios del User Pool"
    >
      <CognitoUsersManager />
    </Page>
  );
}
