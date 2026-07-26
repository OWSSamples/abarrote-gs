// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { initBotId } from 'botid/client/core';
import { BOT_ID_PROTECTED_ROUTES } from '@/lib/security/bot-protection-config';

if (process.env.NODE_ENV === 'production') {
  initBotId({
    protect: BOT_ID_PROTECTED_ROUTES,
  });
}

const isProduction = process.env.NODE_ENV === 'production';
const useCdnLoader = isProduction && process.env.NEXT_PUBLIC_SENTRY_CDN_LOADER_ENABLED !== 'false';
const dsn = useCdnLoader ? undefined : process.env.NEXT_PUBLIC_SENTRY_DSN;
const replayEnabled = process.env.NEXT_PUBLIC_SENTRY_REPLAY_ENABLED === 'true';

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // Replay is useful but heavy. Keep it opt-in so login/dashboard stay fast.
    integrations: replayEnabled
      ? [
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
        ]
      : [],

    tracesSampleRate: isProduction ? 0.02 : 1,
    enableLogs: isProduction && process.env.NEXT_PUBLIC_SENTRY_ENABLE_LOGS === 'true',

    replaysSessionSampleRate: replayEnabled && isProduction ? 0.005 : 0,
    replaysOnErrorSampleRate: replayEnabled && isProduction ? 0.05 : 0,

    // Enable sending user PII (Personally Identifiable Information)
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
