import 'server-only';

import { S3Client } from '@aws-sdk/client-s3';
import { getAwsCredentials } from '@/lib/aws-credentials';
import { env, isPrivateS3Configured, isS3Configured } from '@/lib/env';

export const ASSET_KINDS = [
  'products',
  'avatars',
  'logos',
  'receipts',
  'evidence',
  'promo',
  'display',
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];
export type PrivateAssetKind = 'receipts' | 'evidence';

const PRIVATE_ASSET_KINDS = new Set<PrivateAssetKind>(['receipts', 'evidence']);

function createS3Client(region: string | undefined): S3Client {
  return new S3Client({
    region,
    credentials: getAwsCredentials(),
  });
}

const publicRegion = env.AWS_S3_REGION || env.AWS_REGION;
const privateRegion = env.AWS_S3_PRIVATE_REGION || env.AWS_REGION;

export const publicAssetS3 = createS3Client(publicRegion);
export const privateAssetS3 = createS3Client(privateRegion);

export function isPrivateAssetKind(kind: string): kind is PrivateAssetKind {
  return PRIVATE_ASSET_KINDS.has(kind as PrivateAssetKind);
}

export function assertStorageConfigured(kind: AssetKind): void {
  if (!isS3Configured()) {
    throw new Error('PUBLIC_STORAGE_NOT_CONFIGURED');
  }
  if (isPrivateAssetKind(kind) && !isPrivateS3Configured()) {
    throw new Error('PRIVATE_STORAGE_NOT_CONFIGURED');
  }
}

export function getUploadTarget(kind: AssetKind): {
  bucket: string;
  client: S3Client;
  isPrivate: boolean;
  region: string;
} {
  assertStorageConfigured(kind);

  if (isPrivateAssetKind(kind)) {
    return {
      bucket: env.AWS_S3_PRIVATE_BUCKET!,
      client: privateAssetS3,
      isPrivate: true,
      region: privateRegion!,
    };
  }

  return {
    bucket: env.AWS_S3_BUCKET!,
    client: publicAssetS3,
    isPrivate: false,
    region: publicRegion!,
  };
}

export function getStoredAssetTarget(kind: AssetKind, accessUrl: string): {
  bucket: string;
  client: S3Client;
  isPrivate: boolean;
} {
  const usesPrivateBucket = isPrivateAssetKind(kind) && accessUrl.startsWith('/api/assets/');
  if (usesPrivateBucket) {
    if (!isPrivateS3Configured()) throw new Error('PRIVATE_STORAGE_NOT_CONFIGURED');
    return { bucket: env.AWS_S3_PRIVATE_BUCKET!, client: privateAssetS3, isPrivate: true };
  }

  if (!isS3Configured()) throw new Error('PUBLIC_STORAGE_NOT_CONFIGURED');
  return { bucket: env.AWS_S3_BUCKET!, client: publicAssetS3, isPrivate: false };
}

export function publicObjectUrl(bucket: string, region: string, objectKey: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${objectKey}`;
}

export function privateAssetUrl(assetId: string): string {
  return `/api/assets/${assetId}`;
}
