# Architecture — LINE Smart Queue Assistant

## 1. System Overview

LINE Smart Queue Assistant is a **multi-tenant queue management system** that lets customers join service queues via their LINE app and lets staff manage those queues through a web dashboard.

```
Customer (LINE App / LIFF)
         │  QR scan → LIFF URL
         ▼
   ┌──────────────┐         ┌──────────────────────┐
   │  React SPA   │◄──────►│   Express REST API    │
   │  (Vite/TS)   │  HTTPS  │   (Node.js / TS)     │
   └──────────────┘         └──────────┬───────────┘
         ▲                             │
         │ Web browser / LINE LIFF     │ node-postgres
   Staff & Manager                     ▼
                              ┌──────────────────┐
                              │   PostgreSQL 16   │
                              │  (source of truth)│
                              └──────────────────┘
                                        ▲
                              LINE Messaging API
                              (push notifications)
```

## 2. Module Architecture

### Backend (`apps/api`)

| Module          | Responsibility                                                 |
| --------------- | -------------------------------------------------------------- |
| `auth`          | LINE LIFF login (id_token), email/password login, JWT issuance |
| `queue`         | Customer-facing queue operations: join, cancel, skip, status   |
| `queues`        | Manager CRUD for queue configuration                           |
| `staff`         | Staff actions: call next, serve, complete, no-show, cancel     |
| `orders`        | Order creation (with queue join), status/payment updates       |
| `products`      | Product/service catalog CRUD                                   |
| `orgs`          | Organization settings, QR token management                     |
| `users`         | User management, staff onboarding                              |
| `notifications` | LINE push message dispatch, delivery log                       |
| `line`          | LINE webhook handler (chatbot events, signature verification)  |
| `eta`           | ETA calculation service (pure, stateless)                      |
| `skip-penalty`  | Skip count tracking, priority adjustment                       |

### Background Jobs (`apps/api/src/jobs`)

| Job              | Interval | Purpose                                                 |
| ---------------- | -------- | ------------------------------------------------------- |
| `etaUpdater`     | 30s      | Bulk-update `estimated_call_at` for all waiting entries |
| `etaWarning`     | 30s      | Push "almost your turn" LINE messages                   |
| `calledRenotify` | 60s      | Re-send failed "your turn" notifications                |
| `counterReset`   | hourly   | Reset daily ticket counters at midnight                 |

### Frontend (`apps/web`)

| Page               | Role                                                            |
| ------------------ | --------------------------------------------------------------- |
| `/login`           | Email/password login for staff & manager                        |
| `/qr/:token`       | Public QR landing page → shows org info, products, join form    |
| `/ticket/:entryId` | Public guest ticket tracker (no auth required)                  |
| `/staff`           | Staff dashboard: queue board, call next, serve/complete         |
| `/manager`         | Manager dashboard: analytics, product/queue/settings management |
| `/customer`        | Customer portal (LIFF): my tickets, history                     |

## 3. Data Flow

### Customer joining a queue

```
1. Customer scans QR code → LIFF URL opens in LINE
2. Frontend calls GET /api/v1/orgs/by-token/:token
3. Customer selects products/services
4. Frontend calls POST /api/v1/orders (creates order + queue entry atomically)
5. API: BEGIN TRANSACTION
      a. UPDATE queues SET daily_ticket_counter = counter + 1 RETURNING …
      b. INSERT INTO queue_entries (…) RETURNING *
      c. INSERT INTO orders (…) / order_items
      COMMIT
6. Response: { ticket_display, aheadCount, estimatedWaitSeconds }
7. Customer tracks position via GET /api/v1/queue/entry/:entryId
```

### Staff calling next

```
1. Staff clicks "Call Next" on dashboard
2. Frontend calls POST /api/v1/staff/queues/:queueId/call-next
3. API:
   a. UPDATE queue_entries SET status='called' WHERE id=<next waiting>
   b. Fire-and-forget: push LINE message to ticket holder
   c. Fire-and-forget: push ETA warning to new #1 entry
4. Response: updated entry
```

## 4. Role Flow

```
Customer  →  Scan QR → View org/products → Create order → Join queue → Track ticket
Staff     →  Login → View queue board → Call next → Mark serving → Mark complete
Manager   →  Login → View analytics → Manage products/queues/settings → Export QR
```

## 5. LINE Integration Role

LINE is an **integration layer** — it is not the source of truth for business data.

- **Authentication**: LINE LIFF provides `id_token` which is verified server-side to get `line_user_id`. The backend creates/finds a `users` row and issues a JWT.
- **Notifications**: LINE Messaging API is used to push messages to customers. The `line_user_id` is stored on `queue_entries` for fast lookup.
- **Webhook**: LINE sends chatbot events (messages, follows) to `/api/v1/line/webhook`. The signature is verified with HMAC-SHA256 using `LINE_CHANNEL_SECRET`.

**Business data lives in PostgreSQL.** If LINE is unavailable:

- Customers without LINE can still join via the web form with a guest name.
- Staff and managers can still operate fully through the web dashboard.
- Notifications degrade gracefully (fire-and-forget, never blocks queue operations).

## 6. Database Source of Truth

PostgreSQL is the **single source of truth** for all business state.

Key design decisions:

| Decision                                                       | Rationale                                                            |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `queue_entries.status` is the canonical queue state machine    | Notification tracking is deliberately separate (`notification_log`)  |
| `queue_entries.estimated_call_at` is written by background job | LIFF can read it without per-request DB computation                  |
| `queue_histories` is an append-only archive                    | Active table stays small; analytics queries don't touch the hot path |
| `audit_logs` uses BIGSERIAL PK                                 | Maximum insert throughput, natural time ordering                     |
| `organizations.public_qr_token` is a stable random token       | QR codes never expire even if slugs change                           |
| `line_user_id` denormalized on `queue_entries`                 | Notification workers avoid join on every push                        |

## 7. Security Architecture

- **Authentication**: JWT HS256, verified in `currentUserMiddleware`
- **RBAC**: `requireRole()` middleware enforces role per route
- **Organization isolation**: All service methods accept `orgId` from `req.user` (never from client body)
- **Rate limiting**: Tiered limiters per endpoint type (public/write/staff/strict)
- **Idempotency**: `Idempotency-Key` header prevents duplicate queue joins and order creation
- **Webhook security**: HMAC-SHA256 signature verification on raw request bytes
- **Secrets**: All secrets in environment variables, never in code or git
