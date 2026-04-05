import { type Client } from 'pg';

import { SEED_IDS } from './_ids';

/**
 * Seed 001 — Organization, manager user, and staff user.
 *
 * Creates:
 *   • 1 organization  : "The Queue Lab"
 *   • 1 manager user  : alice@queue-lab.test  (org role: manager)
 *   • 1 staff user    : bob@queue-lab.test    (org role: staff)
 */
export async function seed001Organization(client: Client): Promise<void> {
  // Organization
  await client.query(
    `INSERT INTO organizations (id, name, slug, timezone)
     VALUES ($1, 'The Queue Lab', 'the-queue-lab', 'Asia/Bangkok')
     ON CONFLICT (id) DO NOTHING`,
    [SEED_IDS.org]
  );

  // Manager + staff users
  await client.query(
    `INSERT INTO users (id, display_name, email, role) VALUES
       ($1, 'Alice Manager', 'alice@queue-lab.test', 'staff'),
       ($2, 'Bob Staff',     'bob@queue-lab.test',  'staff')
     ON CONFLICT (id) DO NOTHING`,
    [SEED_IDS.users.manager, SEED_IDS.users.staff]
  );

  // Org membership
  await client.query(
    `INSERT INTO organization_members (organization_id, user_id, role) VALUES
       ($1, $2, 'manager'),
       ($1, $3, 'staff')
     ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [SEED_IDS.org, SEED_IDS.users.manager, SEED_IDS.users.staff]
  );

  console.info('[seed] 001 — organization + 2 staff users created');
}
