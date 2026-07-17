'use server';

import { cookies } from 'next/headers';
import { AuthError, requireAuth, validateId } from '@/lib/auth/guard';
import { userHasStoreAccess } from '@/lib/auth/store-scope';
import { withLogging } from '@/lib/errors';

const STORE_COOKIE = '__store_id';

async function _selectActiveStore(storeId: string): Promise<{ storeId: string }> {
  const validatedStoreId = validateId(storeId, 'Negocio');
  const user = await requireAuth();
  const allowed = await userHasStoreAccess(user, validatedStoreId);
  if (!allowed) {
    throw new AuthError('No tienes acceso al negocio seleccionado.', 403);
  }

  const cookieStore = await cookies();
  cookieStore.set(STORE_COOKIE, validatedStoreId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 12,
    priority: 'high',
  });

  return { storeId: validatedStoreId };
}

export const selectActiveStore = withLogging('storeScope.selectActiveStore', _selectActiveStore);
