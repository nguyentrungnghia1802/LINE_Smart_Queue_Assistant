import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';

import { BRANCHES, DEMO_PASSWORD, ORG_ID, QUEUES, USERS } from './_ids';

const demoUsers = [
  [USERS.ADMIN_1, '管理者デモ', 'admin@gmail.com', '0900000000', 'admin'],
  [USERS.MANAGER_1, 'マネージャーデモ', 'manager@gmail.com', '0900000001', 'manager'],
  [USERS.MANAGER_2, 'マネージャー二郎', 'manager2@gmail.com', '0900000002', 'manager'],
  [USERS.MANAGER_3, 'マネージャー三郎', 'manager3@gmail.com', '0900000003', 'manager'],
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
  [USERS.MANAGER_1, 'manager', false],
  [USERS.MANAGER_2, 'manager', true],
  [USERS.MANAGER_3, 'manager', false],
  [USERS.STAFF_1, 'staff', false],
  [USERS.STAFF_2, 'staff', false],
  [USERS.STAFF_3, 'staff', false],
] as const;

const branchMembers = [
  [BRANCHES.TOKYO_MAIN, USERS.MANAGER_1, 'manager', null],
  [BRANCHES.TOKYO_MAIN, USERS.STAFF_1, 'staff', QUEUES.COUNTER_A],
  [BRANCHES.TOKYO_MAIN, USERS.STAFF_2, 'staff', QUEUES.COUNTER_A],
  [BRANCHES.TOKYO_VIP, USERS.MANAGER_3, 'manager', null],
  [BRANCHES.TOKYO_VIP, USERS.STAFF_3, 'staff', QUEUES.VIP_LANE],
] as const;

export async function seed(client: PoolClient, includeDemoUsers = false): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const selectedUsers = includeDemoUsers ? demoUsers : demoUsers.slice(0, 1);
  for (const [id, displayName, email, phone, role] of selectedUsers) {
    await client.query(
      `
        INSERT INTO users (
          id, display_name, email, phone, role, password_hash,
          is_active, account_status, activated_at
        )
        VALUES ($1, $2, $3, $4, $5::user_role, $6, TRUE, 'active', NOW())
        ON CONFLICT (id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          role = EXCLUDED.role,
          password_hash = EXCLUDED.password_hash,
          is_active = TRUE,
          account_status = 'active',
          activated_at = COALESCE(users.activated_at, NOW()),
          deactivated_at = NULL,
          deactivated_by = NULL,
          updated_at = NOW();
      `,
      [id, displayName, email, phone, role, passwordHash]
    );
  }

  if (!includeDemoUsers) return;
  for (const [userId, role, isOwner] of members) {
    await client.query(
      `
        INSERT INTO organization_members (
          organization_id, user_id, role, is_active, is_owner, activated_at
        )
        VALUES ($1, $2, $3::org_member_role, TRUE, $4, NOW())
        ON CONFLICT (organization_id, user_id) DO UPDATE SET
          role = EXCLUDED.role,
          is_active = TRUE,
          is_owner = EXCLUDED.is_owner,
          activated_at = COALESCE(organization_members.activated_at, NOW());
      `,
      [ORG_ID, userId, role, isOwner]
    );
  }

  for (const [branchId, userId, role, queueId] of branchMembers) {
    await client.query(
      `
        INSERT INTO branch_memberships (
          organization_id, branch_id, user_id, role, is_active, queue_id
        )
        VALUES ($1, $2, $3, $4::org_member_role, TRUE, $5)
        ON CONFLICT (branch_id, user_id) DO UPDATE SET
          role = EXCLUDED.role,
          is_active = TRUE,
          queue_id = EXCLUDED.queue_id,
          deactivated_at = NULL;
      `,
      [ORG_ID, branchId, userId, role, queueId]
    );
  }
}
