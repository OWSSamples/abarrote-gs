import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function run() {
  const result = await db.execute('SELECT "name", "image_url" FROM products;');
  console.log(result.rows);
  process.exit(0);
}
run();
