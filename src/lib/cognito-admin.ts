import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminResetUserPasswordCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminUserGlobalSignOutCommand,
  AdminListGroupsForUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserMFAPreferenceCommand,
  ListUsersCommand,
  ListGroupsCommand,
  type AdminGetUserCommandOutput,
  type AdminCreateUserCommandOutput,
  type ListUsersCommandOutput,
  type UserType,
  type GroupType,
} from '@aws-sdk/client-cognito-identity-provider';
import { getAwsCredentials } from '@/lib/aws-credentials';

const region = process.env.COGNITO_REGION || process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1';
const cognitoClient = new CognitoIdentityProviderClient({
  region,
  credentials: getAwsCredentials(),
});

let lazyCognitoVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;
let lazyCognitoAccessVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getCognitoConfig(): { userPoolId: string; clientId: string } {
  const userPoolId = process.env.COGNITO_USER_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

  if (!userPoolId || !clientId) {
    throw new Error(
      'AWS Cognito no está configurado. Verifica COGNITO_USER_POOL_ID y COGNITO_CLIENT_ID.',
    );
  }

  return { userPoolId, clientId };
}

function getUserPoolId(): string {
  return getCognitoConfig().userPoolId;
}

function getCognitoVerifier(): ReturnType<typeof CognitoJwtVerifier.create> {
  if (!lazyCognitoVerifier) {
    const { userPoolId, clientId } = getCognitoConfig();
    lazyCognitoVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'id',
      clientId,
    });
  }

  return lazyCognitoVerifier;
}

function getCognitoAccessVerifier(): ReturnType<typeof CognitoJwtVerifier.create> {
  if (!lazyCognitoAccessVerifier) {
    const { userPoolId, clientId } = getCognitoConfig();
    lazyCognitoAccessVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access',
      clientId,
    });
  }

  return lazyCognitoAccessVerifier;
}

function isUserNotFoundError(err: unknown): boolean {
  const error = err as { name?: string; message?: string };
  return error.name === 'UserNotFoundException' || Boolean(error.message?.includes('User does not exist'));
}

async function adminGetUserRaw(username: string): Promise<AdminGetUserCommandOutput> {
  return cognitoClient.send(
    new AdminGetUserCommand({
      UserPoolId: getUserPoolId(),
      Username: username,
    }),
  );
}

async function resolveUsernameFromSub(cognitoSub: string): Promise<string> {
  const result = await cognitoClient.send(
    new ListUsersCommand({
      UserPoolId: getUserPoolId(),
      Limit: 1,
      Filter: `sub = "${cognitoSub.replace(/"/g, '\\"')}"`,
    }),
  );

  const username = result.Users?.[0]?.Username;
  if (!username) {
    throw new Error('Usuario Cognito no encontrado para el sub proporcionado.');
  }

  return username;
}

async function resolveCognitoUsername(usernameOrSub: string): Promise<string> {
  try {
    const user = await adminGetUserRaw(usernameOrSub);
    return user.Username ?? usernameOrSub;
  } catch (err) {
    if (!isUserNotFoundError(err)) throw err;
    return resolveUsernameFromSub(usernameOrSub);
  }
}

/**
 * Verifies Cognito ID tokens on the server side using aws-jwt-verify.
 */
export interface CognitoDecodedToken {
  sub: string;
  email: string;
  'cognito:username': string;
  email_verified: boolean;
  iss: string;
  exp: number;
  iat: number;
  auth_time?: number;
  'custom:display_name'?: string;
  name?: string;
}

export interface CognitoAccessToken {
  sub: string;
  client_id: string;
  token_use: 'access';
  scope?: string;
  exp: number;
  iat: number;
}

/**
 * Verify and decode a Cognito ID token.
 * @throws if the token is invalid or expired.
 */
export async function verifyIdToken(token: string): Promise<CognitoDecodedToken> {
  const payload = await getCognitoVerifier().verify(token);
  return payload as unknown as CognitoDecodedToken;
}

export async function verifyAccessToken(token: string): Promise<CognitoAccessToken> {
  const payload = await getCognitoAccessVerifier().verify(token);
  return payload as unknown as CognitoAccessToken;
}

// ══════════════════════════════════════════════════════════════
// ADMIN CLIENT — server-side user management
// ══════════════════════════════════════════════════════════════

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
  password: string;
  displayName: string;
}): Promise<CreateCognitoUserResult> {
  const result: AdminCreateUserCommandOutput = await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: getUserPoolId(),
      Username: params.email,
      TemporaryPassword: params.password,
      UserAttributes: [
        { Name: 'email', Value: params.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: params.displayName },
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

// ══════════════════════════════════════════════════════════════
// USER LIFECYCLE — list / get / disable / enable / delete
// ══════════════════════════════════════════════════════════════

export interface CognitoUserSummary {
  sub: string;
  username: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  status: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  mfaEnabled: boolean;
  phoneNumber?: string;
  phoneVerified?: boolean;
  lastLogin?: string;
}

function toCognitoUserSummary(u: UserType): CognitoUserSummary {
  const attrs = u.Attributes ?? [];
  const find = (n: string) => attrs.find((a) => a.Name === n)?.Value ?? '';
  return {
    sub: find('sub'),
    username: u.Username ?? '',
    email: find('email'),
    emailVerified: find('email_verified') === 'true',
    displayName: find('name') || find('custom:display_name') || '',
    status: u.UserStatus ?? 'UNKNOWN',
    enabled: u.Enabled ?? false,
    createdAt: u.UserCreateDate?.toISOString() ?? '',
    updatedAt: u.UserLastModifiedDate?.toISOString() ?? '',
    mfaEnabled: (u.MFAOptions?.length ?? 0) > 0,
    phoneNumber: find('phone_number') || undefined,
    phoneVerified: find('phone_number_verified') === 'true' ? true : undefined,
  };
}

/**
 * Lists ALL Cognito users (auto-paginating). For enterprise use —
 * retrieves all pages until no more PaginationToken is returned.
 */
export async function listAllCognitoUsers(filter?: string): Promise<CognitoUserSummary[]> {
  const allUsers: CognitoUserSummary[] = [];
  let paginationToken: string | undefined = undefined;

  while (true) {
    const response: ListUsersCommandOutput = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: getUserPoolId(),
        Limit: 60,
        PaginationToken: paginationToken,
        Filter: filter || undefined,
      }),
    );
    allUsers.push(...(response.Users ?? []).map(toCognitoUserSummary));
    if (!response.PaginationToken) break;
    paginationToken = response.PaginationToken;
  }

  return allUsers;
}

/**
 * Lists Cognito users with cursor-based pagination.
 */
export async function listCognitoUsers(params?: {
  limit?: number;
  paginationToken?: string;
  filter?: string;
}): Promise<{ users: CognitoUserSummary[]; nextToken?: string; totalEstimate?: number }> {
  const result = await cognitoClient.send(
    new ListUsersCommand({
      UserPoolId: getUserPoolId(),
      Limit: Math.min(params?.limit ?? 60, 60),
      PaginationToken: params?.paginationToken,
      Filter: params?.filter,
    }),
  );
  return {
    users: (result.Users ?? []).map(toCognitoUserSummary),
    nextToken: result.PaginationToken,
  };
}

/**
 * Get a single Cognito user with full detail.
 */
export async function getCognitoUser(usernameOrSub: string): Promise<CognitoUserSummary> {
  let result: AdminGetUserCommandOutput;
  try {
    result = await adminGetUserRaw(usernameOrSub);
  } catch (err) {
    if (!isUserNotFoundError(err)) throw err;
    result = await adminGetUserRaw(await resolveUsernameFromSub(usernameOrSub));
  }
  const attrs = result.UserAttributes ?? [];
  const find = (n: string) => attrs.find((a) => a.Name === n)?.Value ?? '';
  return {
    sub: find('sub'),
    username: result.Username ?? '',
    email: find('email'),
    emailVerified: find('email_verified') === 'true',
    displayName: find('name') || find('custom:display_name') || '',
    status: result.UserStatus ?? 'UNKNOWN',
    enabled: result.Enabled ?? false,
    createdAt: result.UserCreateDate?.toISOString() ?? '',
    updatedAt: result.UserLastModifiedDate?.toISOString() ?? '',
    mfaEnabled: (result.UserMFASettingList?.length ?? 0) > 0 || (result.MFAOptions?.length ?? 0) > 0,
    phoneNumber: find('phone_number') || undefined,
    phoneVerified: find('phone_number_verified') === 'true' ? true : undefined,
  };
}

/** Disables sign-in for a Cognito user (reversible). */
export async function disableCognitoUser(username: string): Promise<void> {
  const resolvedUsername = await resolveCognitoUsername(username);
  await cognitoClient.send(
    new AdminDisableUserCommand({ UserPoolId: getUserPoolId(), Username: resolvedUsername }),
  );
}

/** Re-enables a previously disabled Cognito user. */
export async function enableCognitoUser(username: string): Promise<void> {
  const resolvedUsername = await resolveCognitoUsername(username);
  await cognitoClient.send(
    new AdminEnableUserCommand({ UserPoolId: getUserPoolId(), Username: resolvedUsername }),
  );
}

/** Permanently deletes a Cognito user. Irreversible. */
export async function deleteCognitoUser(username: string): Promise<void> {
  const resolvedUsername = await resolveCognitoUsername(username);
  await cognitoClient.send(
    new AdminDeleteUserCommand({ UserPoolId: getUserPoolId(), Username: resolvedUsername }),
  );
}

// ══════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════════

/**
 * Forces global sign-out — invalidates ALL of the user's tokens and
 * sessions across all devices. They'll need to re-authenticate everywhere.
 */
export async function globalSignOutUser(username: string): Promise<void> {
  const resolvedUsername = await resolveCognitoUsername(username);
  await cognitoClient.send(
    new AdminUserGlobalSignOutCommand({ UserPoolId: getUserPoolId(), Username: resolvedUsername }),
  );
}

// ══════════════════════════════════════════════════════════════
// PASSWORD MANAGEMENT
// ══════════════════════════════════════════════════════════════

/**
 * Triggers a password reset for a user. Cognito will email a verification
 * code which the user enters to set a new password.
 */
export async function adminResetUserPassword(username: string): Promise<void> {
  const resolvedUsername = await resolveCognitoUsername(username);
  await cognitoClient.send(
    new AdminResetUserPasswordCommand({ UserPoolId: getUserPoolId(), Username: resolvedUsername }),
  );
}

/**
 * Sets a password for the user without requiring the email-code flow.
 * Use `permanent: true` to skip the FORCE_CHANGE_PASSWORD challenge.
 */
export async function adminSetUserPassword(
  username: string,
  password: string,
  permanent = false,
): Promise<void> {
  const resolvedUsername = await resolveCognitoUsername(username);
  await cognitoClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: getUserPoolId(),
      Username: resolvedUsername,
      Password: password,
      Permanent: permanent,
    }),
  );
}

// ══════════════════════════════════════════════════════════════
// ATTRIBUTE UPDATES
// ══════════════════════════════════════════════════════════════

/**
 * Updates Cognito user attributes (display name, email, phone, etc).
 */
export async function updateCognitoUserAttributes(
  username: string,
  attrs: {
    email?: string;
    displayName?: string;
    emailVerified?: boolean;
    phoneNumber?: string;
    phoneVerified?: boolean;
  },
): Promise<void> {
  const userAttributes: { Name: string; Value: string }[] = [];
  if (attrs.email !== undefined) userAttributes.push({ Name: 'email', Value: attrs.email });
  if (attrs.emailVerified !== undefined)
    userAttributes.push({ Name: 'email_verified', Value: String(attrs.emailVerified) });
  if (attrs.displayName !== undefined)
    userAttributes.push({ Name: 'name', Value: attrs.displayName });
  if (attrs.phoneNumber !== undefined)
    userAttributes.push({ Name: 'phone_number', Value: attrs.phoneNumber });
  if (attrs.phoneVerified !== undefined)
    userAttributes.push({ Name: 'phone_number_verified', Value: String(attrs.phoneVerified) });
  if (userAttributes.length === 0) return;

  const resolvedUsername = await resolveCognitoUsername(username);
  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: getUserPoolId(),
      Username: resolvedUsername,
      UserAttributes: userAttributes,
    }),
  );
}

// ══════════════════════════════════════════════════════════════
// GROUP MANAGEMENT (Cognito Groups as permission boundaries)
// ══════════════════════════════════════════════════════════════

export interface CognitoGroup {
  name: string;
  description: string;
  precedence: number;
  roleArn?: string;
  createdAt: string;
  updatedAt: string;
}

function toGroupSummary(g: GroupType): CognitoGroup {
  return {
    name: g.GroupName ?? '',
    description: g.Description ?? '',
    precedence: g.Precedence ?? 0,
    roleArn: g.RoleArn ?? undefined,
    createdAt: g.CreationDate?.toISOString() ?? '',
    updatedAt: g.LastModifiedDate?.toISOString() ?? '',
  };
}

/** Lists all groups in the User Pool. */
export async function listCognitoGroups(): Promise<CognitoGroup[]> {
  const result = await cognitoClient.send(
    new ListGroupsCommand({ UserPoolId: getUserPoolId(), Limit: 60 }),
  );
  return (result.Groups ?? []).map(toGroupSummary);
}

/** Lists groups a specific user belongs to. */
export async function listUserGroups(username: string): Promise<CognitoGroup[]> {
  const resolvedUsername = await resolveCognitoUsername(username);
  const result = await cognitoClient.send(
    new AdminListGroupsForUserCommand({
      UserPoolId: getUserPoolId(),
      Username: resolvedUsername,
      Limit: 60,
    }),
  );
  return (result.Groups ?? []).map(toGroupSummary);
}

/** Adds a user to a Cognito group. */
export async function addUserToGroup(username: string, groupName: string): Promise<void> {
  const resolvedUsername = await resolveCognitoUsername(username);
  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: getUserPoolId(),
      Username: resolvedUsername,
      GroupName: groupName,
    }),
  );
}

/** Removes a user from a Cognito group. */
export async function removeUserFromGroup(username: string, groupName: string): Promise<void> {
  const resolvedUsername = await resolveCognitoUsername(username);
  await cognitoClient.send(
    new AdminRemoveUserFromGroupCommand({
      UserPoolId: getUserPoolId(),
      Username: resolvedUsername,
      GroupName: groupName,
    }),
  );
}

// ══════════════════════════════════════════════════════════════
// BULK OPERATIONS
// ══════════════════════════════════════════════════════════════

export interface BulkOperationResult {
  success: string[];
  failed: { username: string; error: string }[];
}

/** Bulk disable multiple users. */
export async function bulkDisableUsers(usernames: string[]): Promise<BulkOperationResult> {
  const result: BulkOperationResult = { success: [], failed: [] };
  for (const username of usernames) {
    try {
      await disableCognitoUser(username);
      result.success.push(username);
    } catch (err) {
      result.failed.push({ username, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
  return result;
}

/** Bulk enable multiple users. */
export async function bulkEnableUsers(usernames: string[]): Promise<BulkOperationResult> {
  const result: BulkOperationResult = { success: [], failed: [] };
  for (const username of usernames) {
    try {
      await enableCognitoUser(username);
      result.success.push(username);
    } catch (err) {
      result.failed.push({ username, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
  return result;
}

/** Bulk force global sign-out for multiple users. */
export async function bulkGlobalSignOut(usernames: string[]): Promise<BulkOperationResult> {
  const result: BulkOperationResult = { success: [], failed: [] };
  for (const username of usernames) {
    try {
      await globalSignOutUser(username);
      result.success.push(username);
    } catch (err) {
      result.failed.push({ username, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
  return result;
}

// ══════════════════════════════════════════════════════════════
// MFA MANAGEMENT
// ══════════════════════════════════════════════════════════════

/** Enable or disable TOTP MFA for a Cognito user (admin operation). */
export async function adminSetUserMfaPreference(
  username: string,
  enabled: boolean,
): Promise<void> {
  const resolvedUsername = await resolveCognitoUsername(username);
  await cognitoClient.send(
    new AdminSetUserMFAPreferenceCommand({
      UserPoolId: getUserPoolId(),
      Username: resolvedUsername,
      SoftwareTokenMfaSettings: {
        Enabled: enabled,
        PreferredMfa: enabled,
      },
    }),
  );
}
