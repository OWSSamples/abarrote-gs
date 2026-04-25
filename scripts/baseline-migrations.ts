/**
 * Baseline Drizzle Migrations
 * ─────────────────────────────────────────────────────────────────
 * Marks all existing migrations (0000..N-1) as already applied in
 * `drizzle.__drizzle_migrations` WITHOUT executing them.
 *
 * Use this when:
 *   - The database was initialized with `db:push` (which doesn't
 *     populate the migrations table), and you now want to switch
 *     to migration-based deployments.
 *   - You restored a DB from a snapshot and need to re-sync the
 *     migrations table.
 *
 * After baselining, the next `bun db:migrate` will only apply
 * migrations newer than the latest baselined entry.
 *
 * Usage:
 *   bunx tsx scripts/baseline-migrations.ts            # baseline all but the last
 *   bunx tsx scripts/baseline-migrations.ts --all      # baseline ALL migrations
 *   bunx tsx scripts/baseline-migrations.ts --upto 18  # baseline up to idx 18
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

const DRIZZLE_DIR = join(process.cwd(), 'drizzle');
const JOURNAL_PATH = join(DRIZZLE_DIR, 'meta', '_journal.json');

function parseArgs(): { mode: 'all' | 'upto' | 'allButLast'; uptoIdx?: number } {
  const args = process.argv.slice(2);
  if (args.includes('--all')) return { mode: 'all' };
  const uptoIdx = args.indexOf('--upto');
  if (uptoIdx !== -1 && args[uptoIdx + 1]) {
    return { mode: 'upto', uptoIdx: parseInt(args[uptoIdx + 1], 10) };
  }
  return { mode: 'allButLast' };
}

function computeHash(sqlContent: string): string {
  // Drizzle uses sha256 of the raw SQL file content (UTF-8).
  return createHash('sha256').update(sqlContent).digest('hex');
}

async function main(): Promise<void> {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set. Check .env.local');
    process.exit(1);
  }

  const journal: Journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'));
  const { mode, uptoIdx } = parseArgs();

  let entriesToBaseline: JournalEntry[];
  if (mode === 'all') {
    entriesToBaseline = journal.entries;
  } else if (mode === 'upto') {
    entriesToBaseline = journal.entries.filter((e) => e.idx <= (uptoIdx ?? -1));
  } else {
    // allButLast: baseline everything except the latest entry, so the next
    // `bun db:migrate` only applies the most recent migration.
    const sorted = [...journal.entries].sort((a, b) => a.idx - b.idx);
    entriesToBaseline = sorted.slice(0, -1);
  }

  if (entriesToBaseline.length === 0) {
    console.log('⚠️  No migrations to baseline.');
    return;
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Ensure drizzle's bookkeeping schema/table exists.
    await client.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        "id" SERIAL PRIMARY KEY,
        "hash" text NOT NULL,
        "created_at" bigint
      )
    `);

    // Read existing hashes to skip duplicates.
    const { rows: existingRows } = await client.query<{ hash: string }>(
      `SELECT "hash" FROM "drizzle"."__drizzle_migrations"`,
    );
    const existingHashes = new Set(existingRows.map((r) => r.hash));

    let inserted = 0;
    let skipped = 0;

    for (const entry of entriesToBaseline) {
      const sqlPath = join(DRIZZLE_DIR, `${entry.tag}.sql`);
      let sqlContent: string;
      try {
        sqlContent = readFileSync(sqlPath, 'utf8');
      } catch {
        console.warn(`⚠️  ${entry.tag}.sql not found — skipping.`);
        continue;
      }

      const hash = computeHash(sqlContent);

      if (existingHashes.has(hash)) {
        console.log(`  ⏭  ${entry.tag} already baselined`);
        skipped++;
        continue;
      }

      await client.query(`INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)`, [
        hash,
        entry.when,
      ]);
      console.log(`  ✓ ${entry.tag} baselined (hash: ${hash.slice(0, 12)}…)`);
      inserted++;
    }

    console.log('');
    console.log(`✅ Baseline complete: ${inserted} inserted, ${skipped} skipped.`);
    console.log(`   Total entries in journal: ${journal.entries.length}`);
    console.log(`   Now run: bun db:migrate  (will only apply newer migrations)`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error('❌ Baseline failed:', err);
  process.exit(1);
});
