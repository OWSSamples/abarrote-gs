import { ConfiguracionPage } from '@/components/settings/ConfiguracionPage';
import { requirePermission } from '@/lib/auth/guard';

export default async function SettingsPage() {
  await requirePermission('settings.view');

  return <ConfiguracionPage />;
}
