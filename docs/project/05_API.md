# API

## 1. Contract sources

- Runtime endpoint truth: `apps/api/src/routes` and `apps/api/src/modules/**/**.routes.ts`
- Request validation truth: module `*.validator.ts` files
- Response helpers: `apps/api/src/utils/response.ts`
- Interactive Swagger: `GET /api/docs` outside production
- Raw OpenAPI JSON: `GET /api/docs.json` outside production
- Runtime coverage guard: `npm run openapi:check`

The OpenAPI catalog covers every mounted `/api/v1` route and records bearer auth,
pagination, standard success/error envelopes, path parameters, and the runtime Zod
validator name. High-value queue, payment, notification, and LINE operations also
publish detailed component schemas. Express routes and Zod validators remain the
executable source of truth; the contract test fails when a route is added or removed
without updating the catalog.

## 2. Base URLs and authentication

- Versioned API: `/api/v1`
- Bearer authentication: `Authorization: Bearer <jwt>`
- Health/metrics: root paths outside `/api/v1`
- JSON content type for request/response bodies

`currentUserMiddleware` resolves a valid JWT when present. Public endpoints may use optional identity; protected endpoints add `requireAuth` and role middleware. Services must still enforce tenant ownership.

## 3. Response envelopes

Success:

```json
{
  "success": true,
  "data": {}
}
```

Paginated success:

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": { "fieldErrors": { "email": ["Invalid email address"] } }
  }
}
```

Common status semantics: `200` success, `201` created, `204` no content, `400` business input error, `401` unauthenticated, `403` forbidden/tenant mismatch, `404` not found, `409` state/stock conflict, `422` Zod validation, `429` rate limit, `500` unexpected error, `503` dependency/readiness failure.

Clients branch on `error.code` and localize it. `error.message` is diagnostic text, not a display-text contract. Locale-aware reads accept `Accept-Language`; supported values are `ja`, `vi`, and `en`.

For `VALIDATION_ERROR`, `details.fieldErrors` includes complete dot-separated paths for nested
values, for example `managers.0.email`. A root-key alias is also returned for compatibility with
older forms. Frontends should prefer the complete path so the message appears beside the exact
input. Client-side `maxLength`, numeric bounds, and accepted-file hints mirror the API validators;
the API remains authoritative. Form-level validation issues that do not target one input use the
reserved `_form` key, so validation responses never silently collapse to an empty error map.

Numeric form contracts use shared bounds in `@line-queue/shared`. Organization applications accept
`1..10,000` requested locations and `1..10,000,000` expected monthly customers. Queue capacity is
`1..100,000`, average service time is `1..480` minutes, and absence grace is `1..120` minutes.
Product prices are `0..100,000,000`, product wait time is `1..1,440` minutes, finite branch stock is
`0..100,000,000`, and its low-stock threshold is `0..100,000`. Order/payment item quantity is
`1..99`; the customer cart also permits zero to remove an item. Latitude/longitude remain bounded
to `-90..90` and `-180..180`, and reported location accuracy is limited to `0..100,000` metres.
The shared numeric input prevents alphabetic/exponential notation and disallowed signs while
retaining out-of-range values long enough to show one localized inline correction. Native integer,
minimum, and maximum constraints block submission; Zod repeats the authoritative checks for direct
requests. Order and payment
requests contain at most 100 distinct line items, and empty PATCH payloads for organization, staff,
product, queue, and branch updates are rejected instead of becoming silent no-ops.

## 4. Endpoint inventory

### Authentication

| Method | Path                            | Access               | Purpose                                                                         |
| ------ | ------------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| POST   | `/api/v1/auth/line`             | Public, strict limit | Verify LINE ID token, find/create linked customer, issue access/refresh session |
| POST   | `/api/v1/auth/login`            | Public, strict limit | Email/password login for business roles and issue access/refresh session        |
| POST   | `/api/v1/auth/refresh`          | Refresh cookie       | Rotate refresh token and return new access token/user/session metadata          |
| POST   | `/api/v1/auth/logout`           | Refresh cookie       | Revoke the current session family and clear the refresh cookie                  |
| GET    | `/api/v1/auth/account-action`   | Public, token query  | Inspect an activation or password-reset action without consuming it             |
| POST   | `/api/v1/auth/activate-account` | Public, action token | Set the invited account password and activate the business account              |
| POST   | `/api/v1/auth/forgot-password`  | Public, strict limit | Create a password-reset email without revealing account existence               |
| POST   | `/api/v1/auth/reset-password`   | Public, action token | Consume a password-reset action and set a new business password                 |

Login and refresh responses include `token`, `user`, and public `session` timing metadata. The raw
refresh token is never returned in JSON; it uses a `/api/v1/auth` path-scoped `HttpOnly`,
`SameSite=Strict` cookie with `Secure` enabled in production. Browser clients send credentials and
retry one failed authenticated request after a single shared refresh attempt. Login and LINE token
exchange requests opt out of automatic refresh so invalid credentials remain normal form errors.
`AUTH_SESSION_REQUIRED`, refresh failure, or a repeated `401` is a terminal browser-session signal:
the client clears private state and redirects once using its localized `AUTH_SESSION_EXPIRED`
notice instead of rendering the backend message.

### Platform admin

All paths require `admin`.

| Method | Path                                                  | Purpose                                                       |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/v1/admin/dashboard`                             | Plan adoption and platform subscription revenue metrics       |
| GET    | `/api/v1/admin/operations/health`                     | Sanitized platform runtime and delivery health aggregates     |
| GET    | `/api/v1/admin/organizations`                         | List all organizations with lifecycle/suspension metadata     |
| POST   | `/api/v1/admin/organizations/:orgId/suspend`          | Suspend one active organization with reason and optional note |
| GET    | `/api/v1/admin/organizations/:orgId/managers`         | Read the owner manager, including for a suspended tenant      |
| PATCH  | `/api/v1/admin/organizations/:orgId/managers/:userId` | Replace only the owner manager sign-in email for recovery     |

The suspension POST accepts the strict body
`{ "reason": "contract_renewal_cancelled|organization_request|other", "note"?: "..." }`.
The trimmed note is limited to 1,000 characters. Only an active organization can transition to
`suspended`; the transaction records the reason/note, disables tenant accounts and operational
resources, and writes `organization.suspend` audit evidence without deleting tenant data.

The owner recovery PATCH accepts the strict body `{ "email": "owner@example.jp" }`. Extra fields,
including `displayName`, `password`, and `isActive`, fail validation. A successful email change
revokes the owner's existing refresh sessions so the recovered address becomes the next login
authority.

The operations health response is Platform Admin-only. It exposes component states for API,
PostgreSQL, Redis, the notification worker, SSE, LINE configuration, and payment runtime plus
aggregate outbox/latency/error indicators. It never returns organization IDs, customer identities,
notification rows, payment transactions, provider payloads, or credentials. Component reasons are
stable codes translated by the Web client. Demo payment is healthy without real PSP credentials;
external payment configuration is validated before the API starts.

### Organization service applications

| Method | Path                                                       | Access                | Purpose                                                                                    |
| ------ | ---------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| POST   | `/api/v1/organization-applications`                        | Public, write-limited | Submit business/work-email/plan details with server demo price and applicant receipt email |
| GET    | `/api/v1/organization-applications?status=...`             | Admin                 | List pending/approved/rejected applications                                                |
| PATCH  | `/api/v1/organization-applications/:applicationId`         | Admin                 | Correct original application fields while the application remains pending                  |
| POST   | `/api/v1/organization-applications/:applicationId/approve` | Admin                 | Provision inactive tenant, owner invitation, and email outbox; no branch/queue             |
| POST   | `/api/v1/organization-applications/:applicationId/reject`  | Admin                 | Reject, demo-refund, and email the reviewed application result                             |

### Organizations and public entry

| Method | Path                           | Access        | Purpose                                                        |
| ------ | ------------------------------ | ------------- | -------------------------------------------------------------- |
| GET    | `/api/v1/orgs/my-org`          | Owner manager | Resolve owner organization                                     |
| PATCH  | `/api/v1/orgs/my-org`          | Owner manager | Update organization-level settings with audit                  |
| GET    | `/api/v1/orgs/by-token/:token` | Public        | Resolve branch QR, queues, wait/ETA, hours, and queue catalogs |
| GET    | `/api/v1/orgs/:slug`           | Public        | Resolve the organization's first active branch as fallback     |

### Branches and owner management

| Method | Path                                          | Access         | Purpose                                                                                     |
| ------ | --------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/branches`                            | Owner manager  | List branches, managers, staff counts, and active queues                                    |
| POST   | `/api/v1/branches`                            | Owner manager  | Create branch within the plan with map coordinates, calendar, and manager invites; no queue |
| PATCH  | `/api/v1/branches/:branchId`                  | Owner manager  | Edit owned branch contact, structured address, and verified map location                    |
| DELETE | `/api/v1/branches/:branchId`                  | Owner manager  | Permanently remove a branch and branch-owned operational data in one transaction            |
| GET    | `/api/v1/branches/analytics`                  | Owner manager  | Revenue trend, total/best/worst branch, and branch performance                              |
| GET    | `/api/v1/branches/audit`                      | Owner manager  | Personnel and branch audit history                                                          |
| POST   | `/api/v1/branches/geocode`                    | Manager        | Resolve a typed branch address to safe Google place candidates                              |
| POST   | `/api/v1/branches/:branchId/managers`         | Owner manager  | Invite another manager into the branch                                                      |
| DELETE | `/api/v1/branches/:branchId/managers/:userId` | Owner manager  | Remove a non-owner manager while retaining at least one manager                             |
| GET    | `/api/v1/branches/me`                         | Branch manager | Read only the assigned branch and its active queues                                         |
| PATCH  | `/api/v1/branches/me`                         | Branch manager | Update assigned branch contact/address fields with audit                                    |
| GET    | `/api/v1/branches/me/business-calendar`       | Branch manager | Read weekly hours and exception dates                                                       |
| PUT    | `/api/v1/branches/me/business-calendar`       | Branch manager | Replace validated branch calendar with audit                                                |

### Products/services

| Method | Path                                | Access             | Purpose                                                       |
| ------ | ----------------------------------- | ------------------ | ------------------------------------------------------------- |
| GET    | `/api/v1/products`                  | Public/scoped      | Queue catalog, owner catalog, or assigned-branch read catalog |
| GET    | `/api/v1/products/:id`              | Public/scoped      | Product detail with tenant and queue-assignment checks        |
| POST   | `/api/v1/products`                  | Organization owner | Create an organization catalog product/service                |
| PATCH  | `/api/v1/products/:id`              | Organization owner | Update an organization catalog product/service                |
| PATCH  | `/api/v1/products/:id/branch-stock` | Branch manager     | Update only assigned-branch stock and low-stock threshold     |
| DELETE | `/api/v1/products/:id`              | Organization owner | Soft-deactivate an organization catalog product               |

Product `imageUrl` and organization `logoUrl` accept either an HTTP/HTTPS object-storage URL or a same-origin path returned by the media upload API (`/media/...` or `/mock-media/...`). Arbitrary relative paths and data URLs remain invalid. Validation responses use `VALIDATION_ERROR` with `details.fieldErrors`; manager forms identify the affected image field without exposing server internals.

Product create, update, and deactivate operations write their authenticated owner actor as audit type `user`, matching the canonical PostgreSQL `audit_actor_type` enum. Catalog writes invalidate every locale-aware organization cache key and public slug cache key so deleted products and prepayment changes are not served from stale catalog data.

Product writes accept no browser-authoritative organization, branch, or queue IDs. The API derives
the organization from the owner JWT and generates an organization-unique `DVn` or `SPn` code under
a PostgreSQL advisory lock. Queue create/update owns the selected `productIds` mapping and verifies
every product belongs to the manager's organization before creating the branch-scoped assignment.
Organization-owner product writes do not accept stock. Branch managers maintain nullable
`stockQuantity` and `lowStockThreshold` through the dedicated branch-stock endpoint; the server
derives their single assigned branch and never accepts it from the request body. Payment and order
item arrays reject duplicate product IDs. These rules keep catalog pricing separate from
branch-specific inventory and keep checkout, inventory, and database constraints aligned.

### Queue configuration

All paths require a non-owner branch manager with exactly one active branch assignment. The API
does not accept `orgId` or `branchId` in queue write bodies.

| Method | Path                        | Purpose                                                  |
| ------ | --------------------------- | -------------------------------------------------------- |
| GET    | `/api/v1/queues`            | List assigned-branch queues with live status counts      |
| GET    | `/api/v1/queues/:id`        | Assigned-branch queue detail with live status counts     |
| POST   | `/api/v1/queues`            | Create a named queue and its selected product catalog    |
| PATCH  | `/api/v1/queues/:id`        | Update queue rules, absence grace, and selected products |
| PATCH  | `/api/v1/queues/:id/status` | Change queue status                                      |
| DELETE | `/api/v1/queues/:id`        | Soft-delete an assigned-branch queue                     |

Queue responses expose `waitingCount`, `calledCount`, and `servingCount`. `currentNumber` remains
the latest daily ticket sequence value and must not be presented as the current customer count.

### Customer ticket operations

| Method | Path                               | Access                                                           | Purpose                                                                              |
| ------ | ---------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| POST   | `/api/v1/queue/join`               | Public guest or authenticated customer, strict limit, idempotent | Join a queue directly; optional LINE recipient comes only from verified JWT identity |
| GET    | `/api/v1/queue/current?queueId=`   | Public                                                           | Current queue snapshot                                                               |
| GET    | `/api/v1/queue/me`                 | Authenticated customer                                           | Current caller active tickets with linked persisted order/item summaries             |
| GET    | `/api/v1/queue/me/penalties`       | Authenticated                                                    | Active caller penalties                                                              |
| GET    | `/api/v1/queue/entry/:entryId`     | Authenticated ticket owner                                       | Customer-owned ticket status with full linked order summary                          |
| POST   | `/api/v1/queue/:entryId/cancel`    | Authenticated owner/operator                                     | Cancel eligible ticket                                                               |
| POST   | `/api/v1/queue/:entryId/skip`      | Authenticated                                                    | Apply skip policy                                                                    |
| POST   | `/api/v1/queue/:entryId/serve`     | Assigned staff/branch manager                                    | Start service                                                                        |
| POST   | `/api/v1/queue/:entryId/complete`  | Assigned staff/branch manager                                    | Complete service                                                                     |
| GET    | `/api/v1/queue/:queueId/status`    | Public                                                           | Queue status/counts                                                                  |
| POST   | `/api/v1/queue/:queueId/call-next` | Assigned staff/branch manager                                    | Call next ticket                                                                     |

Static `/current` and `/me` routes must remain before parameter routes.

`POST /queue/join` accepts `queueId`, optional `guestName`, and optional `notes`. It does not accept a browser-supplied `lineUserId`; the controller passes only `req.user.lineUserId` after JWT and active `line_accounts` verification. Guests remain supported, while an authenticated non-customer role receives `403 CUSTOMER_ACCOUNT_REQUIRED` before queue admission.

The current customer LIFF UI treats `/queue/join` as a legacy/direct queue path. The product/service booking flow uses `POST /orders` after LIFF ID-token login has produced the system JWT.

### Realtime SSE

| Method | Path                                | Access                                     | Purpose                                      |
| ------ | ----------------------------------- | ------------------------------------------ | -------------------------------------------- |
| GET    | `/api/v1/realtime/tickets/:entryId` | Authenticated customer who owns the ticket | Ticket and queue invalidation event stream   |
| GET    | `/api/v1/realtime/queues/:queueId`  | Exact-branch manager or assigned Staff     | Branch queue operational invalidation stream |

Both endpoints return `text/event-stream`, `Cache-Control: no-cache, no-transform`, an SSE retry
hint, heartbeat comments, and `X-Accel-Buffering: no`. Organization owners, platform admins,
foreign customers, foreign branches, and Staff assigned to another queue are rejected. Streams
have bounded global/per-user counts and a finite connection duration so session authority is
revalidated on reconnect.

Event contract version `1` includes `ticket.created`, `ticket.called`, `ticket.serving`,
`ticket.completed`, `ticket.cancelled`, `ticket.deferred`, `ticket.no_show`,
`ticket.eta_updated`, and `queue.summary_updated`. Payloads contain only status, people-ahead/ETA
hints, or a bounded reason. Events may be duplicated, reordered, or missed during disconnect or
Redis restart. They are refresh hints only; clients must refetch the corresponding authenticated
REST resource and never treat SSE or `Last-Event-ID` as durable state.

### Staff operations

All paths require staff or a non-owner branch manager with exactly one active branch assignment.
Organization owners and platform admins do not receive operational queue access through these
routes. Every queue, entry, order, and product lookup is constrained by organization and branch.

| Method | Path                                      | Purpose                                                                                           |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/staff/branch`                    | Assigned branch identity and the Staff member's assigned queue for QR rendering                   |
| GET    | `/api/v1/staff/my-queue`                  | Assigned queue, next eight active entries, counts, and order/contact data                         |
| GET    | `/api/v1/staff/queues/:queueId`           | Queue overview                                                                                    |
| POST   | `/api/v1/staff/queues/:queueId/call-next` | Call next                                                                                         |
| POST   | `/api/v1/staff/entries/:entryId/serve`    | Start service                                                                                     |
| POST   | `/api/v1/staff/entries/:entryId/complete` | Complete service                                                                                  |
| POST   | `/api/v1/staff/entries/:entryId/defer`    | Record absence, move back three slots, or cancel/refund on the third absence; then auto-call next |
| POST   | `/api/v1/staff/entries/:entryId/no-show`  | Mark no-show                                                                                      |
| POST   | `/api/v1/staff/entries/:entryId/cancel`   | Operator cancellation                                                                             |

Staff transition endpoints validate UUID path parameters and do not require a request body.
Completion snapshots the responsible staff identity on the order, transitions the ticket to
`served`, completes inventory where applicable, and enqueues LINE delivery. Booking into an idle
queue, completion, cancellation, no-show, and defer all use the same queue-locked auto-call rule:
call the earliest waiter only when no ticket is already called or serving.

### Orders and payment

| Method | Path                            | Access                                           | Purpose                                                |
| ------ | ------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| POST   | `/api/v1/orders`                | Authenticated LINE customer, limited, idempotent | Atomic booking/order/payment/stock/location creation   |
| POST   | `/api/v1/orders/:id/cancel`     | Authenticated owner/operator                     | Cancel eligible order and linked ticket                |
| GET    | `/api/v1/orders`                | Assigned staff/branch manager                    | List assigned-branch orders                            |
| GET    | `/api/v1/orders/stats`          | Branch manager                                   | Assigned-branch order statistics                       |
| GET    | `/api/v1/orders/:id`            | Assigned staff/branch manager                    | Assigned-branch order detail                           |
| GET    | `/api/v1/orders/:id/receipt`    | Assigned staff/branch manager                    | Completed, fully paid receipt source data              |
| PATCH  | `/api/v1/orders/:id/status`     | Assigned staff/branch manager                    | Set processing/completed/cancelled                     |
| PATCH  | `/api/v1/orders/:id/payment`    | Assigned staff/branch manager, idempotent        | Collect outstanding balance or record refund           |
| POST   | `/api/v1/orders/:id/payment-qr` | Assigned staff/branch manager                    | Create a payOS counter checkout for the unpaid balance |

Order payment summary is derived from item coverage. A verified `required_items` transaction marks
the order paid when those items are the entire cart. For a mixed cart, Staff payment confirmation
creates an audited manual transaction for the remaining unpaid items; reconciliation then marks the
order paid and repeated UI confirmation is disabled.

Important `POST /orders` request fields:

```json
{
  "orgSlug": "queue-lab-demo",
  "branchId": "branch-uuid",
  "queueId": "queue-uuid",
  "customerName": "山田太郎",
  "customerPhone": "0900000000",
  "items": [{ "productId": "uuid", "quantity": 1 }],
  "bookingGroupId": "optional-uuid",
  "localDeviceKey": "optional-device-key",
  "customerLocation": {
    "latitude": 35.6812,
    "longitude": 139.7671,
    "accuracyMeters": 20
  },
  "payment": { "transactionId": "server-created-payment-uuid" }
}
```

`customerName` and `customerPhone` are required; the phone must pass the Japanese telephone
validator. The server ignores browser price, status, method code, and covered-product authority.
Required prepayment is satisfied only by a `payment.transactionId` that points to a paid,
same-tenant, unused `payment_transactions` row whose server-computed metadata matches the submitted cart.

An already attached payment transaction returns `409 PAYMENT_ALREADY_USED`. Customer clients must
discard that stale paid-checkout reference and start a new payment attempt; they may preserve the
current cart for recovery but must not resubmit the consumed transaction.

`POST /orders` requires a `customer` JWT with an active verified LINE link. The controller passes only trusted actor identity from `req.user`; the order service stores both `user_id` and verified linked `line_user_id` on the new queue entry. Missing auth returns `401 LINE_AUTH_REQUIRED`, a business role returns `403 CUSTOMER_ACCOUNT_REQUIRED`, and a customer without an active LINE link returns `403 LINE_ACCOUNT_REQUIRED`, before order, stock, queue, or payment work starts.

For a verified LINE customer, `bookingGroupId` is not browser authority. Under queue and advisory
locks, the server reuses the current active order and queue entry only when organization, branch,
queue, and verified LINE identity match and the ticket is `waiting`, `called`, or `serving`.
Additional items, payment linkage, totals, item payment state, and finite-stock reservations are
updated atomically without consuming another ticket number or capacity slot. A different queue or
terminal prior ticket creates a separate order/ticket. Orders directly persist branch/queue scope
plus organization, branch, queue, and fulfillment snapshots for receipt rendering.

In LIFF Phase 2, the frontend blocks order creation until `/auth/line` has completed and the authenticated LINE-derived JWT is present. The request body must still never include `lineUserId`.

### Payments

| Method | Path                                        | Access                    | Purpose                                                 |
| ------ | ------------------------------------------- | ------------------------- | ------------------------------------------------------- |
| POST   | `/api/v1/payments/intents`                  | LINE customer, idempotent | Create server-side payment intent/transaction           |
| POST   | `/api/v1/payments/demo/complete`            | Public, limited           | Complete demo payment with server-issued token          |
| GET    | `/api/v1/payments/:transactionId/return`    | Public                    | Read verified payment return status                     |
| POST   | `/api/v1/payments/:transactionId/reconcile` | Branch manager/admin      | Reconcile a branch-scoped or administrative transaction |
| POST   | `/api/v1/payments/webhooks/:provider`       | Signed provider webhook   | Idempotent provider callback processing                 |

Payment intent creation accepts `orgSlug`, `branchId`, `queueId`, selected `items`, `scope`,
`provider`, `method`, `currency`, optional `returnUrl`, and optional `cartSignature`. The API
reloads the branch calendar, selected queue, queue-product mappings, and products before computing
amount/coverage. Demo mode returns a `demoToken`; the browser must send it to
`/payments/demo/complete`, and the server verifies it before marking the transaction paid. The
`payos` adapter creates a VND checkout link and QR payload using backend-only merchant credentials.
Its signed webhook is authoritative and updates the same transaction, item, and order state
machine. Browser return URLs are constrained to the trusted web origin and remain a UX signal only.

The current deployment uses `PAYMENT_MODE=demo`. The provider registry resolves every intent to
`DemoPaymentProvider`, does not call payOS, and accepts only signed demo completion. payOS
credentials are optional and ignored in this mode. Enabling `PAYMENT_MODE=external` disables demo
completion and requires the complete backend-only payOS credential set during API startup; an
incomplete external configuration fails before the API serves traffic.

Manual payment updates use `PATCH /api/v1/orders/:id/payment` with `paymentStatus: paid | refunded`, optional refund `amount` and `reason`, and an `Idempotency-Key` header. Every accepted operation writes an audited reconciliation row. For a legacy paid order without a transaction, the refund path first backfills a server-side manual transaction with covered order products and records a separate reconciliation operation. Branch-manager reconciliation verifies both organization and branch from the linked order or server-created intent metadata. `GET /api/v1/orders/:id/receipt` is assigned-staff/branch-manager only and returns receipt source data only for a completed, fully paid order.

Customer and operator cancellation paths automatically refund all remaining collected amounts for
transactions attached to the order. Automatic refunds use deterministic per-order/per-transaction
reconciliation keys and are committed with order/ticket cancellation. This is executable for the
demo/manual foundation; a real PSP adapter must perform provider-side refund confirmation before
production rollout.

### Booking groups and organization calendar

| Method | Path                                     | Access                                      | Purpose                                                            |
| ------ | ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| GET    | `/api/v1/booking-groups/me?page=&limit=` | Authenticated customer                      | Paginated cross-device history for the current internal user       |
| GET    | `/api/v1/booking-groups/:id`             | Owning customer or assigned branch operator | Independent orders/items/tickets filtered to the authorized branch |
| GET    | `/api/v1/orgs/my-org/business-calendar`  | Owner manager                               | Legacy organization-level calendar                                 |
| PUT    | `/api/v1/orgs/my-org/business-calendar`  | Owner manager                               | Replace legacy organization calendar                               |
| GET    | `/api/v1/forecasts/wait`                 | Branch manager                              | Latest assigned-branch queue forecasts                             |
| GET    | `/api/v1/forecasts/staffing`             | Branch manager                              | Latest assigned-branch staffing baseline                           |

Booking-group requests never accept a customer or LINE user ID as authority. Customer scope comes from the verified system JWT; staff/branch-manager scope requires exactly one active branch assignment and filters the returned orders to that branch. Organization owners and platform admins use aggregate administration surfaces rather than this customer-detail endpoint. History order rows include immutable branch/queue snapshots, and full item details are opened through the authenticated customer-owned ticket endpoint.

### Media

| Method | Path                | Access        | Purpose                                                        |
| ------ | ------------------- | ------------- | -------------------------------------------------------------- |
| POST   | `/api/v1/media`     | Manager/admin | Validate, compress to WebP, store, and register an image asset |
| DELETE | `/api/v1/media/:id` | Tenant/admin  | Delete storage object and mark its metadata deleted            |

The upload request currently carries a browser-compressed data URL for compatibility, but the service validates decoded bytes and image metadata, caps input pixels/bytes, creates a server-generated key, and stores only the returned URL in organization/product records. The returned same-origin path is a valid persisted image reference for local/mock providers; production Compose persists local-provider objects in its VPS `media_data` volume. The optional S3-compatible provider returns a stable absolute public/CDN URL. Existing oversized data URLs are preview-only and are omitted from organization updates until replaced through the media endpoint. S3/R2 credentials are API-only and required only when that provider is selected; the browser never performs a direct upload.

The service treats provider operations as recoverable boundaries: database registration failure triggers
best-effort object cleanup, provider delete failure leaves metadata active for retry, missing objects
are idempotent, and a database failure after a successful delete can be repaired by retrying the
metadata transition. Orphan reconciliation is an operations task using provider inventory and
active `media_assets.storage_key` values; automatic destructive cleanup is intentionally not enabled.

### Users and staff management

| Method | Path                                 | Access              | Purpose                                             |
| ------ | ------------------------------------ | ------------------- | --------------------------------------------------- |
| GET    | `/api/v1/users`                      | Branch manager      | List staff from the manager's assigned branch       |
| PATCH  | `/api/v1/users/me`                   | Authenticated       | Update own profile and `preferredLocale`            |
| PATCH  | `/api/v1/users/me/password`          | Admin/manager/staff | Verify and change own password; revoke all sessions |
| POST   | `/api/v1/users/staff`                | Branch manager      | Invite staff into the assigned branch               |
| PATCH  | `/api/v1/users/staff/:userId/status` | Branch manager      | Change assigned-branch staff active state           |
| PATCH  | `/api/v1/users/staff/:userId`        | Branch manager      | Update assigned-branch staff                        |
| DELETE | `/api/v1/users/staff/:userId`        | Branch manager      | Soft-deactivate assigned-branch staff               |
| GET    | `/api/v1/users/:id`                  | Authenticated       | Own profile, or assigned staff for a branch manager |

`POST /users/staff` requires the staff profile, a non-empty `employeeCode`, and `queueId`; it does
not accept a branch selector. The API derives the target branch from the authenticated non-owner
manager's single active branch membership and verifies that the selected active queue belongs to
that branch. `PATCH /users/staff/:userId` may replace `queueId` under the same guard. One queue may
have multiple Staff assignments, while one active Staff membership has exactly one queue.
Normalized email uniqueness is platform-wide, so an existing email cannot be invited again under
another role.

Every response from these user, staff, branch-manager invitation, and Admin owner-recovery flows
uses a shared allowlist. It excludes `password_hash`, `invited_by`, `deactivated_by`, and any future
repository column unless deliberately added. Platform Admin does not use generic `/users` mutation
or tenant-profile reads; approved organization and immutable-owner recovery remain under the
dedicated `/api/v1/admin/*` contract.

### LINE and notifications

| Method | Path                                          | Access                            | Purpose                                                                                   |
| ------ | --------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| POST   | `/api/v1/line/webhook`                        | LINE signed webhook, strict limit | Verify signature and process supported events                                             |
| POST   | `/api/v1/line/friendship`                     | Authenticated linked customer     | Synchronize current Official Account friendship after LIFF login                          |
| GET    | `/api/v1/notifications`                       | Authenticated                     | List notifications with validated query                                                   |
| GET    | `/api/v1/line/preferences`                    | Authenticated linked customer     | Read LINE notification consent and event preferences                                      |
| PUT    | `/api/v1/line/preferences`                    | Authenticated linked customer     | Update LINE notification consent and event preferences                                    |
| GET    | `/api/v1/line/location-consent`               | Authenticated customer            | Read location snapshot consent                                                            |
| PUT    | `/api/v1/line/location-consent`               | Authenticated customer            | Update location snapshot consent                                                          |
| DELETE | `/api/v1/line/location-data`                  | Authenticated customer            | Revoke consent and anonymize stored snapshots                                             |
| POST   | `/api/v1/line/location-snapshot`              | Verified LINE customer            | Save a consented snapshot only while an active ticket exists                              |
| GET    | `/api/v1/notifications/operations`            | Branch manager/staff              | Safe paginated delivery list; filters status, queue, event, and time range                |
| GET    | `/api/v1/notifications/operations/:id`        | Branch manager/staff              | Scoped detail with event key, ticket reference, attempts, timestamps, and sanitized error |
| POST   | `/api/v1/notifications/operations/:id/retry`  | Branch manager/staff              | Audited retry for retryable `failed` delivery; body requires `reason`                     |
| POST   | `/api/v1/notifications/operations/:id/cancel` | Branch manager                    | Audited cancellation for obsolete `pending` delivery whose ticket is terminal             |

Platform Admin and Organization Owner do not have access to notification operations. Branch managers are constrained to their single active branch and can cancel notifications. Staff members are constrained to their single assigned queue and can retry but not cancel notifications. List/detail responses expose only normalized delivery metadata, masked recipient ID, and safe failure categories. Raw provider payloads, request headers, credentials, and full LINE user IDs are never returned. Manual action bodies are `{ "reason": "..." }` with 3-500 characters.

### Health, docs, and metrics

| Method | Path             | Access                 | Purpose                                                        |
| ------ | ---------------- | ---------------------- | -------------------------------------------------------------- |
| GET    | `/health`        | Public probe           | Process, DB, scheduler, LINE, and safe payment runtime summary |
| GET    | `/ready`         | Public probe           | DB readiness                                                   |
| GET    | `/metrics`       | Public in current code | Prometheus text metrics; protect at infrastructure edge        |
| GET    | `/api/docs`      | Non-production         | Swagger UI                                                     |
| GET    | `/api/docs.json` | Non-production         | Raw Swagger JSON                                               |

## 5. Idempotency, rate limits, and pagination

- Global `/api` limiter applies before versioned routes.
- Public reads/writes, strict auth/LINE paths, and authenticated actions use narrower limiters.
- Order creation, payment intent creation, direct queue join, and order payment patch use idempotency middleware.
- Clients should send a stable idempotency key for retries; consult middleware behavior/tests before changing header/storage semantics.
- List pagination/filter fields are endpoint-specific validators; do not invent a global query contract without updating all consumers.

## 6. API versioning and change rules

- Backward-compatible additions stay in `/api/v1`.
- Breaking request/response/state semantics require migration strategy and potentially `/api/v2`.
- Update routes, validators, service behavior, frontend clients/types, tests, Swagger, and this document together.
- Add real PSP adapters only after provider-specific auth, signature/idempotency, privacy, refund, and audit contracts are defined.

## 7. Account lifecycle summary

- `GET /api/v1/auth/account-action?token=...` inspects an activation/reset link without consuming it.
- `POST /api/v1/auth/activate-account` consumes an activation token and sets the invited account password.
- `POST /api/v1/auth/forgot-password` always returns an accepted response to prevent account enumeration.
- `POST /api/v1/auth/reset-password` consumes a reset token and updates an active business account password.
- `PATCH /api/v1/users/me/password` requires the current password, enforces the shared business
  password policy, updates the hash, and revokes all sessions so the user must sign in again.
- `GET|POST /api/v1/branches` lists branches or lets the organization owner create a branch with
  at least one invited manager. Branch creation does not create a queue; the assigned branch manager
  creates queues separately.
- `GET|PATCH /api/v1/branches/me` and
  `GET|PUT /api/v1/branches/me/business-calendar` are branch-manager-only and derive branch scope
  from the authenticated assignment.
- `GET /api/v1/branches/analytics` returns owner-only organization/branch performance.
- `DELETE /api/v1/branches/:branchId` hard-deletes branch-scoped managers/staff who have no other
  branch assignment, queues, orders, payments, reservations, notifications, QR identity, and
  operational records in one transaction. Historical audit rows and the final deletion snapshot
  remain available for accountability.
- `PATCH /api/v1/branches/:branchId` is owner-only, validates partial contact/address/map changes,
  records the old/new branch snapshot in the audit log, and derives organization scope from the
  authenticated owner.
- `POST /api/v1/branches/:branchId/managers` and
  `DELETE /api/v1/branches/:branchId/managers/:userId` manage branch-manager assignments;
  owner-only. Removal is serialized on the branch and cannot remove the final non-deactivated
  manager assignment. A pending invitation may therefore be revoked while another active or
  pending assignment remains; its activation token and unsent email are revoked in the same
  transaction.
- `GET /api/v1/branches/audit` returns owner-only personnel and branch audit history.
- `POST /api/v1/users/staff` now creates an invitation with profile and branch assignment. It no longer accepts a manager-selected password.
