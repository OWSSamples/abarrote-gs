import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { tenantAssets } from '@/db/schema';
import { checkRateLimit, getClientIp } from '@/infrastructure/redis';
import { AuthError } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { logger } from '@/lib/logger';
import {
  ASSET_KINDS,
  type AssetKind,
  getStoredAssetTarget,
  getUploadTarget,
  privateAssetUrl,
  publicObjectUrl,
} from '@/lib/tenant-asset-storage';
import type { PermissionKey } from '@/types';

const MAX_SIZE = 5 * 1024 * 1024;
const UPLOAD_RATE = { maxRequests: 20, windowMs: 60_000 } as const;
const DELETE_RATE = { maxRequests: 10, windowMs: 60_000 } as const;

const KIND_PERMISSIONS: Partial<Record<AssetKind, PermissionKey[]>> = {
  products: ['inventory.create', 'inventory.edit'],
  evidence: ['inventory.edit'],
  receipts: ['expenses.create'],
  logos: ['settings.edit'],
  promo: ['settings.edit'],
  display: ['settings.edit'],
};

interface DetectedFile {
  mimeType: string;
  extension: string;
}

function parseAssetKind(value: FormDataEntryValue | null): AssetKind | null {
  return typeof value === 'string' && ASSET_KINDS.includes(value as AssetKind)
    ? value as AssetKind
    : null;
}

function sanitizeResourceId(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string' || !value) return null;
  return /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null;
}

function detectFile(buffer: Buffer): DetectedFile | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (buffer.length >= 6) {
    const signature = buffer.subarray(0, 6).toString('ascii');
    if (signature === 'GIF87a' || signature === 'GIF89a') {
      return { mimeType: 'image/gif', extension: 'gif' };
    }
  }
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }
  return null;
}

function assertAssetPermission(
  user: Awaited<ReturnType<typeof requireStoreScope>>['user'],
  kind: AssetKind,
): void {
  if (user.roleName === 'Propietario' || user.roleName === 'Administrador' || kind === 'avatars') return;
  const required = KIND_PERMISSIONS[kind] ?? [];
  if (required.length === 0 || !required.some((permission) => user.permissions.includes(permission))) {
    throw new AuthError('No tienes permisos para administrar este tipo de archivo.', 403);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, storeId } = await requireStoreScope();
    const ip = getClientIp(req);
    const rl = checkRateLimit(`upload:post:${storeId}:${user.uid}:${ip}`, UPLOAD_RATE);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const kind = parseAssetKind(formData.get('kind'));
    const requestedResourceId = sanitizeResourceId(formData.get('resourceId'));
    if (!(file instanceof File) || !kind) {
      return NextResponse.json({ error: 'Archivo o categoría de archivo inválida.' }, { status: 400 });
    }
    assertAssetPermission(user, kind);
    if (file.size <= 0 || file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo debe ser menor a 5 MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectFile(buffer);
    if (!detected) {
      return NextResponse.json({ error: 'El contenido del archivo no corresponde a un formato permitido.' }, { status: 400 });
    }
    if (detected.mimeType === 'application/pdf' && kind !== 'receipts') {
      return NextResponse.json({ error: 'Los documentos PDF solo se permiten como comprobantes.' }, { status: 400 });
    }

    const assetId = randomUUID();
    const resourceId = kind === 'avatars' ? user.uid : requestedResourceId;
    const objectKey = `tenants/${storeId}/${kind}/${assetId}.${detected.extension}`;
    const target = getUploadTarget(kind);
    const accessUrl = target.isPrivate
      ? privateAssetUrl(assetId)
      : publicObjectUrl(target.bucket, target.region, objectKey);
    const checksumSha256 = createHash('sha256').update(buffer).digest('hex');

    await target.client.send(new PutObjectCommand({
      Bucket: target.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: detected.mimeType,
      CacheControl: target.isPrivate ? 'private, no-store' : 'public, max-age=31536000, immutable',
      ...(detected.mimeType === 'application/pdf' ? { ContentDisposition: 'attachment' } : {}),
      ServerSideEncryption: 'AES256',
      Metadata: { tenant: storeId, asset: assetId, access: target.isPrivate ? 'private' : 'public' },
    }));

    try {
      await db.insert(tenantAssets).values({
        id: assetId,
        storeId,
        kind,
        resourceId,
        objectKey,
        publicUrl: accessUrl,
        mimeType: detected.mimeType,
        sizeBytes: buffer.length,
        checksumSha256,
        uploadedBy: user.uid,
      });
    } catch (error) {
      await target.client
        .send(new DeleteObjectCommand({ Bucket: target.bucket, Key: objectKey }))
        .catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ assetId, url: accessUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.endsWith('_STORAGE_NOT_CONFIGURED')) {
      return NextResponse.json({ error: 'El almacenamiento requerido no está configurado.' }, { status: 503 });
    }
    logger.error('Tenant asset upload failed', {
      action: 'tenant_asset_upload',
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ error: 'Error al subir el archivo.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, storeId } = await requireStoreScope();
    const ip = getClientIp(req);
    const rl = checkRateLimit(`upload:delete:${storeId}:${user.uid}:${ip}`, DELETE_RATE);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 });
    }

    const payload: unknown = await req.json();
    const assetId = typeof payload === 'object' && payload !== null && 'assetId' in payload
      ? String(payload.assetId)
      : '';
    const url = typeof payload === 'object' && payload !== null && 'url' in payload
      ? String(payload.url)
      : '';
    if ((!assetId || assetId.length > 128) && (!url || url.length > 2048)) {
      return NextResponse.json({ error: 'Identificador de archivo inválido.' }, { status: 400 });
    }

    const assetSelector = assetId
      ? eq(tenantAssets.id, assetId)
      : eq(tenantAssets.publicUrl, url);
    const [asset] = await db
      .select()
      .from(tenantAssets)
      .where(
        and(
          eq(tenantAssets.storeId, storeId),
          isNull(tenantAssets.deletedAt),
          assetSelector,
        ),
      )
      .limit(1);
    if (!asset) {
      return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 });
    }
    assertAssetPermission(user, asset.kind as AssetKind);
    if (
      asset.kind === 'avatars'
      && asset.uploadedBy !== user.uid
      && user.roleName !== 'Propietario'
      && user.roleName !== 'Administrador'
      && !user.permissions.includes('roles.manage')
    ) {
      throw new AuthError('Solo puedes eliminar tu propia imagen de perfil.', 403);
    }

    const deletedAt = new Date();
    const [reserved] = await db
      .update(tenantAssets)
      .set({ deletedAt })
      .where(
        and(
          eq(tenantAssets.id, asset.id),
          eq(tenantAssets.storeId, storeId),
          isNull(tenantAssets.deletedAt),
        ),
      )
      .returning({ id: tenantAssets.id });
    if (!reserved) {
      return NextResponse.json({ error: 'El archivo ya fue eliminado.' }, { status: 409 });
    }

    try {
      const target = getStoredAssetTarget(asset.kind as AssetKind, asset.publicUrl);
      await target.client.send(new DeleteObjectCommand({ Bucket: target.bucket, Key: asset.objectKey }));
    } catch (error) {
      await db
        .update(tenantAssets)
        .set({ deletedAt: null })
        .where(
          and(
            eq(tenantAssets.id, asset.id),
            eq(tenantAssets.storeId, storeId),
            eq(tenantAssets.deletedAt, deletedAt),
          ),
        );
      throw error;
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.endsWith('_STORAGE_NOT_CONFIGURED')) {
      return NextResponse.json({ error: 'El almacenamiento requerido no está configurado.' }, { status: 503 });
    }
    logger.error('Tenant asset deletion failed', {
      action: 'tenant_asset_delete',
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ error: 'Error al eliminar el archivo.' }, { status: 500 });
  }
}
