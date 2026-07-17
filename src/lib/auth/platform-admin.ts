import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { platformAdministrators } from '@/db/schema';
import { AuthError, requireAuth, type AuthenticatedUser } from '@/lib/auth/guard';

export async function requirePlatformAdministrator(): Promise<AuthenticatedUser> {
  const identity = await requireAuth();
  const [administrator] = await db
    .select({ cognitoSub: platformAdministrators.cognitoSub })
    .from(platformAdministrators)
    .where(
      and(
        eq(platformAdministrators.cognitoSub, identity.uid),
        eq(platformAdministrators.status, 'active'),
      ),
    )
    .limit(1);

  if (!administrator) {
    throw new AuthError('Esta acción requiere administración de plataforma.', 403);
  }
  return identity;
}
