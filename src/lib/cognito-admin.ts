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
  ListUsersCommand,
  ListGroupsCommand,
  type AdminCreateUserCommandOutput,
  type ListUsersCommandOutput,
  type UserType,
  type GroupType,
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
    displayName: find('custom:display_name') || find('name') || '',
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

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response: ListUsersCommandOutput = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
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
      UserPoolId: userPoolId,
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
  const result = await cognitoClient.send(
    new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: usernameOrSub,
    }),
  );
  const attrs = result.UserAttributes ?? [];
  const find = (n: string) => attrs.find((a) => a.Name === n)?.Value ?? '';
  return {
    sub: find('sub'),
    username: result.Username ?? '',
    email: find('email'),
    emailVerified: find('email_verified') === 'true',
    displayName: find('custom:display_name') || find('name') || '',
    status: result.UserStatus ?? 'UNKNOWN',
    enabled: result.Enabled ?? false,
    createdAt: result.UserCreateDate?.toISOString() ?? '',
    updatedAt: result.UserLastModifiedDate?.toISOString() ?? '',
    mfaEnabled: (result.MFAOptions?.length ?? 0) > 0,
    phoneNumber: find('phone_number') || undefined,
    phoneVerified: find('phone_number_verified') === 'true' ? true : undefined,
  };
}

/** Disables sign-in for a Cognito user (reversible). */
export async function disableCognitoUser(username: string): Promise<void> {
  await cognitoClient.send(
    new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: username }),
  );
}

/** Re-enables a previously disabled Cognito user. */
export async function enableCognitoUser(username: string): Promise<void> {
  await cognitoClient.send(
    new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: username }),
  );
}

/** Permanently deletes a Cognito user. Irreversible. */
export async function deleteCognitoUser(username: string): Promise<void> {
  await cognitoClient.send(
    new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username }),
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
  await cognitoClient.send(
    new AdminUserGlobalSignOutCommand({ UserPoolId: userPoolId, Username: username }),
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
  await cognitoClient.send(
    new AdminResetUserPasswordCommand({ UserPoolId: userPoolId, Username: username }),
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
  await cognitoClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
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
    userAttributes.push({ Name: 'custom:display_name', Value: attrs.displayName });
  if (attrs.phoneNumber !== undefined)
    userAttributes.push({ Name: 'phone_number', Value: attrs.phoneNumber });
  if (attrs.phoneVerified !== undefined)
    userAttributes.push({ Name: 'phone_number_verified', Value: String(attrs.phoneVerified) });
  if (userAttributes.length === 0) return;

  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId,
      Username: username,
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
    new ListGroupsCommand({ UserPoolId: userPoolId, Limit: 60 }),
  );
  return (result.Groups ?? []).map(toGroupSummary);
}

/** Lists groups a specific user belongs to. */
export async function listUserGroups(username: string): Promise<CognitoGroup[]> {
  const result = await cognitoClient.send(
    new AdminListGroupsForUserCommand({
      UserPoolId: userPoolId,
      Username: username,
      Limit: 60,
    }),
  );
  return (result.Groups ?? []).map(toGroupSummary);
}

/** Adds a user to a Cognito group. */
export async function addUserToGroup(username: string, groupName: string): Promise<void> {
  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: groupName,
    }),
  );
}

/** Removes a user from a Cognito group. */
export async function removeUserFromGroup(username: string, groupName: string): Promise<void> {
  await cognitoClient.send(
    new AdminRemoveUserFromGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
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

