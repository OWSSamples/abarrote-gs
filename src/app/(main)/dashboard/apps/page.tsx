import { requirePermission } from '@/lib/auth/guard';
import { fetchPluginStoreAction } from '@/app/actions/plugin-actions';
import { PluginStorePage } from '@/components/apps/PluginStorePage';

export default async function AppsPage() {
  await requirePermission('settings.view');
  const plugins = await fetchPluginStoreAction();

  return <PluginStorePage initialPlugins={plugins} />;
}
