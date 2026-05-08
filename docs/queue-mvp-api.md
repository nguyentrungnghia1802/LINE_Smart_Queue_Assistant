# Queue MVP API — Request Examples

Base URL: `http://localhost:4000`  
API prefix: `/api/v1/queue`

---

## Authentication

Most write operations accept an optional `Authorization: Bearer <token>` header.
Anonymous customers (LINE LIFF users without a backend session) can use `lineUserId` in the request body instead.

Issue a token via `POST /api/v1/auth/line` or use the test helper in the
`signToken` utility during development.

---

## POST /api/v1/queue/join

Join a queue and receive a numbered ticket. Returns **201** for a new ticket and **200** when the caller already has an active ticket (idempotent).

### Authenticated user

```bash
curl -X POST http://localhost:4000/api/v1/queue/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{
    "queueId": "123e4567-e89b-12d3-a456-426614174001"
  }'
```

### Anonymous LINE user (LIFF)

```bash
curl -X POST http://localhost:4000/api/v1/queue/join \
  -H "Content-Type: application/json" \
  -d '{
    "queueId": "123e4567-e89b-12d3-a456-426614174001",
    "lineUserId": "Uf0000000000000000000000000000001",
    "notes": "Window seat preferred"
  }'
```

### Success response — new ticket (201)

```json
{
  "success": true,
  "data": {
    "entry": {
      "id": "entry-uuid",
      "queue_id": "123e4567-e89b-12d3-a456-426614174001",
      "ticket_number": 7,
      "ticket_display": "A007",
      "status": "waiting",
      "skip_count": 0,
      "priority": 0,
      "created_at": "2025-01-15T09:00:00.000Z"
    },
    "aheadCount": 6,
    "estimatedWaitSeconds": 720,
    "isExisting": false
  }
}
```

### Success response — existing ticket (200)

Same shape as above but `isExisting: true`. Safe to retry on network failures.

### Business errors

| Status | `error.code`       | Cause                                         |
| ------ | ------------------ | --------------------------------------------- |
| 404    | `NOT_FOUND`        | `queueId` does not exist                      |
| 409    | `CONFLICT`         | Queue is not `open` (e.g. `closed`, `paused`) |
| 409    | `CONFLICT`         | Queue is at full capacity                     |
| 422    | `VALIDATION_ERROR` | `queueId` missing or not a UUID               |

---

## GET /api/v1/queue/me

Returns all active tickets the caller holds across all queues, each annotated with current position and ETA.

```bash
curl http://localhost:4000/api/v1/queue/me \
  -H "Authorization: Bearer <jwt_token>"
```

### Success response (200)

```json
{
  "success": true,
  "data": [
    {
      "entry": {
        "id": "entry-uuid",
        "queue_id": "123e4567-e89b-12d3-a456-426614174001",
        "ticket_display": "A007",
        "status": "waiting"
      },
      "aheadCount": 6,
      "estimatedWaitSeconds": 720
    }
  ]
}
```

Returns an **empty array** when the caller has no active tickets — never 404.  
Anonymous callers (no auth header) also receive 200 with an empty array.

---

## GET /api/v1/queue/:queueId/status

Real-time status of a queue. **Public endpoint — no authentication required.**

```bash
curl http://localhost:4000/api/v1/queue/123e4567-e89b-12d3-a456-426614174001/status
```

### Success response (200)

```json
{
  "success": true,
  "data": {
    "queue": {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "name": "Counter A",
      "status": "open",
      "avg_service_seconds": 120,
      "prefix": "A"
    },
    "waitingCount": 8,
    "estimatedWaitSeconds": 960
  }
}
```

`estimatedWaitSeconds` uses the ETA service: `waitingCount × avg_service_seconds`. Falls back to 120 s/ticket if `avg_service_seconds` is not configured.

### Errors

| Status | `error.code`       | Cause                              |
| ------ | ------------------ | ---------------------------------- |
| 404    | `NOT_FOUND`        | Queue does not exist               |
| 422    | `VALIDATION_ERROR` | `queueId` path param is not a UUID |

---

## GET /api/v1/queue/current?queueId=&lt;uuid&gt;

Same as `/:queueId/status` but accepts the queue ID as a **query parameter** instead of a path segment. Used for lightweight link sharing and QR-code URLs. **Public.**

```bash
curl "http://localhost:4000/api/v1/queue/current?queueId=123e4567-e89b-12d3-a456-426614174001"
```

### Success response (200)

Identical shape to `/:queueId/status`.

### Errors

| Status | `error.code`       | Cause                           |
| ------ | ------------------ | ------------------------------- |
| 404    | `NOT_FOUND`        | Queue does not exist            |
| 422    | `VALIDATION_ERROR` | `queueId` missing or not a UUID |

---

## Standard error envelope

All error responses share the same shape regardless of type:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Queue not found",
    "details": { "fieldErrors": {} }
  }
}
```

`details` is only included for **422** (field-level validation errors) and in **development mode** for 500s.

---

## ETA semantics

| Field                        | Description                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `estimatedWaitSeconds`       | `aheadCount × effectiveAvgServiceSeconds` (raw seconds)                                 |
| `effectiveAvgServiceSeconds` | `queue.avg_service_seconds` when > 0; otherwise falls back to **120 s** (2 min default) |

MVP assumptions: single server per queue, FIFO order, no adjustment for paused state or no-shows ahead.
See `apps/api/src/modules/eta/eta.types.ts` for the full list of documented assumptions.
