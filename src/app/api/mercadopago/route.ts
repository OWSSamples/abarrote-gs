import { NextResponse } from 'next/server';
import { AuthError, requirePermission } from '@/lib/auth/guard';

function noStoreJson(body: Record<string, unknown>, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/**
 * Browser-originated payment commands remain closed until every provider
 * charge is created from a server-priced sale and reconciled before capture.
 * Administrative MercadoPago operations live in server-only services/actions.
 */
export async function POST(): Promise<NextResponse> {
  try {
    await requirePermission('sales.create');
    return noStoreJson(
      {
        error:
          'El cobro automatizado está temporalmente deshabilitado hasta completar la conciliación segura con la venta.',
      },
      409,
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return noStoreJson({ error: error.message }, error.status);
    }
    return noStoreJson({ error: 'No fue posible procesar la solicitud.' }, 500);
  }
}
