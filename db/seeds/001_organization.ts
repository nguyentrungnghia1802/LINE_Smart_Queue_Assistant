import bcrypt from 'bcryptjs';
import { type Client } from 'pg';

import { SEED_IDS } from './_ids';

/**
 * Seed 001 — Organization, manager user, and staff user.
 *
 * Creates:
 *   • 1 organization  : "Tiệm Cắt Tóc The Queue Lab"
 *   • 1 manager user  : alice@queue-lab.test  (role: manager, password: Demo@1234)
 *   • 1 staff user    : bob@queue-lab.test    (role: staff,   password: Demo@1234)
 */
export async function seed001Organization(client: Client): Promise<void> {
  const demoPassword = await bcrypt.hash('Demo@1234', 10);

  // Organization — richer data for demo
  await client.query(
    `INSERT INTO organizations
       (id, name, slug, timezone, phone, address, payment_info, public_qr_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       name         = EXCLUDED.name,
       phone        = EXCLUDED.phone,
       address      = EXCLUDED.address,
       payment_info = EXCLUDED.payment_info,
       public_qr_token = EXCLUDED.public_qr_token`,
    [
      SEED_IDS.org,
      'Tiệm Cắt Tóc The Queue Lab',
      'the-queue-lab',
      'Asia/Bangkok',
      '0901 234 567',
      '123 Đường Lê Văn Lương, Quận 7, TP.HCM',
      'Chuyển khoản: Techcombank 1234567890 - Tên: THE QUEUE LAB\nVietcombank: 9876543210 - Tên: NGUYEN VAN A\nVui lòng ghi mã đơn hàng vào nội dung chuyển khoản.',
      'demo_the_queue_lab_token_001',
    ]
  );

  // Manager user (Alice) + Staff user (Bob)
  await client.query(
    `INSERT INTO users (id, display_name, email, role, password_hash) VALUES
       ($1, 'Alice (Manager)', 'alice@queue-lab.test', 'staff', $3),
       ($2, 'Bob (Staff)',     'bob@queue-lab.test',  'staff', $3)
     ON CONFLICT (id) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       display_name  = EXCLUDED.display_name`,
    [SEED_IDS.users.manager, SEED_IDS.users.staff, demoPassword]
  );

  // Org membership
  await client.query(
    `INSERT INTO organization_members (organization_id, user_id, role) VALUES
       ($1, $2, 'manager'),
       ($1, $3, 'staff')
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [SEED_IDS.org, SEED_IDS.users.manager, SEED_IDS.users.staff]
  );

  console.info('[seed] 001 — organization + 2 staff users created (password: Demo@1234)');
}
