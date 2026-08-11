# Domain and Flows

## 1. Domain model

```text
Organization
  ^-- approved OrganizationApplication
  |--< OrganizationMember >-- User --0..1-- LineAccount
  |--< Product >--< QueueProduct >-- Queue
  |--< OrganizationBranch --< BranchMembership >-- User
  |                       |--< BranchBusinessHour
  |                       |--< BranchExceptionDay
  |                       \--< Queue --< QueueEntry >--0..1-- Order --< OrderItem >-- Product
  |                                                     |             |--< PaymentTransaction
  |                                                     |             |--< InventoryReservation
  |                                                     \--< QueueHistory
  |--< BookingGroup --< Order
  |--< CustomerLocation --< LocationAlert
  |--< Notification
  |--< PenaltyRecord
  |--< WaitTimeForecast
  |--< StaffingRecommendation
  \--< AuditLog
```

### Entity responsibilities

| Entity                                  | Responsibility                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| Organization                            | Tenant identity, public routes/token, branding, location, timezone, settings      |
| OrganizationApplication                 | Public business application, plan/demo payment, review, and provisioning source   |
| User                                    | Platform identity and global role                                                 |
| OrganizationMember                      | Active manager/staff role within one tenant                                       |
| OrganizationBranch                      | Physical branch identity, branch QR, address, timezone, and business calendar     |
| BranchMembership                        | One branch assignment for a manager or staff operator                             |
| LineAccount                             | Verified LINE user link for login/profile/push targeting                          |
| Product                                 | Organization catalog item, generated code, price, duration, image, and stock rule |
| QueueProduct                            | Active product availability and display order for one branch queue                |
| Queue                                   | Named branch service line, ticket counter, capacity, timing, and policy settings  |
| QueueEntry                              | Customer ticket and queue state machine                                           |
| BookingGroup                            | Historical association across bookings from one identity/device                   |
| Order                                   | Reservation commercial header, customer contact, total, status, payment summary   |
| OrderItem                               | Immutable commercial/service snapshot and per-item payment state                  |
| PaymentTransaction                      | Provider attempt/status/payload/audit record                                      |
| InventoryReservation                    | Finite-stock allocation lifecycle                                                 |
| CustomerLocation                        | Consent-based location snapshot and distance calculation                          |
| LocationAlert                           | Pending/sent/skipped/failed proximity notification intent                         |
| Notification                            | Durable LINE notification outbox and delivery log for queue lifecycle messages    |
| QueueHistory/AuditLog                   | Domain and administrative traceability                                            |
| WaitTimeForecast/StaffingRecommendation | Persisted output from the measured heuristic forecast worker                      |

## 2. State machines

### Organization application

| Current   | Action                          | Next       | Actor           |
| --------- | ------------------------------- | ---------- | --------------- |
| new       | Submit valid server-priced form | `pending`  | Public business |
| `pending` | Approve paid application        | `approved` | Platform admin  |
| `pending` | Reject and demo-refund          | `rejected` | Platform admin  |

Submission stores business/contact/address/usage/plan data and does not accept credentials or
create a tenant. The public form recommends a plan from the requested location count and blocks
submission when the selected plan cannot support it; the API enforces the same rule for both public
submission and admin correction. A submitted application enqueues an applicant email with the
reference number, selected plan, requested locations, demo amount, and pending-review guidance.
An admin may correct those submitted fields while the application is pending.
Approval locks the application and atomically creates the inactive organization, invited
owner-manager membership, single-use activation token, and email outbox row. It deliberately does
not create a branch or queue. Rejection marks a paid demo application refunded and enqueues a
localized applicant email containing the review result and any admin note. Reviewed applications
cannot be processed twice.

### Queue

PostgreSQL values are `closed`, `open`, `paused`, and `archived`.

| Current         | Action          | Next       | Actor                   |
| --------------- | --------------- | ---------- | ----------------------- |
| `closed`        | Open queue      | `open`     | Assigned branch manager |
| `open`          | Pause admission | `paused`   | Assigned branch manager |
| `paused`        | Resume          | `open`     | Assigned branch manager |
| `open`/`paused` | Close           | `closed`   | Assigned branch manager |
| non-archived    | Retire          | `archived` | Assigned branch manager |

Only active `open` queues accept a new booking/ticket, and only while the branch calendar is open.
A new branch starts without a queue. Its assigned branch manager creates one or more named queues
and may retire all queues while reconfiguring the branch.

The queue row's `daily_ticket_counter` is a daily ticket-number sequence, not the current queue
depth. Branch-manager queue list/detail responses derive live counts from queue entries in
`waiting`, `called`, and `serving` states so completed or cancelled tickets are never counted.

### Queue entry

PostgreSQL values are `waiting`, `called`, `serving`, `served`, `skipped`, `cancelled`, and `no_show`.

| Current            | Action                    | Next                                | Actor                         |
| ------------------ | ------------------------- | ----------------------------------- | ----------------------------- |
| new                | Create successful booking | `waiting`                           | Customer/system               |
| `waiting`          | Call next                 | `called`                            | Assigned staff/branch manager |
| `called`           | Begin service             | `serving`                           | Assigned staff/branch manager |
| `called`           | Defer late arrival        | `waiting` at current queue tail     | Assigned staff/branch manager |
| `serving`          | Complete service          | `served`                            | Assigned staff/branch manager |
| `waiting`/eligible | Skip                      | `skipped` or policy-specific result | Customer/staff policy         |
| eligible active    | Cancel                    | `cancelled`                         | Owner or tenant operator      |
| called/eligible    | Mark absent               | `no_show`                           | Assigned staff/branch manager |

Terminal states are `served`, `cancelled`, and `no_show`. Exact transition guards in queue/staff services are authoritative.

### Customer QR admission

1. A branch QR URL resolves the organization, branch, active named queues, waiting count, ETA, branch-open state, and queue-specific catalogs.
2. If a JWT is present, only a `customer` role may create an order or join a queue. The API rejects a staff, manager, or admin JWT with `CUSTOMER_ACCOUNT_REQUIRED` before business services run.
3. The public QR UI detects the same business session, keeps it unchanged, and offers a return path to that role's dashboard.
4. The UI creates the current QR LIFF deep link only as an explicit customer action. LIFF then verifies the LINE identity and exchanges the ID token for the customer JWT before booking.
5. With multiple queues, the customer selects one queue from a compact dropdown before its detail
   and catalog are shown. Changing queues clears the previous cart/payment draft and displays only
   products mapped to the new queue.
6. Payment intent and order creation reload the branch, queue, queue-product mapping, price, stock,
   and branch calendar; IDs supplied by the browser are selectors, never authorization.

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

The current deployment is a production-oriented demo. `PAYMENT_MODE=demo` activates only
`DemoPaymentProvider`, processes no real money, requires no payOS merchant credentials, and does
not call the payOS transport even if a client requests that provider. `PAYMENT_MODE=external` is an
explicit future activation boundary: startup requires the complete payOS credential set, demo
completion is disabled, and only signed server/provider evidence may advance transaction state.

Webhook transitions are serialized by locking the payment transaction. Duplicate provider events are ignored by `(provider, event_id)`, older events and regressive transitions are recorded as ignored reconciliation operations, and provider payload fields with secret/card/token-shaped keys are redacted before persistence. Partial refunds keep the transaction/order paid while recording cumulative `refunded_amount`; a full refund transitions to `refunded`. Staff manual paid/refund operations require an idempotency key and create an audited reconciliation row. If an older paid order has no transaction, the server creates and reconciles an audited manual transaction before applying the refund; it never accepts browser payment state as proof. Receipt data is available only when the order is both `completed` and fully `paid`.

Per-item state determines prepaid coverage. The order header is `paid` only when every selected item is paid. Required-only checkout leaves the overall order `unpaid` until remaining balance is collected.

### Inventory reservation

Finite stock belongs to a branch. The selected branch inventory is decremented and a branch-scoped
`reserved` reservation is inserted in the same order transaction. Fulfillment transitions it to
`consumed` without changing stock. Cancellation or no-show transitions it to `released` and
restores the same branch stock. The expiry worker transitions due rows to `expired`, restores stock,
and cancels the pending order/ticket. Every transition is conditional on `status = 'reserved'` and
writes `inventory_reservation_events`, preventing double release or consume.

Values are `reserved`, `consumed`, `released`, and `expired`. Creation decrements
`branch_product_inventories.stock_quantity` and writes `reserved` in the booking transaction.
Completion consumes the reservation; cancellation, no-show, and expiry restore stock exactly once
through guarded reservation transitions.

## 3. Customer entry and identity flow

1. The manager's primary copy/print QR action uses a permanent LIFF link such as `https://liff.line.me/{LIFF_ID}/qr/:token`. With a `/liff` endpoint, the appended path is `/qr/:token`, not `/liff/qr/:token`, which prevents `/liff/liff/...` after LIFF restores navigation. LIFF automatically starts LINE Login when the customer is not signed in.
2. LIFF initializes, automatically starts LINE Login in real mode when needed, obtains an ID token, calls `/auth/line`, and stores the system JWT. If the LINE channel has the optional `email` scope and the customer consents, the backend stores the server-verified email without overwriting or duplicating an existing platform email.
3. The client synchronizes the Official Account friendship state, then fetches public organization,
   queue, and active product data after the route context is known. A customer who skipped the
   consent-screen Add Friend option receives a localized, non-blocking Add/Unblock prompt inside
   LIFF. The prompt uses LINE's native friendship subwindow, rechecks the result, and synchronizes
   the backend preference state.
4. Customer selects products/services, completes the current server-verified demo checkout when
   prepayment is required, and creates the booking within the same LIFF flow. This demonstration
   does not move real money; the retained external-provider path is not active.
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

### Session lifecycle

1. Email or LINE authentication creates an `auth_sessions` family and returns a 15-minute access
   token plus public session timing metadata.
2. The opaque refresh token exists only in a path-scoped `HttpOnly` cookie; PostgreSQL stores its
   SHA-256 hash. The SPA stores the access token only in memory.
3. On reload or an access-token `401`, the client sends the cookie to `/auth/refresh`. The API locks
   the current row, rotates the token, and issues a new access token for the same family. Concurrent
   callers share one refresh promise and each original request is retried no more than once.
4. Admin, manager, and staff browser interaction triggers periodic refresh. No interaction for 15
   minutes ends the session; continuous activity cannot extend it beyond 12 hours.
5. Customer sessions do not use the business idle timer and can resume for at most 30 days. LIFF
   still re-verifies LINE identity when the app opens and authenticated requests still require an
   active linked LINE account. If the LIFF SDK temporarily reports signed-out after reload, an
   already-restored customer cookie session may render without forcing another interactive login;
   the next available LINE ID token is still exchanged server-side.
6. Logout, password reset, authenticated business-account password change, account disablement,
   and staff removal revoke the relevant session family or every active session for that user.
   Password change verifies the current password and commits the new hash with session revocation
   in one transaction. Customer logout also clears the LIFF adapter state. Reuse outside the short
   concurrent-rotation grace window revokes the family.
7. If refresh fails, the retried request remains unauthorized, or the API returns
   `AUTH_SESSION_REQUIRED`, the SPA atomically clears its access token, Zustand auth state, legacy
   auth storage, and React Query cache. A guarded terminal-session action redirects to `/login`
   once and displays a localized inactivity message stored only for that navigation; technical API
   messages are not exposed to the user.

## 4. Booking without required prepayment

1. Customer selects available items and quantities and enters the required name and telephone number.
2. UI checks visible stock and calculates a display subtotal.
3. Customer may optionally choose checkout for all items or place the reservation unpaid.
4. `POST /orders` reloads organization, an open queue, products, prices, ownership, and stock.
5. In one transaction the API locks the queue and verified customer/queue key. It either creates
   the first booking group, queue entry, and order, or reuses the customer's existing active
   order/ticket in that queue; it then writes items, stock reservations, payment linkage, and any
   supplied location/alert.
6. On success the UI stores a local booking record and navigates to `/liff/tickets/:entryId`.
7. Any transaction error rolls back all database writes.

## 5. Booking with required prepayment

1. Selection includes one or more `requires_prepayment` items.
2. The single booking action validates customer details and opens one checkout flow.
3. Checkout offers two scopes: `required_items` or `all_items`.
4. API creates a server-side payment intent and `payment_transactions` row with server-computed coverage.
5. Demo provider completes with a server-signed token. payOS creates a VND checkout/QR and becomes
   paid only through its signed webhook or server-side verification; future Japan providers follow
   the same boundary.
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

1. Browser may keep a local device key for draft recovery, but it is not grouping authority.
2. The first reservation creates an order/ticket and a server booking group.
3. A later reservation starts with a clean cart/payment attempt. When the verified LINE identity,
   organization, branch, and queue match an order whose ticket is `waiting`, `called`, or
   `serving`, the API locks and extends that order instead of issuing another ticket.
4. The extension appends item snapshots, attaches only the new verified payment transaction,
   increments finite-stock reservations, and recalculates the whole order total/payment state.
5. A different queue or a terminal prior ticket creates a separate order/ticket. Booking groups
   remain useful for cross-queue and historical navigation.
6. The customer booking summary is intersected with server-reported active tickets, so completed,
   cancelled, served, and no-show local records are not presented as current bookings.
7. `orders.order_number` is the durable commercial order/receipt identifier shown consistently on
   the Staff queue, Staff receipt, customer current-ticket details, and customer history. It is
   distinct from the queue-position `queue_entries.ticket_code`.

A paid transaction can be attached to only one order. Legacy browser state that references an
already attached transaction is discarded, the cart remains available for a new checkout, and the
API returns the stable `PAYMENT_ALREADY_USED` conflict code.

Anonymous browser drafts may still use a local grouping key, but cross-device history requires authenticated LINE/system identity.

Direct `POST /queue/join` retries use the same PostgreSQL correctness boundary. The service first
performs a fast active-ticket lookup, then locks the queue row and repeats that lookup inside the
transaction before checking capacity or incrementing the counter. Concurrent requests from the
same verified user/LINE identity therefore return the committed active ticket instead of creating a
second ticket. Anonymous requests without a verified identity cannot use identity-based replay and
must supply a stable HTTP idempotency key when retried.

## 7. Staff queue flow

1. Staff or a branch manager authenticates and the API resolves one active organization membership
   and exactly one active branch assignment. Staff authentication additionally resolves the one
   active queue recorded on the branch membership.
2. `/staff/my-queue` returns only the Staff member's assigned queue. A branch manager using the same
   operational service remains branch-scoped. The response returns at most the next eight active entries,
   exposes separate total-active and waiting counts, and includes order details, booking
   name/telephone, and the linked LINE display name when available.
3. Booking into an idle queue and transitions that free its active slot atomically call the next
   eligible waiting entry when no ticket is already `called` or `serving`; the Staff UI therefore
   has no manual call-next control.
4. The queue transition and LINE outbox row, including resolved locale, are written in the same transaction; a worker sends the localized message after commit.
5. Staff starts service, completes, marks no-show, cancels, or moves a called late arrival behind
   everyone currently waiting through guarded transitions. Defer preserves the ticket code and calls
   the next waiting customer when one exists.
6. Staff can collect an outstanding balance. The API creates an audited manual payment transaction
   for unpaid items, reconciles item payment states, and marks the order paid only when no unpaid
   item remains.
7. Receipt printing uses immutable organization/branch/queue and fulfilling-staff snapshots. It
   shows gross total, every net amount already collected (whether required-item or full-cart
   checkout), and remaining balance without charging paid items twice. After completion, the Staff
   UI holds a centered receipt-ready modal over the current
   workspace; it refreshes and moves to the next ticket only after Staff confirms.
8. Related booking groups are historical associations, but the Staff working context filters them
   to tickets in `waiting`, `called`, or `serving`.

Branch managers select the queue when inviting Staff and may replace that assignment later. A
queue can have multiple Staff members, but an active Staff membership cannot exist without one
valid queue in the same organization and branch.

The customer current-ticket response includes the linked order and item snapshots in the same
authenticated request. History uses compact order rows without line items; selecting a row opens
the customer-owned ticket detail and its full order summary.

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

The standard ticket notification journey covers booking-created, exactly five people ahead,
called, and completed. Exceptional deferred, cancelled, and no-show transitions also notify the
customer. Each event has a distinct durable event key. Each Flex Message shows the system name, ticket
code, current status, people ahead, ETA, next action guidance, and a button that opens the LIFF
ticket detail.

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
6. A PostgreSQL-locked scheduler checks queue proximity, consent, LINE preferences, and the configured `TravelTimeProvider`. Mock mode is deterministic for development; Google Routes mode requests walking alternatives, selects the longest returned duration, and adds the configured safety buffer.
7. Alerts become sent-to-outbox, skipped, retry-pending, or failed. Snapshot cleanup anonymizes coordinates after `LOCATION_RETENTION_DAYS`; the LIFF settings page can revoke consent and delete data immediately.
8. When buffered travel time exceeds queue ETA, the worker enqueues a localized LINE warning and records the outcome without blocking queue/order transitions.

The browser shares location only with explicit consent and while an active ticket exists; this is not continuous background tracking. Production Google Routes use still requires restricted credentials, quota/cost monitoring, privacy review, and physical-device acceptance.

## 11. ETA and staffing flow

Current ETA uses total service workload when available, otherwise people ahead multiplied by configured average service seconds. Confidence is heuristic. A 30-second job updates waiting entries.

The PostgreSQL-locked forecasting job aggregates the previous eight weeks by organization-local weekday/hour, persists demand and measured service duration, and writes versioned wait forecasts and staffing recommendations. Confidence increases with sample size, the API exposes locale-neutral numeric inputs for localized explanations in the UI, and expired records are removed according to configuration. This baseline is a deterministic measured heuristic, not a trained ML model.

There is no OpenAI or Gemini call in this flow. Adding a generative-AI API key without a backend adapter and an explicit product decision would create unused secret configuration and is therefore prohibited.

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

## 13. Operational calendar and list behavior

- Branch business calendars contain recurring weekly hours plus `exceptionDays`. A closed exception
  overrides the weekly schedule for the whole local calendar day; it is persisted with the existing
  business-calendar update endpoint. The UI places exception-day selection after weekly hours,
  uses timezone-stable year/month arithmetic, supports multiple closures, and focuses the calendar
  month when a date is selected through the date input.
- Management list views use client-side pagination in the UI at 15 records per page after the
  server-filtered result set is loaded. This is a presentation concern and does not weaken tenant
  scope or server-side authorization. Visible sequence columns are left-aligned; the Admin
  application list keeps review controls inside the selected application detail.
- The “arrival wait after call” value remains a branch/queue operational setting consumed by the
  existing no-show worker; the settings UI must not introduce a second competing timer.

# Business account lifecycle and branches

- A public organization application never accepts or stores a manager password.
- Admin approval atomically creates an inactive organization, an invited owner-manager membership,
  and an account-activation email outbox record. No branch or queue is provisioned automatically.
- The owner manager activates the tenant by opening the single-use email link and choosing a password. Owner managers cannot remove themselves.
- Platform-admin owner recovery is limited to replacing the owner manager's sign-in email. The
  owner changes their own display name and password; an admin email change revokes existing owner
  sessions and never grants access to other tenant accounts.
- An owner manager may create branches, edit branch contact/address/map details, and invite one or
  more branch managers. Before activation, the owner may revoke pending invitations as long as at
  least one active or pending manager assignment remains. Every branch retains at least one such
  assignment, while its queues are created later by an activated branch manager.
- An owner manager may permanently delete a branch through an explicit confirmation flow. The API
  locks the branch and removes branch-owned accounts, queues, orders, payment records, inventory,
  notifications, QR identity, and operational data atomically. Accounts with another active branch
  assignment or pending non-deactivated assignment are retained; immutable audit history is also
  retained. Pending email delivery is cancelled only for accounts that are actually removed.
- Branch creation is serialized against the organization and enforces the subscription plan. The
  Standard plan permits at most three active branches.
- The owner manager uses organization-level catalog, branch, manager, audit, and
  aggregate-performance views. The owner flag remains an organization membership property, not a
  new global role.
- Each branch manager has exactly one active branch assignment and may create multiple named queues.
  A branch may temporarily have no queue and has one stable public QR token.
- Products belong to the organization catalog and receive immutable-scope generated `DVn` or `SPn`
  codes. A branch manager selects catalog products through queue configuration; `queue_products`
  stores the branch-safe assignment. Customer QR admission selects a queue before loading only that
  queue's catalog.
- Branch managers maintain weekly hours/exception dates and invite staff to their assigned branch.
  Invitees set their own password; staff removal is soft deactivation and records the acting
  manager in `audit_logs`.
- Staff invitation bodies do not choose a branch. The server derives the manager's assigned branch,
  and every staff invitation requires an employee code.
- A normalized email address belongs to one platform account only; a second role cannot be created
  by reusing that email.
- Customers continue to authenticate through LINE. Admin, owner manager, manager, and staff use the shared business login screen.
