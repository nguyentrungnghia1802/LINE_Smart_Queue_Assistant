import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const ADMIN_EMAIL = 'admin@gmail.com';

export async function seedAdministrator(client: PoolClient): Promise<void> {
  const configuredPassword = process.env.SEED_ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production' && !configuredPassword) {
    throw new Error('SEED_ADMIN_PASSWORD is required when seeding a production database');
  }
  const passwordHash = await bcrypt.hash(configuredPassword ?? '123456', 10);
  await client.query(
    `INSERT INTO users (
       id, display_name, email, phone, role, password_hash,
       is_active, account_status, activated_at
     )
     VALUES ($1, 'Platform Administrator', $2, NULL, 'admin', $3, TRUE, 'active', NOW())
     ON CONFLICT (id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       email = EXCLUDED.email,
       role = 'admin',
       password_hash = EXCLUDED.password_hash,
       is_active = TRUE,
       account_status = 'active',
       activated_at = COALESCE(users.activated_at, NOW()),
       deactivated_at = NULL,
       deactivated_by = NULL,
       updated_at = NOW()`,
    [ADMIN_ID, ADMIN_EMAIL, passwordHash]
  );
}
