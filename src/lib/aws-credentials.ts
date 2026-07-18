import 'server-only';

import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';
import type { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@smithy/types';
import { env } from '@/lib/env';

type AwsCredentials = AwsCredentialIdentity | AwsCredentialIdentityProvider;

let vercelCredentials: AwsCredentialIdentityProvider | null = null;

/**
 * Resolves AWS credentials without coupling service clients to one runtime.
 * Production uses short-lived Vercel OIDC credentials; local development may
 * use an explicit key pair or the standard AWS SDK credential chain.
 */
export function getAwsCredentials(): AwsCredentials | undefined {
  if (env.AWS_ROLE_ARN && process.env.VERCEL) {
    vercelCredentials ??= awsCredentialsProvider({
      roleArn: env.AWS_ROLE_ARN,
      audience: env.AWS_OIDC_AUDIENCE ?? 'https://vercel.com/opendex-corporation',
      roleSessionName: 'opendex-kiosko-production',
      durationSeconds: 3600,
      clientConfig: {
        region: env.AWS_REGION ?? 'us-east-1',
      },
    });

    return vercelCredentials;
  }

  if (env.AWS_ACCESS_KEY_ID || env.AWS_SECRET_ACCESS_KEY) {
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS_STATIC_CREDENTIALS_INCOMPLETE');
    }

    return {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    };
  }

  return undefined;
}
