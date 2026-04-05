/**
 * db/seeds/index.ts — Seed runner
 *
 * Usage (from monorepo root via npm scripts):
 *   npm run db:seed          — insert seed data (idempotent via ON CONFLICT DO NOTHING)
 *   npm run db:seed:reset    — truncate all data, then re-seed from scratch
 *
 * The runner loads DATABASE_URL from the monorepo-root .env file.
 */
import path from 'node:path';

import dotenv from 'dotenv';
import { Client } from 'pg';

import { seed001Organization } from './001_organization';
import { seed002Queues } from './002_queues';
import { seed003TestData } from './003_test_data';

// ── Load env ──────────────────────────────────────────────────────────────────
// __dirname is db/seeds/ — go two levels up to reach the monorepo root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[seed] DATABASE_URL is not set. Add it to your .env file.');
  process.exit(1);
}

// ── Reset helper ──────────────────────────────────────────────────────────────
// Truncate leaf-to-root in FK order. CASCADE handles any remaining deps.
async function resetDatabase(client: Client): Promise<void> {
  console.info('[seed] Resetting database — truncating all seed tables…');
  await client.query(`
    TRUNCATE
      audit_logs,
      queue_histories,
      notifications,
      penalty_records,
      queue_entries,
      organization_members,
      line_accounts,
      queues,
      users,
      organizations
    RESTART IDENTITY CASCADE
  `);
  console.info('[seed] Database truncated.');
}

// ── Runner ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const isReset = process.argv.includes('--reset');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.info('[seed] Connected to database.');

  try {
    if (isReset) {
      await resetDatabase(client);
    }

    await seed001Organization(client);
    await seed002Queues(client);
    await seed003TestData(client);

    console.info('[seed] All seeds completed successfully.');
  } catch (err) {
    console.error('[seed] Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error('[seed] Unexpected error:', err);
  process.exit(1);
});
