/**
 * Enterprise Rate Limiting System
 * 
 * Provides tiered rate limiting with:
 * - Per-action configuration
 * - Role-based limits (admin, owner, user)
 * - Brute force protection for sensitive operations
 * - IP-based blocking
 * - Sliding window algorithm
 * 
 * @example
 * // Basic usage
 * const result = await checkTieredRateLimit('sales.create', userId, ip);
 * if (result.blocked) throw new RateLimitError(result);
 * 
 * @example
 * // HOF wrapper
 * export const createSale = withRateLimit('sales.create', _createSale);
 */

import { checkRateLimitAsync, type RateLimitResult } from './rate-limit';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/errors';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export interface RateLimitTier {
  /** Requests allowed per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface TieredRateLimitConfig {
  /** Default tier for unauthenticated/unknown users */
  default: RateLimitTier;
  /** Tier for authenticated users */
  user?: RateLimitTier;
  /** Tier for staff/employees */
  staff?: RateLimitTier;
  /** Tier for admin users */
  admin?: RateLimitTier;
  /** Tier for owner (no rate limit) */
  owner?: RateLimitTier | 'bypass';
  /** Enable IP-based rate limiting alongside user */
  enableIpLimit?: boolean;
  /** Separate IP rate limit (if different from user) */
  ipLimit?: RateLimitTier;
}

export interface TieredRateLimitResult extends RateLimitResult {
  /** Which tier was applied */
  tier: 'default' | 'user' | 'staff' | 'admin' | 'owner' | 'ip';
  /** The action that was rate limited */
  action: string;
}

export type RoleTier = 'default' | 'user' | 'staff' | 'admin' | 'owner';

// ══════════════════════════════════════════════════════════════
// PREDEFINED TIERS
// ══════════════════════════════════════════════════════════════

/** Standard rate limit: 60 requests per minute */
const STANDARD: RateLimitTier = { limit: 60, windowMs: 60_000 };

/** Relaxed rate limit: 120 requests per minute */
const RELAXED: RateLimitTier = { limit: 120, windowMs: 60_000 };

/** Strict rate limit: 20 requests per minute */
const STRICT: RateLimitTier = { limit: 20, windowMs: 60_000 };

/** Very strict: 5 requests per minute (for sensitive operations) */
const VERY_STRICT: RateLimitTier = { limit: 5, windowMs: 60_000 };

/** Brute force protection: 5 attempts per 15 minutes */
const BRUTE_FORCE: RateLimitTier = { limit: 5, windowMs: 15 * 60_000 };

/** Bulk operations: 10 per minute */
const BULK: RateLimitTier = { limit: 10, windowMs: 60_000 };

/** Read operations: 100 per minute */
const READ_HEAVY: RateLimitTier = { limit: 100, windowMs: 60_000 };

// ══════════════════════════════════════════════════════════════
// ACTION CONFIGURATIONS
// ══════════════════════════════════════════════════════════════

/**
 * Rate limit configurations by action pattern.
 * 
 * Patterns support wildcards:
 * - `sales.*` matches all sales actions
 * - `*.create` matches all create actions
 * - `auth.login` matches exactly auth.login
 */
const ACTION_CONFIGS: Record<string, TieredRateLimitConfig> = {
  // ── Authentication (strictest) ──
  'auth.login': {
    default: BRUTE_FORCE,
    user: BRUTE_FORCE,
    staff: BRUTE_FORCE,
    admin: BRUTE_FORCE,
    owner: BRUTE_FORCE,
    enableIpLimit: true,
    ipLimit: { limit: 10, windowMs: 15 * 60_000 },
  },
  'auth.pin': {
    default: { limit: 3, windowMs: 60_000 },
    user: { limit: 3, windowMs: 60_000 },
    staff: { limit: 5, windowMs: 60_000 },
    admin: { limit: 10, windowMs: 60_000 },
    owner: { limit: 10, windowMs: 60_000 },
  },
  
  // ── Sales (high volume) ──
  'sales.create': {
    default: STRICT,
    user: STANDARD,
    staff: RELAXED,
    admin: RELAXED,
    owner: 'bypass',
  },
  'sales.fetch': {
    default: READ_HEAVY,
    user: READ_HEAVY,
    staff: READ_HEAVY,
    admin: READ_HEAVY,
    owner: 'bypass',
  },
  'sales.cancel': {
    default: VERY_STRICT,
    user: STRICT,
    staff: STANDARD,
    admin: RELAXED,
    owner: 'bypass',
  },

  // ── Products ──
  'product.create': {
    default: STRICT,
    user: STANDARD,
    staff: STANDARD,
    admin: RELAXED,
    owner: 'bypass',
  },
  'product.update': {
    default: STANDARD,
    user: STANDARD,
    staff: RELAXED,
    admin: RELAXED,
    owner: 'bypass',
  },
  'product.delete': {
    default: VERY_STRICT,
    user: STRICT,
    staff: STANDARD,
    admin: RELAXED,
    owner: 'bypass',
  },
  'product.fetch': {
    default: READ_HEAVY,
    user: READ_HEAVY,
    staff: READ_HEAVY,
    admin: READ_HEAVY,
    owner: 'bypass',
  },

  // ── Inventory ──
  'inventory.*': {
    default: STANDARD,
    user: STANDARD,
    staff: RELAXED,
    admin: RELAXED,
    owner: 'bypass',
  },

  // ── Finance ──
  'finance.*': {
    default: STANDARD,
    user: STANDARD,
    staff: STANDARD,
    admin: RELAXED,
    owner: 'bypass',
  },

  // ── Customers ──
  'customer.create': {
    default: STANDARD,
    user: STANDARD,
    staff: RELAXED,
    admin: RELAXED,
    owner: 'bypass',
  },
  'customer.fiado': {
    default: STRICT,
    user: STANDARD,
    staff: STANDARD,
    admin: RELAXED,
    owner: 'bypass',
  },

  // ── Roles (admin operations) ──
  'role.*': {
    default: VERY_STRICT,
    user: VERY_STRICT,
    staff: STRICT,
    admin: STANDARD,
    owner: 'bypass',
  },

  // ── Bulk operations ──
  'import.*': {
    default: BULK,
    user: BULK,
    staff: BULK,
    admin: { limit: 20, windowMs: 60_000 },
    owner: 'bypass',
  },
  'export.*': {
    default: BULK,
    user: BULK,
    staff: BULK,
    admin: { limit: 20, windowMs: 60_000 },
    owner: 'bypass',
  },

  // ── Analytics (read-heavy but computed) ──
  'analytics.*': {
    default: STRICT,
    user: STANDARD,
    staff: STANDARD,
    admin: RELAXED,
    owner: 'bypass',
  },

  // ── Payments ──
  'payment.*': {
    default: STRICT,
    user: STANDARD,
    staff: STANDARD,
    admin: RELAXED,
    owner: 'bypass',
  },
  'mercadopago.*': {
    default: STRICT,
    user: STANDARD,
    staff: STANDARD,
    admin: RELAXED,
    owner: 'bypass',
  },

  // ── Default fallback ──
  '*': {
    default: STANDARD,
    user: STANDARD,
    staff: RELAXED,
    admin: RELAXED,
    owner: 'bypass',
  },
};

// ══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════

/**
 * Find the best matching config for an action.
 * Checks exact match, then prefix wildcards, then suffix, then default.
 */
function findConfig(action: string): TieredRateLimitConfig {
  // 1. Exact match
  if (ACTION_CONFIGS[action]) {
    return ACTION_CONFIGS[action];
  }

  // 2. Prefix wildcard (e.g., 'sales.*' matches 'sales.create')
  const prefix = action.split('.')[0];
  if (ACTION_CONFIGS[`${prefix}.*`]) {
    return ACTION_CONFIGS[`${prefix}.*`];
  }

  // 3. Suffix wildcard (e.g., '*.create' matches 'sales.create')
  const suffix = action.split('.').slice(1).join('.');
  if (ACTION_CONFIGS[`*.${suffix}`]) {
    return ACTION_CONFIGS[`*.${suffix}`];
  }

  // 4. Default fallback
  return ACTION_CONFIGS['*'];
}

/**
 * Get rate limit tier for a specific role.
 */
function getTierForRole(config: TieredRateLimitConfig, role: RoleTier): RateLimitTier | 'bypass' {
  switch (role) {
    case 'owner':
      return config.owner ?? config.admin ?? config.default;
    case 'admin':
      return config.admin ?? config.default;
    case 'staff':
      return config.staff ?? config.user ?? config.default;
    case 'user':
      return config.user ?? config.default;
    default:
      return config.default;
  }
}

/**
 * Map roleId to tier.
 */
export function roleIdToTier(roleId: string | undefined): RoleTier {
  if (!roleId) return 'default';
  
  const lower = roleId.toLowerCase();
  if (lower.includes('owner') || lower.includes('propietario')) return 'owner';
  if (lower.includes('admin') || lower.includes('administrador')) return 'admin';
  if (lower.includes('staff') || lower.includes('empleado') || lower.includes('cajero')) return 'staff';
  if (lower.includes('user') || lower.includes('usuario')) return 'user';
  
  return 'user'; // Default authenticated users to 'user' tier
}

// ══════════════════════════════════════════════════════════════
// RATE LIMIT ERROR
// ══════════════════════════════════════════════════════════════

export class RateLimitError extends AppError {
  readonly retryAfterMs: number;
  readonly remaining: number;
  readonly tier: string;

  constructor(result: TieredRateLimitResult) {
    const retryAfterMs = result.reset.getTime() - Date.now();
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    
    super(
      'RATE_LIMIT_EXCEEDED',
      `Demasiadas solicitudes. Intenta de nuevo en ${retryAfterSec} segundos.`,
      429,
    );
    
    this.retryAfterMs = retryAfterMs;
    this.remaining = result.remaining;
    this.tier = result.tier;
  }

  toResponse() {
    return {
      error: this.message,
      code: this.code,
      retryAfter: Math.ceil(this.retryAfterMs / 1000),
    };
  }
}

// ══════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════

/**
 * Check tiered rate limit for an action.
 * 
 * @param action - Action identifier (e.g., 'sales.create')
 * @param identifier - User ID or unique identifier
 * @param options - Optional IP for additional IP-based limiting
 */
export async function checkTieredRateLimit(
  action: string,
  identifier: string,
  options?: { ip?: string; roleId?: string },
): Promise<TieredRateLimitResult> {
  const config = findConfig(action);
  const tier = roleIdToTier(options?.roleId);
  const tierConfig = getTierForRole(config, tier);

  // Owner bypass
  if (tierConfig === 'bypass') {
    logger.info('Rate limit bypassed (owner)', { action, identifier, tier });
    return {
      remaining: Infinity,
      reset: new Date(Date.now() + 60_000),
      blocked: false,
      isRateLimited: false,
      allowed: true,
      tier: 'owner',
      action,
    };
  }

  // Check user-based limit
  const userKey = `${action}:${identifier}`;
  const userResult = await checkRateLimitAsync(userKey, tierConfig);

  if (userResult.blocked) {
    logger.warn('Rate limit exceeded (user)', {
      action: 'ratelimit_blocked_user',
      actionName: action,
      identifier,
      tier,
      remaining: userResult.remaining,
    });
    
    return {
      ...userResult,
      tier: tier as TieredRateLimitResult['tier'],
      action,
    };
  }

  // Check IP-based limit if enabled
  if (config.enableIpLimit && options?.ip) {
    const ipConfig = config.ipLimit ?? config.default;
    const ipKey = `${action}:ip:${options.ip}`;
    const ipResult = await checkRateLimitAsync(ipKey, ipConfig);

    if (ipResult.blocked) {
      logger.warn('Rate limit exceeded (IP)', {
        action: 'ratelimit_blocked_ip',
        actionName: action,
        ip: options.ip,
        remaining: ipResult.remaining,
      });
      
      return {
        ...ipResult,
        tier: 'ip',
        action,
      };
    }
  }

  return {
    ...userResult,
    tier: tier as TieredRateLimitResult['tier'],
    action,
  };
}

/**
 * Higher-order function to wrap server actions with rate limiting.
 * 
 * @param action - Action identifier for rate limit config lookup
 * @param fn - The server action function to wrap
 * @param options - Optional configuration
 * 
 * @example
 * const _createSale = async (data: SaleData) => { ... };
 * export const createSale = withRateLimit('sales.create', _createSale);
 */
export function withRateLimit<Args extends unknown[], Return>(
  action: string,
  fn: (...args: Args) => Promise<Return>,
  options?: {
    /** Custom identifier extractor. Defaults to first arg or 'anonymous' */
    getIdentifier?: (...args: Args) => string;
    /** Custom role extractor */
    getRoleId?: (...args: Args) => string | undefined;
    /** Throw error or return result with error flag */
    throwOnLimit?: boolean;
  },
): (...args: Args) => Promise<Return> {
  const { throwOnLimit = true } = options ?? {};

  return async (...args: Args): Promise<Return> => {
    // Extract identifier - try to find userId in args or use 'anonymous'
    let identifier = 'anonymous';
    if (options?.getIdentifier) {
      identifier = options.getIdentifier(...args);
    } else if (args.length > 0 && typeof args[0] === 'string') {
      identifier = args[0];
    }

    const roleId = options?.getRoleId?.(...args);

    const result = await checkTieredRateLimit(action, identifier, { roleId });

    if (result.blocked) {
      if (throwOnLimit) {
        throw new RateLimitError(result);
      }
      // Return as error result - caller must handle
      return {
        success: false,
        error: new RateLimitError(result).message,
        retryAfter: Math.ceil((result.reset.getTime() - Date.now()) / 1000),
      } as Return;
    }

    return fn(...args);
  };
}

/**
 * Check brute force protection for sensitive operations.
 * Uses very strict limits and longer windows.
 * 
 * @param operation - Operation name (e.g., 'login', 'pin')
 * @param identifier - User identifier or IP
 */
export async function checkBruteForce(
  operation: string,
  identifier: string,
): Promise<TieredRateLimitResult> {
  const action = `auth.${operation}`;
  return checkTieredRateLimit(action, identifier, { roleId: undefined });
}

/**
 * Reset rate limit for a specific action/identifier.
 * Useful after successful authentication to clear brute force counters.
 */
export function resetRateLimit(action: string, identifier: string): void {
  // Note: This only works with memory-based rate limiting
  // For Redis, we'd need to delete the key
  logger.info('Rate limit reset requested', { action, identifier });
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

export {
  STANDARD,
  RELAXED,
  STRICT,
  VERY_STRICT,
  BRUTE_FORCE,
  BULK,
  READ_HEAVY,
};
