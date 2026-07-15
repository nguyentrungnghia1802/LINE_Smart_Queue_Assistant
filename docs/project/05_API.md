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

## 4. Endpoint inventory

### Authentication

| Method | Path                    | Access               | Purpose                                                      |
| ------ | ----------------------- | -------------------- | ------------------------------------------------------------ |
| POST   | `/api/v1/auth/line`     | Public, strict limit | Verify LINE ID token, find/create linked customer, issue JWT |
| POST   | `/api/v1/auth/login`    | Public, strict limit | Email/password login                                         |
| POST   | `/api/v1/auth/register` | Public, strict limit | Register customer account                                    |

### Platform admin

All paths require `admin`.

| Method | Path                                                  | Purpose                                          |
| ------ | ----------------------------------------------------- | ------------------------------------------------ |
| GET    | `/api/v1/admin/organizations`                         | List organizations                               |
| POST   | `/api/v1/admin/organizations`                         | Create organization without manager              |
| POST   | `/api/v1/admin/organizations/register`                | Atomically create organization and Gmail manager |
| PATCH  | `/api/v1/admin/organizations/:orgId`                  | Update organization                              |
| DELETE | `/api/v1/admin/organizations/:orgId`                  | Soft-deactivate organization                     |
| GET    | `/api/v1/admin/organizations/:orgId/managers`         | List managers                                    |
| POST   | `/api/v1/admin/organizations/:orgId/managers`         | Create manager/membership                        |
| PATCH  | `/api/v1/admin/organizations/:orgId/managers/:userId` | Update manager profile/password/active state     |
| DELETE | `/api/v1/admin/organizations/:orgId/managers/:userId` | Deactivate manager/membership                    |

### Organizations and public entry

| Method | Path                           | Access        | Purpose                                                      |
| ------ | ------------------------------ | ------------- | ------------------------------------------------------------ |
| GET    | `/api/v1/orgs/my-org`          | Authenticated | Resolve actor organization including public QR token         |
| PATCH  | `/api/v1/orgs/my-org`          | Manager/admin | Update own organization settings with audit                  |
| GET    | `/api/v1/orgs/by-token/:token` | Public        | Resolve public organization by generated token               |
| GET    | `/api/v1/orgs/:slug`           | Public        | Resolve organization, active queue, and catalog landing data |

### Products/services

| Method | Path                   | Access        | Purpose                                          |
| ------ | ---------------------- | ------------- | ------------------------------------------------ |
| GET    | `/api/v1/products`     | Public        | List by query scope such as organization slug/ID |
| GET    | `/api/v1/products/:id` | Public        | Product detail                                   |
| POST   | `/api/v1/products`     | Manager/admin | Create product/service                           |
| PATCH  | `/api/v1/products/:id` | Manager/admin | Update product/service                           |
| DELETE | `/api/v1/products/:id` | Manager/admin | Delete/deactivate according to service behavior  |

### Queue configuration

All paths require manager/admin.

| Method | Path                        | Purpose                                          |
| ------ | --------------------------- | ------------------------------------------------ |
| GET    | `/api/v1/queues`            | List tenant queues                               |
| GET    | `/api/v1/queues/:id`        | Queue detail                                     |
| POST   | `/api/v1/queues`            | Create queue                                     |
| PATCH  | `/api/v1/queues/:id`        | Update queue configuration                       |
| PATCH  | `/api/v1/queues/:id/status` | Change queue status                              |
| DELETE | `/api/v1/queues/:id`        | Delete/archive queue according to service guards |

### Customer ticket operations

| Method | Path                               | Access                           | Purpose                                                                              |
| ------ | ---------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| POST   | `/api/v1/queue/join`               | Public, strict limit, idempotent | Join a queue directly; optional LINE recipient comes only from verified JWT identity |
| GET    | `/api/v1/queue/current?queueId=`   | Public                           | Current queue snapshot                                                               |
| GET    | `/api/v1/queue/me`                 | Authenticated                    | Current caller ticket                                                                |
| GET    | `/api/v1/queue/me/penalties`       | Authenticated                    | Active caller penalties                                                              |
| GET    | `/api/v1/queue/entry/:entryId`     | Public                           | Guest/public ticket status                                                           |
| POST   | `/api/v1/queue/:entryId/cancel`    | Authenticated owner/operator     | Cancel eligible ticket                                                               |
| POST   | `/api/v1/queue/:entryId/skip`      | Authenticated                    | Apply skip policy                                                                    |
| POST   | `/api/v1/queue/:entryId/serve`     | Staff/manager/admin              | Start service                                                                        |
| POST   | `/api/v1/queue/:entryId/complete`  | Staff/manager/admin              | Complete service                                                                     |
| GET    | `/api/v1/queue/:queueId/status`    | Public                           | Queue status/counts                                                                  |
| POST   | `/api/v1/queue/:queueId/call-next` | Staff/manager/admin              | Call next ticket                                                                     |

Static `/current` and `/me` routes must remain before parameter routes.

`POST /queue/join` accepts `queueId`, optional `guestName`, and optional `notes`. It does not accept a browser-supplied `lineUserId`; the controller passes only `req.user.lineUserId` after JWT and active `line_accounts` verification.

The current customer LIFF UI treats `/queue/join` as a legacy/direct queue path. The product/service booking flow uses `POST /orders` after LIFF ID-token login has produced the system JWT.

### Staff operations

All paths require staff/manager/admin and organization ownership.

| Method | Path                                      | Purpose                                       |
| ------ | ----------------------------------------- | --------------------------------------------- |
| GET    | `/api/v1/staff/my-queue`                  | Full operational board for actor organization |
| GET    | `/api/v1/staff/queues/:queueId`           | Queue overview                                |
| POST   | `/api/v1/staff/queues/:queueId/call-next` | Call next                                     |
| POST   | `/api/v1/staff/entries/:entryId/serve`    | Start service                                 |
| POST   | `/api/v1/staff/entries/:entryId/complete` | Complete service                              |
| POST   | `/api/v1/staff/entries/:entryId/no-show`  | Mark no-show                                  |
| POST   | `/api/v1/staff/entries/:entryId/cancel`   | Operator cancellation                         |

### Orders and payment

| Method | Path                         | Access                          | Purpose                                              |
| ------ | ---------------------------- | ------------------------------- | ---------------------------------------------------- |
| POST   | `/api/v1/orders`             | Public, limited, idempotent     | Atomic booking/order/payment/stock/location creation |
| POST   | `/api/v1/orders/:id/cancel`  | Authenticated owner/operator    | Cancel eligible order and linked ticket              |
| GET    | `/api/v1/orders`             | Staff/manager/admin             | List tenant orders                                   |
| GET    | `/api/v1/orders/stats`       | Manager/admin                   | Tenant order statistics                              |
| GET    | `/api/v1/orders/:id`         | Staff/manager/admin             | Order detail                                         |
| PATCH  | `/api/v1/orders/:id/status`  | Staff/manager/admin             | Set processing/completed/cancelled                   |
| PATCH  | `/api/v1/orders/:id/payment` | Staff/manager/admin, idempotent | Manually set unpaid/paid summary                     |

Important `POST /orders` request fields:

```json
{
  "orgSlug": "queue-lab-demo",
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

The server ignores browser price, status, method code, and covered-product authority. Required prepayment is satisfied only by a `payment.transactionId` that points to a paid, same-tenant, unused `payment_transactions` row whose server-computed metadata matches the submitted cart.

For authenticated `POST /orders`, the controller passes only trusted actor identity from `req.user`; the order service stores both `user_id` and verified linked `line_user_id` on the new queue entry. Guest orders keep both recipient fields empty unless a separately verified identity flow is used.

In LIFF Phase 2, the frontend blocks order creation until `/auth/line` has completed and the authenticated LINE-derived JWT is present. The request body must still never include `lineUserId`.

### Payments

| Method | Path                                        | Access                      | Purpose                                        |
| ------ | ------------------------------------------- | --------------------------- | ---------------------------------------------- |
| POST   | `/api/v1/payments/intents`                  | Public, limited, idempotent | Create server-side payment intent/transaction  |
| POST   | `/api/v1/payments/demo/complete`            | Public, limited             | Complete demo payment with server-issued token |
| GET    | `/api/v1/payments/:transactionId/return`    | Public                      | Read verified payment return status            |
| POST   | `/api/v1/payments/:transactionId/reconcile` | Manager/admin               | Reconcile linked order/items from transaction  |
| POST   | `/api/v1/payments/webhooks/:provider`       | Signed provider webhook     | Idempotent provider callback processing        |

Payment intent creation accepts `orgSlug`, selected `items`, `scope`, `provider`, `method`, `currency`, optional `returnUrl`, and optional `cartSignature`. The API reloads products and computes amount/coverage. Demo mode returns a `demoToken`; the browser must send it to `/payments/demo/complete`, and the server verifies it before marking the transaction paid. Future PSPs must update the same transaction state machine through signed webhooks or server-side verification.

Manual payment updates use `PATCH /api/v1/orders/:id/payment` with `paymentStatus: paid | refunded`, optional refund `amount` and `reason`, and an `Idempotency-Key` header. Every accepted operation writes an audited reconciliation row. `GET /api/v1/orders/:id/receipt` is staff/manager/admin only and returns receipt source data only for a completed, fully paid order.

### Booking groups and organization calendar

| Method | Path                                     | Access                     | Purpose                                                       |
| ------ | ---------------------------------------- | -------------------------- | ------------------------------------------------------------- |
| GET    | `/api/v1/booking-groups/me?page=&limit=` | Authenticated customer     | Paginated cross-device history for the current internal user  |
| GET    | `/api/v1/booking-groups/:id`             | Owner, tenant staff, admin | Independent orders/items/tickets in one related booking group |
| GET    | `/api/v1/orgs/my-org/business-calendar`  | Manager/admin              | Weekly hours and upcoming holiday/exception dates             |
| PUT    | `/api/v1/orgs/my-org/business-calendar`  | Manager/admin              | Atomically replace validated tenant calendar and write audit  |
| GET    | `/api/v1/forecasts/wait`                 | Manager/admin              | Latest per-queue measured wait forecast with confidence       |
| GET    | `/api/v1/forecasts/staffing`             | Manager/admin              | Latest weekday/hour staffing baseline with explanation        |

Booking-group requests never accept a customer or LINE user ID as authority. Customer scope comes from the verified system JWT; staff scope comes from active tenant membership. Payment, cancellation, receipt, and ticket status remain independent for every order in the response.

### Media

| Method | Path                | Access        | Purpose                                                        |
| ------ | ------------------- | ------------- | -------------------------------------------------------------- |
| POST   | `/api/v1/media`     | Manager/admin | Validate, compress to WebP, store, and register an image asset |
| DELETE | `/api/v1/media/:id` | Tenant/admin  | Delete storage object and mark its metadata deleted            |

The upload request currently carries a browser-compressed data URL for compatibility, but the service validates decoded bytes and image metadata, caps input pixels/bytes, creates a safe generated key, and stores only the returned URL in organization/product records. The local and mock providers are implemented; a real object-storage client remains external configuration.

### Users and staff management

| Method | Path                                 | Access        | Purpose                                      |
| ------ | ------------------------------------ | ------------- | -------------------------------------------- |
| GET    | `/api/v1/users`                      | Manager/admin | List users by tenant/role query              |
| PATCH  | `/api/v1/users/me`                   | Authenticated | Update own profile                           |
| POST   | `/api/v1/users/staff`                | Manager/admin | Create tenant staff                          |
| PATCH  | `/api/v1/users/staff/:userId/status` | Manager/admin | Change staff active state                    |
| PATCH  | `/api/v1/users/staff/:userId`        | Manager/admin | Update staff                                 |
| DELETE | `/api/v1/users/staff/:userId`        | Manager/admin | Remove/deactivate staff membership           |
| GET    | `/api/v1/users/:id`                  | Authenticated | User detail subject to service authorization |
| POST   | `/api/v1/users`                      | Admin         | Create user                                  |
| DELETE | `/api/v1/users/:id`                  | Admin         | Deactivate user                              |

### LINE and notifications

| Method  | Path                                          | Access                            | Purpose                                                           |
| ------- | --------------------------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| POST    | `/api/v1/line/webhook`                        | LINE signed webhook, strict limit | Verify signature and process supported events                     |
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
