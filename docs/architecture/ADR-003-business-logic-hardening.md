# ADR-003: Business Logic Hardening

**Status:** Accepted  
**Date:** 2025-07-21  
**Deciders:** Architecture Review  

## Context

A deep audit of the entire codebase revealed multiple logic-level issues that, while not causing runtime crashes, created subtle bugs, race conditions, memory issues, and security weaknesses under real-world conditions (concurrency, large data, edge inputs).

## Decision Drivers

- **Correctness** — Functions must produce correct results for all valid inputs, including edge cases (zero values, empty sets, large quantities).
- **Concurrency safety** — Server actions run concurrently; shared mutable state and non-atomic operations cause data corruption.
- **Performance** — O(n) memory allocations for mathematical calculations are unacceptable. Blocking the event loop with synchronous crypto is unacceptable.
- **Security** — Untrusted input (cursors, tokens) must be structurally validated. Timing attacks via response duration must be mitigated.

## Decisions Made

### 1. StockLevel Value Object — Zero Minimum Edge Case
- **Problem:** When `minimum = 0`, `halfMin` computed to `0`, making the `'critical'` threshold unreachable. All items with zero minimum incorrectly reported as `'critical'`.
- **Fix:** Early return `'ok'` when `minimum.isZero()` — if no minimum is set, stock level is always acceptable.
- **Pattern:** Guard clauses for degenerate inputs in value objects.

### 2. PricingService — Buy X Get Y Memory Optimization
- **Problem:** `buy_x_get_y` promotion materialized a per-unit array of all items, causing O(n) memory allocation for bulk purchases (e.g., 10,000 units).
- **Fix:** Mathematical calculation using sorted items and a `remainingFree` counter. O(1) additional memory.
- **Pattern:** Replace materialized collections with mathematical iteration for combinatorial promotions.

### 3. Pagination Cursor — Structural Validation
- **Problem:** `decodeCursor()` accepted any valid JSON from Base64 input, allowing injection of arbitrary objects, arrays, or nested structures.
- **Fix:** After JSON parse, validate the result is a non-null plain object with only `string | number | null` values.
- **Pattern:** Validate untrusted input structure at system boundaries, not just format.

### 4. Zustand Store — Promise-Based Deduplication
- **Problem:** `fetchDashboardData` used a boolean `isFetching` flag. Under concurrent React renders, multiple calls could pass the guard before the first set `isFetching = true`.
- **Fix:** Replace boolean with a shared `Promise` reference. Concurrent callers await the same in-flight promise.
- **Pattern:** Promise-based dedup for any async operation that should not run concurrently.

### 5. Circuit Breaker — Exponential Backoff
- **Problem:** On HALF_OPEN → OPEN transitions (failed recovery attempts), the reset timeout was constant. This caused rapid retry flapping against a struggling upstream.
- **Fix:** `currentResetTimeoutMs` grows by 1.5× on each failed recovery, capped at 300 seconds. Resets to base on successful CLOSED transition.
- **Pattern:** Exponential backoff with cap for circuit breaker recovery.

### 6. Feature Flags — Cache Stampede Prevention
- **Problem:** Multiple concurrent `getFlag()` calls for the same flag key all hit the database independently when the cache expired.
- **Fix:** `pendingFetches` Map stores in-flight promises. Concurrent callers coalesce on the same promise. Added stale-while-error: returns expired cache on DB failure.
- **Pattern:** Request coalescing + stale-while-error for cached lookups.

### 7. Role Actions — Race Condition & Async Crypto
- **Problem 1:** `_ensureOwnerRole()` could attempt duplicate INSERTs under concurrent first-login scenarios.
- **Fix 1:** Check specific user first (fast path), catch duplicate key errors gracefully.
- **Problem 2:** `hashPin()` and `verifyPin()` used synchronous `scryptSync`, blocking the event loop for ~100ms per call.
- **Fix 2:** Converted to async using `promisify(scrypt)`. All callers updated to `await`.
- **Pattern:** Async crypto at all times in server-side code. Graceful duplicate key handling for upsert-like operations.

### 8. useSyncEngine Hook — Unmount Race Guard
- **Problem:** `queue.init()` is async. If the component unmounts before init resolves, `engine.start()` runs on a dead component, and the interval fires after cleanup.
- **Fix:** Added `aborted` flag checked after `await queue.init()`. Cleanup sets `aborted = true`.
- **Pattern:** Guard async initialization chains against unmount in React effects.

## Consequences

### Positive
- All 453 unit tests continue to pass
- TypeScript compiles with zero errors
- No new dependencies introduced
- All fixes are backward-compatible
- Improved resilience under concurrent load

### Negative
- Async PIN hashing adds ~1ms latency vs sync (negligible, but measurable)
- Circuit breaker backoff means longer recovery time after extended outages (intentional)

### Risks
- `sales-actions.ts` folio sequence, idempotency keys, and payment saga patterns remain as known tech debt (separate ADR recommended)
- `inventory-actions.ts` N+1 query for alerts should be optimized in a future pass
