// Run migration 0007 against the Neon database
const fs = require('fs');

const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;

// Read DATABASE_URL directly from .env.local, stripping quotes
const envLines = fs.readFileSync('.env.local', 'utf8').split('\n');
const dbLine = envLines.find(l => l.startsWith('DATABASE_URL='));
let dbUrl = dbLine.replace('DATABASE_URL=', '').trim();
// Remove surrounding quotes
if ((dbUrl.startsWith("'") && dbUrl.endsWith("'")) || (dbUrl.startsWith('"') && dbUrl.endsWith('"'))) {
  dbUrl = dbUrl.slice(1, -1);
}
// Remove channel_binding param (not supported by WS pool)
dbUrl = dbUrl.replace(/[&?]channel_binding=[^&]*/g, '');
// Ensure ? is present if sslmode is the only remaining param
if (!dbUrl.includes('?') && dbUrl.includes('sslmode')) {
  dbUrl = dbUrl.replace('sslmode', '?sslmode');
}

console.log('DB URL (first 50):', dbUrl.substring(0, 50));
const pool = new Pool({ connectionString: dbUrl });

const statements = [
  `ALTER TABLE "sale_records" ADD COLUMN IF NOT EXISTS "installments" integer NOT NULL DEFAULT 1`,
  `ALTER TABLE "sale_records" ADD COLUMN IF NOT EXISTS "mp_payment_id" text`,
  `CREATE INDEX IF NOT EXISTS "sale_records_mp_payment_id_idx" ON "sale_records" ("mp_payment_id")`,
  `CREATE TABLE IF NOT EXISTS "mercadopago_payments" (
    "id" text PRIMARY KEY,
    "payment_id" text NOT NULL UNIQUE,
    "status" text NOT NULL,
    "external_reference" text,
    "amount" numeric(10, 2),
    "created_at" timestamp NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE "mercadopago_payments" ADD COLUMN IF NOT EXISTS "sale_id" text REFERENCES "sale_records"("id") ON DELETE SET NULL`,
  `ALTER TABLE "mercadopago_payments" ADD COLUMN IF NOT EXISTS "payment_method_id" text`,
  `ALTER TABLE "mercadopago_payments" ADD COLUMN IF NOT EXISTS "payment_type" text`,
  `ALTER TABLE "mercadopago_payments" ADD COLUMN IF NOT EXISTS "installments" integer NOT NULL DEFAULT 1`,
  `ALTER TABLE "mercadopago_payments" ADD COLUMN IF NOT EXISTS "fee_amount" numeric(10, 2)`,
  `ALTER TABLE "mercadopago_payments" ADD COLUMN IF NOT EXISTS "net_amount" numeric(10, 2)`,
  `ALTER TABLE "mercadopago_payments" ADD COLUMN IF NOT EXISTS "payer_email" text`,
  `ALTER TABLE "mercadopago_payments" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now()`,
  `CREATE INDEX IF NOT EXISTS "mp_payments_sale_id_idx" ON "mercadopago_payments" ("sale_id")`,
  `CREATE INDEX IF NOT EXISTS "mp_payments_status_idx" ON "mercadopago_payments" ("status")`,
  `CREATE INDEX IF NOT EXISTS "mp_payments_external_ref_idx" ON "mercadopago_payments" ("external_reference")`,
  `CREATE TABLE IF NOT EXISTS "mercadopago_refunds" (
    "id" text PRIMARY KEY,
    "mp_payment_id" text NOT NULL,
    "mp_refund_id" text NOT NULL UNIQUE,
    "sale_id" text REFERENCES "sale_records"("id") ON DELETE SET NULL,
    "amount" numeric(10, 2) NOT NULL,
    "status" text NOT NULL DEFAULT 'pending',
    "reason" text NOT NULL DEFAULT '',
    "initiated_by" text NOT NULL,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "resolved_at" timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS "mp_refunds_sale_id_idx" ON "mercadopago_refunds" ("sale_id")`,
  `CREATE INDEX IF NOT EXISTS "mp_refunds_payment_id_idx" ON "mercadopago_refunds" ("mp_payment_id")`,
  `ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "mp_device_id" text`,
  `ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "mp_public_key" text`,
  `ALTER TABLE "store_config" ADD COLUMN IF NOT EXISTS "mp_enabled" boolean NOT NULL DEFAULT false`,
];

async function run() {
  const results = [];
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      results.push('OK: ' + stmt.slice(0, 60));
    } catch (e) {
      results.push('ERR: ' + e.message.slice(0, 100) + ' | ' + stmt.slice(0, 50));
    }
  }
  results.push('DONE');
  fs.writeFileSync('/tmp/db_mig7.txt', results.join('\n'));
  await pool.end();
  console.log('Migration complete. Check /tmp/db_mig7.txt');
}

run().catch(e => {
  console.error('Fatal:', e.message);
  pool.end();
});
