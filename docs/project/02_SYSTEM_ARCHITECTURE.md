# System Architecture

## 1. Architecture summary

The system is a TypeScript modular monolith: one React SPA, one Express API process, one PostgreSQL database, and direct LINE HTTP integration. Scheduled jobs run inside the API process. This keeps local operation simple while module boundaries provide an upgrade path to workers or services later.

```text
Customer Browser / LINE LIFF       Staff / Manager / Admin Browser
              |                                  |
              +-------------- HTTPS -------------+
                                 |
                         React + Vite SPA
                                 |
                         REST /api/v1 + JWT
                                 |
                         Express API process
                    +------------+-------------+
                    |            |             |
               PostgreSQL   Scheduled jobs   LINE APIs
                    ^             |          Login/OIDC +
                    |             +------> Messaging push
                    +------ durable notification outbox
```

## 2. Containers and runtime boundaries

| Container/process | Technology                                  | Responsibility                                                                         |
| ----------------- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `web`             | React/Vite in dev, nginx static SPA in prod | Routes, i18next UI, browser state, API calls, LIFF adapter                             |
| `api`             | Node/Express                                | HTTP contracts, auth, business services, SQL repositories, LINE adapter, scheduler     |
| Media adapter     | Local/mock plus object-compatible interface | Validates and compresses image ingress; isolates persistence transport                 |
| `postgres`        | PostgreSQL 16                               | Tenant, identity, queue, order, inventory, payment, notification, audit, forecast data |
| LINE platform     | LINE Login/LIFF and Messaging API           | Customer identity and chat delivery                                                    |
| Payment provider  | Demo adapter or future PSP                  | Hosted/payment redirect and authoritative webhook                                      |

Docker Compose supplies these local/production-like boundaries; it is not the final cloud infrastructure specification. In production-style web images, nginx serves the built SPA and reverse-proxies `/api/*` and `/media/*` to the internal `api:4000` service without stripping either prefix, so browser code and locally persisted media use the same public origin. API requests use `VITE_API_URL=/api`.

## 3. Backend module architecture

The API entry is `apps/api/src/server.ts`; `app.ts` composes middleware, health routes, docs, and `/api/v1` modules.

| Module          | Responsibility                                                   |
| --------------- | ---------------------------------------------------------------- |
| `auth`          | Email/password login, LINE ID-token login, customer registration |
| `admin`         | Platform organization and manager lifecycle                      |
| `orgs`          | Public organization lookup and manager settings                  |
| `products`      | Catalog and finite/unlimited inventory configuration             |
| `queues`        | Manager queue configuration                                      |
| `queue`         | Customer ticket operations and shared ticket transitions         |
| `staff`         | Organization-scoped operational queue board/actions              |
| `orders`        | Reservation/order/payment/item/inventory/location transaction    |
| `users`         | Profiles and manager-owned staff accounts                        |
| `line`          | Webhook signature handling, reply/push transport                 |
| `notifications` | Notification listing and queue lifecycle messaging               |
| `eta`           | Pure wait-time calculation                                       |
| `skip-penalty`  | Skip/no-show policy behavior                                     |

Dependency direction:

```text
routes -> middleware + validators -> controllers -> services -> repositories -> PostgreSQL
                                                \-> integration adapters -> LINE/provider
shared types/helpers <- API and web (framework-independent only)
```

Routes and controllers must not contain domain policy. Repositories must not know about HTTP.

## 4. Frontend architecture

`apps/web/src/router.tsx` defines one SPA with these route domains:

- Public customer fallback: `/q/:orgSlug`, `/qr/:token`, `/ticket/:entryId`, `/checkout/demo/:sessionId`
- LINE-first customer: `/liff/home`, `/liff/q/:orgSlug`, `/liff/qr/:token`, `/liff/checkout/demo/:sessionId`, `/liff/tickets`, `/liff/tickets/:entryId`
- Staff: `/staff`, `/staff/products`
- Manager: `/manager/*`
- Platform admin: `/admin/*`
- Legacy/general authenticated workspace: `/app/*`

Frontend responsibilities are split into route pages, reusable components/layouts, API services, LIFF adapters, hooks, Zustand auth state, and browser checkout helpers. TanStack Query owns server-state fetching/caching. Browser storage currently preserves checkout drafts and local booking-group history; it is not authoritative business storage.

## 5. Data ownership

- PostgreSQL owns organizations, identities, memberships, products, queues, tickets, orders, payments, stock reservations, notifications, penalties, history, and audit data.
- LINE owns LINE account identity and chat transport; the system stores only linked identifiers/profile snapshots needed for the service.
- The browser owns temporary checkout session/draft state and a local device key. Server validation remains authoritative.
- Future payment providers own settlement state; verified webhooks must update local transaction/order/item records.

## 6. Authentication and authorization

### Email/password

1. Client posts credentials to `/api/v1/auth/login`.
2. API validates the hash and active user state.
3. API issues a signed JWT.
4. `currentUserMiddleware` resolves optional identity; `requireAuth` and `requireRole` enforce protected routes.
5. Services/repositories must also constrain tenant-owned resources by organization ID.

### LINE LIFF

1. LIFF initializes with public `VITE_LIFF_ID`. In real mode, a signed-out customer is automatically sent through LINE Login; mock mode can stay signed in/out for local tests.
2. After LINE login, the client obtains an OIDC ID token and posts it to `/api/v1/auth/line`.
3. API verifies it against the configured LINE Login channel ID.
4. API finds or creates the customer and links `line_accounts.line_user_id` transactionally.
5. `currentUserMiddleware` accepts the JWT LINE claim only when the matching `line_accounts` row still belongs to that user and `is_linked = TRUE`.
6. LIFF booking, demo payment return, order creation, and ticket display run in the same `/liff/*` flow. Order and direct queue creation in LIFF are blocked until the system JWT has been issued from the LINE ID token.
7. Queue entries that store that verified linked LINE user ID can be targeted through Messaging API push.
8. Rich Menu entry points open safe `/liff/*` routes. `/liff/home?mode=ticket` resolves the current active ticket for the authenticated LINE user instead of depending on a fixed entry ID.

LINE Login does not send messages. Messaging API does not authenticate the web session. A complete setup needs both capabilities under the intended provider and a consistent LINE user relationship.

Authenticated order and direct queue creation copy only `req.user.lineUserId`, which came from the verified LINE ID token, internal JWT, and active `line_accounts` link, into the new queue entry. Guest orders and anonymous direct queue joins remain valid without a LINE recipient; public request bodies cannot assert `lineUserId`.

## 7. Synchronous flows

- Browser-to-API communication is JSON REST over `/api/v1`. Production frontend bundles use the public `VITE_API_URL=/api` value and rely on the web nginx reverse proxy to forward requests to the internal API service.
- API-to-PostgreSQL uses parameterized `pg` queries and explicit transactions for multi-row writes.
- Queue/order services never call LINE directly. They enqueue durable notification intents in PostgreSQL through `QueueNotificationService` and `NotificationOutboxRepository` inside the same business transaction as the queue/order state change.
- API-to-LINE uses HTTPS `fetch` through `ILineMessagingAdapter`; queue lifecycle copy, Flex Message payloads, text fallbacks, and ticket deep links are centralized in `line-notification.templates.ts` and sent by the notification delivery worker through `lineNotificationService`.
- Frontend resources are split by locale/domain. Locale resolution is user preference, organization default, browser/LIFF, then Japanese; API errors are translated by stable code.
- LINE copy is split into `ja`, `vi`, and `en` backend templates. The outbox stores the resolved customer locale at enqueue time.
- Rich Menu management is separate from runtime startup. `rich-menu.definition.ts` owns the Japanese menu actions and LIFF routes, `rich-menu.adapter.ts` owns LINE transport, `rich-menu.sync.service.ts` owns idempotent create/reuse/replace behavior, and `npm run line:rich-menu:sync` performs the explicit synchronization. Uploading Rich Menu images uses LINE's data API host, while create/list/default/delete use the Messaging API host.
- Payment originates as a server-created intent. Browser return is a UX signal; demo completion and future PSP callbacks are verified server-side before an order can consume the transaction.

## 8. Background jobs

The API scheduler uses overlap-protected `setInterval` jobs:

| Job                   | Interval     | Current behavior                                                                 |
| --------------------- | ------------ | -------------------------------------------------------------------------------- |
| ETA updater           | 30 seconds   | Recomputes wait estimates for waiting entries in open queues                     |
| ETA warning scan      | 30 seconds   | Enqueues approaching-turn LINE notification intents for eligible linked tickets  |
| Called retry scan     | 60 seconds   | Enqueues called-reminder intents using the same durable event-key deduplication  |
| Notification delivery | 15 seconds   | Claims due LINE outbox rows, sends them, and records sent/retry/failed outcomes  |
| Counter reset         | Hourly check | Resets counters after the organization-local business date changes               |
| Forecasting           | Configurable | Persists measured demand/service aggregates, wait forecasts, and staffing advice |

Notification delivery uses PostgreSQL row locking with `FOR UPDATE SKIP LOCKED`. ETA, warning, called, inventory expiry, location, counter reset, and forecasting jobs use PostgreSQL advisory locks with scheduler run health records, so multiple API replicas do not execute the same logical cycle concurrently.

## 9. Payment architecture

`paymentGateway.ts` defines Japan-oriented method choices for the browser, while `apps/api/src/modules/payments` owns the payment boundary. The API creates `payment_transactions` before checkout, computes payable coverage from server-side product data, and exposes provider adapters through `ExternalPaymentProvider`. `DemoPaymentProvider` returns a server-signed completion token for local/dev auto-success; future Stripe/KOMOJU/PayPay adapters plug into the same intent, return, webhook, and reconciliation flow.

Production target:

```text
Browser -> API create payment intent -> provider checkout/demo page
Provider/demo -> signed webhook or server-side verification -> API transaction state machine
API -> reconciliation -> order creation consumes verified transaction -> Browser return/status query
```

The browser return URL is a user experience signal, not proof of payment.

## 10. Security architecture

- Helmet, configured CORS, JSON size limits, request IDs, rate limits, Zod validation, and standard error envelopes.
- Password hashing and JWT signing occur only on the API.
- LINE webhook verification uses captured raw request bytes and `LINE_CHANNEL_SECRET`.
- `VITE_*` values are public; LINE/JWT/database/provider secrets are backend-only.
- Organization membership and resource ownership are required in addition to role checks.
- Audit records cover sensitive manager/organization actions; coverage should expand with payment/location operations.

## 11. Scalability and reliability boundaries

The current design is appropriate for a single API instance and modest queue volume. Before horizontal scale:

- coordinate scheduled jobs;
- enforce queue capacity and order numbering under lock/sequence;
- add provider webhook idempotency and reconciliation;
- introduce Redis/BullMQ only when measured workload justifies it;
- add database pooling/monitoring, object storage, centralized logs, and tracing.

These are constraints, not a requirement to rewrite the modular monolith.
