-- =============================================================================
-- seed_demo.sql
-- Demo data for LINE Smart Queue Assistant
-- Password for all demo accounts: Demo@1234
-- Hash (bcrypt cost 10): $2b$10$W/XzmPlWw6Za0bUZwdAPBONCuMDyIR3pC6YYRnfdGHJ/Uc.9uRj9a
-- Run AFTER all migrations.
-- =============================================================================

BEGIN;

-- ── Disable FK checks during seed (re-enabled at end) ─────────────────────────
SET session_replication_role = 'replica';

-- ── Organizations ─────────────────────────────────────────────────────────────

INSERT INTO organizations (id, name, slug, timezone, is_active, settings) VALUES
  ('00000000-0001-0000-0000-000000000001', 'Nhà Hàng Phở Sài Gòn',    'pho-sai-gon',  'Asia/Ho_Chi_Minh', TRUE, '{}'),
  ('00000000-0001-0000-0000-000000000002', 'Phòng Khám Đa Khoa Minh Đức', 'pkdk-minh-duc', 'Asia/Ho_Chi_Minh', TRUE, '{}'),
  ('00000000-0001-0000-0000-000000000003', 'Ngân Hàng Viet Credit',    'viet-credit',  'Asia/Ho_Chi_Minh', TRUE, '{}'),
  ('00000000-0001-0000-0000-000000000004', 'Cắt Tóc Phong Cách',       'cat-toc-phong-cach', 'Asia/Ho_Chi_Minh', TRUE, '{}')
ON CONFLICT (id) DO NOTHING;

-- ── Users ─────────────────────────────────────────────────────────────────────
-- 1 admin, 4 managers (1 per org), 4 staff (1 per org), 10 customers

INSERT INTO users (id, display_name, email, password_hash, role, is_active) VALUES
  -- Admin
  ('00000000-0002-0000-0000-000000000001', 'System Admin',          'admin@linequeue.test',           '$2b$10$W/XzmPlWw6Za0bUZwdAPBONCuMDyIR3pC6YYRnfdGHJ/Uc.9uRj9a', 'admin',    TRUE),
  -- Managers
  ('00000000-0002-0000-0000-000000000002', 'Quản Lý Phở Sài Gòn',  'manager.pho@linequeue.test',     '$2b$10$W/XzmPlWw6Za0bUZwdAPBONCuMDyIR3pC6YYRnfdGHJ/Uc.9uRj9a', 'manager',  TRUE),
  ('00000000-0002-0000-0000-000000000003', 'Quản Lý Phòng Khám',   'manager.clinic@linequeue.test',  '$2b$10$W/XzmPlWw6Za0bUZwdAPBONCuMDyIR3pC6YYRnfdGHJ/Uc.9uRj9a', 'manager',  TRUE),
  ('00000000-0002-0000-0000-000000000004', 'Quản Lý Ngân Hàng',    'manager.bank@linequeue.test',    '$2b$10$W/XzmPlWw6Za0bUZwdAPBONCuMDyIR3pC6YYRnfdGHJ/Uc.9uRj9a', 'manager',  TRUE),
  ('00000000-0002-0000-0000-000000000005', 'Quản Lý Tiệm Cắt Tóc', 'manager.barber@linequeue.test',  '$2b$10$W/XzmPlWw6Za0bUZwdAPBONCuMDyIR3pC6YYRnfdGHJ/Uc.9uRj9a', 'manager',  TRUE),
  -- Staff
  ('00000000-0002-0000-0000-000000000006', 'Nhân Viên Phở',         'staff.pho@linequeue.test',       '$2b$10$W/XzmPlWw6Za0bUZwdAPBONCuMDyIR3pC6YYRnfdGHJ/Uc.9uRj9a', 'staff',    TRUE),
  ('00000000-0002-0000-0000-000000000007', 'Nhân Viên Phòng Khám',  'staff.clinic@linequeue.test',    '$2b$10$W/XzmPlWw6Za0bUZwdAPBONCuMDyIR3pC6YYRnfdGHJ/Uc.9uRj9a', 'staff',    TRUE),
  ('00000000-0002-0000-0000-000000000008', 'Nhân Viên Ngân Hàng',   'staff.bank@linequeue.test',      '$2b$10$W/XzmPlWw6Za0bUZwdAPBONCuMDyIR3pC6YYRnfdGHJ/Uc.9uRj9a', 'staff',    TRUE),
  ('00000000-0002-0000-0000-000000000009', 'Nhân Viên Cắt Tóc',     'staff.barber@linequeue.test',    '$2b$10$W/XzmPlWw6Za0bUZwdAPBONCuMDyIR3pC6YYRnfdGHJ/Uc.9uRj9a', 'staff',    TRUE),
  -- LINE Customers (no email/password — authenticated via LINE)
  ('00000000-0002-0000-0000-000000000010', 'Nguyễn Văn An',         NULL, NULL, 'customer', TRUE),
  ('00000000-0002-0000-0000-000000000011', 'Trần Thị Bình',         NULL, NULL, 'customer', TRUE),
  ('00000000-0002-0000-0000-000000000012', 'Lê Minh Cường',         NULL, NULL, 'customer', TRUE),
  ('00000000-0002-0000-0000-000000000013', 'Phạm Thị Dung',         NULL, NULL, 'customer', TRUE),
  ('00000000-0002-0000-0000-000000000014', 'Hoàng Văn Em',          NULL, NULL, 'customer', TRUE),
  ('00000000-0002-0000-0000-000000000015', 'Vũ Thị Phương',         NULL, NULL, 'customer', TRUE),
  ('00000000-0002-0000-0000-000000000016', 'Đặng Văn Giang',        NULL, NULL, 'customer', TRUE),
  ('00000000-0002-0000-0000-000000000017', 'Bùi Thị Hoa',           NULL, NULL, 'customer', TRUE),
  ('00000000-0002-0000-0000-000000000018', 'Ngô Văn Ích',           NULL, NULL, 'customer', TRUE),
  ('00000000-0002-0000-0000-000000000019', 'Lý Thị Kim',            NULL, NULL, 'customer', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── LINE Accounts (fake LINE user IDs for demo customers) ─────────────────────

INSERT INTO line_accounts (id, user_id, line_user_id, display_name, picture_url, is_linked) VALUES
  ('00000000-0003-0000-0000-000000000010', '00000000-0002-0000-0000-000000000010', 'Uabc0000000001', 'Nguyễn Văn An',   'https://profile.line-scdn.net/placeholder1.jpg', TRUE),
  ('00000000-0003-0000-0000-000000000011', '00000000-0002-0000-0000-000000000011', 'Uabc0000000002', 'Trần Thị Bình',   'https://profile.line-scdn.net/placeholder2.jpg', TRUE),
  ('00000000-0003-0000-0000-000000000012', '00000000-0002-0000-0000-000000000012', 'Uabc0000000003', 'Lê Minh Cường',   NULL, TRUE),
  ('00000000-0003-0000-0000-000000000013', '00000000-0002-0000-0000-000000000013', 'Uabc0000000004', 'Phạm Thị Dung',   NULL, TRUE),
  ('00000000-0003-0000-0000-000000000014', '00000000-0002-0000-0000-000000000014', 'Uabc0000000005', 'Hoàng Văn Em',    NULL, TRUE),
  ('00000000-0003-0000-0000-000000000015', '00000000-0002-0000-0000-000000000015', 'Uabc0000000006', 'Vũ Thị Phương',   NULL, TRUE),
  ('00000000-0003-0000-0000-000000000016', '00000000-0002-0000-0000-000000000016', 'Uabc0000000007', 'Đặng Văn Giang',  NULL, TRUE),
  ('00000000-0003-0000-0000-000000000017', '00000000-0002-0000-0000-000000000017', 'Uabc0000000008', 'Bùi Thị Hoa',    NULL, TRUE),
  ('00000000-0003-0000-0000-000000000018', '00000000-0002-0000-0000-000000000018', 'Uabc0000000009', 'Ngô Văn Ích',    NULL, TRUE),
  ('00000000-0003-0000-0000-000000000019', '00000000-0002-0000-0000-000000000019', 'Uabc0000000010', 'Lý Thị Kim',     NULL, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── Organization Members ──────────────────────────────────────────────────────

INSERT INTO organization_members (id, organization_id, user_id, role) VALUES
  -- Phở Sài Gòn
  ('00000000-0004-0000-0000-000000000001', '00000000-0001-0000-0000-000000000001', '00000000-0002-0000-0000-000000000002', 'owner'),
  ('00000000-0004-0000-0000-000000000002', '00000000-0001-0000-0000-000000000001', '00000000-0002-0000-0000-000000000006', 'staff'),
  -- Phòng Khám Minh Đức
  ('00000000-0004-0000-0000-000000000003', '00000000-0001-0000-0000-000000000002', '00000000-0002-0000-0000-000000000003', 'owner'),
  ('00000000-0004-0000-0000-000000000004', '00000000-0001-0000-0000-000000000002', '00000000-0002-0000-0000-000000000007', 'staff'),
  -- Ngân Hàng Viet Credit
  ('00000000-0004-0000-0000-000000000005', '00000000-0001-0000-0000-000000000003', '00000000-0002-0000-0000-000000000004', 'owner'),
  ('00000000-0004-0000-0000-000000000006', '00000000-0001-0000-0000-000000000003', '00000000-0002-0000-0000-000000000008', 'staff'),
  -- Cắt Tóc Phong Cách
  ('00000000-0004-0000-0000-000000000007', '00000000-0001-0000-0000-000000000004', '00000000-0002-0000-0000-000000000005', 'owner'),
  ('00000000-0004-0000-0000-000000000008', '00000000-0001-0000-0000-000000000004', '00000000-0002-0000-0000-000000000009', 'staff')
ON CONFLICT (id) DO NOTHING;

-- ── Queues ─────────────────────────────────────────────────────────────────────

INSERT INTO queues (id, organization_id, name, description, prefix, status, max_capacity, avg_service_seconds, auto_no_show_minutes, is_active) VALUES
  -- Phở Sài Gòn
  ('00000000-0005-0000-0000-000000000001', '00000000-0001-0000-0000-000000000001',
    'Hàng Đợi Ăn Tại Chỗ', 'Khách ăn tại nhà hàng', 'A', 'open', 50, 1800, 10, TRUE),
  ('00000000-0005-0000-0000-000000000002', '00000000-0001-0000-0000-000000000001',
    'Đặt Mang Đi', 'Khách đặt đồ mang về', 'T', 'open', 30, 600, 5, TRUE),
  -- Phòng Khám Minh Đức
  ('00000000-0005-0000-0000-000000000003', '00000000-0001-0000-0000-000000000002',
    'Khám Tổng Quát', 'Phòng khám đa khoa', 'K', 'open', 40, 1200, 15, TRUE),
  ('00000000-0005-0000-0000-000000000004', '00000000-0001-0000-0000-000000000002',
    'Xét Nghiệm', 'Phòng xét nghiệm máu và nước tiểu', 'X', 'open', 20, 300, 10, TRUE),
  -- Ngân Hàng Viet Credit
  ('00000000-0005-0000-0000-000000000005', '00000000-0001-0000-0000-000000000003',
    'Giao Dịch Thông Thường', 'Gửi / rút / chuyển tiền', 'G', 'open', 60, 900, 10, TRUE),
  ('00000000-0005-0000-0000-000000000006', '00000000-0001-0000-0000-000000000003',
    'Vay Vốn & Tư Vấn', 'Tư vấn vay tín dụng và mở thẻ', 'V', 'open', 20, 2400, 20, TRUE),
  -- Cắt Tóc Phong Cách
  ('00000000-0005-0000-0000-000000000007', '00000000-0001-0000-0000-000000000004',
    'Cắt Tóc Nam', 'Cắt, gội, tạo kiểu nam', 'N', 'open', 15, 2700, 10, TRUE),
  ('00000000-0005-0000-0000-000000000008', '00000000-0001-0000-0000-000000000004',
    'Cắt Tóc Nữ', 'Cắt, nhuộm, uốn tóc nữ', 'F', 'open', 10, 5400, 15, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── Queue Entries (active demo tickets) ───────────────────────────────────────

-- Phở Sài Gòn — Hàng Đợi Ăn Tại Chỗ (A001–A004 waiting, A005 called)
INSERT INTO queues (id, daily_ticket_counter) VALUES ('00000000-0005-0000-0000-000000000001', 5)
  ON CONFLICT (id) DO UPDATE SET daily_ticket_counter = GREATEST(queues.daily_ticket_counter, 5);

INSERT INTO queue_entries (id, queue_id, organization_id, user_id, line_user_id, ticket_number, ticket_display, status, notes, priority) VALUES
  ('00000000-0006-0000-0000-000000000001', '00000000-0005-0000-0000-000000000001', '00000000-0001-0000-0000-000000000001', '00000000-0002-0000-0000-000000000010', 'Uabc0000000001', 1, 'A001', 'waiting', NULL, 0),
  ('00000000-0006-0000-0000-000000000002', '00000000-0005-0000-0000-000000000001', '00000000-0001-0000-0000-000000000001', '00000000-0002-0000-0000-000000000011', 'Uabc0000000002', 2, 'A002', 'waiting', NULL, 0),
  ('00000000-0006-0000-0000-000000000003', '00000000-0005-0000-0000-000000000001', '00000000-0001-0000-0000-000000000001', NULL,                                   NULL,             3, 'A003', 'waiting', '[Guest] Khách bàn 5', 0),
  ('00000000-0006-0000-0000-000000000004', '00000000-0005-0000-0000-000000000001', '00000000-0001-0000-0000-000000000001', '00000000-0002-0000-0000-000000000012', 'Uabc0000000003', 4, 'A004', 'waiting', NULL, 0),
  ('00000000-0006-0000-0000-000000000005', '00000000-0005-0000-0000-000000000001', '00000000-0001-0000-0000-000000000001', '00000000-0002-0000-0000-000000000013', 'Uabc0000000004', 5, 'A005', 'called',  NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- Phòng Khám — Khám Tổng Quát (K001–K003 waiting)
INSERT INTO queues (id, daily_ticket_counter) VALUES ('00000000-0005-0000-0000-000000000003', 3)
  ON CONFLICT (id) DO UPDATE SET daily_ticket_counter = GREATEST(queues.daily_ticket_counter, 3);

INSERT INTO queue_entries (id, queue_id, organization_id, user_id, line_user_id, ticket_number, ticket_display, status, notes, priority) VALUES
  ('00000000-0006-0000-0000-000000000010', '00000000-0005-0000-0000-000000000003', '00000000-0001-0000-0000-000000000002', '00000000-0002-0000-0000-000000000014', 'Uabc0000000005', 1, 'K001', 'waiting', NULL, 0),
  ('00000000-0006-0000-0000-000000000011', '00000000-0005-0000-0000-000000000003', '00000000-0001-0000-0000-000000000002', '00000000-0002-0000-0000-000000000015', 'Uabc0000000006', 2, 'K002', 'waiting', NULL, 0),
  ('00000000-0006-0000-0000-000000000012', '00000000-0005-0000-0000-000000000003', '00000000-0001-0000-0000-000000000002', NULL,                                   NULL,             3, 'K003', 'waiting', '[Guest] Nguyễn Thị Lan', 0)
ON CONFLICT (id) DO NOTHING;

-- Ngân Hàng — Giao Dịch (G001–G002 waiting, G003 serving)
INSERT INTO queues (id, daily_ticket_counter) VALUES ('00000000-0005-0000-0000-000000000005', 3)
  ON CONFLICT (id) DO UPDATE SET daily_ticket_counter = GREATEST(queues.daily_ticket_counter, 3);

INSERT INTO queue_entries (id, queue_id, organization_id, user_id, line_user_id, ticket_number, ticket_display, status, notes, priority) VALUES
  ('00000000-0006-0000-0000-000000000020', '00000000-0005-0000-0000-000000000005', '00000000-0001-0000-0000-000000000003', '00000000-0002-0000-0000-000000000016', 'Uabc0000000007', 1, 'G001', 'waiting', NULL, 0),
  ('00000000-0006-0000-0000-000000000021', '00000000-0005-0000-0000-000000000005', '00000000-0001-0000-0000-000000000003', '00000000-0002-0000-0000-000000000017', 'Uabc0000000008', 2, 'G002', 'waiting', NULL, 0),
  ('00000000-0006-0000-0000-000000000022', '00000000-0005-0000-0000-000000000005', '00000000-0001-0000-0000-000000000003', '00000000-0002-0000-0000-000000000018', 'Uabc0000000009', 3, 'G003', 'serving', NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- Cắt Tóc — Nam (N001 waiting)
INSERT INTO queues (id, daily_ticket_counter) VALUES ('00000000-0005-0000-0000-000000000007', 1)
  ON CONFLICT (id) DO UPDATE SET daily_ticket_counter = GREATEST(queues.daily_ticket_counter, 1);

INSERT INTO queue_entries (id, queue_id, organization_id, user_id, line_user_id, ticket_number, ticket_display, status, notes, priority) VALUES
  ('00000000-0006-0000-0000-000000000030', '00000000-0005-0000-0000-000000000007', '00000000-0001-0000-0000-000000000004', '00000000-0002-0000-0000-000000000019', 'Uabc0000000010', 1, 'N001', 'waiting', NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- ── Re-enable FK checks ────────────────────────────────────────────────────────
SET session_replication_role = 'origin';

COMMIT;
