/**
 * Copies sensitive tenant assets to the private S3 bucket and rewrites stored
 * references to the authenticated asset endpoint. Source objects are retained
 * for rollback and must be removed only after production validation.
 *
 * Dry run:
 *   bun scripts/migrate-private-assets.ts --profile opendex-admin
 *
 * Apply after /api/assets/[assetId] is deployed:
 *   bun scripts/migrate-private-assets.ts --profile opendex-admin --apply --confirm-route-deployed
 */

import {
  CopyObjectCommand,
  HeadObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });

interface AssetRow {
  id: string;
  store_id: string;
  kind: 'receipts' | 'evidence';
  object_key: string;
  public_url: string;
}

interface MigrationOptions {
  apply: boolean;
  routeConfirmed: boolean;
  profile?: string;
}

function parseOptions(): MigrationOptions {
  const args = process.argv.slice(2);
  const profileIndex = args.indexOf('--profile');
  return {
    apply: args.includes('--apply'),
    routeConfirmed: args.includes('--confirm-route-deployed'),
    profile: profileIndex >= 0 ? args[profileIndex + 1] : undefined,
  };
}

function configureAwsProfile(profile?: string): void {
  if (!profile) return;
  process.env.AWS_PROFILE = profile;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_SESSION_TOKEN;
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function copySource(bucket: string, objectKey: string): string {
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');
  return `${encodeURIComponent(bucket)}/${encodedKey}`;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && (error.name === 'NotFound' || error.name === 'NoSuchKey');
}

async function getDestinationHead(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<HeadObjectCommandOutput | null> {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function main(): Promise<void> {
  const options = parseOptions();
  configureAwsProfile(options.profile);

  if (options.apply && !options.routeConfirmed) {
    throw new Error('--apply requires --confirm-route-deployed');
  }

  const databaseUrl = requireEnvironment('DATABASE_URL');
  const sourceBucket = requireEnvironment('AWS_S3_BUCKET');
  const sourceRegion = process.env.AWS_S3_REGION || requireEnvironment('AWS_REGION');
  const destinationBucket = requireEnvironment('AWS_S3_PRIVATE_BUCKET');
  const destinationRegion = process.env.AWS_S3_PRIVATE_REGION || requireEnvironment('AWS_REGION');

  const sourceS3 = new S3Client({ region: sourceRegion });
  const destinationS3 = new S3Client({ region: destinationRegion });
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, idle_timeout: 10 });

  try {
    const [schemaState] = await sql<{ tenant_assets_exists: boolean }[]>`
      SELECT to_regclass('public.tenant_assets') IS NOT NULL AS tenant_assets_exists
    `;
    if (!schemaState?.tenant_assets_exists) {
      throw new Error('tenant_assets is missing; apply database migration 0032 before migrating private assets');
    }

    const assets = await sql<AssetRow[]>`
      SELECT id, store_id, kind, object_key, public_url
      FROM tenant_assets
      WHERE kind IN ('receipts', 'evidence')
        AND deleted_at IS NULL
        AND public_url NOT LIKE '/api/assets/%'
      ORDER BY created_at ASC
    `;

    console.log(`Sensitive assets pending migration: ${assets.length}`);
    if (!options.apply || assets.length === 0) {
      console.log(options.apply ? 'No changes required.' : 'Dry run only. No S3 or database changes were made.');
      return;
    }

    let copied = 0;
    let migrated = 0;
    for (const asset of assets) {
      const destinationHead = await getDestinationHead(destinationS3, destinationBucket, asset.object_key);
      if (!destinationHead) {
        const sourceHead = await sourceS3.send(new HeadObjectCommand({
          Bucket: sourceBucket,
          Key: asset.object_key,
        }));
        await destinationS3.send(new CopyObjectCommand({
          Bucket: destinationBucket,
          Key: asset.object_key,
          CopySource: copySource(sourceBucket, asset.object_key),
          ContentType: sourceHead.ContentType,
          ContentDisposition: sourceHead.ContentDisposition,
          CacheControl: 'private, no-store',
          MetadataDirective: 'REPLACE',
          Metadata: { ...sourceHead.Metadata, access: 'private' },
          ServerSideEncryption: 'AES256',
        }));
        copied += 1;
      }

      const accessUrl = `/api/assets/${asset.id}`;
      await sql.begin(async (transaction) => {
        const updatedAsset = await transaction<{ id: string }[]>`
          UPDATE tenant_assets
          SET public_url = ${accessUrl}
          WHERE id = ${asset.id}
            AND store_id = ${asset.store_id}
            AND public_url = ${asset.public_url}
          RETURNING id
        `;
        if (updatedAsset.length !== 1) {
          throw new Error('Asset changed concurrently; migration stopped');
        }

        if (asset.kind === 'receipts') {
          await transaction`
            UPDATE gastos
            SET comprobante_url = ${accessUrl}
            WHERE store_id = ${asset.store_id}
              AND comprobante_url = ${asset.public_url}
          `;
        } else {
          await transaction`
            UPDATE merma_records
            SET evidence_url = ${accessUrl}
            WHERE store_id = ${asset.store_id}
              AND evidence_url = ${asset.public_url}
          `;
        }
      });
      migrated += 1;
    }

    console.log(`Copied to private storage: ${copied}`);
    console.log(`Database references migrated: ${migrated}`);
    console.log('Public source objects were retained for rollback.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Private asset migration failed');
  process.exitCode = 1;
});
