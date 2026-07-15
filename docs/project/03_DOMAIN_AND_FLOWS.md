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

| Entity                                  | Responsibility                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| Organization                            | Tenant identity, public routes/token, branding, location, timezone, settings      |
| User                                    | Platform identity and global role                                                 |
| OrganizationMember                      | Active manager/staff role within one tenant                                       |
| LineAccount                             | Verified LINE user link for login/profile/push targeting                          |
| Product                                 | Product/service price, duration, image, prepayment rule, finite/unlimited stock   |
| Queue                                   | Operational line, ticket counter, capacity, timing and policy settings            |
| QueueEntry                              | Customer ticket and queue state machine                                           |
| BookingGroup                            | Association of separate repeat bookings from one identity/device                  |
| Order                                   | Reservation commercial header, customer contact, total, status, payment summary   |
| OrderItem                               | Immutable commercial/service snapshot and per-item payment state                  |
| PaymentTransaction                      | Provider attempt/status/payload/audit record                                      |
| InventoryReservation                    | Finite-stock allocation lifecycle                                                 |
| CustomerLocation                        | Consent-based location snapshot and distance calculation                          |
| LocationAlert                           | Pending/sent/skipped/failed proximity notification intent                         |
| Notification                            | Durable general notification schema; queue push service does not fully use it yet |
| QueueHistory/AuditLog                   | Domain and administrative traceability                                            |
| WaitTimeForecast/StaffingRecommendation | Model output history; runtime producer not implemented                            |

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

Database values are `unpaid`, `paid`, `refunded`, and `failed`. Current public create-order validation accepts a successful payment payload only; production must support a full provider transaction state machine.

Per-item state determines prepaid coverage. The order header is `paid` only when every selected item is paid. Required-only checkout leaves the overall order `unpaid` until remaining balance is collected.

### Inventory reservation

Values are `reserved`, `consumed`, `released`, and `expired`. Creation currently decrements `products.stock_quantity` and writes `reserved`; transitions and stock restoration are not yet fully implemented.

## 3. Customer entry and identity flow

1. Primary customer entry is the LIFF route, usually `/liff/qr/:token` from `https://liff.line.me/{LIFF_ID}?liff.state=...`.
2. LIFF initializes, automatically starts LINE Login in real mode when needed, obtains an ID token, calls `/auth/line`, and stores the system JWT.
3. Web fetches public organization, queue, and active product data after the route context is known.
4. Customer selects products/services, optionally completes demo checkout for required prepayment, and creates the booking within the same LIFF flow.
5. The backend uses server-verified identity, not browser profile data or public request body fields, to attach the LINE recipient.
6. On success, LIFF navigates to `/liff/tickets/:entryId` and shows ticket code, status, people ahead, and ETA.

Public `/qr/:token`, `/q/:orgSlug`, `/ticket/:entryId`, and public demo checkout remain fallback/browser-compatible routes. Guest trade-off: the order/ticket works, but LINE push is unavailable unless the ticket resolves to a linked `line_user_id`. For LINE-authenticated requests, `currentUserMiddleware` validates the JWT LINE claim against the active `line_accounts` row. The order and queue controllers pass both internal user ID and verified LINE user ID to their services, which store both on the queue entry inside the write transaction.

## 4. Booking without required prepayment

1. Customer selects available items and quantities.
2. UI checks visible stock and calculates a display subtotal.
3. Customer may optionally choose checkout for all items or place the reservation unpaid.
4. `POST /orders` reloads organization, active queue, products, prices, ownership, and stock.
5. In one transaction the API increments the ticket counter, creates optional booking group, queue entry with any verified LINE recipient, order, items, stock reservations, payment row if supplied, and location/alert if supplied.
6. On success the UI stores a local booking record and navigates to `/liff/tickets/:entryId` in LIFF or `/ticket/:entryId` in the public fallback.
7. Any transaction error rolls back all database writes.

## 5. Booking with required prepayment

1. Selection includes one or more `requires_prepayment` items.
2. The booking action explains that those items must be paid and opens one checkout flow.
3. Checkout offers two scopes: `required_items` or `all_items`.
4. Demo mode creates a synthetic successful code; a future external mode redirects to provider checkout.
5. Browser returns to the booking page with its session draft preserved.
6. Order request includes payment method/code/scope and covered product IDs.
7. API rejects the request if any required product is not covered.
8. API recomputes paid subtotal, writes the payment transaction, and marks covered order items paid.
9. Full coverage marks the order paid; required-only coverage leaves the order unpaid for later staff collection.

Production invariant: a browser return cannot establish payment. Only the server's verified provider state may produce step 6.

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
4. After commit, the notification service attempts a Japanese LINE called Flex Message with text fallback.
5. Staff starts service, completes, marks no-show, or cancels through guarded transitions; each successful state change attempts a Japanese LINE push when the ticket has a verified recipient.
6. Staff updates order/payment status manually as needed.
7. Receipt printing is available after the applicable payment success state.

Notification failure is non-transactional and cannot reverse a queue transition.

## 8. LINE notification flow

```text
Queue transition / 30s scan
          |
          v
QueueNotificationService -- missing LINE ID --> skip
          |
          +-- already sent in memory --> suppress
          |
          v
lineNotificationService + Japanese Flex template + text fallback + LIFF ticket deep link
          |
          v
ILineMessagingAdapter
    | token absent/test -> MockLineAdapter
    | token present     -> LINE /v2/bot/message/push
          |
       Flex success: mark in-memory sent + metric
       Flex failure: try Japanese text fallback
       final failure: log + metric; queue/order state stays committed
```

Current deduplication is process-local. Restarting or adding replicas can cause repeat sends. The database `notifications` table is not yet the authoritative queue-push outbox.

Notification ticket links prefer `LINE_LIFF_ID` and generate `https://liff.line.me/{LINE_LIFF_ID}?liff.state=/liff/tickets/:entryId`. When the LIFF ID is not configured, the backend falls back to `WEB_ORIGIN` plus `/liff/tickets/:entryId`.

Ticket lifecycle notifications currently cover booking-created, ETA warning, called, serving, completed, cancelled, and no-show events. Each Flex Message shows the system name, ticket code, current status, people ahead, ETA, next action guidance, and a button that opens the LIFF ticket detail.

## 9. Location warning flow

1. Customer explicitly grants browser geolocation permission.
2. Booking request carries latitude, longitude, and optional accuracy.
3. API calculates Haversine distance to organization coordinates.
4. API stores a `customer_locations` snapshot.
5. If over the current 1,000-meter threshold, API stores a pending `location_alert`.
6. Planned worker compares queue timing/distance, sends LINE warning, and records sent/skipped/failed.

Step 6 is not implemented. There is no continuous tracking, and production requires consent/retention controls.

## 10. ETA and staffing flow

Current ETA uses total service workload when available, otherwise people ahead multiplied by configured average service seconds. Confidence is heuristic. A 30-second job updates waiting entries.

`wait_time_forecasts` and `staffing_recommendations` are target output tables. No current job trains a model, aggregates hourly history, writes these tables, or exposes recommendations. “AI” should therefore be described as planned/heuristic, not a deployed predictive model.

## 11. Failure flows

- Authentication failure: return `401`; do not fall back to a privileged role.
- Tenant mismatch: return `403`; do not reveal whether the foreign resource exists.
- Closed queue: reject booking before ticket creation.
- Insufficient stock: transaction raises conflict and rolls back ticket/order/payment/item writes.
- Missing prepayment: reject before transaction.
- Duplicate retry: idempotency middleware should return/reject consistently without duplicate writes.
- LINE failure: preserve queue transition, log/metric, and retry according to notification workflow.
- Database unavailable: `/ready` returns `503`; Vite proxy errors indicate the API is not accepting connections.
- Payment provider uncertainty: keep transaction pending/failed; never infer success from redirect alone.
