import { NextResponse } from 'next/server';
import { getProviderConnectionStatus } from '@/lib/oauth-providers';
import { requireAuth } from '@/lib/auth/guard';

export async function GET() {
  try {
    await requireAuth();
    
    // We get the MP connection status which contains the publicKey straight from the OAuth DB
    const mpStatus = await getProviderConnectionStatus('mercadopago');
    
    if (!mpStatus || !mpStatus.connected || !mpStatus.publicKey) {
      return NextResponse.json(
        { error: 'MercadoPago no está conectado o falta la publicKey.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      publicKey: mpStatus.publicKey,
      connected: true,
      email: mpStatus.email
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener la configuración de MercadoPago' },
      { status: 500 }
    );
  }
}
