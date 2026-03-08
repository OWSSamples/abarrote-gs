import { NextRequest, NextResponse } from 'next/server';
import { uploadToS3, deleteFromS3, extractKeyFromUrl } from '@/lib/s3';

export const runtime = 'nodejs';

/**
 * POST /api/upload — Upload a file to S3
 * Expects multipart/form-data with:
 *   - file: the File blob
 *   - path: the desired storage path (e.g. "products/abc-123.jpg")
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const path = formData.get('path') as string | null;

        if (!file) {
            return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
        }
        if (!path) {
            return NextResponse.json({ error: 'No se proporcionó la ruta de almacenamiento' }, { status: 400 });
        }

        // Validate file size (max 5MB)
        const MAX_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: 'El archivo excede el tamaño máximo de 5MB' },
                { status: 413 },
            );
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Tipo de archivo no permitido. Solo se aceptan imágenes (jpg, png, webp, gif)' },
                { status: 415 },
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const url = await uploadToS3(buffer, path, file.type);

        return NextResponse.json({ url });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Error al subir el archivo' },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/upload — Delete a file from S3
 * Expects JSON body with:
 *   - url: the full URL of the file to delete
 */
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ error: 'No se proporcionó la URL del archivo' }, { status: 400 });
        }

        const key = extractKeyFromUrl(url);
        if (!key) {
            return NextResponse.json({ error: 'URL no válida' }, { status: 400 });
        }

        await deleteFromS3(key);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete error:', error);
        return NextResponse.json(
            { error: 'Error al eliminar el archivo' },
            { status: 500 },
        );
    }
}
