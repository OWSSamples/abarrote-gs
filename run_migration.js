import { config } from 'dotenv';
import { Pool } from 'pg';
config({ path: '.env.local' });

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'pieza';");
    console.log("Migration successful.");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    pool.end();
  }
}
run();
