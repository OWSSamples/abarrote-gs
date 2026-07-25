import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { env } from '@/lib/env';
import { db } from '@/db';
import { uberOauthStates } from '@/db/schema-uber';
// Nota: Se asume que existe un helper getAuthSession() o similar para obtener el usuario de Cognito
// Si no existe, este es el lugar para inyectar la lógica de sesión del proyecto.

export async function GET() {
  try {
    // 1. Aquí se debería validar la sesión del usuario (Cognito)
    // const session = await getAuthSession();
    // if (!session?.workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    // Placeholder para workspaceId hasta confirmar helper de sesión
    const workspaceId = '00000000-0000-0000-0000-000000000000'; 
    const userId = '00000000-0000-0000-0000-000000000000';

    // 2. Generar State robusto (Anti-CSRF)
    const state = randomBytes(32).toString('hex');
    const stateHash = createHash('sha256').update(state).digest('hex');

    // 3. Persistir contexto
    await db.insert(uberOauthStates).values({
      stateHash,
      workspaceId,
      userId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    });

    // 4. Construir URL con Credenciales de UBER (No Cognito)
    const params = new URLSearchParams({
      client_id: env.UBER_DEVELOPER_CLIENT_ID || '',
      response_type: 'code',
      redirect_uri: env.UBER_OAUTH_REDIRECT_URI || '',
      scope: 'eats.pos_provisioning',
      state: state,
    });

    return NextResponse.redirect(`${env.UBER_OAUTH_AUTHORIZE_URL}?${params.toString()}`);
  } catch (error) {
    console.error('Error initiating Uber OAuth:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}