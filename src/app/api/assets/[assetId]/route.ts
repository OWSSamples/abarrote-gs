import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenantAssets } from '@/db/schema';
import { checkRateLimit, getClientIp } from '@/infrastructure/redis';
import { AuthError } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { logger } from '@/lib/logger';
import {
  getStoredAssetTarget,
  isPrivateAssetKind,
} from '@/lib/tenant-asset-storage';
import type { PermissionKey } from '@/types';

const ASSET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS_RATE = { maxRequests: 60, windowMs: 60_000 } as const;
const SIGNED_URL_TTL_SECONDS = 60;

const VIEW_PERMISSIONS: Record<'receipts' | 'evidence', PermissionKey> = {
  receipts: 'expenses.view',
  evidence: 'inventory.view',
};

function assertViewPermission(
  user: Awaited<ReturnType<typeof requireStoreScope>>['user'],
  kind: 'receipts' | 'evidence',
): void {
  if (user.roleName === 'Propietario' || user.roleName === 'Administrador') return;
  if (!user.permissions.includes(VIEW_PERMISSIONS[kind])) {
    throw new AuthError('No tienes permisos para consultar este archivo.', 403);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
): Promise<NextResponse> {
  try {
    const { assetId } = await params;
    if (!ASSET_ID_PATTERN.test(assetId)) {
      return NextResponse.json({ error: 'Identificador de archivo inválido.' }, { status: 400 });
    }

    const { user, storeId } = await requireStoreScope();
    const rateLimit = checkRateLimit(
      `asset:get:${storeId}:${user.uid}:${getClientIp(req)}`,
      ACCESS_RATE,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta más tarde.' }, { status: 429 });
    }

    const [asset] = await db
      .select({
        id: tenantAssets.id,
        kind: tenantAssets.kind,
        objectKey: tenantAssets.objectKey,
        accessUrl: tenantAssets.publicUrl,
        mimeType: tenantAssets.mimeType,
      })
      .from(tenantAssets)
      .where(
        and(
          eq(tenantAssets.id, assetId),
          eq(tenantAssets.storeId, storeId),
          isNull(tenantAssets.deletedAt),
        ),
      )
      .limit(1);

    if (!asset || !isPrivateAssetKind(asset.kind)) {
      return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 });
    }

    assertViewPermission(user, asset.kind);
    const target = getStoredAssetTarget(asset.kind, asset.accessUrl);
    if (!target.isPrivate) {
      return NextResponse.json({ error: 'El archivo todavía usa almacenamiento legado.' }, { status: 409 });
    }

    const signedUrl = await getSignedUrl(
      target.client,
      new GetObjectCommand({
        Bucket: target.bucket,
        Key: asset.objectKey,
        ResponseContentType: asset.mimeType,
        ResponseCacheControl: 'private, no-store',
        ResponseContentDisposition: asset.mimeType === 'application/pdf'
          ? `attachment; filename="document-${asset.id}.pdf"`
          : 'inline',
      }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );

    const response = NextResponse.redirect(signedUrl, 307);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.endsWith('_STORAGE_NOT_CONFIGURED')) {
      return NextResponse.json({ error: 'El almacenamiento privado no está configurado.' }, { status: 503 });
    }
    logger.error('Private tenant asset access failed', {
      action: 'tenant_asset_access',
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ error: 'No fue posible abrir el archivo.' }, { status: 500 });
  }
}
