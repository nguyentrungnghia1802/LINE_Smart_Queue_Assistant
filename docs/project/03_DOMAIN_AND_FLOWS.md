# Domain and Flows

## 1. Domain model

```text
Organization
  |--< OrganizationMember >-- User --0..1-- LineAccount
  |--< Product
  |--< Queue --< QueueEntry >--0..1-- Order --< OrderItem >-- Product
  |                         \             |--< PaymentTransaction
  |                          \            |--< InventoryReservation
  |                           \--< QueueHistory
  |--< BookingGroup --< Order
  |--< CustomerLocation --< LocationAlert
  |--< Notification
  |--< PenaltyRecord
  |--< WaitTimeForecast
  |--< StaffingRecommendation
  \--< AuditLog
```

### Entity responsibilities

| Entity                                  | Responsibility                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Organization                            | Tenant identity, public routes/token, branding, location, timezone, settings    |
| User                                    | Platform identity and global role                                               |
| OrganizationMember                      | Active manager/staff role within one tenant                                     |
| LineAccount                             | Verified LINE user link for login/profile/push targeting                        |
| Product                                 | Product/service price, duration, image, prepayment rule, finite/unlimited stock |
| Queue                                   | Operational line, ticket counter, capacity, timing and policy settings          |
| QueueEntry                              | Customer ticket and queue state machine                                         |
| BookingGroup                            | Association of separate repeat bookings from one identity/device                |
| Order                                   | Reservation commercial header, customer contact, total, status, payment summary |
| OrderItem                               | Immutable commercial/service snapshot and per-item payment state                |
| PaymentTransaction                      | Provider attempt/status/payload/audit record                                    |
| InventoryReservation                    | Finite-stock allocation lifecycle                                               |
| CustomerLocation                        | Consent-based location snapshot and distance calculation                        |
| LocationAlert                           | Pending/sent/skipped/failed proximity notification intent                       |
| Notification                            | Durable LINE notification outbox and delivery log for queue lifecycle messages  |
| QueueHistory/AuditLog                   | Domain and administrative traceability                                          |
| WaitTimeForecast/StaffingRecommendation | Model output history; runtime producer not implemented                          |

## 2. State machines

### Queue

PostgreSQL values are `closed`, `open`, `paused`, and `archived`.

| Current         | Action          | Next       | Actor         |
| --------------- | --------------- | ---------- | ------------- |
| `closed`        | Open queue      | `open`     | Manager/admin |
| `open`          | Pause admission | `paused`   | Manager/admin |
| `paused`        | Resume          | `open`     | Manager/admin |
| `open`/`paused` | Close           | `closed`   | Manager/admin |
| non-archived    | Retire          | `archived` | Manager/admin |

Only `open` queues accept a new booking/ticket.

### Queue entry

PostgreSQL values are `waiting`, `called`, `serving`, `served`, `skipped`, `cancelled`, and `no_show`.

| Current            | Action                    | Next                                | Actor                    |
| ------------------ | ------------------------- | ----------------------------------- | ------------------------ |
| new                | Create successful booking | `waiting`                           | Customer/system          |
| `waiting`          | Call next                 | `called`                            | Staff/manager/admin      |
| `called`           | Begin service             | `serving`                           | Staff/manager/admin      |
| `serving`          | Complete service          | `served`                            | Staff/manager/admin      |
| `waiting`/eligible | Skip                      | `skipped` or policy-specific result | Customer/staff policy    |
| eligible active    | Cancel                    | `cancelled`                         | Owner or tenant operator |
| called/eligible    | Mark absent               | `no_show`                           | Staff/manager/admin      |

Terminal states are `served`, `cancelled`, and `no_show`. Exact transition guards in queue/staff services are authoritative.

### Order

| Current                | Action                | Next         |
| ---------------------- | --------------------- | ------------ |
| new                    | Successful booking    | `pending`    |
| `pending`              | Staff starts handling | `processing` |
| `pending`/`processing` | Finish order/service  | `completed`  |
| `pending`/`processing` | Valid cancellation    | `cancelled`  |

Order and ticket states are related but separate. A queue completion should not be assumed to prove commercial payment completion.

### Payment

Order/item summary values include `unpaid` and `paid`; provider transaction values use the Phase 6 state machine: `pending`, `authorized`, `paid`, `failed`, `cancelled`, and `refunded`. Public create-order validation accepts only a server-created payment `transactionId`; it does not accept browser-supplied amount, status, method code, or covered product IDs.

Webhook transitions are serialized by locking the payment transaction. Duplicate provider events are ignored by `(provider, event_id)`, older events and regressive transitions are recorded as ignored reconciliation operations, and provider payload fields with secret/card/token-shaped keys are redacted before persistence. Partial refunds keep the transaction/order paid while recording cumulative `refunded_amount`; a full refund transitions to `refunded`. Staff manual paid/refund operations require an idempotency key and create an audited reconciliation row. Receipt data is available only when the order is both `completed` and fully `paid`.

Per-item state determines prepaid coverage. The order header is `paid` only when every selected item is paid. Required-only checkout leaves the overall order `unpaid` until remaining balance is collected.

### Inventory reservation

Finite stock is decremented and a `reserved` reservation is inserted in the same order transaction. Fulfillment transitions it to `consumed` without changing stock. Cancellation or no-show transitions it to `released` and restores stock. The expiry worker transitions due rows to `expired`, restores stock, and cancels the pending order/ticket. Every transition is conditional on `status = 'reserved'` and writes `inventory_reservation_events`, preventing double release or consume.

Values are `reserved`, `consumed`, `released`, and `expired`. Creation currently decrements `products.stock_quantity` and writes `reserved`; transitions and stock restoration are not yet fully implemented.

## 3. Customer entry and identity flow

1. Primary customer entry is the LIFF route, usually `/liff/qr/:token` from `https://liff.line.me/{LIFF_ID}?liff.state=...`.
2. LIFF initializes, automatically starts LINE Login in real mode when needed, obtains an ID token, calls `/auth/line`, and stores the system JWT.
3. Web fetches public organization, queue, and active product data after the route context is known.
4. Customer selects products/services, optionally completes demo checkout for required prepayment, and creates the booking within the same LIFF flow.
5. The backend uses server-verified identity, not browser profile data or public request body fields, to attach the LINE recipient.
6. On success, LIFF navigates to `/liff/tickets/:entryId` and shows ticket code, status, people ahead, and ETA.
7. Rich Menu opens `/liff/home` or `/liff/home` with mode/section query parameters. LIFF Home uses the authenticated LINE session to resolve the current active ticket, start booking from the configured default booking path, or show Japanese empty/usage states.

Public `/qr/:token`, `/q/:orgSlug`, `/ticket/:entryId`, and public demo checkout remain fallback/browser-compatible routes. Guest trade-off: the order/ticket works, but LINE push is unavailable unless the ticket resolves to a linked `line_user_id`. For LINE-authenticated requests, `currentUserMiddleware` validates the JWT LINE claim against the active `line_accounts` row. The order and queue controllers pass both internal user ID and verified LINE user ID to their services, which store both on the queue entry inside the write transaction.

## 4. Booking without required prepayment

1. Customer selects available items and quantities.
2. UI checks visible stock and calculates a display subtotal.
3. Customer may optionally choose checkout for all items or place the reservation unpaid.
4. `POST /orders` reloads organization, active queue, products, prices, ownership, and stock.
5. In one transaction the API increments the ticket counter, creates optional booking group, queue entry with any verified LINE recipient, order, items, stock reservations, and location/alert if supplied.
6. On success the UI stores a local booking record and navigates to `/liff/tickets/:entryId` in LIFF or `/ticket/:entryId` in the public fallback.
7. Any transaction error rolls back all database writes.

## 5. Booking with required prepayment

1. Selection includes one or more `requires_prepayment` items.
2. The booking action explains that those items must be paid and opens one checkout flow.
3. Checkout offers two scopes: `required_items` or `all_items`.
4. API creates a server-side payment intent and `payment_transactions` row with server-computed coverage.
5. Demo provider completes with a server-signed token; future external providers redirect to PSP checkout and return via signed webhook/server verification.
6. Browser returns to the booking page with its session draft preserved and only the verified `transactionId` stored locally.
7. Order request includes the `transactionId` only.
8. API reloads product data, loads the paid transaction, checks tenant, unused state, amount, cart metadata, and required prepayment coverage.
9. API links the transaction to the order and marks covered order items paid.
10. Full coverage marks the order paid; required-only coverage leaves the order unpaid for later staff collection.

Production invariant: a browser return cannot establish payment. Only the server's verified provider state may produce a paid transaction that order creation can consume.

## 6. Repeat/additional booking flow

1. Browser creates a stable local device key and a booking-group UUID.
2. First reservation creates an independent order/ticket and optionally the server booking group.
3. A later reservation creates another independent order/ticket using the same group ID.
4. Browser history groups the records for convenience; staff can eventually retrieve the group server-side.
5. Cancellation, queue state, item/payment records, and receipts remain per order.

Current limitation: no dedicated group retrieval/management API is exposed, so the end-to-end server experience is partial.

## 7. Staff queue flow

1. Staff authenticates and the API resolves active organization membership.
2. `/staff/my-queue` returns the organization queue board and selected order details.
3. Calling next atomically selects/transitions the next eligible waiting entry.
4. The queue transition and LINE notification outbox row are written in the same database transaction; a worker sends the Japanese LINE message after commit.
5. Staff starts service, completes, marks no-show, or cancels through guarded transitions; each successful state change enqueues a LINE push intent when the ticket has a verified recipient.
6. Staff updates order/payment status manually as needed.
7. Receipt printing is available after the applicable payment success state.

Notification delivery failure is non-transactional and cannot reverse a queue transition. Failed delivery is retried through the durable outbox until the configured attempt limit is reached.

## 8. LINE notification flow

```text
Queue/order transition / 30s scan
          |
          v
QueueNotificationService -- missing LINE ID --> skip
          |
          +-- duplicate event key --> reuse existing outbox row
          |
          v
PostgreSQL notifications outbox row (pending)
          |
          v
Notification delivery worker -- claim due row with FOR UPDATE SKIP LOCKED
          |
          v
lineNotificationService + Japanese Flex template + text fallback + LIFF ticket deep link
          |
          v
ILineMessagingAdapter
    | token absent/test -> MockLineAdapter
    | token present     -> LINE /v2/bot/message/push
          |
       Flex success: mark sent + metric
       Flex failure: try Japanese text fallback
       final failure: schedule exponential retry or mark failed
```

The `notifications.event_key` unique constraint makes enqueue idempotent for lifecycle events such as `queue_entry:{entryId}:called`. Workers claim due rows with PostgreSQL row locks, increment `attempt_count`, and update the row to `sent`, `pending` with a later `next_retry_at`, or `failed`. If a process restarts while a row is `processing`, a later worker can reclaim it after the configured processing timeout. Delivery errors are sanitized before storage/logging and never include channel tokens or sensitive provider payloads.

Notification ticket links prefer `LINE_LIFF_ID` and generate `https://liff.line.me/{LINE_LIFF_ID}?liff.state=/liff/tickets/:entryId`. When the LIFF ID is not configured, the backend falls back to `WEB_ORIGIN` plus `/liff/tickets/:entryId`.

Ticket lifecycle notifications currently cover booking-created, ETA warning, called, serving, completed, cancelled, and no-show events. Each Flex Message shows the system name, ticket code, current status, people ahead, ETA, next action guidance, and a button that opens the LIFF ticket detail.

## 9. LINE Rich Menu navigation flow

```text
LINE Rich Menu tap
          |
          v
https://liff.line.me/{LINE_LIFF_ID}?liff.state=/liff/home...
          |
          v
LIFF initializes + exchanges ID token for system JWT
          |
          +-- ホーム         -> /liff/home
          +-- 予約する       -> /liff/home?mode=booking -> configured /liff/qr/{token}
          +-- 現在の受付     -> /liff/home?mode=ticket  -> active ticket or /liff/tickets
          +-- 利用案内       -> /liff/home?section=guide
```

The Rich Menu definition never points to `/liff/tickets/:entryId` because the entry ID is customer-specific and must be resolved at runtime. When `LINE_LIFF_ID` is missing, menu URIs fall back to `WEB_ORIGIN` plus the same `/liff/*` route. Rich Menu creation/upload/default-setting is an operator command, not an API startup side effect.

## 10. Location warning flow

1. An authenticated LIFF customer explicitly enables location sharing; anonymous request bodies cannot establish consent or LINE identity.
2. Booking request carries latitude, longitude, and optional accuracy.
3. API calculates Haversine distance to organization coordinates.
4. API stores a `customer_locations` snapshot.
5. If over the current 1,000-meter threshold, API stores a pending idempotent `location_alert` without logging exact coordinates.
6. A PostgreSQL-locked scheduler checks queue proximity, consent, LINE preferences, and the mock `TravelTimeProvider`, then enqueues a Japanese `location_warning` through the durable notification outbox.
7. Alerts become sent-to-outbox, skipped, retry-pending, or failed. Snapshot cleanup anonymizes coordinates after `LOCATION_RETENTION_DAYS`; the LIFF settings page can revoke consent and delete data immediately.
8. Planned worker compares queue timing/distance, sends LINE warning, and records sent/skipped/failed.

Step 6 is not implemented. There is no continuous tracking, and production requires consent/retention controls.

## 11. ETA and staffing flow

Current ETA uses total service workload when available, otherwise people ahead multiplied by configured average service seconds. Confidence is heuristic. A 30-second job updates waiting entries.

`wait_time_forecasts` and `staffing_recommendations` are target output tables. No current job trains a model, aggregates hourly history, writes these tables, or exposes recommendations. “AI” should therefore be described as planned/heuristic, not a deployed predictive model.

## 12. Failure flows

- Authentication failure: return `401`; do not fall back to a privileged role.
- Tenant mismatch: return `403`; do not reveal whether the foreign resource exists.
- Closed queue: reject booking before ticket creation.
- Insufficient stock: transaction raises conflict and rolls back ticket/order/payment/item writes.
- Missing prepayment: reject before transaction.
- Duplicate retry: idempotency middleware should return/reject consistently without duplicate writes.
- LINE failure: preserve queue transition, log/metric, and retry according to notification workflow.
- Rich Menu sync failure: log a clear operational error and exit the sync command without affecting the running API.
- Database unavailable: `/ready` returns `503`; Vite proxy errors indicate the API is not accepting connections.
- Payment provider uncertainty: keep transaction pending/failed; never infer success from redirect alone.
