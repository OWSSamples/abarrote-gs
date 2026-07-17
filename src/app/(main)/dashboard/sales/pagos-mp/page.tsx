import { requirePermission } from '@/lib/auth/guard';
import { PagosMPPageClient } from './PagosMPPageClient';

export default async function PagosMPPage() {
  await requirePermission('sales.refund', 'settings.view');

  return <PagosMPPageClient />;
}
