# System Architecture

## 1. Architecture summary

The system is a TypeScript modular monolith: one React SPA, one Express API process, one PostgreSQL database, and direct LINE HTTP integration. Scheduled jobs run inside the API process. This keeps local operation simple while module boundaries provide an upgrade path to workers or services later. The current source-to-runtime inventory is maintained in [`10_IMPLEMENTATION_MAP.md`](10_IMPLEMENTATION_MAP.md).

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
| Payment provider  | Demo adapter or payOS                       | Hosted/payment redirect, QR payload, and authoritative webhook                         |

Docker Compose supplies these local/production-like boundaries; it is not the final cloud infrastructure specification. In production-style web images, nginx serves the built SPA and reverse-proxies `/api/*` and `/media/*` to the internal `api:4000` service without stripping either prefix, so browser code and locally persisted media use the same public origin. The Vite development server proxies these same prefixes to the local API, keeping persisted image URLs working at `localhost:5173`. Production API requests use an empty `VITE_API_URL` because service paths already include `/api/v1`.

The deployed production request path uses two proxy hops before Express: the host TLS nginx and the web-container nginx. The API therefore sets Express `trust proxy` to `2` so `req.ip` is derived from the forwarded client chain instead of the container socket address. This is important for strict rate limiting and request attribution. API port `4000` remains internal to the Compose network and is not published directly to the internet.

## 3. Backend module architecture

The API entry is `apps/api/src/server.ts`; `app.ts` composes middleware, health routes, docs, and `/api/v1` modules.

| Module                      | Responsibility                                                    |
| --------------------------- | ----------------------------------------------------------------- |
| `account-lifecycle`         | Activation, password reset, and email action tokens               |
| `admin`                     | Approved organization and owner-manager recovery                  |
| `auth`                      | Business email/password and customer LINE ID-token login          |
| `bookings`                  | Authenticated current/history booking-group reads                 |
| `branches`                  | Owner branch lifecycle/analytics and branch-manager settings      |
| `email`                     | Durable invitation/reset/application email delivery               |
| `eta`, `forecasts`          | Wait calculation, historical metrics, and staffing advice         |
| `inventory`                 | Branch stock reservations and expiry                              |
| `line`                      | Webhook, friendship, location consent, and Rich Menu transport    |
| `location`                  | Consent-based snapshots, routes, and travel alerts                |
| `media`                     | Validated image upload, compression, and storage adapters         |
| `notifications`             | Durable LINE outbox, templates, delivery, and operations          |
| `orders`, `payments`        | Atomic booking, fulfillment, payment, QR, webhook, reconciliation |
| `organization-applications` | Public submission, server demo pricing, and admin review          |
| `orgs`                      | Public organization/branch booking resolution                     |
| `products`, `queues`        | Organization catalog and branch queue configuration               |
| `queue`, `staff`            | Customer tickets and branch-scoped operations                     |
| `skip-penalty`              | Absence/defer/no-show policy and refund boundary                  |
| `shared`                    | Shared validators and cross-module request contracts              |
| `users`                     | Profiles, owner/manager/staff accounts, and audit-aware changes   |

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

`paymentGateway.ts` defines locale/currency-compatible method choices for the browser, while
`apps/api/src/modules/payments` owns the payment boundary. The API creates `payment_transactions`
before checkout, computes payable coverage from server-side product data, and exposes provider
adapters through `ExternalPaymentProvider`. `DemoPaymentProvider` returns a server-signed
completion token for local/dev auto-success. `PayosPaymentProvider` creates VND checkout links and
QR payloads and verifies signed webhooks; future Japan PSP adapters plug into the same intent,
return, webhook, and reconciliation flow.

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
- LINE webhook verification uses captured raw request bytes and
  `LINE_MESSAGING_CHANNEL_SECRET`.
- `VITE_*` values are public; LINE/JWT/database/provider secrets are backend-only.
- Organization membership and resource ownership are required in addition to role checks.
- Audit records cover sensitive manager/organization actions; coverage should expand with payment/location operations.

## 11. Scalability and reliability boundaries

The current design is appropriate for a single API instance and modest queue volume. Before horizontal scale:

- coordinate scheduled jobs;
- enforce queue capacity and order numbering under lock/sequence;
- extend provider-specific settlement, refund, and operational reconciliation beyond the
  current abstraction and adapter boundary;
- introduce Redis/BullMQ only when measured workload justifies it;
- add database pooling/monitoring, object storage, centralized logs, and tracing.

These are constraints, not a requirement to rewrite the modular monolith.
