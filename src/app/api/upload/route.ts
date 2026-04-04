import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { requireAuth, AuthError } from '@/lib/auth/guard';
import { checkRateLimit, getClientIp } from '@/infrastructure/redis';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

const s3 = new S3Client({
  region: env.AWS_REGION!,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = env.AWS_S3_BUCKET!;

/**
 * Allowed S3 path prefixes — user-provided paths MUST start with one of these.
 * Prevents path traversal and uploading to arbitrary locations.
 */
const ALLOWED_PATH_PREFIXES = ['products/', 'avatars/', 'logos/', 'receipts/'];

/**
 * Validates and sanitizes the upload path.
 * Returns the sanitized key or null if invalid.
 */
function validateUploadPath(rawPath: string): string | null {
  // Normalize: remove leading slashes, collapse double dots, NUL bytes
  const normalized = rawPath
    .replace(/\0/g, '')           // strip NUL bytes
    .replace(/^\/+/, '')          // strip leading slashes
    .replace(/\.\./g, '')         // strip path traversal
    .replace(/%2e/gi, '')         // strip URL-encoded dots
    .replace(/%2f/gi, '/');       // normalize encoded slashes

  // Must start with an allowed prefix
  const isAllowed = ALLOWED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  if (!isAllowed) return null;

  // Only allow strict ASCII alphanumeric, hyphens, underscores, dots, and forward slashes
  // No Unicode ranges — prevents encoded traversal attacks
  if (!/^[a-zA-Z0-9/_\-.]+$/.test(normalized)) return null;

  // Prevent empty segments (double slashes)
  if (/\/\//.test(normalized)) return null;

  return normalized;
}

/** Rate limits */
const UPLOAD_RATE = { maxRequests: 20, windowMs: 60_000 } as const;
const DELETE_RATE = { maxRequests: 10, windowMs: 60_000 } as const;

// ── POST /api/upload — sube un archivo y devuelve la URL pública ──────────────
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`upload:post:${ip}`, UPLOAD_RATE);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }, { status: 429 });
    }

    await requireAuth();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const path = formData.get('path') as string | null;

    if (!file || !path) {
      return NextResponse.json({ error: 'Archivo o ruta faltante.' }, { status: 400 });
    }

    // Validate path against whitelist
    const sanitizedKey = validateUploadPath(path);
    if (!sanitizedKey) {
      return NextResponse.json({ error: 'Ruta de archivo no permitida.' }, { status: 400 });
    }

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido. Solo imágenes.' }, { status: 400 });
    }

    // Limitar tamaño: 5 MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo supera el límite de 5 MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: sanitizedKey,
        Body: buffer,
        ContentType: file.type,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    const url = `https://${BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${sanitizedKey}`;

    return NextResponse.json({ url }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error('Upload POST failed', { error: err instanceof Error ? err.message : 'Unknown' });
    return NextResponse.json({ error: 'Error al subir el archivo.' }, { status: 500 });
  }
}

// ── DELETE /api/upload — elimina un archivo por su URL pública ────────────────
export async function DELETE(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`upload:delete:${ip}`, DELETE_RATE);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 });
    }

    await requireAuth();
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL no proporcionada.' }, { status: 400 });
    }

    // Validate the URL belongs to our S3 bucket
    const expectedHost = `${BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL inválida.' }, { status: 400 });
    }

    if (urlObj.hostname !== expectedHost) {
      return NextResponse.json({ error: 'URL no pertenece al almacenamiento del sistema.' }, { status: 400 });
    }

    const key = decodeURIComponent(urlObj.pathname.slice(1));

    // Validate key against allowed prefixes
    const sanitizedKey = validateUploadPath(key);
    if (!sanitizedKey) {
      return NextResponse.json({ error: 'Ruta de archivo no permitida.' }, { status: 400 });
    }

    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: sanitizedKey,
      }),
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error('Upload DELETE failed', { error: err instanceof Error ? err.message : 'Unknown' });
    return NextResponse.json({ error: 'Error al eliminar el archivo.' }, { status: 500 });
  }
}
