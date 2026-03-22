import { config } from 'dotenv';
import pg from 'pg';
config({ path: '.env.local' });

const { Pool } = pg;

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("ALTER TABLE store_config ADD COLUMN IF NOT EXISTS prices_include_iva boolean NOT NULL DEFAULT true;");
    console.log("Migration successful.");
  } catch (e) {
    if (e.code === '42701') {
      console.log("Column already exists.");
    } else {
      console.error("Migration failed:", e);
    }
  } finally {
    pool.end();
  }
}
run();
