import { Pool } from 'pg';
import path from 'node:path';
import dotenv from 'dotenv';
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

async function main(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('[seed] 001 — organizations');
    await seedOrganizations(client);

    console.log('[seed] 002 — users + organization members');
    await seedUsers(client);

    console.log('[seed] 003 — LINE accounts');
    await seedLineAccounts(client);

    console.log('[seed] 004 — products/services');
    await seedProducts(client);

    console.log('[seed] 005 — queues');
    await seedQueues(client);

    console.log('[seed] 006 — orders + queue entries + histories');
    await seedOrdersAndQueueEntries(client);

    console.log('[seed] 007 — notifications');
    await seedNotifications(client);

    console.log('[seed] 008 — penalties');
    await seedPenalties(client);

    await client.query('COMMIT');
    console.log('[seed] All seeds completed successfully.');
    console.log('[seed] Demo accounts: manager@gmail.com / staff@gmail.com / customer@gmail.com — password: 123456');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[seed] Failed. Rolled back.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
