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
    "details": { "fieldErrors": {} }
  }
}
```

Common status semantics: `200` success, `201` created, `204` no content, `400` business input error, `401` unauthenticated, `403` forbidden/tenant mismatch, `404` not found, `409` state/stock conflict, `422` Zod validation, `429` rate limit, `500` unexpected error, `503` dependency/readiness failure.

Clients branch on `error.code` and localize it. `error.message` is diagnostic text, not a display-text contract. Locale-aware reads accept `Accept-Language`; supported values are `ja`, `vi`, and `en`.

## 4. Endpoint inventory

### Authentication

| Method | Path                 | Access               | Purpose                                                                                      |
| ------ | -------------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/auth/line`  | Public, strict limit | Verify LINE ID token, find/create linked customer, optionally sync verified email, issue JWT |
| POST   | `/api/v1/auth/login` | Public, strict limit | Email/password login for admin, manager, and staff; customer role is rejected                |

### Platform admin

All paths require `admin`.

| Method | Path                                                  | Purpose                                      |
| ------ | ----------------------------------------------------- | -------------------------------------------- |
| GET    | `/api/v1/admin/organizations`                         | List organizations                           |
| PATCH  | `/api/v1/admin/organizations/:orgId`                  | Update organization                          |
| DELETE | `/api/v1/admin/organizations/:orgId`                  | Soft-deactivate organization                 |
| GET    | `/api/v1/admin/organizations/:orgId/managers`         | List managers                                |
| POST   | `/api/v1/admin/organizations/:orgId/managers`         | Create manager/membership                    |
| PATCH  | `/api/v1/admin/organizations/:orgId/managers/:userId` | Update manager profile/password/active state |
| DELETE | `/api/v1/admin/organizations/:orgId/managers/:userId` | Deactivate manager/membership                |

### Organization service applications

| Method | Path                                                       | Access                | Purpose                                                                          |
| ------ | ---------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| POST   | `/api/v1/organization-applications`                        | Public, write-limited | Submit business/work-email/plan details with server demo price                   |
| GET    | `/api/v1/organization-applications?status=...`             | Admin                 | List pending/approved/rejected applications                                      |
| POST   | `/api/v1/organization-applications/:applicationId/approve` | Admin                 | Provision inactive tenant, main branch/queue, owner invitation, and email outbox |
| POST   | `/api/v1/organization-applications/:applicationId/reject`  | Admin                 | Reject and demo-refund the reviewed application                                  |

### Organizations and public entry

| Method | Path                           | Access        | Purpose                                                        |
| ------ | ------------------------------ | ------------- | -------------------------------------------------------------- |
| GET    | `/api/v1/orgs/my-org`          | Owner manager | Resolve owner organization                                     |
| PATCH  | `/api/v1/orgs/my-org`          | Owner manager | Update organization-level settings with audit                  |
| GET    | `/api/v1/orgs/by-token/:token` | Public        | Resolve branch QR, queues, wait/ETA, hours, and queue catalogs |
| GET    | `/api/v1/orgs/:slug`           | Public        | Resolve the organization's first active branch as fallback     |

### Branches and owner management

| Method | Path                                          | Access         | Purpose                                                                                |
| ------ | --------------------------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| GET    | `/api/v1/branches`                            | Owner manager  | List branches, managers, staff counts, and active queues                               |
| POST   | `/api/v1/branches`                            | Owner manager  | Create branch within the subscribed plan, calendar, default queue, and manager invites |
| GET    | `/api/v1/branches/analytics`                  | Owner manager  | Revenue trend, total/best/worst branch, and branch performance                         |
| GET    | `/api/v1/branches/audit`                      | Owner manager  | Personnel and branch audit history                                                     |
| POST   | `/api/v1/branches/:branchId/managers`         | Owner manager  | Invite another manager into the branch                                                 |
| DELETE | `/api/v1/branches/:branchId/managers/:userId` | Owner manager  | Remove a non-owner manager while retaining at least one manager                        |
| GET    | `/api/v1/branches/me`                         | Branch manager | Read only the assigned branch and its active queues                                    |
| PATCH  | `/api/v1/branches/me`                         | Branch manager | Update assigned branch contact/address fields with audit                               |
| GET    | `/api/v1/branches/me/business-calendar`       | Branch manager | Read weekly hours and exception dates                                                  |
| PUT    | `/api/v1/branches/me/business-calendar`       | Branch manager | Replace validated branch calendar with audit                                           |

### Products/services

| Method | Path                   | Access         | Purpose                                               |
| ------ | ---------------------- | -------------- | ----------------------------------------------------- |
| GET    | `/api/v1/products`     | Public/scoped  | Public query or assigned-branch manager/staff catalog |
| GET    | `/api/v1/products/:id` | Public/scoped  | Product detail with branch checks for business actors |
| POST   | `/api/v1/products`     | Branch manager | Create a branch product and assign at least one queue |
| PATCH  | `/api/v1/products/:id` | Branch manager | Update assigned-branch product and queue mappings     |
| DELETE | `/api/v1/products/:id` | Branch manager | Soft-deactivate an assigned-branch product            |

Product `imageUrl` accepts either an HTTP/HTTPS object-storage URL or a same-origin path returned by the media upload API (`/media/...` or `/mock-media/...`). Arbitrary relative paths and data URLs remain invalid. Validation responses use `VALIDATION_ERROR` with `details.fieldErrors`; manager product forms show the error code and affected field without exposing server internals.

Product create, update, and deactivate operations write their authenticated branch-manager actor as audit type `user`, matching the canonical PostgreSQL `audit_actor_type` enum. Catalog writes invalidate every locale-aware organization cache key and public slug cache key so deleted products and prepayment changes are not served from stale catalog data.

Product writes accept `queueIds` but no browser-authoritative organization or branch ID. The API
derives scope from the branch-manager JWT and verifies every selected queue belongs to that branch.
Product validation rejects finite stock for `service` records and rejects
`requiresPrepayment=true` when the price is zero. Payment and order item arrays reject duplicate
product IDs. These rules keep Manager configuration compatible with checkout, inventory, and
database constraints.

### Queue configuration

All paths require a non-owner branch manager with exactly one active branch assignment. The API
does not accept `orgId` or `branchId` in queue write bodies.

| Method | Path                        | Purpose                                                 |
| ------ | --------------------------- | ------------------------------------------------------- |
| GET    | `/api/v1/queues`            | List assigned-branch queues                             |
| GET    | `/api/v1/queues/:id`        | Assigned-branch queue detail                            |
| POST   | `/api/v1/queues`            | Create a named queue in the assigned branch             |
| PATCH  | `/api/v1/queues/:id`        | Update name/description/status/capacity/service minutes |
| PATCH  | `/api/v1/queues/:id/status` | Change queue status                                     |
| DELETE | `/api/v1/queues/:id`        | Soft-delete unless it is the branch's last active queue |

### Customer ticket operations

| Method | Path                               | Access                                                           | Purpose                                                                              |
| ------ | ---------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| POST   | `/api/v1/queue/join`               | Public guest or authenticated customer, strict limit, idempotent | Join a queue directly; optional LINE recipient comes only from verified JWT identity |
| GET    | `/api/v1/queue/current?queueId=`   | Public                                                           | Current queue snapshot                                                               |
| GET    | `/api/v1/queue/me`                 | Authenticated                                                    | Current caller ticket                                                                |
| GET    | `/api/v1/queue/me/penalties`       | Authenticated                                                    | Active caller penalties                                                              |
| GET    | `/api/v1/queue/entry/:entryId`     | Public                                                           | Guest/public ticket status                                                           |
| POST   | `/api/v1/queue/:entryId/cancel`    | Authenticated owner/operator                                     | Cancel eligible ticket                                                               |
| POST   | `/api/v1/queue/:entryId/skip`      | Authenticated                                                    | Apply skip policy                                                                    |
| POST   | `/api/v1/queue/:entryId/serve`     | Assigned staff/branch manager                                    | Start service                                                                        |
| POST   | `/api/v1/queue/:entryId/complete`  | Assigned staff/branch manager                                    | Complete service                                                                     |
| GET    | `/api/v1/queue/:queueId/status`    | Public                                                           | Queue status/counts                                                                  |
| POST   | `/api/v1/queue/:queueId/call-next` | Assigned staff/branch manager                                    | Call next ticket                                                                     |

Static `/current` and `/me` routes must remain before parameter routes.

`POST /queue/join` accepts `queueId`, optional `guestName`, and optional `notes`. It does not accept a browser-supplied `lineUserId`; the controller passes only `req.user.lineUserId` after JWT and active `line_accounts` verification. Guests remain supported, while an authenticated non-customer role receives `403 CUSTOMER_ACCOUNT_REQUIRED` before queue admission.

The current customer LIFF UI treats `/queue/join` as a legacy/direct queue path. The product/service booking flow uses `POST /orders` after LIFF ID-token login has produced the system JWT.

### Staff operations

All paths require staff or a non-owner branch manager with exactly one active branch assignment.
Organization owners and platform admins do not receive operational queue access through these
routes. Every queue, entry, order, and product lookup is constrained by organization and branch.

| Method | Path                                      | Purpose                                                                                             |
| ------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/staff/my-queue`                  | Next eight active entries, counts, order/contact data, and available queues for the assigned branch |
| GET    | `/api/v1/staff/queues/:queueId`           | Queue overview                                                                                      |
| POST   | `/api/v1/staff/queues/:queueId/call-next` | Call next                                                                                           |
| POST   | `/api/v1/staff/entries/:entryId/serve`    | Start service                                                                                       |
| POST   | `/api/v1/staff/entries/:entryId/complete` | Complete service                                                                                    |
| POST   | `/api/v1/staff/entries/:entryId/defer`    | Return a called late arrival behind all current waiting entries and call the next eligible ticket   |
| POST   | `/api/v1/staff/entries/:entryId/no-show`  | Mark no-show                                                                                        |
| POST   | `/api/v1/staff/entries/:entryId/cancel`   | Operator cancellation                                                                               |

Staff transition endpoints validate UUID path parameters and do not require a request body.
Completion snapshots the responsible staff identity on the order, transitions the ticket to
`served`, completes inventory where applicable, and enqueues LINE delivery. Booking into an idle
queue, completion, cancellation, no-show, and defer all use the same queue-locked auto-call rule:
call the earliest waiter only when no ticket is already called or serving.

### Orders and payment

| Method | Path                         | Access                                                      | Purpose                                              |
| ------ | ---------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| POST   | `/api/v1/orders`             | Public guest or authenticated customer, limited, idempotent | Atomic booking/order/payment/stock/location creation |
| POST   | `/api/v1/orders/:id/cancel`  | Authenticated owner/operator                                | Cancel eligible order and linked ticket              |
| GET    | `/api/v1/orders`             | Assigned staff/branch manager                               | List assigned-branch orders                          |
| GET    | `/api/v1/orders/stats`       | Branch manager                                              | Assigned-branch order statistics                     |
| GET    | `/api/v1/orders/:id`         | Assigned staff/branch manager                               | Assigned-branch order detail                         |
| PATCH  | `/api/v1/orders/:id/status`  | Assigned staff/branch manager                               | Set processing/completed/cancelled                   |
| PATCH  | `/api/v1/orders/:id/payment` | Assigned staff/branch manager, idempotent                   | Collect outstanding balance or record refund         |

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

For a verified LINE customer, `bookingGroupId` is not browser authority. The server reuses an
active booking group only for the same organization, branch, and LINE identity under a transaction
advisory lock. Every reservation remains a separate order/ticket; terminal historical orders are
excluded from the Staff active-group view. Orders directly persist branch/queue scope plus
organization, branch, queue, and fulfillment snapshots for receipt rendering.

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
`/payments/demo/complete`, and the server verifies it before marking the transaction paid. Future
PSPs must update the same transaction state machine through signed webhooks or server-side
verification.

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

Booking-group requests never accept a customer or LINE user ID as authority. Customer scope comes from the verified system JWT; staff/branch-manager scope requires exactly one active branch assignment and filters the returned orders to that branch. Organization owners and platform admins use aggregate administration surfaces rather than this customer-detail endpoint. Payment, cancellation, receipt, and ticket status remain independent for every order in the response.

### Media

| Method | Path                | Access        | Purpose                                                        |
| ------ | ------------------- | ------------- | -------------------------------------------------------------- |
| POST   | `/api/v1/media`     | Manager/admin | Validate, compress to WebP, store, and register an image asset |
| DELETE | `/api/v1/media/:id` | Tenant/admin  | Delete storage object and mark its metadata deleted            |

The upload request currently carries a browser-compressed data URL for compatibility, but the service validates decoded bytes and image metadata, caps input pixels/bytes, creates a safe generated key, and stores only the returned URL in organization/product records. The local and mock providers are implemented; a real object-storage client remains external configuration.

### Users and staff management

| Method | Path                                 | Access               | Purpose                                      |
| ------ | ------------------------------------ | -------------------- | -------------------------------------------- |
| GET    | `/api/v1/users`                      | Branch manager/admin | List assigned-branch staff or platform users |
| PATCH  | `/api/v1/users/me`                   | Authenticated        | Update own profile and `preferredLocale`     |
| POST   | `/api/v1/users/staff`                | Branch manager       | Invite staff into the assigned branch        |
| PATCH  | `/api/v1/users/staff/:userId/status` | Branch manager       | Change assigned-branch staff active state    |
| PATCH  | `/api/v1/users/staff/:userId`        | Branch manager       | Update assigned-branch staff                 |
| DELETE | `/api/v1/users/staff/:userId`        | Branch manager       | Soft-deactivate assigned-branch staff        |
| GET    | `/api/v1/users/:id`                  | Authenticated        | User detail subject to service authorization |
| POST   | `/api/v1/users`                      | Admin                | Create user                                  |
| DELETE | `/api/v1/users/:id`                  | Admin                | Deactivate user                              |

`POST /users/staff` requires the staff profile and a non-empty `employeeCode`; it does not accept a
branch selector. The API derives the target branch from the authenticated non-owner manager's
single active branch membership. Normalized email uniqueness is platform-wide, so an existing
email cannot be invited again under another role.

### LINE and notifications

| Method  | Path                                          | Access                            | Purpose                                                           |
| ------- | --------------------------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| POST    | `/api/v1/line/webhook`                        | LINE signed webhook, strict limit | Verify signature and process supported events                     |
| POST    | `/api/v1/line/friendship`                     | Authenticated linked customer     | Synchronize current Official Account friendship after LIFF login  |
| GET     | `/api/v1/notifications`                       | Authenticated                     | List notifications with validated query                           |
| GET/PUT | `/api/v1/line/preferences`                    | Authenticated linked customer     | Read/update LINE notification consent and event preferences       |
| GET/PUT | `/api/v1/line/location-consent`               | Authenticated customer            | Read/update location snapshot consent                             |
| DELETE  | `/api/v1/line/location-data`                  | Authenticated customer            | Revoke consent and anonymize stored snapshots                     |
| GET     | `/api/v1/notifications/operations`            | Manager/admin                     | Tenant-scoped delivery operations list with masked LINE recipient |
| POST    | `/api/v1/notifications/operations/:id/retry`  | Manager/admin                     | Audited explicit retry for failed/cancelled delivery              |
| POST    | `/api/v1/notifications/operations/:id/cancel` | Manager/admin                     | Audited cancellation for unsent delivery                          |

### Health, docs, and metrics

| Method | Path             | Access                 | Purpose                                                 |
| ------ | ---------------- | ---------------------- | ------------------------------------------------------- |
| GET    | `/health`        | Public probe           | Process, DB, scheduler, LINE configuration summary      |
| GET    | `/ready`         | Public probe           | DB readiness                                            |
| GET    | `/metrics`       | Public in current code | Prometheus text metrics; protect at infrastructure edge |
| GET    | `/api/docs`      | Non-production         | Swagger UI                                              |
| GET    | `/api/docs.json` | Non-production         | Raw Swagger JSON                                        |

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
- `GET|POST /api/v1/branches` lists branches or lets the organization owner create a branch with
  at least one manager and a default closed queue.
- `GET|PATCH /api/v1/branches/me` and
  `GET|PUT /api/v1/branches/me/business-calendar` are branch-manager-only and derive branch scope
  from the authenticated assignment.
- `GET /api/v1/branches/analytics` returns owner-only organization/branch performance.
- `POST /api/v1/branches/:branchId/managers` and `DELETE /api/v1/branches/:branchId/managers/:userId` manage branch-manager assignments; owner-only.
- `GET /api/v1/branches/audit` returns owner-only personnel and branch audit history.
- `POST /api/v1/users/staff` now creates an invitation with profile and branch assignment. It no longer accepts a manager-selected password.
