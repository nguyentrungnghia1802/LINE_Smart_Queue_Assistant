# Database

## 1. Source of truth

The executable schema source of truth is the ordered migration set in `db/migrations/node-pg-migrate`:

1. `000001_create_full_schema.js`
2. `000002_add_admin_user_role.js`
3. `000003_payment_transactions_and_inventory.js`
4. `000004_booking_location_and_forecasts.js`
5. `000005_durable_line_notification_outbox.js`
6. `000006_payment_production_foundation.js`
7. `000007_operational_correctness.js`
8. `000008_payment_reconciliation.js`

`db/schema/reset_line_queue_schema.sql` is a synchronized destructive local/dev reset snapshot. If this document or shared TypeScript enums disagree with migrations, migrations and runtime SQL win; fix the discrepancy in the same change.

## 2. Logical ERD

```text
organizations 1---* organization_members *---1 users 1---0..1 line_accounts
      |                                            |
      |---* products                               |
      |---* queues 1---* queue_entries ------------+
      |                    | 0..1
      |                    v
      |---* booking_groups 1---* orders 1---* order_items *---1 products
      |                              |---* payment_transactions 1---* payment_webhook_events
      |                              \---* inventory_reservations
      |---* customer_locations 1---* location_alerts
      |---* notifications
      |---* penalty_records
      |---* queue_histories
      |---* audit_logs
      |---* wait_time_forecasts
      \---* staffing_recommendations
```

## 3. Table catalog

### Identity and tenancy

| Table                  | Key purpose                                           | Important constraints                                       |
| ---------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| `organizations`        | Tenant, slug/token, branding, location, LINE/settings | Unique slug/token; coordinate ranges; soft active flag      |
| `users`                | Platform identity, role, password/profile             | Unique optional email; active flag                          |
| `organization_members` | Tenant manager/staff authorization                    | Unique organization/user pair; cascading tenant/user delete |
| `line_accounts`        | One linked LINE identity per user                     | Unique `line_user_id` and `user_id`                         |

### Catalog, queue, and orders

| Table                               | Key purpose                           | Important constraints                                                           |
| ----------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| `products`                          | Product/service snapshot source       | Nonnegative price/stock; positive duration; service stock must be `NULL`        |
| `queues`                            | Queue configuration and daily counter | Tenant FK, capacity/time/policy checks and status indexes                       |
| `booking_groups`                    | Group separate repeat bookings        | Tenant/customer/device keys; active/completed/cancelled check                   |
| `orders`                            | Commercial reservation header         | Tenant/order number, optional queue entry/customer/group, totals/status         |
| `order_items`                       | Price/name/duration/payment snapshots | Positive quantity, nonnegative subtotal/prepaid amount                          |
| `payment_transactions`              | Provider intent/state/reconciliation  | Tenant/order, amount/currency, provider intent/external-ID indexes              |
| `payment_webhook_events`            | Idempotent provider callback log      | Unique provider/event ID; replay-safe status                                    |
| `inventory_reservations`            | Finite stock allocation               | Positive quantity; reserved/consumed/released/expired check                     |
| `payment_reconciliation_operations` | Audited payment decisions             | Unique idempotency key; tenant, transaction, order, actor and amount references |
| `queue_entries`                     | Ticket lifecycle and ETA fields       | Unique queue/ticket number and code; active-user/LINE indexes                   |

### Location, analysis, messaging, and audit

| Table                      | Key purpose                              | Important constraints                                                                 |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `customer_locations`       | Consent-based coordinate snapshot        | Coordinate and nonnegative accuracy/distance checks                                   |
| `location_alerts`          | Proximity warning intent                 | pending/sent/skipped/failed check and due index                                       |
| `wait_time_forecasts`      | Forecast output history                  | Nonnegative wait/depth; confidence 0..1                                               |
| `staffing_recommendations` | Hourly staffing output                   | weekday 0..6, hour 0..23, positive staff, confidence 0..1                             |
| `notifications`            | Durable LINE outbox and delivery log     | Unique event key, tenant/entry/user/LINE references, pending/processing/retry indexes |
| `penalty_records`          | No-show/late/cancel/manual policy record | User/LINE/tenant lookup indexes                                                       |
| `queue_histories`          | Queue transition/event history           | Tenant/queue/entry/actor indexes                                                      |
| `audit_logs`               | Administrative/system audit trail        | Actor, tenant, resource indexes and JSON changes                                      |

## 4. Enumerated values

| Type                  | Values                                                                       |
| --------------------- | ---------------------------------------------------------------------------- |
| `user_role`           | `customer`, `staff`, `manager`, `admin`                                      |
| `org_member_role`     | `manager`, `staff`                                                           |
| `product_type`        | `product`, `service`                                                         |
| `queue_status`        | `closed`, `open`, `paused`, `archived`                                       |
| `queue_type`          | `walk_in`, `appointment`, `priority`, `disaster`                             |
| `queue_entry_status`  | `waiting`, `called`, `serving`, `served`, `skipped`, `cancelled`, `no_show`  |
| `order_status`        | `pending`, `processing`, `completed`, `cancelled`                            |
| `payment_status`      | `unpaid`, `pending`, `authorized`, `paid`, `refunded`, `failed`, `cancelled` |
| `notification_status` | `pending`, `processing`, `sent`, `delivered`, `failed`, `cancelled`          |

`notification_type` includes queue lifecycle values used by the durable outbox, including `queue_serving` added in migration `000005`. PostgreSQL enum additions require deliberate forward/backward compatibility planning; enum values are not removed by down migrations.

## 5. Critical constraints and indexes

- `organizations.slug` and `public_qr_token` are globally unique.
- Product stock cannot be negative; services cannot carry finite stock.
- Queue ticket number/code uniqueness is scoped to queue as defined by migrations.
- Active queue-entry lookup indexes support customer/LINE and queue/status ordering.
- Payment transaction lookup is indexed by provider external ID and provider intent ID.
- `payment_webhook_events(provider,event_id)` is unique so provider retries are idempotent.
- Pending notification/location-alert indexes support worker scans.
- `notifications.event_key` is unique, so the same domain event can be enqueued repeatedly without creating duplicate sends.
- `idx_notif_due_line_outbox` supports due pending LINE delivery scans, and workers claim rows with `FOR UPDATE SKIP LOCKED`.
- Tenant/recent indexes support orders, payment, history, location, forecast, and audit dashboards.

## 6. Transaction boundaries

### Order creation

One explicit PostgreSQL transaction creates/updates:

1. queue counter;
2. optional booking group;
3. queue entry;
4. order and queue-entry link;
5. optional verified payment transaction link;
6. optional location and pending alert;
7. order items;
8. finite stock decrement and reservation.

An insufficient-stock update affects zero rows, raises a conflict, and rolls back all writes.

### Other transactional workflows

- LINE user creation and account linking use one transaction.
- Organization plus initial manager/membership registration uses one transaction.
- Queue join counter, entry creation, and booking-created notification outbox enqueue use one transaction.
- Queue/order lifecycle transitions that produce customer LINE notifications write the state change and outbox row in the same transaction. External LINE API delivery happens only after commit through the worker.

Known concurrency gaps: queue capacity is checked before the join transaction, and organization order numbers are count-derived. Both need stronger locking/sequence semantics before high concurrency.

## 7. Deletion and retention

- Organization and member lifecycle is normally soft-deactivated by application services.
- FKs use a mix of `CASCADE`, `RESTRICT`, and `SET NULL` to preserve commercial/audit relationships; inspect migrations before any hard-delete feature.
- Orders/payment/audit/history should use retention rather than casual hard deletion.
- Location snapshots and raw provider payloads need explicit production retention and erasure rules.
- LINE profile data should be minimized and refreshed/deleted according to account unlink/consent policy.

## 8. Sensitive data

Sensitive or regulated fields include password hashes, email/phone, LINE user IDs/profile URLs, coordinates, IP/user agent audit data, payment external IDs, redirect URLs, and raw provider payloads. Do not seed production data, log secrets, or expose raw payloads through general APIs.

## 9. Migration workflow

```bash
npm run db:migrate:status -w apps/api
npm run db:migrate -w apps/api
npm run db:migrate:status
npm run db:migrate
npm run db:seed
```

Rules:

- Never edit an applied migration.
- Add a forward migration with an explicit `down` where safe.
- Use expand/backfill/validate/contract phases for nontrivial production changes.
- Keep the reset schema, repositories, shared/runtime types, seeds, tests, and this document synchronized.
- Back up before production migration and test restore/rollback in staging.

Schema migrations currently live under `db/migrations/node-pg-migrate` and are executed by the `apps/api` workspace `node-pg-migrate` command. The root `npm run db:migrate` command is a legacy SQL runner for `db/migrations/*.sql`; keep running it for compatibility checks, but it will not apply the JavaScript migrations unless the runner is unified in a future maintenance task.

`npm run db:reset` is destructive and intended only for local/dev.

## 10. Seed baseline

`db/seeds` provides one Queue Lab organization, admin/manager/staff/customer accounts, queues, products, orders, tickets, notifications, and penalties. Password and IDs are deterministic for local demonstration. Seed address/currency values are legacy Vietnamese samples and should be localized before a Japan-facing demo.

## 11. Schema gaps requiring follow-up

- Inventory reservation release/consume/expire behavior is missing.
- Payment transaction status history is still coarse; a full append-only transition history can be added if audit requirements demand it.
- Business hours/holidays and per-organization payment/LINE provider secrets need structured encrypted configuration.
- Booking-group retrieval/ownership constraints need an exposed domain service/API.
- Forecast and staffing tables lack producers and retention policy.
- Advanced notification operations UI, manual replay/cancel controls, and long-term notification retention policy are not implemented.
