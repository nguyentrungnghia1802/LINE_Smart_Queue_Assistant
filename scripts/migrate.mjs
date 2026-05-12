/**
 * Custom SQL migration runner.
 * Runs db/migrations/*.sql files in order, tracking applied migrations in a
 * `pgmigrations` table — compatible with the node-pg-migrate table schema.
 *
 * Usage (from repo root):
 *   node scripts/migrate.mjs           # apply all pending migrations
 *   node scripts/migrate.mjs status    # list applied vs pending
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set. Check your .env file.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pgmigrations (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) NOT NULL UNIQUE,
      run_on     TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query(
    'SELECT name FROM pgmigrations ORDER BY run_on',
  );
  return new Set(rows.map((r) => r.name));
}

function getSqlFiles() {
  const migrationsDir = path.join(ROOT, 'db', 'migrations');
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function runMigrations() {
  const command = process.argv[2] ?? 'up';
  const client = await pool.connect();

  try {
    if (command === 'reset') {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      console.log('✅  Schema reset. Run npm run db:migrate to re-apply migrations.');
      return;
    }

    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = getSqlFiles();

    if (command === 'status') {
      console.log('\n📋  Migration status:');
      for (const file of files) {
        const status = applied.has(file) ? '✅ applied' : '⏳ pending';
        console.log(`  ${status}  ${file}`);
      }
      return;
    }

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('✅  No pending migrations.');
      return;
    }

    console.log(`\n🚀  Running ${pending.length} migration(s)...\n`);

    for (const file of pending) {
      const filePath = path.join(ROOT, 'db', 'migrations', file);
      const sql = fs.readFileSync(filePath, 'utf8');

      process.stdout.write(`  ▶ ${file} ... `);
      try {
        await client.query(sql);
        await client.query('INSERT INTO pgmigrations (name, run_on) VALUES ($1, now())', [file]);
        console.log('✅');
      } catch (err) {
        console.log('❌');
        console.error(`\n  Error in ${file}:\n  ${err.message}\n`);
        process.exit(1);
      }
    }

    console.log('\n✅  All migrations applied successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
