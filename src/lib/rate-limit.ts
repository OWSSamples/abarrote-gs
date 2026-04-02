/**
 * @deprecated — Use `@/infrastructure/redis` instead.
 * This file is a backward-compatibility shim.
 */
export {
  checkRateLimit,
  checkRateLimitAsync,
  getClientIp,
  type RateLimitConfig as RateLimitOptions,
  type RateLimitResult as RateLimitInfo,
} from '@/infrastructure/redis';
