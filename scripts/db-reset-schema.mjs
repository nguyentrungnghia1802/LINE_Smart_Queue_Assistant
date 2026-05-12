/**
 * Reset the public schema (dev only — wipes all tables, types, indexes).
 */
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  console.log('✅  Public schema reset.');
  await client.end();
}

main().catch((err) => {
  process.stderr.write('❌  ' + err.message + '\n');
  process.exit(1);
});
