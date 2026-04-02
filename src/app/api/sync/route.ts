import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, sanitize, validateNumber } from '@/lib/auth/guard';
import { createSale } from '@/app/actions/sales-actions';
import { updateProduct } from '@/app/actions/product-actions';
import { checkRateLimit, getClientIp } from '@/infrastructure/redis';
import { logger } from '@/lib/logger';

/** Rate limit: 30 sync requests per minute per IP */
const RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 } as const;

const ALLOWED_ACTIONS = new Set(['createSale', 'updateProduct'] as const);

/**
 * Basic structural validation for sync payloads.
 * Domain-level validation happens inside createSale/updateProduct.
 */
function validateSyncPayload(action: string, payload: unknown): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload inválido: se esperaba un objeto' };
  }

  const obj = payload as Record<string, unknown>;

  if (action === 'createSale') {
    if (!Array.isArray(obj.items) || obj.items.length === 0) {
      return { valid: false, error: 'La venta debe contener al menos un producto' };
    }
    if (typeof obj.total !== 'number' || obj.total < 0) {
      return { valid: false, error: 'Total de venta inválido' };
    }
    if (typeof obj.paymentMethod !== 'string') {
      return { valid: false, error: 'Método de pago requerido' };
    }
  }

  if (action === 'updateProduct') {
    if (typeof obj.id !== 'string' || obj.id.length === 0) {
      return { valid: false, error: 'ID de producto requerido' };
    }
  }

  return { valid: true };
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`sync:${ip}`, RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    await requireAuth();

    const body = await req.json();
    const { action, payload } = body as { action: unknown; payload: unknown };

    if (typeof action !== 'string' || !ALLOWED_ACTIONS.has(action as 'createSale' | 'updateProduct')) {
      return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
    }

    // Structural validation before passing to domain functions
    const validation = validateSyncPayload(action, payload);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    switch (action) {
      case 'createSale':
        await createSale(payload as Parameters<typeof createSale>[0]);
        break;
      case 'updateProduct': {
        const productPayload = payload as { id: string } & Record<string, unknown>;
        await updateProduct(productPayload.id, productPayload);
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Sync action failed', {
      error: error instanceof Error ? error.message : 'Unknown',
      action: 'sync',
    });
    return NextResponse.json(
      { error: 'Error al sincronizar datos' },
      { status: 500 },
    );
  }
}
