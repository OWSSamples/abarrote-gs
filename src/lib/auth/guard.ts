import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { verifyIdToken } from '@/lib/cognito-admin';
import { db } from '@/db';
import { userRoles, roleDefinitions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { PermissionKey } from '@/types';
import { logger } from '@/lib/logger';

// ==================== TYPES ====================

export interface AuthenticatedUser {
  uid: string;
  email: string;
  roleId: string;
  roleName?: string;
  permissions: PermissionKey[];
  displayName?: string;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

// ==================== TOKEN EXTRACTION ====================

/**
 * Extracts the Cognito ID token from the request.
 * Checks: Authorization header > __session cookie
 */
async function extractToken(): Promise<string | null> {
  // 1. Check Authorization header (Bearer token)
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // 2. Check cookie
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (sessionCookie) {
    return sessionCookie;
  }

  return null;
}

// ==================== CORE AUTH FUNCTION ====================

/**
 * Internal cached resolver — deduplicates DB calls within the same request.
 * If requireAuth() is called multiple times in one request, only one DB query runs.
 */
const verifyToken = cache(async (token: string): Promise<AuthenticatedUser> => {
  const decodedToken = await verifyIdToken(token);
  const uid = decodedToken.sub;
  const email = decodedToken.email || '';
  const tokenName = decodedToken['custom:display_name'] || decodedToken['cognito:username'] || '';

  // Single JOIN query: user role + permissions in one round-trip
  const rows = await db
    .select({
      status: userRoles.status,
      roleId: userRoles.roleId,
      displayName: userRoles.displayName,
      permissions: roleDefinitions.permissions,
      roleName: roleDefinitions.name,
    })
    .from(userRoles)
    .leftJoin(roleDefinitions, eq(roleDefinitions.id, userRoles.roleId))
    .where(eq(userRoles.cognitoSub, uid))
    .limit(1);

  // Auto-bootstrap: si el usuario tiene token Cognito válido pero no
  // existe en la tabla user_roles, lo creamos automáticamente. El
  // primer usuario en absoluto se vuelve Propietario; los siguientes
  // entran como "Solo lectura" hasta que un admin les asigne rol.
  if (rows.length === 0) {
    logger.info('Auto-bootstrap: creating user_roles row for new Cognito user', {
      action: 'auth_auto_bootstrap',
      uid,
      email,
    });
    const { ensureOwnerRole } = await import('@/app/actions/role-actions');
    const created = await ensureOwnerRole(uid, email, tokenName);
    const roleDef = await db
      .select({ permissions: roleDefinitions.permissions, name: roleDefinitions.name })
      .from(roleDefinitions)
      .where(eq(roleDefinitions.id, created.roleId))
      .limit(1);
    let perms: PermissionKey[] = [];
    if (roleDef[0]?.permissions) {
      try {
        perms = JSON.parse(roleDef[0].permissions) as PermissionKey[];
      } catch {
        perms = [];
      }
    }
    return {
      uid,
      email,
      roleId: created.roleId,
      roleName: roleDef[0]?.name ?? undefined,
      permissions: perms,
      displayName: created.displayName || tokenName || undefined,
    };
  }

  const row = rows[0];

  if (row.status !== 'activo') {
    throw new AuthError('Tu cuenta ha sido desactivada. Contacta al administrador.', 403);
  }

  let permissions: PermissionKey[] = [];
  if (row.permissions) {
    try {
      permissions = JSON.parse(row.permissions) as PermissionKey[];
    } catch {
      permissions = [];
    }
  }

  return {
    uid,
    email,
    roleId: row.roleId,
    roleName: row.roleName ?? undefined,
    permissions,
    displayName: row.displayName || undefined,
  };
});

/**
 * Verifies the current request is from an authenticated user.
 * Returns user info including role and permissions.
 * Throws AuthError if not authenticated.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const token = await extractToken();

  if (!token) {
    throw new AuthError('Autenticación requerida', 401);
  }

  try {
    const user = await verifyToken(token);
    // Asocia el usuario al contexto de observabilidad (Sentry).
    // No-op si Sentry no está instalado/configurado.
    void import('@/lib/observability').then((obs) => obs.setObservabilityUser({ id: user.uid, email: user.email }));
    return user;
  } catch (error) {
    if (error instanceof AuthError) throw error;

    // Log full detail internally — expose uniform message to client
    const message = error instanceof Error ? error.message : 'Unknown';
    const code = (error as { code?: string }).code ?? '';
    logger.warn('Auth verification failed', {
      action: 'requireAuth',
      error: message,
      code,
    });

    // Classify using Cognito JWT error types
    const isExpired =
      message.includes('Token expired') ||
      message.includes('Token use is not') ||
      (error as { name?: string }).name === 'JwtExpiredError';

    throw new AuthError(
      isExpired
        ? 'Tu sesión ha expirado. Inicia sesión de nuevo.'
        : 'Error de autenticación. Inicia sesión de nuevo.',
      401,
    );
  }
}

// ==================== PERMISSION HELPERS ====================

/**
 * Requires the user to have at least one of the specified permissions.
 */
export async function requirePermission(...requiredPerms: PermissionKey[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  // Propietario/Administrador bypass all permission checks
  if (user.roleName === 'Propietario' || user.roleName === 'Administrador') return user;

  const hasPermission = requiredPerms.some((perm) => user.permissions.includes(perm));

  if (!hasPermission) {
    logger.warn('Permission denied', {
      action: 'requirePermission',
      userId: user.uid,
      required: requiredPerms.join(','),
      userRole: user.roleId,
    });
    throw new AuthError('No tienes permisos para esta acción', 403);
  }

  return user;
}

/**
 * Requires the user to be the owner/admin.
 */
export async function requireOwner(): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (user.roleName !== 'Propietario') {
    throw new AuthError('Esta acción requiere permisos de administrador TI', 403);
  }

  return user;
}

// ==================== INPUT VALIDATION ====================

/**
 * Sanitizes a string input to prevent injection attacks.
 * Strips HTML entities, null bytes, SQL comment sequences, and control characters.
 */
export function sanitize(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[<>"'`;]/g, '') // Remove HTML/injection characters
    .replace(/--/g, '') // Remove SQL comment sequences
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, 1000); // Limit length
}

/**
 * Validates that a number is within a safe range.
 */
export function validateNumber(value: number, { min = 0, max = 999999999, label = 'valor' } = {}): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new AuthError(`${label} debe ser un número válido`, 400);
  }
  if (value < min || value > max) {
    throw new AuthError(`${label} debe estar entre ${min} y ${max}`, 400);
  }
  return value;
}

/**
 * Validates that an ID looks legitimate (prevents injection).
 */
export function validateId(id: string, label = 'ID'): string {
  if (!id || typeof id !== 'string') {
    throw new AuthError(`${label} es obligatorio`, 400);
  }
  // Only allow alphanumeric, dashes, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || id.length > 128) {
    throw new AuthError(`${label} tiene un formato inválido`, 400);
  }
  return id;
}
