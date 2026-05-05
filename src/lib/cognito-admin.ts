import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  type AdminCreateUserCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider';

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!;
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!;
const region = process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1';

/**
 * Verifies Cognito ID tokens on the server side using aws-jwt-verify.
 */
export const cognitoVerifier = CognitoJwtVerifier.create({
  userPoolId,
  tokenUse: 'id',
  clientId,
});

export interface CognitoDecodedToken {
  sub: string;
  email: string;
  'cognito:username': string;
  email_verified: boolean;
  iss: string;
  'custom:display_name'?: string;
}

/**
 * Verify and decode a Cognito ID token.
 * @throws if the token is invalid or expired.
 */
export async function verifyIdToken(token: string): Promise<CognitoDecodedToken> {
  const payload = await cognitoVerifier.verify(token);
  return payload as unknown as CognitoDecodedToken;
}

// ══════════════════════════════════════════════════════════════
// ADMIN CLIENT — server-side user management
// ══════════════════════════════════════════════════════════════

const cognitoClient = new CognitoIdentityProviderClient({ region });

export interface CreateCognitoUserResult {
  uid: string;
  email: string;
}

/**
 * Creates a new user in the Cognito User Pool (server-side admin operation).
 * Creates a Cognito user via AdminCreateUserCommand.
 */
export async function createCognitoUser(params: {
  email: string;
  password?: string;
  displayName: string;
}): Promise<CreateCognitoUserResult> {
  const tempPassword = params.password || 'Temp1234!';

  const result: AdminCreateUserCommandOutput = await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: params.email,
      TemporaryPassword: tempPassword,
      UserAttributes: [
        { Name: 'email', Value: params.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'custom:display_name', Value: params.displayName },
      ],
      MessageAction: 'SUPPRESS', // Don't send welcome email — the app handles onboarding
    }),
  );

  const sub = result.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
  if (!sub) {
    throw new Error('Cognito user created but sub attribute not found');
  }

  return { uid: sub, email: params.email };
}
