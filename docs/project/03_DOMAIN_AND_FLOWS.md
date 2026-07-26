# Domain and Flows

## 1. Domain model

```text
Organization
  ^-- approved OrganizationApplication
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
| OrganizationApplication                 | Public business application, plan/demo payment, review, and provisioning source |
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

### Organization application

| Current   | Action                          | Next       | Actor           |
| --------- | ------------------------------- | ---------- | --------------- |
| new       | Submit valid server-priced form | `pending`  | Public business |
| `pending` | Approve paid application        | `approved` | Platform admin  |
| `pending` | Reject and demo-refund          | `rejected` | Platform admin  |

Submission stores business/contact/address/usage/plan data and a bcrypt manager password hash. It
does not create a tenant. Approval locks the application and atomically creates the organization,
generated slug/QR token, manager account, and active membership, then removes the pending password
hash. Rejection removes the hash and marks a paid demo application refunded. Reviewed applications
cannot be processed twice.

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
| `called`           | Defer late arrival        | `waiting` at current queue tail     | Staff/manager/admin      |
| `serving`          | Complete service          | `served`                            | Staff/manager/admin      |
| `waiting`/eligible | Skip                      | `skipped` or policy-specific result | Customer/staff policy    |
| eligible active    | Cancel                    | `cancelled`                         | Owner or tenant operator |
| called/eligible    | Mark absent               | `no_show`                           | Staff/manager/admin      |

Terminal states are `served`, `cancelled`, and `no_show`. Exact transition guards in queue/staff services are authoritative.

### Customer QR admission

1. A QR URL resolves public organization/catalog data and remains usable by a guest for the documented public fallback flow.
2. If a JWT is present, only a `customer` role may create an order or join a queue. The API rejects a staff, manager, or admin JWT with `CUSTOMER_ACCOUNT_REQUIRED` before business services run.
3. The public QR UI detects the same business session, keeps it unchanged, and offers a return path to that role's dashboard.
4. The UI creates the current QR LIFF deep link only as an explicit customer action. LIFF then verifies the LINE identity and exchanges the ID token for the customer JWT before booking.

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

Webhook transitions are serialized by locking the payment transaction. Duplicate provider events are ignored by `(provider, event_id)`, older events and regressive transitions are recorded as ignored reconciliation operations, and provider payload fields with secret/card/token-shaped keys are redacted before persistence. Partial refunds keep the transaction/order paid while recording cumulative `refunded_amount`; a full refund transitions to `refunded`. Staff manual paid/refund operations require an idempotency key and create an audited reconciliation row. If an older paid order has no transaction, the server creates and reconciles an audited manual transaction before applying the refund; it never accepts browser payment state as proof. Receipt data is available only when the order is both `completed` and fully `paid`.

Per-item state determines prepaid coverage. The order header is `paid` only when every selected item is paid. Required-only checkout leaves the overall order `unpaid` until remaining balance is collected.

### Inventory reservation

Finite stock is decremented and a `reserved` reservation is inserted in the same order transaction. Fulfillment transitions it to `consumed` without changing stock. Cancellation or no-show transitions it to `released` and restores stock. The expiry worker transitions due rows to `expired`, restores stock, and cancels the pending order/ticket. Every transition is conditional on `status = 'reserved'` and writes `inventory_reservation_events`, preventing double release or consume.

Values are `reserved`, `consumed`, `released`, and `expired`. Creation decrements
`products.stock_quantity` and writes `reserved` in the booking transaction. Completion consumes the
reservation; cancellation, no-show, and expiry restore stock exactly once through guarded
reservation transitions.

## 3. Customer entry and identity flow

1. The manager's primary copy/print QR action uses a permanent LIFF link such as `https://liff.line.me/{LIFF_ID}/qr/:token`. With a `/liff` endpoint, the appended path is `/qr/:token`, not `/liff/qr/:token`, which prevents `/liff/liff/...` after LIFF restores navigation. LIFF automatically starts LINE Login when the customer is not signed in.
2. LIFF initializes, automatically starts LINE Login in real mode when needed, obtains an ID token, calls `/auth/line`, and stores the system JWT. If the LINE channel has the optional `email` scope and the customer consents, the backend stores the server-verified email without overwriting or duplicating an existing platform email.
3. The client synchronizes the Official Account friendship state, then fetches public organization, queue, and active product data after the route context is known.
4. Customer selects products/services, optionally completes demo checkout for required prepayment, and creates the booking within the same LIFF flow.
5. The backend uses server-verified identity, not browser profile data or public request body fields, to attach the LINE recipient.
6. On success, LIFF navigates to `/liff/tickets/:entryId` and shows ticket code, status, people ahead, and ETA.
7. Rich Menu opens `/liff/home` or `/liff/home` with mode/section query parameters. LIFF Home resolves the current active ticket and renders localized empty/usage states with Japanese fallback.

Public `/qr/:token` and `/q/:orgSlug` are customer discovery/redirect routes; they do not create
guest orders. Payment intents and bookings require the customer JWT created by `/auth/line`.
`currentUserMiddleware` validates its LINE claim against the active `line_accounts` row. The order
and queue controllers pass both internal user ID and verified LINE user ID to their services, which
store both on the queue entry inside the write transaction.

The shared login page presents LINE as the customer entry and the email form only for staff,
manager, and admin accounts. The API rejects email login for customer-role users. Local development
uses the mock LIFF adapter and mock backend ID-token verification, preserving the same
ID-token-to-system-JWT flow without a second customer auth model.

## 4. Booking without required prepayment

1. Customer selects available items and quantities and enters the required name and telephone number.
2. UI checks visible stock and calculates a display subtotal.
3. Customer may optionally choose checkout for all items or place the reservation unpaid.
4. `POST /orders` reloads organization, an open queue, products, prices, ownership, and stock.
5. In one transaction the API increments the ticket counter, creates optional booking group, queue entry with any verified LINE recipient, order, items, stock reservations, and location/alert if supplied.
6. On success the UI stores a local booking record and navigates to `/liff/tickets/:entryId`.
7. Any transaction error rolls back all database writes.

## 5. Booking with required prepayment

1. Selection includes one or more `requires_prepayment` items.
2. The single booking action validates customer details and opens one checkout flow.
3. Checkout offers two scopes: `required_items` or `all_items`.
4. API creates a server-side payment intent and `payment_transactions` row with server-computed coverage.
5. Demo provider completes with a server-signed token; future external providers redirect to PSP checkout and return via signed webhook/server verification.
6. Browser returns to the booking page with its session draft preserved and only the verified `transactionId` stored locally.
7. The booking page consumes the payment continuation once and automatically creates the order;
   no second booking-button click is required.
8. Order request includes the `transactionId` only.
9. API reloads product data, loads the paid transaction, checks tenant, unused state, amount, cart metadata, and required prepayment coverage.
10. API links the transaction to the order and marks covered order items paid.
11. If the covered items equal the full cart, the order is paid even when checkout used the
    `required_items` option. A mixed cart remains unpaid only while an uncovered balance exists.
12. After order creation succeeds, the frontend synchronously removes the completed cart draft,
    checkout session, and paid transaction reference before opening the ticket. Booking history is
    retained separately.

Production invariant: a browser return cannot establish payment. Only the server's verified provider state may produce a paid transaction that order creation can consume.

Payment intent creation also requires an open queue. The customer UI disables payment and booking
when no queue is accepting customers, and the API independently returns
`QUEUE_NOT_ACCEPTING`. This prevents payment when the organization cannot issue a ticket. Order
creation locks both the selected queue and any referenced payment transaction before attaching the
transaction, so the same verified payment cannot create two bookings under concurrent requests.

## 6. Repeat/additional booking flow

1. Browser creates a stable local device key and a booking-group UUID.
2. First reservation creates an independent order/ticket and optionally the server booking group.
3. A later reservation starts with a clean cart/payment attempt and creates another independent
   order/ticket using the same group ID.
4. The authenticated customer history API resolves the group by internal user identity, supports pagination across devices, and returns each order/ticket independently.
5. Tenant staff may inspect a related group from the staff workspace; customer ownership and staff organization scope are enforced server-side.
6. Cancellation, queue state, item/payment records, and receipts remain per order.

A paid transaction can be attached to only one order. Legacy browser state that references an
already attached transaction is discarded, the cart remains available for a new checkout, and the
API returns the stable `PAYMENT_ALREADY_USED` conflict code.

Anonymous browser drafts may still use a local grouping key, but cross-device history requires authenticated LINE/system identity.

## 7. Staff queue flow

1. Staff authenticates and the API resolves active organization membership.
2. `/staff/my-queue` selects an organization queue with waiting/called/serving activity (falling back to the first active queue), returns at most the next eight active entries for the board, exposes separate total-active and waiting counts, and includes order details, booking name/telephone, and the linked LINE display name when available.
3. Completion atomically transitions the current service to `served` and calls the next eligible
   waiting entry when no other ticket is already `called`; the Staff UI therefore has no manual
   call-next control.
4. The queue transition and LINE outbox row, including resolved locale, are written in the same transaction; a worker sends the localized message after commit.
5. Staff starts service, completes, marks no-show, cancels, or moves a called late arrival behind
   everyone currently waiting through guarded transitions. Defer preserves the ticket code and calls
   the next waiting customer when one exists.
6. Staff can collect an outstanding balance. The API creates an audited manual payment transaction
   for unpaid items, reconciles item payment states, and marks the order paid only when no unpaid
   item remains.
7. Receipt printing is available after the applicable payment success state.
8. Related booking groups are historical associations, but the Staff working context filters them
   to tickets in `waiting`, `called`, or `serving`.

Customer and operator cancellation refund every remaining collected amount before the cancellation
transaction commits. Each transaction uses a deterministic reconciliation key, so retries cannot
refund twice. No-show remains a separate business outcome and does not imply an automatic refund.

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
lineNotificationService + localized Flex template + text fallback + LIFF ticket deep link
          |
          v
ILineMessagingAdapter
    | token absent/test -> MockLineAdapter
    | token present     -> LINE /v2/bot/message/push
          |
       Flex success: mark sent + metric
       Flex failure: try localized text fallback, then Japanese fallback
       final failure: schedule exponential retry or mark failed
```

The `notifications.event_key` unique constraint makes enqueue idempotent for lifecycle events such as `queue_entry:{entryId}:called`. Workers claim due rows with PostgreSQL row locks, increment `attempt_count`, and update the row to `sent`, `pending` with a later `next_retry_at`, or `failed`. If a process restarts while a row is `processing`, a later worker can reclaim it after the configured processing timeout. Delivery errors are sanitized before storage/logging and never include channel tokens or sensitive provider payloads.

Notification ticket links prefer `LINE_LOGIN_LIFF_ID` and generate endpoint-relative permanent
links such as `https://liff.line.me/{LINE_LOGIN_LIFF_ID}/tickets/:entryId` for the default `/liff`
endpoint. When the LIFF ID is not configured, the backend falls back to `WEB_ORIGIN` plus
`/liff/tickets/:entryId`.

Ticket lifecycle notifications currently cover booking-created, ETA warning, called, serving, completed, cancelled, and no-show events. Each Flex Message shows the system name, ticket code, current status, people ahead, ETA, next action guidance, and a button that opens the LIFF ticket detail.

## 9. LINE Rich Menu navigation flow

```text
LINE Rich Menu tap
          |
          v
https://liff.line.me/{LINE_LOGIN_LIFF_ID}/home...
          |
          v
LIFF initializes + exchanges ID token for system JWT
          |
          +-- ホーム         -> /liff/home
          +-- 予約する       -> /liff/home?mode=booking -> configured /liff/qr/{token}
          +-- 現在の受付     -> /liff/home?mode=ticket  -> active ticket or /liff/tickets
          +-- 利用案内       -> /liff/home?section=guide
```

The Rich Menu definition never points to `/liff/tickets/:entryId` because the entry ID is
customer-specific and must be resolved at runtime. When `LINE_LOGIN_LIFF_ID` is missing, menu URIs
fall back to `WEB_ORIGIN` plus the same `/liff/*` route. Rich Menu
creation/upload/default-setting is an operator command, not an API startup side effect.

## 10. Location warning flow

1. An authenticated LIFF customer explicitly enables location sharing; anonymous request bodies cannot establish consent or LINE identity.
2. Booking request carries latitude, longitude, and optional accuracy.
3. API calculates Haversine distance to organization coordinates.
4. API stores a `customer_locations` snapshot.
5. If over the current 1,000-meter threshold, API stores a pending idempotent `location_alert` without logging exact coordinates.
6. A PostgreSQL-locked scheduler checks queue proximity, consent, LINE preferences, and the mock `TravelTimeProvider`, then enqueues a locale-aware `location_warning` through the durable notification outbox.
7. Alerts become sent-to-outbox, skipped, retry-pending, or failed. Snapshot cleanup anonymizes coordinates after `LOCATION_RETENTION_DAYS`; the LIFF settings page can revoke consent and delete data immediately.
8. Planned worker compares queue timing/distance, sends LINE warning, and records sent/skipped/failed.

Step 6 is not implemented. There is no continuous tracking, and production requires consent/retention controls.

## 11. ETA and staffing flow

Current ETA uses total service workload when available, otherwise people ahead multiplied by configured average service seconds. Confidence is heuristic. A 30-second job updates waiting entries.

The PostgreSQL-locked forecasting job aggregates the previous eight weeks by organization-local weekday/hour, persists demand and measured service duration, and writes versioned wait forecasts and staffing recommendations. Confidence increases with sample size, the API exposes locale-neutral numeric inputs for localized explanations in the UI, and expired records are removed according to configuration. This baseline is a deterministic measured heuristic, not a trained ML model.

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

# Business account lifecycle and branches

- A public organization application never accepts or stores a manager password.
- Admin approval atomically creates an inactive organization, its main branch, one closed queue, an invited owner-manager membership, and an account-activation email outbox record.
- The owner manager activates the tenant by opening the single-use email link and choosing a password. Owner managers cannot remove themselves.
- An owner manager may create branches and invite one or more branch managers. Every branch must retain at least one assigned manager and has exactly one active queue in the current scope.
- Managers invite staff to an assigned branch. Invitees set their own password; staff removal is soft deactivation and records the acting manager in `audit_logs`.
- Customers continue to authenticate through LINE. Admin, owner manager, manager, and staff use the shared business login screen.
