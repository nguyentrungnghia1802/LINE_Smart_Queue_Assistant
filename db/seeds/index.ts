import path from 'node:path';

import dotenv from 'dotenv';
import { Pool } from 'pg';

import { seed as seedOrganizations } from './001_organizations';
import { seed as seedUsers } from './002_users';
import { seed as seedLineAccounts } from './003_line_accounts';
import { seed as seedProducts } from './004_products';
import { seed as seedQueues } from './005_queues';
import { seed as seedOrdersAndQueueEntries } from './006_orders_and_queue_entries';
import { seed as seedNotifications } from './007_notifications';
import { seed as seedPenalties } from './008_penalties';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run seeds');
}

const pool = new Pool({ connectionString: databaseUrl });
const args = new Set(process.argv.slice(2));
const resetRequested = args.has('--reset');
const demoRequested = args.has('--demo');
const supportedArgs = new Set(['--reset', '--demo']);
const unknownArgs = [...args].filter((arg) => !supportedArgs.has(arg));

if (unknownArgs.length > 0) {
  throw new Error(`Unsupported seed arguments: ${unknownArgs.join(', ')}`);
}

if (resetRequested) {
  const databaseHost = new URL(databaseUrl).hostname;
  const localDatabaseHosts = new Set(['localhost', '127.0.0.1', '::1']);
  const explicitResetAllowed = process.env.ALLOW_DESTRUCTIVE_SEED_RESET === 'true';

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed reset is disabled when NODE_ENV=production');
  }
  if (!localDatabaseHosts.has(databaseHost) && !explicitResetAllowed) {
    throw new Error(
      'Seed reset is limited to local databases. Set ALLOW_DESTRUCTIVE_SEED_RESET=true only for an isolated development database.'
    );
  }
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function logError(message: unknown): void {
  process.stderr.write(
    `${message instanceof Error ? (message.stack ?? message.message) : String(message)}\n`
  );
}

async function main(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (resetRequested) {
      log('[seed] Resetting local application data');
      await client.query('TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE');
    }

    log('[seed] 001 - organizations');
    await seedOrganizations(client);

    log('[seed] 002 - users + organization members');
    await seedUsers(client);

    if (demoRequested) {
      log('[seed:demo] 003 - LINE accounts');
      await seedLineAccounts(client);

      log('[seed:demo] 004 - products/services');
      await seedProducts(client);

      log('[seed:demo] 005 - queues');
      await seedQueues(client);

      log('[seed:demo] 006 - orders + queue entries + histories');
      await seedOrdersAndQueueEntries(client);

      log('[seed:demo] 007 - notifications');
      await seedNotifications(client);

      log('[seed:demo] 008 - penalties');
      await seedPenalties(client);
    }

    await client.query('COMMIT');
    log(
      demoRequested
        ? '[seed] Demo profile completed successfully.'
        : '[seed] Baseline completed successfully; no catalog, queue, order, or notification data was created.'
    );
    log(
      '[seed] Demo accounts: admin@gmail.com / manager@gmail.com / staff@gmail.com / customer@gmail.com - password: 123456'
    );
  } catch (error) {
    await client.query('ROLLBACK');
    logError('[seed] Failed. Rolled back.');
    logError(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
