/**
 * Next.js Instrumentation — Server Startup Hook
 *
 * This file runs ONCE when the Node.js server starts.
 * Used to register domain event handlers and initialize infrastructure.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only register on the server (not during build or edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Register domain event handlers (audit logging, cache invalidation)
    await import('@/domain/events/handlers');
  }
}
