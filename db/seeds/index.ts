import path from 'node:path';

import dotenv from 'dotenv';
import { Pool } from 'pg';

import { seedAdministrator } from './seed-administrator';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to run seeds');

const args = new Set(process.argv.slice(2));
const supportedArgs = new Set(['--reset']);
const unknownArgs = [...args].filter((arg) => !supportedArgs.has(arg));
if (unknownArgs.length > 0) {
  throw new Error(`Unsupported seed arguments: ${unknownArgs.join(', ')}`);
}

const resetRequested = args.has('--reset');
if (resetRequested) {
  const databaseHost = new URL(databaseUrl).hostname;
  const localDatabaseHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed reset is disabled when NODE_ENV=production');
  }
  if (
    !localDatabaseHosts.has(databaseHost) &&
    process.env.ALLOW_DESTRUCTIVE_SEED_RESET !== 'true'
  ) {
    throw new Error(
      'Seed reset is limited to local databases. Set ALLOW_DESTRUCTIVE_SEED_RESET=true only for an isolated development database.'
    );
  }
}

const pool = new Pool({ connectionString: databaseUrl });

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (resetRequested) {
      process.stdout.write('[seed] Resetting local application data\n');
      await client.query('TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE');
    }
    await seedAdministrator(client);
    await client.query('COMMIT');
    process.stdout.write(
      '[seed] Administrator seed completed. No organization, branch, manager, staff, customer, catalog, queue, order, or notification data was created.\n'
    );
  } catch (error) {
    await client.query('ROLLBACK');
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
