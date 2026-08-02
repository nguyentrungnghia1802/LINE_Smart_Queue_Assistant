import { createHash } from 'node:crypto';
import path from 'node:path';

import dotenv from 'dotenv';
import { Pool, type PoolClient } from 'pg';

import { BRANCHES, ORG_ID, PRODUCTS, QUEUES } from '../e2e/_ids';
import { seed as seedOrganizations } from '../e2e/001_organizations';
import { seed as seedUsers } from '../e2e/002_users';
import { seed as seedLineAccounts } from '../e2e/003_line_accounts';
import { seed as seedProducts } from '../e2e/004_products';
import { seed as seedQueues } from '../e2e/005_queues';
import { seed as seedOrdersAndQueueEntries } from '../e2e/006_orders_and_queue_entries';
import { seed as seedNotifications } from '../e2e/007_notifications';
import { seed as seedPenalties } from '../e2e/008_penalties';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const GUIDE_QUEUE_ID = '33333333-3333-4333-8333-333333333333';
const GUIDE_APPLICATION_ID = '88888888-8888-4888-8888-888888888801';
const GUIDE_ACTIVATION_ORG_ID = '99999999-9999-4999-8999-999999999901';
const GUIDE_ACTIVATION_USER_ID = '99999999-9999-4999-8999-999999999902';
const GUIDE_ACTIVATION_TOKEN_ID = '99999999-9999-4999-8999-999999999903';
export const GUIDE_ACTIVATION_TOKEN = 'guide-activation-token-2026-safe-local';
const GUIDE_LINE_USER_ID = 'mock-guide-customer';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to load guide fixtures');
if (process.env.NODE_ENV === 'production') {
  throw new Error('Guide fixtures are disabled in production');
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
if (!/(guide|dev|test)/i.test(databaseName)) {
  throw new Error(
    `Guide fixtures require an isolated guide/dev/test database, received: ${databaseName}`
  );
}

const pool = new Pool({ connectionString: databaseUrl });

async function seedGuideQueue(client: PoolClient): Promise<void> {
  await client.query('UPDATE queue_entries SET absence_count = 0 WHERE queue_id = $1', [
    QUEUES.COUNTER_A,
  ]);
  await client.query("UPDATE organizations SET logo_url = '/img/logo.png' WHERE id = $1", [ORG_ID]);
  await client.query(
    "UPDATE products SET image_url = '/img/landing-hero.webp' WHERE organization_id = $1",
    [ORG_ID]
  );
  await client.query(
    `INSERT INTO branch_product_inventories (
       branch_id, product_id, organization_id, stock_quantity, low_stock_threshold
     )
     SELECT branch.id,
            product.id,
            product.organization_id,
            CASE
              WHEN product.product_type = 'service' THEN NULL
              WHEN product.id = $2::uuid AND branch.id = $1::uuid THEN 2
              WHEN product.id = $3::uuid AND branch.id = $1::uuid THEN 0
              WHEN product.id = $4::uuid THEN NULL
              ELSE 10
            END,
            CASE WHEN product.id = $2::uuid THEN 2 ELSE 3 END
     FROM organization_branches branch
     JOIN products product ON product.organization_id = branch.organization_id
     WHERE branch.organization_id = $5
     ON CONFLICT (branch_id, product_id) DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       stock_quantity = EXCLUDED.stock_quantity,
       low_stock_threshold = EXCLUDED.low_stock_threshold`,
    [BRANCHES.TOKYO_MAIN, PRODUCTS.PEACH_TEA, PRODUCTS.BUN_BO, PRODUCTS.WATER, ORG_ID]
  );
  await client.query(
    `UPDATE order_items item
     SET payment_status = 'paid',
         prepaid_amount = item.subtotal,
         refunded_amount = 0
     FROM orders order_record
     WHERE item.order_id = order_record.id
       AND order_record.payment_status = 'paid'`
  );
  await client.query(
    `INSERT INTO queues (
       id, organization_id, branch_id, name, description, status, queue_type, prefix,
       max_capacity, daily_ticket_counter, avg_service_seconds,
       notify_ahead_positions, allow_skip, max_skips_before_penalty,
       auto_no_show_minutes, absence_deferral_slots, max_absence_count,
       opens_at, closes_at, settings, is_active
     ) VALUES (
       $1, $2, $3, 'サービス相談窓口', '商品相談・サービス案内', 'open', 'walk_in', 'B',
       80, 4, 720, 5, TRUE, 2, 5, 3, 3,
       '09:00', '18:00', '{"guide":true}'::jsonb, TRUE
     )
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       status = EXCLUDED.status,
       prefix = EXCLUDED.prefix,
       max_capacity = EXCLUDED.max_capacity,
       avg_service_seconds = EXCLUDED.avg_service_seconds,
       absence_deferral_slots = EXCLUDED.absence_deferral_slots,
       max_absence_count = EXCLUDED.max_absence_count,
       is_active = TRUE,
       updated_at = NOW()`,
    [GUIDE_QUEUE_ID, ORG_ID, BRANCHES.TOKYO_MAIN]
  );
  await client.query(
    `INSERT INTO queue_translations (queue_id, locale, name, description) VALUES
       ($1, 'ja', 'サービス相談窓口', '商品相談・サービス案内'),
       ($1, 'vi', 'Quầy tư vấn dịch vụ', 'Tư vấn sản phẩm và dịch vụ'),
       ($1, 'en', 'Service Consultation', 'Product and service consultation')
     ON CONFLICT (queue_id, locale) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description`,
    [GUIDE_QUEUE_ID]
  );
  await client.query(
    `INSERT INTO queue_products (
       queue_id, product_id, organization_id, branch_id, is_active, display_order
     )
     SELECT $1, product_id, $2, $3, TRUE, display_order
     FROM UNNEST($4::uuid[]) WITH ORDINALITY AS selected(product_id, display_order)
     ON CONFLICT (queue_id, product_id) DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       branch_id = EXCLUDED.branch_id,
       is_active = TRUE,
       display_order = EXCLUDED.display_order`,
    [
      GUIDE_QUEUE_ID,
      ORG_ID,
      BRANCHES.TOKYO_MAIN,
      [PRODUCTS.HAIRCUT, PRODUCTS.CHECKUP, PRODUCTS.WATER],
    ]
  );
}

async function setGuideLocales(client: PoolClient): Promise<void> {
  await client.query(
    `UPDATE users
     SET preferred_locale = 'ja'
     WHERE LOWER(email) = ANY($1::text[])`,
    [['admin@gmail.com', 'manager2@gmail.com', 'manager@gmail.com', 'staff@gmail.com']]
  );
}

async function seedPendingApplication(client: PoolClient): Promise<void> {
  const existing = await client.query<{ organization_id: string | null }>(
    'SELECT organization_id FROM organization_applications WHERE id = $1',
    [GUIDE_APPLICATION_ID]
  );
  await client.query('DELETE FROM organization_applications WHERE id = $1', [GUIDE_APPLICATION_ID]);
  if (existing.rows[0]?.organization_id) {
    await client.query('DELETE FROM organizations WHERE id = $1', [
      existing.rows[0].organization_id,
    ]);
  }
  await client.query("DELETE FROM users WHERE LOWER(email) = 'owner.application@guide.invalid'");
  await client.query(
    "DELETE FROM email_outbox WHERE LOWER(recipient_email) = 'owner.application@guide.invalid'"
  );
  const submittedApplications = await client.query<{ organization_id: string | null }>(
    `SELECT organization_id
     FROM organization_applications
     WHERE LOWER(work_email) = 'business.registration@guide.invalid'`
  );
  await client.query(
    "DELETE FROM organization_applications WHERE LOWER(work_email) = 'business.registration@guide.invalid'"
  );
  for (const application of submittedApplications.rows) {
    if (application.organization_id) {
      await client.query('DELETE FROM organizations WHERE id = $1', [application.organization_id]);
    }
  }
  await client.query(
    "DELETE FROM users WHERE LOWER(email) = 'business.registration@guide.invalid'"
  );
  await client.query(
    "DELETE FROM email_outbox WHERE LOWER(recipient_email) = 'business.registration@guide.invalid'"
  );
  await client.query(
    `INSERT INTO organization_applications (
       id, reference_code, status, legal_name, trade_name, business_type,
       registration_number, website_url, contact_name, contact_title, work_email,
       phone, postal_code, prefecture, city, address_line1, address_line2,
       location_count, expected_monthly_customers, plan_code, billing_cycle,
       default_locale, logo_url, payment_provider, payment_status,
       payment_reference, amount_yen, submitted_at
     ) VALUES (
       $1, 'SQA-GUIDE01', 'pending', '株式会社ガイドスマート受付', 'ガイドスマート受付', 'salon',
       'T1234567890123', 'https://guide.invalid', '山田 ガイド', '店舗責任者',
       'owner.application@guide.invalid', '0312345678', '100-0001', '東京都',
       '千代田区', '千代田1-1', NULL, 2, 1500, 'standard', 'monthly',
       'ja', NULL, 'demo', 'paid', 'demo-guide-application-2026', 29800,
       NOW() - INTERVAL '15 minutes'
     )`,
    [GUIDE_APPLICATION_ID]
  );
}

async function resetGuideCustomer(client: PoolClient): Promise<void> {
  const orders = await client.query<{ id: string }>(
    'SELECT id FROM orders WHERE customer_line_user_id = $1',
    [GUIDE_LINE_USER_ID]
  );
  const orderIds = orders.rows.map((order) => order.id);
  await client.query('DELETE FROM notifications WHERE line_user_id = $1', [GUIDE_LINE_USER_ID]);
  await client.query('DELETE FROM queue_histories WHERE line_user_id = $1', [GUIDE_LINE_USER_ID]);
  await client.query('DELETE FROM customer_locations WHERE customer_line_user_id = $1', [
    GUIDE_LINE_USER_ID,
  ]);
  await client.query('DELETE FROM queue_entries WHERE line_user_id = $1', [GUIDE_LINE_USER_ID]);
  if (orderIds.length > 0) {
    await client.query('DELETE FROM payment_transactions WHERE order_id = ANY($1::uuid[])', [
      orderIds,
    ]);
    await client.query('DELETE FROM orders WHERE id = ANY($1::uuid[])', [orderIds]);
  }
  await client.query('DELETE FROM booking_groups WHERE customer_line_user_id = $1', [
    GUIDE_LINE_USER_ID,
  ]);
  const lineAccount = await client.query<{ user_id: string }>(
    'SELECT user_id FROM line_accounts WHERE line_user_id = $1',
    [GUIDE_LINE_USER_ID]
  );
  if (lineAccount.rows[0]) {
    await client.query('DELETE FROM users WHERE id = $1', [lineAccount.rows[0].user_id]);
  }
}

async function seedActivationAccount(client: PoolClient): Promise<void> {
  await client.query('DELETE FROM organizations WHERE id = $1', [GUIDE_ACTIVATION_ORG_ID]);
  await client.query('DELETE FROM users WHERE id = $1', [GUIDE_ACTIVATION_USER_ID]);
  await client.query(
    `INSERT INTO organizations (
       id, name, slug, public_qr_token, phone, address, timezone, settings,
       is_active, activation_status, default_locale, postal_code, prefecture,
       city, address_line1
     ) VALUES (
       $1, 'ガイド承認済み組織', 'guide-approved-organization',
       'guide-approved-org-2026', '0311112222',
       '〒100-0001 東京都千代田区千代田2-2', 'Asia/Tokyo',
       '{"subscriptionPlan":"starter","billingCycle":"monthly","guide":true}'::jsonb,
       FALSE, 'pending_activation', 'ja', '100-0001', '東京都', '千代田区', '千代田2-2'
     )`,
    [GUIDE_ACTIVATION_ORG_ID]
  );
  await client.query(
    `INSERT INTO organization_translations (organization_id, locale, name) VALUES
       ($1, 'ja', 'ガイド承認済み組織'),
       ($1, 'vi', 'Tổ chức đã được duyệt'),
       ($1, 'en', 'Approved Guide Organization')`,
    [GUIDE_ACTIVATION_ORG_ID]
  );
  await client.query(
    `INSERT INTO users (
       id, display_name, email, phone, role, password_hash, is_active,
       account_status, job_title
     ) VALUES (
       $1, '大村 ガイド', 'owner.activate@guide.invalid', '0311112222',
       'manager', NULL, FALSE, 'invited', 'Organization Owner'
     )`,
    [GUIDE_ACTIVATION_USER_ID]
  );
  await client.query(
    `INSERT INTO organization_members (
       organization_id, user_id, role, is_active, is_owner, invited_at
     ) VALUES ($1, $2, 'manager', FALSE, TRUE, NOW())`,
    [GUIDE_ACTIVATION_ORG_ID, GUIDE_ACTIVATION_USER_ID]
  );
  await client.query(
    `INSERT INTO account_action_tokens (
       id, user_id, purpose, token_hash, expires_at
     ) VALUES ($1, $2, 'account_activation', $3, NOW() + INTERVAL '7 days')`,
    [
      GUIDE_ACTIVATION_TOKEN_ID,
      GUIDE_ACTIVATION_USER_ID,
      createHash('sha256').update(GUIDE_ACTIVATION_TOKEN).digest('hex'),
    ]
  );
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seedOrganizations(client);
    await seedUsers(client, true);
    await seedLineAccounts(client);
    await seedProducts(client);
    await seedQueues(client);
    await seedOrdersAndQueueEntries(client);
    await seedNotifications(client);
    await seedPenalties(client);
    await setGuideLocales(client);
    await resetGuideCustomer(client);
    await seedGuideQueue(client);
    await seedPendingApplication(client);
    await seedActivationAccount(client);
    await client.query('COMMIT');
    process.stdout.write('[fixture:guide] Loaded deterministic local guide fixtures.\n');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
