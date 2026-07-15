# Database — LINE Smart Queue Assistant

## Schema Reference

The canonical schema is: **`db/schema/reset_line_queue_schema.sql`**

This file is the single source of truth for the database structure. All migrations, repositories, and seed data must conform to this file.

---

## Tables Overview

| Table                  | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `organizations`        | Tenant root — every piece of data belongs to an org           |
| `organization_members` | Links users to organizations with a role and `is_active` flag |
| `users`                | All platform users (managers, staff, customers)               |
| `line_accounts`        | One LINE account per user — stored separately from `users`    |
| `products`             | Product/service catalog per organization                      |
| `queues`               | Queue instances — each org can have multiple queues           |
| `orders`               | Orders linking a customer, queue entry, and order items       |
| `order_items`          | Line items in an order (snapshot of product at order time)    |
| `queue_entries`        | Live queue tickets — the operational queue state              |
| `notifications`        | Outbound message log with retry tracking                      |
| `penalty_records`      | Skip/no-show/abuse penalty records per user                   |
| `queue_histories`      | Append-only archive when a ticket reaches terminal status     |
| `audit_logs`           | Immutable event trail for compliance                          |

---

## Key Schema Decisions

### `queue_entries`

The new schema drops `notes`, `metadata`, `skip_count` from queue entries. These were moved to the linked `orders` table or removed entirely:

| Old column                        | New location                                                  |
| --------------------------------- | ------------------------------------------------------------- |
| `ticket_display`                  | `ticket_code`                                                 |
| `serving_at`                      | `serving_started_at`                                          |
| `completed_at`                    | `served_at`                                                   |
| `estimated_call_at` (TIMESTAMPTZ) | `estimated_wait_seconds` (INT) — simpler, no clock drift      |
| `skip_count`                      | Removed — penalty tracking handles skip enforcement           |
| `notes`                           | Removed — customer notes go on the `orders` row               |
| `metadata`                        | Removed — JSONB overload avoided in favor of explicit columns |

Status `completed` → `served` to better reflect business semantics.

### `penalty_records`

Simplified: no `is_active`, `expires_at`, `severity`. The new model stores `points` and `penalty_type`. "Active" means created within a configurable window (currently 24 h).

### `notifications`

Added `retry_count` and `next_retry_at` for retry scheduling without a separate job queue.

### `organization_members`

Added `is_active` to allow soft-disabling a staff member without deleting their membership record.

---

## Why LINE Is Not the Source of Truth

LINE is an **integration layer** for customer identity and notifications:

1. **Authentication**: LINE LIFF provides `id_token` → verified server-side → `line_user_id` stored in `line_accounts`. The `users` table is the identity source; `line_accounts` is a secondary identity link.
2. **Notifications**: LINE Messaging API is used to push messages. Delivery status is tracked in `notifications`, not in LINE's systems.
3. **Business data**: All orders, queue states, products, and analytics live entirely in PostgreSQL. If LINE is unavailable, staff and managers can still operate through the web dashboard.

---

## How to Reset the Database

### Option A — Apply the canonical SQL directly

```bash
psql -U postgres -d line_queue -f db/schema/reset_line_queue_schema.sql
```

### Option B — Re-run migrations from scratch

```bash
# Drop and recreate DB
psql -U postgres -c "DROP DATABASE IF EXISTS line_queue; CREATE DATABASE line_queue;"
# Run the single consolidated migration
npm run db:migrate --workspace=apps/api
```

---

## How to Migrate

```bash
# Up (apply all pending migrations)
npm run db:migrate --workspace=apps/api

# Down (rollback last migration)
npm run db:migrate:down --workspace=apps/api

# Status
npm run db:migrate:status --workspace=apps/api
```

Migration files live in: `db/migrations/node-pg-migrate/`

Current consolidated migration: `000001_create_full_schema.ts`

---

## How to Seed

```bash
# Idempotent seed (ON CONFLICT DO NOTHING)
npm run db:seed --workspace=apps/api

# Full reset + re-seed (truncates ALL data first)
npm run db:seed:reset --workspace=apps/api
```

With Docker:

```bash
docker compose exec api npm run db:seed
docker compose exec api npm run db:seed:reset
```

---

## Demo Accounts (after seeding)

| Role    | Email                | Password  |
| ------- | -------------------- | --------- |
| Manager | alice@queue-lab.test | Demo@1234 |
| Staff   | bob@queue-lab.test   | Demo@1234 |

Organization public QR token: `demo_the_queue_lab_token_001`

Join URL: `http://localhost:5173/qr/demo_the_queue_lab_token_001`

---

## Key Relations

```
organizations
  └─ organization_members ──→ users
  └─ queues
       └─ queue_entries ──→ users (nullable)
            └─ order (optional direct FK)
  └─ orders ──→ order_items ──→ products
  └─ notifications ──→ queue_entries
  └─ penalty_records ──→ users
  └─ queue_histories (archive of terminal entries)
  └─ audit_logs
```

The cross-FK between `orders` and `queue_entries` is intentionally bidirectional:

- `orders.queue_entry_id` — which entry this order is waiting in
- `queue_entries.order_id` — which order is linked to this ticket

Both are nullable and set to `NULL ON DELETE` to keep deletion safe.
