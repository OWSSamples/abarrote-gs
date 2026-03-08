import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3 Client singleton — reads from server-side env vars (never exposed to browser)
const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const BUCKET = process.env.AWS_S3_BUCKET!;

/**
 * Uploads a buffer to S3 and returns the public URL.
 */
export async function uploadToS3(
    buffer: Buffer,
    key: string,
    contentType: string,
): Promise<string> {
    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        }),
    );

    // If the bucket has a custom domain or CloudFront, use that.
    // Otherwise, return the standard S3 URL.
    const customDomain = process.env.AWS_S3_CUSTOM_DOMAIN;
    if (customDomain) {
        return `${customDomain}/${key}`;
    }

    return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

/**
 * Deletes an object from S3 using its key.
 */
export async function deleteFromS3(key: string): Promise<void> {
    try {
        await s3.send(
            new DeleteObjectCommand({
                Bucket: BUCKET,
                Key: key,
            }),
        );
    } catch (error) {
        console.warn('Could not delete file from S3:', error);
    }
}

/**
 * Generates a presigned URL for temporary access to a private object.
 * Useful if the bucket is not public.
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });
    return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Extracts the S3 key from a full URL.
 * Works with standard S3 URLs and custom domains.
 */
export function extractKeyFromUrl(url: string): string | null {
    try {
        const customDomain = process.env.AWS_S3_CUSTOM_DOMAIN;
        if (customDomain && url.startsWith(customDomain)) {
            return url.replace(`${customDomain}/`, '');
        }

        // Standard S3 URL pattern: https://bucket.s3.region.amazonaws.com/key
        const match = url.match(/\.amazonaws\.com\/(.+)$/);
        if (match) return decodeURIComponent(match[1]);

        return null;
    } catch {
        return null;
    }
}
