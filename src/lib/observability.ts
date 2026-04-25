/**
 * Observability — wrapper opt-in para tracking de errores y métricas.
 *
 * Diseño:
 *   - Si `SENTRY_DSN` está en env y `@sentry/nextjs` está instalado, reporta a Sentry.
 *   - Si no, es no-op (logs siguen yendo a stdout vía logger).
 *   - Sin imports estáticos → no rompe build cuando el paquete no está instalado.
 *
 * Para activar:
 *   1. bun add @sentry/nextjs
 *   2. Configura SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN en .env
 *   3. Ejecuta `bunx @sentry/wizard@latest -i nextjs --skip-connect` para generar
 *      sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts
 *   4. Envuelve next.config.ts con `withSentryConfig`
 *
 * El logger.error() ya llama captureError() automáticamente desde aquí,
 * así que no necesitas tocar tus actions ni route handlers.
 */

type ErrorContext = {
  action?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
};

interface SentryLike {
  captureException: (err: unknown, hint?: { tags?: Record<string, string>; extra?: Record<string, unknown> }) => void;
  captureMessage: (
    msg: string,
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug',
    hint?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
  ) => void;
  setUser: (user: { id?: string; email?: string } | null) => void;
}

let sentryInstance: SentryLike | null = null;
let sentryAttempted = false;

async function getSentry(): Promise<SentryLike | null> {
  if (sentryAttempted) return sentryInstance;
  sentryAttempted = true;

  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return null;
  }

  try {
    // Dynamic import via runtime variable — TypeScript no resuelve estáticamente,
    // así que el paquete puede no estar instalado sin romper el build.
    const moduleName = '@sentry/nextjs';
    const Sentry = (await import(/* webpackIgnore: true */ moduleName)) as unknown as SentryLike;
    sentryInstance = Sentry;
    return Sentry;
  } catch {
    // Paquete no instalado — silencioso. Logger sigue funcionando.
    return null;
  }
}

/**
 * Reporta un error al sistema de observabilidad.
 * Si Sentry no está configurado/instalado, es no-op.
 *
 * El logger.error() ya llama esto automáticamente para todos los errores
 * estructurados — solo úsalo manualmente si necesitas captar algo
 * que NO pasó por el logger.
 */
export function captureError(err: unknown, ctx?: ErrorContext): void {
  // Fire-and-forget — nunca bloquea el flujo de la request.
  void getSentry().then((sentry) => {
    if (!sentry) return;

    const tags: Record<string, string> = {};
    const extra: Record<string, unknown> = {};

    if (ctx) {
      for (const [key, value] of Object.entries(ctx)) {
        if (value === undefined || value === null) continue;
        // Tags son indexables (max 200 chars, solo strings/numbers cortos)
        if ((key === 'action' || key === 'userId' || key === 'requestId') && typeof value === 'string') {
          tags[key] = value.slice(0, 200);
        } else {
          extra[key] = value;
        }
      }
    }

    if (err instanceof Error) {
      sentry.captureException(err, { tags, extra });
    } else {
      sentry.captureMessage(typeof err === 'string' ? err : JSON.stringify(err), 'error', { tags, extra });
    }
  });
}

/**
 * Asocia el usuario actual con el contexto de Sentry.
 * Llamar desde requireAuth() después de verificar el token.
 */
export function setObservabilityUser(user: { id?: string; email?: string } | null): void {
  void getSentry().then((sentry) => sentry?.setUser(user));
}
