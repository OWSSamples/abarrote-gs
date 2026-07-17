import { NextResponse } from 'next/server';
import { getProviderConnectionStatus } from '@/lib/oauth-providers';
import { AuthError, requirePermission } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';

export async function GET() {
  try {
    await requirePermission('sales.create', 'settings.view');
    const { storeId } = await requireStoreScope();

    // We get the MP connection status which contains the publicKey straight from the OAuth DB
    const mpStatus = await getProviderConnectionStatus('mercadopago', storeId);

    if (!mpStatus || !mpStatus.connected || !mpStatus.publicKey) {
      return NextResponse.json({ error: 'MercadoPago no está conectado o falta la publicKey.' }, { status: 404 });
    }

    return NextResponse.json({
      publicKey: mpStatus.publicKey,
      connected: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error al obtener la configuración de MercadoPago' }, { status: 500 });
  }
}
