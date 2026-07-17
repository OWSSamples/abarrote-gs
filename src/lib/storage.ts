/**
 * Client-side storage utilities.
 * Uploads and deletions are handled via the /api/upload server route,
 * which securely communicates with AWS S3 (credentials never reach the browser).
 */

/**
 * Uploads a file via the server API route and returns the public URL.
 * @param file  The file to upload.
 * @param path  A local classification hint. The server never uses it as the S3 key.
 * @returns     Promise with the public URL of the uploaded file.
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  const [rawKind = '', rawResource = ''] = path.replace(/^\/+/, '').split('/');
  const kindAliases: Record<string, string> = {
    products: 'products',
    avatars: 'avatars',
    logos: 'logos',
    receipts: 'receipts',
    mermas: 'evidence',
    evidence: 'evidence',
    promo: 'promo',
    display: 'display',
  };
  const kind = kindAliases[rawKind];
  if (!kind) throw new Error('La categoría del archivo no está permitida.');
  const resourceId = rawResource
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('kind', kind);
  if (resourceId) formData.append('resourceId', resourceId);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(data.error || 'No se pudo subir la imagen.');
  }

  const { url } = await res.json();
  return url;
}

/**
 * Deletes a file via the server API route.
 * @param fullUrl The full URL of the file to delete.
 */
export async function deleteFileFromUrl(fullUrl: string): Promise<void> {
  const response = await fetch('/api/upload', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: fullUrl }),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String(payload.error)
      : 'No se pudo eliminar el archivo.';
    throw new Error(message);
  }
}

/**
 * Generates a standard path for product images.
 */
export function getProductImagePath(productId: string, originalName: string): string {
  const extension = originalName.split('.').pop();
  return `products/${productId}-${Date.now()}.${extension}`;
}

/**
 * Generates a standard path for user avatars.
 */
export function getUserAvatarPath(userId: string, originalName: string): string {
  const extension = originalName.split('.').pop();
  return `avatars/${userId}-${Date.now()}.${extension}`;
}
