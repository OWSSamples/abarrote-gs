// Run migration 0008: OAuth Provider Connections
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
const fs = require('fs');
const path = require('path');

neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_Ji5KmITZGN0p@ep-crimson-sea-ai2th8nr-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require',
  });

  const sql = fs.readFileSync(
    path.join(__dirname, 'drizzle', '0008_oauth_provider_connections.sql'),
    'utf8'
  );

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const results = [];

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      results.push(`OK: ${stmt.slice(0, 60)}`);
    } catch (e) {
      results.push(`ERR: ${stmt.slice(0, 60)} → ${e.message.slice(0, 100)}`);
    }
  }

  results.push('DONE');
  fs.writeFileSync('/tmp/db_mig8.txt', results.join('\n'));
  console.log('Migration 0008 complete. Check /tmp/db_mig8.txt');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
