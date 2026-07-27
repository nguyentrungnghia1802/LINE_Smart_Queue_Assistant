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
9. `000009_notification_consent_location_privacy.js`
10. `000010_booking_history_japan_calendar.js`
11. `000011_forecasting_baseline.js`
12. `000012_media_storage.js`
13. `000013_internationalization.js`
14. `000014_organization_applications.js`
15. `000015_account_lifecycle_and_branches.js`
16. `000016_branch_scoped_multi_queue.js`
17. `000017_order_fulfillment_and_scope.js`
18. `000018_system_workflow_hardening.js`

`db/schema/reset_line_queue_schema.sql` is a synchronized destructive local/dev reset snapshot. If this document or shared TypeScript enums disagree with migrations, migrations and runtime SQL win; fix the discrepancy in the same change.

## 2. Logical ERD

```text
organization_applications 0..1---1 organizations 1---* organization_members *---1 users 1---0..1 line_accounts
      |                          |                 |
      |                          |---* organization_branches 1---* branch_memberships ---+
      |                                      |---* branch_business_hours
      |                                      |---* branch_exception_days
      |                                      |---* products *---* queues (through queue_products)
      |                                      \---* queues 1---* queue_entries ----------+
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

| Table                         | Key purpose                                                                  | Important constraints                                                       |
| ----------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `organizations`               | Tenant, slug/token, locale, Japan address, branding, location, LINE/settings | Unique slug/token; `default_locale`; `Asia/Tokyo` default; soft active flag |
| `organization_applications`   | Public business details, plan/demo payment, and admin review                 | Status/payment checks; pending-email uniqueness; reviewer/organization FKs  |
| `organization_business_hours` | Weekly local opening schedule                                                | Unique tenant/weekday; closed/open time consistency                         |
| `organization_exception_days` | Holidays and exceptional opening/closure dates                               | Unique tenant/date; closed/open time consistency                            |
| `users`                       | Platform identity, role, password/profile, preferred locale                  | Globally unique normalized optional email; nullable locale; active flag     |
| `organization_members`        | Tenant manager/staff authorization                                           | Unique organization/user pair; cascading tenant/user delete                 |
| `organization_branches`       | Physical branch, stable QR, address, timezone, payment acceptance, lifecycle | Unique branch QR and organization/code; soft active flag                    |
| `branch_memberships`          | Manager/staff branch assignment                                              | Branch/member FK; one active branch for a manager                           |
| `branch_business_hours`       | Weekly branch-local opening schedule                                         | Unique branch/weekday; closed/open time consistency                         |
| `branch_exception_days`       | Branch holidays and exceptional opening/closure dates                        | Unique branch/date; overrides weekly schedule                               |
| `line_accounts`               | One linked LINE identity per user                                            | Unique `line_user_id` and `user_id`                                         |
| `organization_translations`   | Localized organization names                                                 | Composite organization/locale key; cascade delete                           |
| `product_translations`        | Localized product names/descriptions                                         | Composite product/locale key; cascade delete                                |
| `queue_translations`          | Localized queue names/descriptions                                           | Composite queue/locale key; cascade delete                                  |
| `media_assets`                | Stored image key, URL, ownership and deletion state                          | Unique key; provider/purpose/type/size/status checks                        |

### Catalog, queue, and orders

| Table                               | Key purpose                               | Important constraints                                                                      |
| ----------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `products`                          | Organization product/service catalog      | Organization FK; unique `SPn`/`DVn` code; nonnegative price/stock; service stock is `NULL` |
| `queues`                            | Named branch queue and daily counter      | Organization/branch FK; unique active branch/name; capacity/time checks                    |
| `queue_products`                    | Queue-specific branch catalog assignment  | Queue branch scope plus organization product FK; unique mapping and active display order   |
| `booking_groups`                    | Group separate repeat bookings            | Tenant/customer/device keys; active/completed/cancelled check                              |
| `orders`                            | Commercial reservation and receipt header | Direct branch/queue scope, group, totals/status, immutable business/fulfillment snapshots  |
| `order_items`                       | Price/name/duration/payment snapshots     | Positive quantity, nonnegative subtotal/prepaid amount                                     |
| `payment_transactions`              | Provider intent/state/reconciliation      | Tenant/order, amount/currency, provider intent/external-ID indexes                         |
| `payment_webhook_events`            | Idempotent provider callback log          | Unique provider/event ID; replay-safe status                                               |
| `inventory_reservations`            | Finite stock allocation                   | Positive quantity; reserved/consumed/released/expired check                                |
| `payment_reconciliation_operations` | Audited payment decisions                 | Unique idempotency key; tenant, transaction, order, actor and amount references            |
| `queue_entries`                     | Ticket lifecycle and ETA fields           | Unique queue/ticket number and code; active-user/LINE indexes                              |

### Location, analysis, messaging, and audit

| Table                           | Key purpose                                       | Important constraints                                                                       |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `customer_locations`            | Consent-based coordinate snapshot                 | Coordinate and nonnegative accuracy/distance checks                                         |
| `location_alerts`               | Proximity warning intent                          | Idempotent event key, attempt/retry fields, pending/sent/skipped/failed state and due index |
| `line_notification_preferences` | Verified LINE delivery consent and event switches | One row per linked user/LINE recipient                                                      |
| `customer_location_consents`    | Location consent, revocation and deletion request | One row per authenticated customer                                                          |
| `wait_time_forecasts`           | Forecast output history                           | Nonnegative wait/depth; confidence 0..1                                                     |
| `staffing_recommendations`      | Hourly staffing output                            | weekday 0..6, hour 0..23, positive staff, confidence 0..1                                   |
| `queue_hourly_metrics`          | Retained eight-week demand/service aggregate      | Tenant slot indexes, nonnegative counts/durations, bounded weekday/hour, expiry             |
| `notifications`                 | Durable localized LINE outbox and delivery log    | Unique event key, resolved locale, tenant/entry/user/LINE references, delivery indexes      |
| `penalty_records`               | No-show/late/cancel/manual policy record          | User/LINE/tenant lookup indexes                                                             |
| `queue_histories`               | Queue transition/event history                    | Tenant/queue/entry indexes; `actor_id` stores the authenticated operator, not the customer  |
| `audit_logs`                    | Administrative/system audit trail                 | Actor, tenant, resource indexes and JSON changes                                            |

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
- Only one pending organization application can exist per normalized work email.
- One normalized email address can identify only one platform user and therefore cannot carry
  multiple platform roles.
- Application approval requires `payment_status = 'paid'`; reviewed state requires reviewer/time,
  and approval creates a single-use owner activation action instead of accepting an applicant password.
- Product stock cannot be negative; services cannot carry finite stock.
- Active queue names are unique within a branch. A branch may have zero queues during initial setup
  or operational reconfiguration.
- A non-owner manager can have only one active branch membership. The organization owner may retain
  a compatibility membership created during activation, but that row never grants branch-operation
  authorization.
- Staff invitations derive the target branch from the authenticated branch manager and require a
  non-empty employee code; request-body branch identifiers are not accepted as authority.
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
- Organization application approval locks the application and creates the organization, initial
  manager, membership, and reviewed state in one transaction.
- Queue join counter, entry creation, and booking-created notification outbox enqueue use one transaction.
- Queue/order lifecycle transitions that produce customer LINE notifications write the state change and outbox row in the same transaction. External LINE API delivery happens only after commit through the worker.
- Customer/operator cancellation locks the order and refundable payment transactions, records
  idempotent reconciliation operations, updates transaction/item/order refund summaries, releases
  inventory, cancels the order/ticket, and enqueues the LINE cancellation notification in one transaction.
- Service completion locks the queue before serving completion and automatic call-next selection.
  Booking into an idle queue, cancellation, no-show, and defer use the same queue-locked auto-call
  boundary. It never calls a second customer while another ticket is called or serving.
- A recorded absence increments `queue_entries.absence_count`; the first two occurrences move the
  ticket back by the queue's configured slot count (default three), while the configured maximum
  (default three) cancels the order, refunds collected payment, releases inventory, and enqueues
  the no-show notification in one transaction.
- Completion snapshots the responsible staff user, display name, employee code, and completion time
  on the order. Order creation snapshots organization, branch, and queue names for durable receipts.

Queue capacity, call-next, daily ticket numbering, and organization order numbering use transaction locks or atomic counters. Production load testing remains required.

## 7. Deletion and retention

- Organization and member lifecycle is normally soft-deactivated by application services.
- FKs use a mix of `CASCADE`, `RESTRICT`, and `SET NULL` to preserve commercial/audit relationships; inspect migrations before any hard-delete feature.
- Orders/payment/audit/history should use retention rather than casual hard deletion.
- Location snapshots and raw provider payloads need explicit production retention and erasure rules.
- LINE profile data should be minimized and refreshed/deleted according to account unlink/consent policy.

## 8. Sensitive data

Sensitive or regulated fields include account password hashes, encrypted invitation/reset tokens,
email/phone, LINE user IDs/profile URLs, coordinates, IP/user agent audit data, payment external
IDs, redirect URLs, and raw provider payloads. Application/API contracts never expose password
hashes or action tokens. Do not seed production data, log secrets, or expose raw payloads through
general APIs.

## 9. Migration workflow

```bash
npm run db:migrate:status -w apps/api
npm run db:migrate -w apps/api
npm run db:migrate:status
npm run db:migrate
npm run db:seed
npm run db:fixture:e2e
```

Rules:

- Never edit an applied migration.
- Add a forward migration with an explicit `down` where safe.
- Use expand/backfill/validate/contract phases for nontrivial production changes.
- Keep the reset schema, repositories, shared/runtime types, seeds, tests, and this document synchronized.
- Back up before production migration and test restore/rollback in staging.

Schema migrations live under `db/migrations/node-pg-migrate`. Root and `apps/api` workspace migration commands both execute this canonical `node-pg-migrate` history; the historical SQL runner is disabled by default.

`npm run db:reset` is destructive and intended only for local/dev.

## 10. Seed baseline

The default `npm run db:seed` profile creates only the platform administrator. It deliberately
creates no organization, branch, manager, staff, customer, product, queue, order, ticket, payment,
notification, or penalty data. Production seeding requires `SEED_ADMIN_PASSWORD`; the local
fallback password exists only for development.

`npm run db:fixture:e2e` explicitly loads the isolated browser-test organization, identities,
branches, queue catalogs, orders, and notification fixtures. It is not a production seed and must
not run as part of server startup. `db:seed:reset` truncates application data before restoring only
the administrator; it is blocked in production and requires
`ALLOW_DESTRUCTIVE_SEED_RESET=true` for a non-loopback isolated development database.

## 11. Schema gaps requiring follow-up

- Real per-organization payment/LINE provider secrets need a managed encrypted configuration boundary.
- Forecast calibration still needs production history and measured accuracy review before any ML claim.
- Advanced notification operations UI, manual replay/cancel controls, and long-term notification retention policy are not implemented.

## 12. Account lifecycle, branch scope, and receipts (migrations 000015-000017)

- `organizations.activation_status` separates pending activation, active, and suspended tenants.
- `users.account_status` and invitation/profile fields model invited, active, and disabled business accounts.
- `organization_members.is_owner` identifies the immutable organization owner manager.
- `organization_branches` and `branch_memberships` scope managers and staff to physical branches.
- `organization_branches.public_qr_token` provides one stable QR per branch.
- `branch_business_hours` and `branch_exception_days` control branch-local booking availability.
- `queues.branch_id` is required; a branch can have multiple active queues with unique active names.
- Migration `000020_organization_product_catalog` makes `products.branch_id` nullable compatibility
  data, generates organization-unique `DVn`/`SPn` product codes, and changes `queue_products` to
  reference the organization catalog while preserving queue/branch scope.
- `organization_branches.payment_settings` stores non-secret accepted methods, merchant display
  information, and settlement instructions. Provider credentials remain outside this JSON field.
- `orders.branch_id` and `orders.queue_id` preserve direct operational scope, while organization,
  branch, queue, and fulfilling-staff snapshots preserve receipt meaning after later profile changes.
- Active reservations made by the same verified LINE user in one branch reuse the current active
  booking group. Completed/cancelled history remains separate and is excluded from Staff work cards.
- `account_action_tokens` stores only SHA-256 token hashes and supports single-use activation/reset links.
- `email_outbox` provides durable, retryable delivery. Its action token is encrypted at rest and cleared after successful delivery.
- Baseline seeding creates only the admin account. Browser-test data requires the explicit E2E fixture command.
