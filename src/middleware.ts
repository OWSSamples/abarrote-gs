/**
 * Next.js Middleware — Security & Observability Gateway
 *
 * This is the ONLY file Next.js loads as Edge middleware.
 * It delegates to proxy.ts which implements:
 *   - Bot/scanner blocking (sqlmap, nikto, masscan, etc.)
 *   - Suspicious path blocking (.env, .git, wp-admin, etc.)
 *   - CSRF origin verification (OWASP compliant)
 *   - Security headers (CSP, HSTS, X-Frame-Options, etc.)
 *   - Request-ID generation for distributed tracing
 *   - Firebase auth session validation
 */

export { proxy as middleware, config } from '@/proxy';
