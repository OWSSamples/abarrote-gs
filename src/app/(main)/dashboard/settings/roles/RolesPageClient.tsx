'use client';

import { Breadcrumbs, Box } from '@shopify/polaris';
import { useRouter } from 'next/navigation';
import { PersonLockFilledIcon } from '@shopify/polaris-icons';
import { RolesManager } from '@/components/roles/RolesManager';
import { SettingsSectionHeader } from '@/components/settings/SettingsSectionHeader';
import './roles-page.css';

export function RolesPageClient() {
  const router = useRouter();

  return (
    <main className="settings-secondary-page">
      <nav className="settings-secondary-breadcrumb" aria-label="Breadcrumb">
        <Breadcrumbs
          backAction={{
            content: 'Ajustes',
            onAction: () => router.push('/dashboard/settings'),
          }}
        />
        <span aria-current="page">Usuarios y Accesos</span>
      </nav>
      <header className="settings-secondary-header">
        <SettingsSectionHeader icon={PersonLockFilledIcon} label="Usuarios y Accesos" />
      </header>
      <Box padding="400">
        <RolesManager />
      </Box>
    </main>
  );
}
