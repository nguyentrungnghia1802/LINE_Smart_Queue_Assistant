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

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to load E2E fixtures');
if (process.env.NODE_ENV === 'production') {
  throw new Error('E2E fixtures are disabled in production');
}

const pool = new Pool({ connectionString: databaseUrl });

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seedOrganizations(client);
    await seedProducts(client);
    await seedQueues(client);
    await seedUsers(client, true);
    await seedLineAccounts(client);
    await seedOrdersAndQueueEntries(client);
    await seedNotifications(client);
    await seedPenalties(client);
    await client.query('COMMIT');
    process.stdout.write('[fixture:e2e] Loaded isolated browser-test fixtures.\n');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
