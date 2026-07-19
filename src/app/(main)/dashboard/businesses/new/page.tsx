import { CreateBusinessPage } from '@/components/tenants/CreateBusinessPage';
import { requireAuth } from '@/lib/auth/guard';

export default async function NewBusinessPage() {
  const user = await requireAuth();

  return <CreateBusinessPage accountEmail={user.email ?? ''} />;
}
