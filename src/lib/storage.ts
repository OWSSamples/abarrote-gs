/**
 * Client-side storage utilities.
 * Uploads and deletions are handled via the /api/upload server route,
 * which securely communicates with AWS S3 (credentials never reach the browser).
 */

/**
 * Uploads a file via the server API route and returns the public URL.
 * @param file  The file to upload.
 * @param path  The desired storage path (e.g., 'products/product-1.jpg').
 * @returns     Promise with the public URL of the uploaded file.
 */
export async function uploadFile(file: File, path: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

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
    try {
        await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: fullUrl }),
        });
    } catch (error) {
        console.warn('Could not delete file:', error);
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
