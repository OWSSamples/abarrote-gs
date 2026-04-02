// ══════════════════════════════════════════════════════════════
// QStash Infrastructure — Public API
// ══════════════════════════════════════════════════════════════
//
// Upstash QStash: serverless message queue + cron scheduler.
//
// Structure:
//   src/infrastructure/qstash/
//   ├── index.ts          ← This file (public surface)
//   ├── connection.ts     ← Client singleton
//   ├── verify.ts         ← Signature verification (incoming webhooks)
//   └── jobs.ts           ← Job publisher + scheduler
//
// Usage:
//   import { publishJob, verifyQStashSignature } from '@/infrastructure/qstash';

// ── Connection ──
export {
  getQStashClient,
  isQStashAvailable,
} from './connection';

// ── Signature Verification ──
export {
  verifyQStashSignature,
} from './verify';

// ── Job Publishing ──
export {
  publishJob,
  scheduleJob,
  type JobType,
  type PublishOptions,
} from './jobs';
