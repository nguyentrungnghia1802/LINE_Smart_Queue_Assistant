# System Architecture

## 1. Architecture summary

The system is a TypeScript modular monolith: one React SPA, an Express API process, a dedicated
background worker process from the same API image, PostgreSQL, Redis, and direct LINE HTTP
integration. Most recurring database scans remain in the API scheduler; BullMQ owns only LINE
notification dispatch and delivery. The current source-to-runtime inventory is maintained in
[`10_IMPLEMENTATION_MAP.md`](10_IMPLEMENTATION_MAP.md).

OpenTelemetry instruments safe HTTP/Express, PostgreSQL, ioredis, and outbound Undici boundaries
when an OTLP endpoint is configured. Dispatcher jobs propagate W3C trace context to the dedicated
worker without placing recipient data in Redis. Sentry captures sanitized browser, API, and worker
exceptions. Both systems are optional and fail open; PostgreSQL transactions, API responses, and
worker outcomes never depend on a telemetry backend.

```text
Customer Browser / LINE LIFF       Staff / Manager / Admin Browser
              |                                  |
              +-------------- HTTPS -------------+
                                 |
                         React + Vite SPA
                                 |
                     REST /api/v1 + authorized SSE
                                 |
                         Express API process
                                 |
                    PostgreSQL durable outbox
                                 |
                  PostgreSQL outbox dispatcher
                                 |
                  BullMQ per-notification jobs
                                 |
                      Dedicated LINE worker
                       |                   |
                     Redis             LINE APIs
              limits/cache/queue   Login/OIDC + push
```

## 2. Containers and runtime boundaries

| Container/process | Technology                                  | Responsibility                                                                         |
| ----------------- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `web`             | React/Vite in dev, nginx static SPA in prod | Routes, i18next UI, browser state, API calls, LIFF adapter                             |
| `api`             | Node/Express                                | HTTP contracts, auth, business services, SQL repositories, LINE adapter, scheduler     |
| `worker`          | Node/BullMQ                                 | Dispatches committed LINE outbox rows and processes one notification per delivery job  |
| Media adapter     | Persistent local, mock, plus S3-compatible  | Validates/compresses image ingress; isolates mounted-volume or object persistence      |
| `postgres`        | PostgreSQL 16                               | Tenant, identity, queue, order, inventory, payment, notification, audit, forecast data |
| `redis`           | Redis 7.4                                   | Rate limits, public read caches, transient Pub/Sub, and BullMQ orchestration           |
| LINE platform     | LINE Login/LIFF and Messaging API           | Customer identity and chat delivery                                                    |
| Payment provider  | Demo active; payOS adapter retained         | Server-authoritative demo completion or explicitly enabled hosted/QR PSP webhook       |

Docker Compose supplies these local/production-like boundaries; it is not the final cloud infrastructure specification. In the current production-oriented VPS demo, the API uses the local provider at `/app/var/media`, backed by the production Compose `media_data` named volume. The volume outlives API container recreation and deployment while nginx reverse-proxies `/media/*` to `api:4000` without stripping the prefix. The web image likewise proxies `/api/*`, and production API requests use an empty `VITE_API_URL` because service paths already include `/api/v1`. S3-compatible media remains selectable for a future external/multi-host deployment; those records return a stable absolute public/CDN URL and do not depend on `/media`. The Vite development server proxies both same-origin prefixes to the local API.

`docker-compose.validation.yml` is a destructive, isolated engineering topology rather than a
deployment file. Its nginx gateway balances two API replicas that share PostgreSQL and Redis while
a separate worker owns LINE dispatch/delivery. It is used to prove cross-replica authentication,
rate limits, cache fallback, Redis Pub/Sub/SSE fan-out, worker recovery, API restart, and database
readiness behavior without contacting real providers.

Redis is backend-only and non-authoritative. One centralized `RedisService` owns connection,
reconnect, command timeout, safe health, and shutdown behavior. Strict authentication/webhook,
public-write, and authenticated-action rate limits share Redis counters across API replicas. The
global coarse API limiter and read limiter remain process-local. If Redis is unavailable, protected
policies use bounded process-local counters and emit safe metrics/logs; queue, order, payment, and
other durable business correctness continues to rely on PostgreSQL.

Public branch booking and public queue-summary reads use cache-aside Redis entries under versioned,
tenant-scoped keys. The branch booking read model has a default 5-second TTL; the queue count/ETA
summary has a default 3-second TTL. Queue, branch, catalog, inventory-display, and live-ticket
mutations invalidate affected keys only after their database transaction commits. Cache reads use
validated JSON envelopes, and malformed values, misses, timeouts, or Redis outages fall back to
PostgreSQL. Cached openness, stock, counts, or payment-shaped data is display-only: booking,
capacity, inventory, payment, transition, and authorization decisions always reload authoritative
PostgreSQL state.

Authorized realtime delivery uses versioned application events rather than database-row events.
Customer ticket streams and branch queue streams connect to an in-process `RealtimeHub`; the hub
uses dedicated Redis publisher/subscriber connections for cross-replica fan-out. Channels include
organization, branch, queue, and optional ticket scope. Redis Pub/Sub is transient and carries only
minimal status/ETA invalidation data, never phone, email, LINE identity, payment, or location data.
Queue/order state is committed before publication, and publication failure is logged without
rolling back business work. Reconnecting clients must reload the authoritative REST snapshot from
PostgreSQL because events are not replayed.

The React SPA consumes these streams through one authenticated fetch-stream connection manager,
not component-owned `EventSource` instances. Subscribers to the same endpoint share a connection.
Minimal events trigger TanStack Query invalidation and REST reconciliation; event payloads never
directly replace ticket or queue state. The client suppresses duplicate IDs, reconnects with
bounded backoff and a `Last-Event-ID` hint, pauses while the document is hidden or offline, closes
unused/logout streams, and performs one normal auth-session refresh on `401`. Polling remains the
degraded and missed-event recovery path, running less frequently only while SSE is connected.

BullMQ uses a separate queue and worker connection lifecycle because a worker requires blocking,
reconnecting Redis behavior. The versioned `line.notification-outbox.dispatch.v1` scheduler job
contains only `{ version: 1 }`. It claims committed PostgreSQL rows with `SKIP LOCKED` and adds
`line.notification-delivery.v1` jobs containing the notification UUID and optional W3C trace
headers. Recipient IDs,
provider credentials, locale, and templates remain in PostgreSQL. Each delivery job has the stable
ID `line-notification-<notification UUID>`, and LINE receives the notification UUID as
`X-Line-Retry-Key`. A crash before enqueue leaves a stale dispatch claim recoverable; a crash after
enqueue can redispatch the same BullMQ job harmlessly. Redis/worker downtime therefore grows the
undispatched PostgreSQL backlog without blocking API transactions.

Delivery retries classify timeouts, `429`, and provider `5xx` as retryable and provider validation
`4xx` as permanent. BullMQ applies bounded attempts, exponential backoff with jitter,
`Retry-After`, and provider throttling. PostgreSQL separately records dispatch state and actual
delivery state; enqueueing a BullMQ job never marks a notification `sent`.

The deployed production request path uses two proxy hops before Express: the host TLS nginx and the
web-container nginx. The API therefore sets Express `trust proxy` to `2` so `req.ip` is derived from
the trusted forwarded chain instead of the container socket address. Rate-limit keys consume only
that Express-resolved value and never parse the raw client-controlled left-most
`X-Forwarded-For` entry. API port `4000` remains internal to the Compose network and is not
published directly to the internet.

## 3. Backend module architecture

The API entry is `apps/api/src/server.ts`; `app.ts` composes middleware, health routes, docs, and `/api/v1` modules.

| Module              | Responsibility                                                 |
| ------------------- | -------------------------------------------------------------- |
| `account-lifecycle` | Activation, password reset, and email action tokens            |
| `admin`             | Approved organization and owner-manager recovery               |
| `auth`              | Business email/password and customer LINE ID-token login       |
| `bookings`          | Authenticated current/history booking-group reads              |
| `branches`          | Owner branch lifecycle/analytics and branch-manager settings   |
| `email`             | Durable invitation/reset/application email delivery            |
| `eta`, `forecasts`  | Wait calculation, historical metrics, and staffing advice      |
| `inventory`         | Branch stock reservations and expiry                           |
| `line`              | Webhook, friendship, location consent, and Rich Menu transport |
| `location`          | Consent-based snapshots, routes, and travel alerts             |
| `media`             | Validated image upload, compression, and storage adapters      |
| `notifications`     | Durable LINE outbox, templates, delivery, and operations       |

The `admin` module also owns a Platform Admin-only operational health read model. It composes
existing probes and safe aggregates without entering tenant repositories: PostgreSQL/Redis state,
API scheduler or dedicated-worker heartbeat, SSE state, LINE configuration, payment runtime, and
notification backlog. Dedicated worker heartbeat is ephemeral Redis data with a TTL and contains
only `status` and `updatedAt`. Failure to read observability data is represented in the response
and never participates in queue/order/payment transactions.

Notification operations preserve the outbox boundary: read models join tickets/queues/branches for
server-derived scope. Branch Managers are pinned to their single active branch, Staff are pinned to
their assigned queue, and platform Admin/Organization Owner are rejected. Manual retry updates the
same event-key row and schedules a new
deterministic dispatch generation. Cancellation is permitted only for pending delivery rows whose
ticket is terminal. Neither operation calls LINE inside the request transaction or mutates queue/order state.
| `observability` | OTel/Sentry lifecycle, safe spans, correlation, and sanitization |
| `orders`, `payments` | Atomic booking, fulfillment, payment, QR, webhook, reconciliation |
| `organization-applications` | Public submission, server demo pricing, and admin review |
| `orgs` | Public organization/branch booking resolution |
| `products`, `queues` | Organization catalog and branch queue configuration |
| `queue`, `staff` | Customer tickets and branch-scoped operations |
| `realtime` | Authorized SSE streams, event contracts, local hub, Redis Pub/Sub |
| `skip-penalty` | Absence/defer/no-show policy and refund boundary |
| `shared` | Shared validators and cross-module request contracts |
| `users` | Profiles, owner/manager/staff accounts, and audit-aware changes |

### Media persistence boundary

`MediaService` owns image validation, pixel limits, orientation-safe rotation, WebP compression, generated
keys, tenant authorization, and metadata registration. It depends only on `MediaStorage`; the
catalog and organization modules never import an S3 SDK. `LocalMediaStorage` is used by development
and the current production-oriented VPS demo; production Compose mounts its directory from the
durable `media_data` volume. `MockMediaStorage` is used by tests, and
`S3CompatibleMediaStorage` uses the AWS SDK transport for optional AWS S3, Cloudflare R2, or another
compatible endpoint. S3 credentials are required only when that provider is selected and remain in
the API runtime. The browser sends a data URL to the API and cannot select a bucket, object key, or
credential.

Dependency direction:

```text
routes -> middleware + validators -> controllers -> services -> repositories -> PostgreSQL
                                                \-> integration adapters -> LINE/provider
shared types/helpers <- API and web (framework-independent only)
```

Routes and controllers must not contain domain policy. Repositories must not know about HTTP.

## 4. Frontend architecture

`apps/web/src/router.tsx` defines one SPA with these route domains:

- Customer LINE entry redirects: `/q/:orgSlug`, `/qr/:token`
- LINE-first customer: `/liff/home`, `/liff/q/:orgSlug`, `/liff/qr/:token`, `/liff/checkout/demo/:sessionId`, `/liff/tickets`, `/liff/tickets/:entryId`
- Staff: `/staff`, `/staff/products`, `/staff/qr`
- Organization owner manager: `/manager`, `/manager/branches/*`, `/manager/audit`,
  `/manager/products/*`, `/manager/settings`
- Branch manager: `/manager`, `/manager/queues/*`, `/manager/users`, `/manager/qr`,
  `/manager/settings`
- Platform admin: `/admin/*`
- Public product/onboarding: `/`, `/business/register`

Legacy `/customer`, `/app/*`, `/join/:queueId`, and `/ticket/:entryId` pages are not separate
application surfaces. They only redirect old bookmarks to `/liff/*` or the current role dashboard;
customer functionality remains LINE/LIFF-only.

Frontend responsibilities are split into route pages, reusable components/layouts, API services, LIFF adapters, hooks, Zustand auth state, and browser checkout helpers. TanStack Query owns server-state fetching/caching. Browser storage currently preserves checkout drafts and local booking-group history; it is not authoritative business storage.

Storybook lives under `apps/web/.storybook` and is a development-only review boundary for selected
reusable components. Its preview supplies the same global CSS/design tokens, i18n resources,
TanStack Query provider, and MemoryRouter context used by stories. Stories use deterministic local
fixtures and never call LINE, payment, Google Routes, or the production API; Storybook is not part
of the production SPA bundle.

## 5. Data ownership

- PostgreSQL owns organization applications, organizations, branches, identities, organization
  memberships, branch memberships, branch calendars, organization product catalogs,
  branch queue-product assignments, queues,
  tickets, orders, payments, stock reservations, notifications, penalties, history, and audit data.
- LINE owns LINE account identity and chat transport; the system stores only linked identifiers/profile snapshots needed for the service.
- The browser owns temporary checkout session/draft state and a local device key. Server validation remains authoritative.
- Future payment providers own settlement state; verified webhooks must update local transaction/order/item records.

## 6. Authentication and authorization

### Email/password

Email/password is the operational login for staff, managers, and platform admins. The API rejects
email login for customer-role users and exposes no public customer registration endpoint.

1. Client posts credentials to `/api/v1/auth/login`.
2. API validates the hash and active user state.
3. API creates a PostgreSQL `auth_sessions` family, returns a 15-minute signed access JWT, and sets
   an opaque rotating refresh token in a path-scoped `HttpOnly`, production-`Secure` cookie.
4. The SPA keeps the access token in memory. It bootstraps or renews access through
   `/api/v1/auth/refresh`; access and refresh tokens are never persisted in browser storage.
   Authenticated API calls share one in-flight refresh operation and retry the original request at
   most once. `AUTH_SESSION_REQUIRED`, a failed refresh, or a second `401` ends the client session,
   clears the private query cache and user state, and performs one redirect to email login with a
   localized notice. Provider and backend error text is not rendered for this terminal path.
5. `currentUserMiddleware` verifies the JWT and active session family; `requireAuth` and
   `requireRole` enforce protected routes.
6. `currentUserMiddleware` reloads active organization membership, owner flag, and branch IDs from
   PostgreSQL; browser/JWT request bodies do not establish tenant scope.
7. Owner-only services require `organization_members.is_owner = TRUE`.
8. Branch manager/staff services require exactly one active branch assignment and constrain every
   resource by both organization ID and branch ID.

Business session refresh extends the idle deadline only while browser interaction is observed.
Admin, manager, and staff sessions end after 15 idle minutes or 12 absolute hours. Customer
sessions have a 30-day absolute limit; LIFF can exchange a valid LINE ID token again when needed.
Refresh rotation retains only SHA-256 token hashes, supports family revocation, tolerates a short
same-browser concurrent-refresh grace period, and treats later replay as compromise.

### LINE LIFF

1. Customer-facing manager print/copy actions generate permanent links such as `https://liff.line.me/{LIFF_ID}/qr/:token`. The configured endpoint is normally `/liff`, so the additional path is endpoint-relative and must not contain another `/liff`.
2. Public `/qr` and `/q` routes resolve the requested customer destination and redirect into LINE. LIFF initializes with public `VITE_LIFF_ID`. In real mode, including an external browser, a signed-out customer is automatically sent through LINE Login.
3. After LINE login, the client obtains an OIDC ID token and posts it to `/api/v1/auth/line`.
4. API verifies it against the configured LINE Login channel ID and may persist the optional verified email claim when the channel has email permission and the address is not already owned.
5. API finds or creates the customer, links `line_accounts.line_user_id` transactionally, and
   creates a 30-day customer refresh session.
6. `currentUserMiddleware` accepts the JWT LINE claim only when both its session family is active
   and the matching `line_accounts` row still belongs to that user with `is_linked = TRUE`.
7. LIFF booking, demo payment return, order creation, and ticket display run in the same `/liff/*` flow. Order and direct queue creation in LIFF are blocked until the system JWT has been issued from the LINE ID token.
8. After authentication, the client reads and synchronizes the Official Account friendship state
   without overriding a later explicit notification opt-out. When the linked account is not a
   friend, the LIFF shell displays a localized non-blocking action that calls
   `liff.requestFriendship()`, then rechecks `liff.getFriendship()` and synchronizes the result.
9. Queue entries that store that verified linked LINE user ID can be targeted through Messaging API push.
10. Rich Menu entry points open safe `/liff/*` routes. `/liff/home?mode=ticket` resolves the current active ticket for the authenticated LINE user instead of depending on a fixed entry ID.
11. A branch QR resolves its branch token, active queues, queue-specific products, current waiting
    count, ETA, and branch-open state. The customer selects a queue before payment or order creation.
    The UI distinguishes no configured queues, a paused/closed queue, and a branch outside business
    hours; only the last two are temporary availability states.
12. Product definitions and prices require the organization-owner capability. Branch managers can
    read that catalog, maintain stock for their assigned branch, and select queue assignments.

LINE Login does not send messages. Messaging API does not authenticate the web session. A complete setup needs both capabilities under the intended provider and a consistent LINE user relationship.

Payment intent creation, order creation, and direct customer queue creation require a customer JWT
whose `lineUserId` came from the verified LINE ID token and active `line_accounts` link. Controllers
copy only this trusted claim into new queue entries; public request bodies cannot assert
`lineUserId`.

## 7. Synchronous flows

- Browser-to-API communication is JSON REST over `/api/v1`. Production frontend bundles keep the public `VITE_API_URL` value empty and rely on the web nginx reverse proxy to forward those same-origin request paths to the internal API service.
- API-to-PostgreSQL uses parameterized `pg` queries and explicit transactions for multi-row writes.
- Queue/order services never call LINE directly. They enqueue durable notification intents in PostgreSQL through `QueueNotificationService` and `NotificationOutboxRepository` inside the same business transaction as the queue/order state change.
- API-to-LINE uses HTTPS `fetch` through `ILineMessagingAdapter`; queue lifecycle copy, Flex Message payloads, text fallbacks, and ticket deep links are centralized in `line-notification.templates.ts` and sent by the notification delivery worker through `lineNotificationService`.
- Customer-facing ticket Flex Messages use compact event-specific presentation colors while retaining localized text and Japanese fallback. Presentation changes do not alter durable outbox event keys or delivery semantics.
- Forecasting and staffing recommendations are deterministic PostgreSQL-backed heuristics. The runtime has no OpenAI or Gemini dependency, and AI provider credentials are intentionally absent from the configuration contract.
- Frontend resources are split by locale/domain. Locale resolution is user preference, organization default, browser/LIFF, then Japanese; API errors are translated by stable code.
- LINE copy is split into `ja`, `vi`, and `en` backend templates. The outbox stores the resolved customer locale at enqueue time.
- Rich Menu management is separate from runtime startup. `rich-menu.definition.ts` owns the Japanese menu actions and LIFF routes, `rich-menu.adapter.ts` owns LINE transport, `rich-menu.sync.service.ts` owns idempotent create/reuse/replace behavior, and `npm run line:rich-menu:sync` performs the explicit synchronization. Uploading Rich Menu images uses LINE's data API host, while create/list/default/delete use the Messaging API host.
- Payment originates as a server-created intent. Browser return is a UX signal; demo completion,
  payOS callbacks, and future PSP callbacks are verified server-side before an order can consume
  the transaction.
- Branch hours are evaluated in `organization_branches.timezone`; a matching exception date
  overrides weekly hours. Payment intent and order creation independently revalidate the selected
  branch, queue, and queue-product assignments. Branch-manager controls render explicit `00:00`
  through `23:59` values instead of browser-locale AM/PM controls and identify `Asia/Tokyo` as the
  Japan Standard Time boundary.
- The web build uses only the required official LIFF modules. A reviewed Vite transform replaces
  LINE's eval-based sub-window iframe bootstrap with an equivalent targeted form POST, and the
  post-build CSP check fails if `eval(` or `new Function` returns to a production JavaScript bundle.

## 8. Background jobs

The API scheduler uses overlap-protected `setInterval` jobs except for LINE delivery, which is
owned by the dedicated BullMQ worker when `LINE_NOTIFICATION_DELIVERY_OWNER=bullmq`:

| Job                   | Interval     | Current behavior                                                                                    |
| --------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| ETA updater           | 30 seconds   | Recomputes wait estimates for waiting entries in open queues                                        |
| ETA warning scan      | 30 seconds   | Enqueues approaching-turn LINE notification intents for eligible linked tickets                     |
| Called retry scan     | 60 seconds   | Enqueues called-reminder intents using the same durable event-key deduplication                     |
| Notification dispatch | 15 seconds   | Claims committed outbox rows and creates deterministic BullMQ delivery jobs                         |
| Notification delivery | Event-driven | LINE worker records actual sent/retry/failed outcomes for one PostgreSQL row                        |
| Location alerts       | 60 seconds   | Leases due rows, calls the travel provider outside transactions, then atomically enqueues/finalizes |
| Counter reset         | Hourly check | Resets counters after the organization-local business date changes                                  |
| Forecasting           | Configurable | Persists measured demand/service aggregates, wait forecasts, and staffing advice                    |

Notification dispatch uses PostgreSQL row locking with `FOR UPDATE SKIP LOCKED`; BullMQ does not
replace the durable outbox. ETA, warning, called, inventory expiry, location, counter reset,
forecasting, session cleanup, and email delivery retain their existing scheduler ownership. Those
singleton scans use PostgreSQL advisory locks where applicable, while row workloads retain safe
claims. Location alerts use `processing_started_at` as a recoverable lease; each provider call runs
without an open business transaction, and only notification enqueue plus claim finalization share
a short transaction. Bare local development can explicitly use API ownership, but a deployment must never run
both owners for LINE delivery.

## 9. Payment architecture

`paymentGateway.ts` defines locale/currency-compatible method choices for the browser, while
`apps/api/src/modules/payments` owns the payment boundary. The API creates `payment_transactions`
before checkout, computes payable coverage from server-side product data, and exposes provider
adapters through `ExternalPaymentProvider`. `DemoPaymentProvider` returns a server-signed
completion token for the current production-oriented demonstration runtime. It moves no real money,
requires no payOS merchant credentials, and cannot call the payOS transport. `PayosPaymentProvider`
creates VND checkout links and
QR payloads and verifies signed webhooks; future Japan PSP adapters plug into the same intent,
return, webhook, and reconciliation flow.

`PAYMENT_MODE` is the single backend activation boundary. `demo` always selects the demo adapter,
rejects external webhooks, and remains a healthy configured state without `PAYOS_*`. `external`
disables demo completion and requires the full payOS credential set during startup. The safe health
projection exposes only mode, active provider, and a credential-completeness boolean.

Production target:

```text
Browser -> API create payment intent -> provider checkout/demo page
Provider/demo -> signed webhook or server-side verification -> API transaction state machine
API -> reconciliation -> order creation consumes verified transaction -> Browser return/status query
```

The browser return URL is a user experience signal, not proof of payment.

## 10. Security architecture

- Helmet, configured CORS, JSON size limits, request IDs, distributed protected-write/auth rate limits, Zod validation, and standard error envelopes.
- Password hashing and JWT signing occur only on the API.
- LINE webhook verification uses captured raw request bytes and
  `LINE_MESSAGING_CHANNEL_SECRET`.
- `VITE_*` values are public; LINE/JWT/database/provider secrets are backend-only.
- Organization membership and resource ownership are required in addition to role checks.
- User repository rows are projected through an explicit response allowlist before leaving users,
  branch, or Admin services. Credential hashes and internal audit-actor columns are never API data.
- Platform Admin tenant access is limited to dedicated, reviewed `/admin/*` organization and owner
  workflows. Generic tenant user listing, creation, deactivation, and cross-user profile reads are
  not Admin capabilities.
- Audit records cover sensitive manager/organization actions; coverage should expand with payment/location operations.

## 11. Scalability and reliability boundaries

The measured development baseline, process-local state inventory, representative load scenarios,
initial SLOs, and staged target architecture are maintained in
[`11_SCALABILITY_BASELINE.md`](11_SCALABILITY_BASELINE.md).

The current design supports shared protected-write/auth rate-limit counters, bounded public caches,
cross-replica SSE fan-out, and a dedicated LINE worker. TASK-11 validated those boundaries with two
API instances. Each API/worker process now takes `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, and
`DB_POOL_CONNECTION_TIMEOUT_MS`; operators must budget the aggregate across every replica and
leave headroom for migrations, administration, and recovery. Other boundaries still require
staging work before unrestricted horizontal scale:

- move remaining long-running/provider work out of the HTTP process when measured, while preserving
  advisory locks or safe row claims; location travel estimates already use a recoverable row lease
  and do not hold a transaction during provider I/O;
- replace correctness-sensitive process-local idempotency responses with shared behavior;
- select and enforce an environment-specific aggregate PostgreSQL connection budget;
- enforce queue capacity and order numbering under lock/sequence;
- extend provider-specific settlement, refund, and operational reconciliation beyond the
  current abstraction and adapter boundary;
- validate real provider quotas and production observability export; validate S3/R2 credentials
  only before explicitly enabling the optional external media provider;
- replace correctness-sensitive process-local idempotency response replay where a durable database
  constraint alone is insufficient.

These are constraints, not a requirement to rewrite the modular monolith.
