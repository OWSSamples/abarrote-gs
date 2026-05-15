/**
 * Feature Flags System
 *
 * Enterprise-grade feature flag management with:
 * - Database-backed flags (persistent, admin-controlled)
 * - In-memory cache for sub-ms reads
 * - Percentage-based rollouts
 * - User/role targeting
 * - Scheduled activation/deactivation
 * - Audit trail of changes
 *
 * Architecture:
 *   DB (source of truth) → Cache (fast reads) → Evaluation (logic)
 *
 * @example
 * // Check a flag
 * if (await isFeatureEnabled('new_checkout_flow')) {
 *   // New code path
 * }
 *
 * // Check with user targeting
 * if (await isFeatureEnabled('beta_feature', { userId: 'u-123', roleId: 'admin' })) {
 *   // Beta code path for targeted users
 * }
 *
 * // In server actions
 * const createSale = withFeatureFlag('sales_v2', _createSaleV2, _createSaleV1);
 */

import { db } from '@/db';
import { featureFlags } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export interface FeatureFlag {
  /** Unique flag identifier (kebab-case) */
  id: string;
  /** Human-readable description */
  description: string;
  /** Whether the flag is globally enabled */
  enabled: boolean;
  /** Percentage of users (0-100) for gradual rollout */
  rolloutPercentage: number;
  /** Specific user IDs that always get this flag */
  targetUserIds: string[];
  /** Specific role IDs that always get this flag */
  targetRoleIds: string[];
  /** Activation date (null = immediately) */
  activateAt: Date | null;
  /** Deactivation date (null = never) */
  deactivateAt: Date | null;
  /** Metadata for tracking */
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvaluationContext {
  /** Current user ID */
  userId?: string;
  /** Current user's role ID */
  roleId?: string;
  /** Custom attributes for advanced targeting */
  attributes?: Record<string, string | number | boolean>;
}

interface CacheEntry {
  flag: FeatureFlag;
  expiresAt: number;
}

// ══════════════════════════════════════════════════════════════
// IN-MEMORY CACHE
// ══════════════════════════════════════════════════════════════

const FLAG_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 seconds
let _allFlagsLastFetchAt = 0;
const _ALL_FLAGS_TTL_MS = 60_000; // 1 minute

// Dedup in-flight fetches to prevent cache stampede
const pendingFetches = new Map<string, Promise<FeatureFlag | null>>();

/**
 * Invalidate a specific flag from cache
 */
export function invalidateFlagCache(flagId: string): void {
  FLAG_CACHE.delete(flagId);
}

/**
 * Invalidate all flags from cache
 */
export function invalidateAllFlagsCache(): void {
  FLAG_CACHE.clear();
  _allFlagsLastFetchAt = 0;
}

// ══════════════════════════════════════════════════════════════
// DATA ACCESS
// ══════════════════════════════════════════════════════════════

/**
 * Fetch a single flag from cache or database.
 * Uses Promise-based deduplication to prevent cache stampede when
 * multiple concurrent requests expire the cache simultaneously.
 */
async function getFlag(flagId: string): Promise<FeatureFlag | null> {
  // Check cache first
  const cached = FLAG_CACHE.get(flagId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.flag;
  }

  // Deduplicate: if another request is already fetching this flag, reuse its Promise
  const pending = pendingFetches.get(flagId);
  if (pending) {
    return pending;
  }

  // Fetch from DB
  const fetchPromise = (async (): Promise<FeatureFlag | null> => {
    try {
      const rows = await db.select().from(featureFlags).where(eq(featureFlags.id, flagId)).limit(1);

      if (rows.length === 0) return null;

      const row = rows[0];
      const flag: FeatureFlag = {
        id: row.id,
        description: row.description,
        enabled: row.enabled,
        rolloutPercentage: row.rolloutPercentage,
        targetUserIds: row.targetUserIds ?? [],
        targetRoleIds: row.targetRoleIds ?? [],
        activateAt: row.activateAt,
        deactivateAt: row.deactivateAt,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };

      // Update cache
      FLAG_CACHE.set(flagId, { flag, expiresAt: Date.now() + CACHE_TTL_MS });

      return flag;
    } catch (err) {
      logger.error('Failed to fetch feature flag', {
        action: 'feature_flag_fetch_error',
        flagId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Return stale cache entry if available (stale-while-error)
      const stale = FLAG_CACHE.get(flagId);
      return stale?.flag ?? null;
    } finally {
      pendingFetches.delete(flagId);
    }
  })();

  pendingFetches.set(flagId, fetchPromise);
  return fetchPromise;
}

/**
 * Fetch all flags (for admin dashboard)
 */
export async function getAllFlags(): Promise<FeatureFlag[]> {
  try {
    const rows = await db.select().from(featureFlags);

    return rows.map((row) => ({
      id: row.id,
      description: row.description,
      enabled: row.enabled,
      rolloutPercentage: row.rolloutPercentage,
      targetUserIds: row.targetUserIds ?? [],
      targetRoleIds: row.targetRoleIds ?? [],
      activateAt: row.activateAt,
      deactivateAt: row.deactivateAt,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch (err) {
    logger.error('Failed to fetch all feature flags', {
      action: 'feature_flags_fetch_all_error',
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// EVALUATION ENGINE
// ══════════════════════════════════════════════════════════════

/**
 * Deterministic hash for percentage-based rollouts.
 * Same user+flag always gets same result.
 */
function hashForRollout(flagId: string, userId: string): number {
  const input = `${flagId}:${userId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash % 100);
}

/**
 * Check if a flag's schedule allows it to be active
 */
function isWithinSchedule(flag: FeatureFlag): boolean {
  const now = new Date();

  if (flag.activateAt && now < flag.activateAt) {
    return false; // Not yet activated
  }

  if (flag.deactivateAt && now > flag.deactivateAt) {
    return false; // Already deactivated
  }

  return true;
}

/**
 * Evaluate whether a feature flag is enabled for a given context.
 *
 * Evaluation order:
 * 1. Flag exists? No → false
 * 2. Flag.enabled? No → false
 * 3. Within schedule? No → false
 * 4. User in targetUserIds? Yes → true
 * 5. Role in targetRoleIds? Yes → true
 * 6. Rollout percentage check
 */
export function evaluateFlag(flag: FeatureFlag, context: EvaluationContext = {}): boolean {
  // Step 1-2: Basic enabled check
  if (!flag.enabled) return false;

  // Step 3: Schedule check
  if (!isWithinSchedule(flag)) return false;

  // Step 4: User targeting (explicit include)
  if (context.userId && flag.targetUserIds.includes(context.userId)) {
    return true;
  }

  // Step 5: Role targeting
  if (context.roleId && flag.targetRoleIds.includes(context.roleId)) {
    return true;
  }

  // Step 6: Percentage rollout
  if (flag.rolloutPercentage >= 100) return true;
  if (flag.rolloutPercentage <= 0) {
    // If no targeting matched and rollout is 0%, only targeted users get it
    return false;
  }

  // Deterministic hash for consistent per-user results
  const userId = context.userId ?? 'anonymous';
  const userHash = hashForRollout(flag.id, userId);
  return userHash < flag.rolloutPercentage;
}

// ══════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════

/**
 * Check if a feature flag is enabled.
 *
 * Returns false for unknown flags (fail-safe) and logs a warning for telemetry.
 */
export async function isFeatureEnabled(flagId: string, context: EvaluationContext = {}): Promise<boolean> {
  const flag = await getFlag(flagId);

  if (!flag) {
    // Unknown flags are disabled by default (fail-safe)
    logger.warn('Unknown feature flag requested', {
      action: 'feature_flag_unknown',
      flagId,
      userId: context.userId,
      roleId: context.roleId,
    });
    return false;
  }

  const result = evaluateFlag(flag, context);

  logger.debug('Feature flag evaluated', {
    action: 'feature_flag_eval',
    flagId,
    result: result ? 'enabled' : 'disabled',
    userId: context.userId,
    roleId: context.roleId,
  });

  return result;
}

/**
 * Get the value of a feature flag with a fallback.
 * Useful for flags that control non-boolean behavior.
 */
export async function getFeatureValue<T>(
  flagId: string,
  enabledValue: T,
  disabledValue: T,
  context: EvaluationContext = {},
): Promise<T> {
  const enabled = await isFeatureEnabled(flagId, context);
  return enabled ? enabledValue : disabledValue;
}

/**
 * Higher-order function for feature-flagged server actions.
 *
 * Routes to different implementations based on flag state.
 *
 * @example
 * export const createSale = withFeatureFlag(
 *   'sales_v2',
 *   _createSaleV2,
 *   _createSaleV1,
 * );
 */
export function withFeatureFlag<TArgs extends unknown[], TReturn>(
  flagId: string,
  enabledFn: (...args: TArgs) => Promise<TReturn>,
  disabledFn: (...args: TArgs) => Promise<TReturn>,
  contextExtractor?: (...args: TArgs) => EvaluationContext,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const context = contextExtractor?.(...args) ?? {};
    const enabled = await isFeatureEnabled(flagId, context);

    if (enabled) {
      return enabledFn(...args);
    }
    return disabledFn(...args);
  };
}

// ══════════════════════════════════════════════════════════════
// ADMIN API (for managing flags)
// ══════════════════════════════════════════════════════════════

export interface CreateFlagInput {
  id: string;
  description: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  targetUserIds?: string[];
  targetRoleIds?: string[];
  activateAt?: Date | null;
  deactivateAt?: Date | null;
  createdBy: string;
}

export interface UpdateFlagInput {
  enabled?: boolean;
  description?: string;
  rolloutPercentage?: number;
  targetUserIds?: string[];
  targetRoleIds?: string[];
  activateAt?: Date | null;
  deactivateAt?: Date | null;
}

/**
 * Create a new feature flag
 */
export async function createFlag(input: CreateFlagInput): Promise<FeatureFlag> {
  const now = new Date();

  await db.insert(featureFlags).values({
    id: input.id,
    description: input.description,
    enabled: input.enabled ?? false,
    rolloutPercentage: input.rolloutPercentage ?? 0,
    targetUserIds: input.targetUserIds ?? [],
    targetRoleIds: input.targetRoleIds ?? [],
    activateAt: input.activateAt ?? null,
    deactivateAt: input.deactivateAt ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });

  invalidateFlagCache(input.id);

  logger.info('Feature flag created', {
    action: 'feature_flag_created',
    flagId: input.id,
    createdBy: input.createdBy,
  });

  return getFlag(input.id) as Promise<FeatureFlag>;
}

/**
 * Update an existing feature flag
 */
export async function updateFlag(flagId: string, input: UpdateFlagInput): Promise<void> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.enabled !== undefined) updateData.enabled = input.enabled;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.rolloutPercentage !== undefined) updateData.rolloutPercentage = input.rolloutPercentage;
  if (input.targetUserIds !== undefined) updateData.targetUserIds = input.targetUserIds;
  if (input.targetRoleIds !== undefined) updateData.targetRoleIds = input.targetRoleIds;
  if (input.activateAt !== undefined) updateData.activateAt = input.activateAt;
  if (input.deactivateAt !== undefined) updateData.deactivateAt = input.deactivateAt;

  await db.update(featureFlags).set(updateData).where(eq(featureFlags.id, flagId));

  invalidateFlagCache(flagId);

  logger.info('Feature flag updated', {
    action: 'feature_flag_updated',
    flagId,
    changes: Object.keys(input),
  });
}

/**
 * Delete a feature flag
 */
export async function deleteFlag(flagId: string): Promise<void> {
  await db.delete(featureFlags).where(eq(featureFlags.id, flagId));

  invalidateFlagCache(flagId);

  logger.info('Feature flag deleted', {
    action: 'feature_flag_deleted',
    flagId,
  });
}
