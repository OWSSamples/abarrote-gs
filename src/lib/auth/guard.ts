import { cookies, headers } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import { db } from '@/db';
import { userRoles, roleDefinitions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { PermissionKey } from '@/types';

// ==================== TYPES ====================

export interface AuthenticatedUser {
    uid: string;
    email: string;
    roleId: string;
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
 * Extracts the Firebase ID token from the request.
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
 * Verifies the current request is from an authenticated user.
 * Returns user info including role and permissions.
 * Throws AuthError if not authenticated.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
    const token = await extractToken();

    if (!token) {
        throw new AuthError('No se proporcionó token de autenticación', 401);
    }

    try {
        // Verify the Firebase ID token server-side
        const decodedToken = await adminAuth.verifyIdToken(token, true);
        const uid = decodedToken.uid;
        const email = decodedToken.email || '';

        // Get user role from database
        const rows = await db
            .select()
            .from(userRoles)
            .where(eq(userRoles.firebaseUid, uid))
            .limit(1);

        if (rows.length === 0) {
            throw new AuthError('Usuario no registrado en el sistema', 403);
        }

        const userRole = rows[0];

        if (userRole.status !== 'activo') {
            throw new AuthError('Tu cuenta ha sido desactivada. Contacta al administrador.', 403);
        }

        // Get permissions from role definition
        let permissions: PermissionKey[] = [];
        const roleDefs = await db
            .select()
            .from(roleDefinitions)
            .where(eq(roleDefinitions.id, userRole.roleId))
            .limit(1);

        if (roleDefs.length > 0) {
            try {
                permissions = JSON.parse(roleDefs[0].permissions) as PermissionKey[];
            } catch {
                permissions = [];
            }
        }

        return {
            uid,
            email,
            roleId: userRole.roleId,
            permissions,
            displayName: userRole.displayName || undefined,
        };
    } catch (error) {
        if (error instanceof AuthError) throw error;

        // Firebase token verification errors
        const message = error instanceof Error ? error.message : 'Token inválido';
        if (message.includes('auth/id-token-expired')) {
            throw new AuthError('Tu sesión ha expirado. Inicia sesión de nuevo.', 401);
        }
        if (message.includes('auth/id-token-revoked')) {
            throw new AuthError('Tu sesión fue revocada. Inicia sesión de nuevo.', 401);
        }

        throw new AuthError('Error de autenticación: ' + message, 401);
    }
}

// ==================== PERMISSION HELPERS ====================

/**
 * Requires the user to have at least one of the specified permissions.
 */
export async function requirePermission(...requiredPerms: PermissionKey[]): Promise<AuthenticatedUser> {
    const user = await requireAuth();

    // Owner bypasses all permission checks
    if (user.roleId === 'owner') return user;

    const hasPermission = requiredPerms.some((perm) =>
        user.permissions.includes(perm)
    );

    if (!hasPermission) {
        throw new AuthError(
            `No tienes permisos para esta acción. Se requiere: ${requiredPerms.join(' o ')}`,
            403
        );
    }

    return user;
}

/**
 * Requires the user to be the owner/admin.
 */
export async function requireOwner(): Promise<AuthenticatedUser> {
    const user = await requireAuth();

    if (user.roleId !== 'owner') {
        throw new AuthError('Esta acción requiere permisos de administrador', 403);
    }

    return user;
}

// ==================== INPUT VALIDATION ====================

/**
 * Sanitizes a string input to prevent injection attacks.
 */
export function sanitize(input: string | undefined | null): string {
    if (!input) return '';
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove HTML tags
        .slice(0, 1000); // Limit length
}

/**
 * Validates that a number is within a safe range.
 */
export function validateNumber(
    value: number,
    { min = 0, max = 999999999, label = 'valor' } = {}
): number {
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
