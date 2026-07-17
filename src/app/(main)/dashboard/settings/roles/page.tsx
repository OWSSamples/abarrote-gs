import { requirePermission } from '@/lib/auth/guard';
import { RolesPageClient } from './RolesPageClient';

export default async function RolesPage() {
  await requirePermission('roles.manage');

  return <RolesPageClient />;
}
