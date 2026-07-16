import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';

import { DEMO_PASSWORD, ORG_ID, USERS } from './_ids';

const demoUsers = [
  [USERS.ADMIN_1, '管理者デモ', 'admin@gmail.com', '0900000000', 'admin'],
  [USERS.MANAGER_1, 'マネージャーデモ', 'manager@gmail.com', '0900000001', 'manager'],
  [USERS.MANAGER_2, 'マネージャー二郎', 'manager2@gmail.com', '0900000002', 'manager'],
  [USERS.STAFF_1, 'スタッフデモ', 'staff@gmail.com', '0900000011', 'staff'],
  [USERS.STAFF_2, 'スタッフ二郎', 'staff2@gmail.com', '0900000012', 'staff'],
  [USERS.STAFF_3, 'スタッフ三郎', 'staff3@gmail.com', '0900000013', 'staff'],
  [USERS.CUSTOMER_1, '山田 太郎', 'customer@gmail.com', '0900000031', 'customer'],
  [USERS.CUSTOMER_2, '佐藤 花子', 'customer2@gmail.com', '0900000032', 'customer'],
  [USERS.CUSTOMER_3, '鈴木 一郎', 'customer3@gmail.com', '0900000033', 'customer'],
  [USERS.CUSTOMER_4, '高橋 美咲', 'customer4@gmail.com', '0900000034', 'customer'],
  [USERS.CUSTOMER_5, '田中 健太', 'customer5@gmail.com', '0900000035', 'customer'],
] as const;

const members = [
  [USERS.MANAGER_1, 'manager'],
  [USERS.MANAGER_2, 'manager'],
  [USERS.STAFF_1, 'staff'],
  [USERS.STAFF_2, 'staff'],
  [USERS.STAFF_3, 'staff'],
] as const;

export async function seed(client: PoolClient): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const [id, displayName, email, phone, role] of demoUsers) {
    await client.query(
      `
        INSERT INTO users (id, display_name, email, phone, role, password_hash, is_active)
        VALUES ($1, $2, $3, $4, $5::user_role, $6, TRUE)
        ON CONFLICT (id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          role = EXCLUDED.role,
          password_hash = EXCLUDED.password_hash,
          is_active = TRUE,
          updated_at = NOW();
      `,
      [id, displayName, email, phone, role, passwordHash]
    );
  }

  for (const [userId, role] of members) {
    await client.query(
      `
        INSERT INTO organization_members (organization_id, user_id, role, is_active)
        VALUES ($1, $2, $3::org_member_role, TRUE)
        ON CONFLICT (organization_id, user_id) DO UPDATE SET
          role = EXCLUDED.role,
          is_active = TRUE;
      `,
      [ORG_ID, userId, role]
    );
  }
}
