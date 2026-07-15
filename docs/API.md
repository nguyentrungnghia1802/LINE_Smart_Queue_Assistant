# API Reference — LINE Smart Queue Assistant

Base URL: `http://localhost:4000/api/v1`

Interactive docs (development only): `http://localhost:4000/api/docs`

---

## Authentication

Most endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Tokens are issued by the `/auth` endpoints. Role claims are embedded in the token.

---

## Roles

| Role       | Description                                             |
| ---------- | ------------------------------------------------------- |
| `customer` | End-user who joins queues                               |
| `staff`    | Operates queue board (call next, serve, complete)       |
| `manager`  | Manages org settings, products, queues, views analytics |
| `admin`    | Platform-level superuser (rare)                         |

---

## Auth Endpoints

### POST /auth/login/line

Login with LINE LIFF id_token.

**Request:**

```json
{ "idToken": "<LINE id_token from LIFF>" }
```

**Response:**

```json
{ "success": true, "data": { "token": "jwt...", "user": { "id": "...", "role": "customer" } } }
```

### POST /auth/login

Login with email and password.

**Request:**

```json
{ "email": "alice@queue-lab.test", "password": "Demo@1234" }
```

**Response:** Same as LINE login.

---

## Public / Customer Endpoints (no auth required)

### GET /orgs/:slug

Get organization info and active queue status for a given slug.

### GET /orgs/by-token/:token

Get organization info by public QR token (stable URL for QR codes).

### GET /queue/:queueId/status

Real-time status of a queue: waiting count, ETA.

### GET /queue/current?queueId=:id

Full queue state with all waiting entries.

### GET /queue/entry/:entryId

Public ticket tracking — position, ETA, linked order details (no auth needed).

### POST /queue/join

Join a queue and receive a ticket. Optionally create an order.

**Headers:** `Idempotency-Key: <uuid>` (recommended to prevent duplicates)

**Request:**

```json
{ "queueId": "...", "lineUserId": "Uf...", "guestName": "Nguyen Van A", "notes": "..." }
```

**Response:**

```json
{
  "success": true,
  "data": {
    "entry": { "id": "...", "ticket_display": "A-003", "status": "waiting" },
    "aheadCount": 2,
    "estimatedWaitSeconds": 240,
    "isExisting": false
  }
}
```

### POST /orders

Create a new order (with products/services). Automatically creates a queue entry.

**Headers:** `Idempotency-Key: <uuid>` (recommended)

**Request:**

```json
{
  "orgSlug": "the-queue-lab",
  "customerName": "Nguyen Van A",
  "customerPhone": "0901234567",
  "items": [{ "productId": "...", "quantity": 1 }]
}
```

### GET /products?orgSlug=:slug

List active products/services for an organization.

---

## Authenticated Customer Endpoints

### GET /queue/me

All active tickets for the current user across all queues.

### GET /queue/me/penalties

Active skip/no-show penalties for the current user.

### POST /queue/:entryId/cancel

Cancel own ticket.

### POST /queue/:entryId/skip

Self-service skip (move own ticket back one position).

### POST /orders/:id/cancel

Cancel own order.

### PATCH /users/me

Update own profile (displayName, email).

---

## Staff Endpoints (role: staff or manager)

All require `Authorization: Bearer <token>` with staff/manager role.

### GET /staff/queues/:queueId

Full queue overview for staff board: waiting list, called, serving entry.

### POST /staff/queues/:queueId/call-next

Advance queue: transition next waiting entry to `called`. Sends LINE push.

### POST /staff/entries/:entryId/serve

Mark a called entry as `serving` (customer is at counter).

### POST /staff/entries/:entryId/complete

Mark a serving entry as `completed`. Writes queue_histories row.

### POST /staff/entries/:entryId/no-show

Mark called entry as `no_show`.

### POST /staff/entries/:entryId/cancel

Staff cancel of any waiting/called entry.

### GET /staff/my-queue

Enriched queue overview (with order details per entry) for the active queue of the staff's organization.

---

## Manager Endpoints (role: manager)

### GET /orgs/my-org

Get own organization details including `publicQrToken` and join URL.

### PATCH /orgs/my-org

Update organization settings.

### GET /queues

List all queues for own organization.

### POST /queues

Create a new queue.

### PATCH /queues/:id

Update queue settings.

### PATCH /queues/:id/status

Open/close/pause a queue.

### DELETE /queues/:id

Soft-delete a queue.

### GET /products?orgId=:id

List products (including inactive) for own organization.

### POST /products

Create a product/service.

### PATCH /products/:id

Update a product/service.

### DELETE /products/:id

Soft-delete a product/service.

### GET /orders

List all orders for own organization.

### GET /orders/stats

Dashboard analytics: revenue, top products, queue metrics, recent activity.

### PATCH /orders/:id/status

Update order status.

### PATCH /orders/:id/payment

Update order payment status.

### GET /users?role=staff

List staff members in own organization.

### POST /users/staff

Create a staff account and add to organization.

### PATCH /users/staff/:userId/status

Activate/deactivate a staff member.

---

## Notification Endpoints (authenticated)

### GET /notifications

Get notification history for the current user.

---

## Health & Metrics Endpoints (no auth)

### GET /health

Liveness probe — returns API, DB, scheduler, and notification service status.

**Response:**

```json
{
  "status": "ok",
  "api": "ok",
  "db": "connected",
  "scheduler": { "running": true, "registeredJobs": 4 },
  "notificationService": "configured",
  "uptime": 3600.1,
  "timestamp": "2026-06-18T10:00:00.000Z"
}
```

### GET /ready

Readiness probe — returns 200 only when DB is accepting connections.

### GET /metrics

Prometheus-formatted counters.

```
line_queue_requests_total 1234
line_queue_errors_total 2
line_queue_queue_created_total 15
line_queue_queue_served_total 87
line_queue_queue_cancelled_total 4
line_queue_notifications_sent_total 102
line_queue_notifications_failed_total 1
```

---

## Error Response Shape

All errors follow this shape:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Queue not found"
  }
}
```

Common error codes: `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `VALIDATION_ERROR`, `TOO_MANY_REQUESTS`.

---

## Rate Limits

| Limiter              | Limit          | Applied to                               |
| -------------------- | -------------- | ---------------------------------------- |
| Global API           | 200 req/15 min | All `/api/*` routes                      |
| Strict               | 20 req/min     | Auth endpoints, LINE webhook, queue join |
| Public read          | 120 req/min    | Status, ticket lookup                    |
| Public write         | 15 req/min     | Order creation                           |
| Authenticated action | 60 req/min     | Staff operations                         |
