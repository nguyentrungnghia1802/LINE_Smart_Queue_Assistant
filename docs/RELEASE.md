# Release Notes — RC-1

**Version:** RC-1 (Release Candidate 1)
**Date:** 2026-06-18
**Branch:** `release/rc-1`

---

## Completed Features

### Core Queue Engine

- [x] Customer joins queue via QR scan or web form
- [x] Idempotency on queue join (safe for LINE retries)
- [x] Daily ticket counter with atomic increment (no duplicate ticket numbers)
- [x] Queue capacity enforcement
- [x] Priority queue support (VIP, skip penalty)
- [x] Customer self-service skip (with penalty after limit)
- [x] Real-time queue position tracking

### ETA Engine

- [x] Position-based ETA calculation (pure, O(1) per request)
- [x] Workload-aware ETA using order `service_time_minutes × quantity`
- [x] Background ETA updater (every 30s) writes `estimated_call_at` to DB
- [x] Confidence levels: HIGH / MEDIUM / LOW based on queue depth

### Order Management

- [x] Order creation with product selection (transactional with queue join)
- [x] Order status lifecycle: pending → processing → completed / cancelled
- [x] Payment status tracking: unpaid → paid
- [x] Order cancellation by customer (own orders) or staff/manager (org orders)

### Staff Dashboard

- [x] Live queue board (waiting / called / serving)
- [x] Call next ticket (with LINE push notification)
- [x] Mark serving / complete / no-show / cancel
- [x] Enriched queue view with linked order details

### Manager Dashboard

- [x] Analytics: revenue, cancellation rate, top products, daily chart
- [x] Queue depth and average ETA overview
- [x] Recent orders and queue activities
- [x] Product/service catalog CRUD
- [x] Queue CRUD with open/close/pause controls
- [x] Organization settings (name, address, payment info)
- [x] QR code display with join URL
- [x] Staff account management

### Notification Engine

- [x] "Your turn" LINE push on call-next
- [x] "Almost your turn" ETA warning (threshold: 2 positions ahead)
- [x] Re-notify scanner for missed deliveries
- [x] Anti-duplicate registry (in-memory, per process)
- [x] Graceful degradation (notification failure never blocks queue state)

### Security & Hardening

- [x] JWT authentication (HS256, configurable expiry)
- [x] RBAC enforcement (customer / staff / manager / admin)
- [x] Organization isolation (all APIs verify org membership)
- [x] Tiered rate limiting (global / strict / public-read / public-write / authenticated)
- [x] Idempotency middleware (Idempotency-Key header support)
- [x] LINE webhook HMAC-SHA256 signature verification
- [x] Helmet.js security headers
- [x] Non-root Docker user
- [x] Secrets via environment variables only

### Observability

- [x] Structured pino logging with secret redaction
- [x] Request ID tracing (X-Request-Id header)
- [x] Prometheus-format metrics endpoint (`/metrics`)
- [x] Health endpoint with DB/scheduler/notification status (`/health`, `/ready`)
- [x] Per-event metrics: requests, errors, queue ops, notifications

### Performance

- [x] Composite partial indexes on `orders`, `queue_entries`, `order_items`
- [x] N+1 fix: `findByQueueEntry` uses single JOIN query
- [x] Batch workload calculation: `batchWorkloadForEntries` replaces N serial calls
- [x] Dashboard `getStats` merged from 8 to 6 parallel queries with CTE
- [x] In-memory TTL cache for queue config and product catalog
- [x] Cache invalidation on write operations

### Infrastructure

- [x] Multi-stage Docker build (non-root runner)
- [x] Docker Compose for dev (hot-reload) and production
- [x] Health checks on all containers
- [x] Graceful shutdown (SIGTERM/SIGINT)

---

## Known Limitations

1. **LINE Notifications require real credentials**: `LINE_CHANNEL_ACCESS_TOKEN` and `LINE_CHANNEL_SECRET` must be set from LINE Developers Console. Without them, push messages are silently skipped and `notificationService: "not_configured"` appears in `/health`.

2. **In-memory rate limiting and cache**: Rate limiters and `queueConfigCache` / `productCatalogCache` are process-local. Multi-instance deployments will need Redis.

3. **In-memory notification dedup log**: `notificationLogRepository` is an in-memory Map. It is cleared on process restart (entries called while server is down may be re-notified once). Production upgrade: move to a `notification_log` DB table.

4. **No real payment integration**: Payment status (`unpaid` → `paid`) is manually updated by staff. No payment gateway is integrated.

5. **LIFF App ID required for LINE login**: `VITE_LIFF_ID` must be set for LINE LIFF authentication. Without it, only email/password login is available.

6. **Single organization per staff/manager**: A user can only belong to one organization. Multi-organization support is deferred to V2.

7. **No email/SMS notifications**: Only LINE push is implemented. Email/SMS delivery channels are defined in the schema but not yet wired.

---

## Setup Checklist

### Prerequisites

- [ ] Node.js ≥ 20 installed
- [ ] Docker and Docker Compose installed
- [ ] PostgreSQL 16 available (or use Docker)

### Configuration

- [ ] `cp .env.example .env`
- [ ] Set `DB_PASSWORD` (required for Docker)
- [ ] Set `JWT_SECRET` to a 64-byte random hex string
- [ ] Set `LINE_CHANNEL_ACCESS_TOKEN` (optional for demo without LINE push)
- [ ] Set `LINE_CHANNEL_SECRET` (required if LINE token is set)
- [ ] Set `VITE_LIFF_ID` (optional for demo without LINE login)

### Database

- [ ] Run migrations: `npm run db:migrate --workspace=apps/api`
- [ ] Run seed: `npm run db:seed --workspace=apps/api`

### Verification

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (30 suites / 278 tests)
- [ ] `npm run build --workspace=apps/web` passes
- [ ] `curl http://localhost:4000/health` returns `"status": "ok"`
- [ ] Login at `http://localhost:5173/login` with `alice@queue-lab.test` / `Demo@1234`

---

## Verification Checklist

| Check           | Command / URL                            | Expected                |
| --------------- | ---------------------------------------- | ----------------------- |
| API typecheck   | `npm run typecheck --workspace=apps/api` | 0 errors                |
| API lint        | `npm run lint --workspace=apps/api`      | 0 warnings              |
| All tests       | `npm run test`                           | 30/30 pass, 278 tests   |
| Web build       | `npm run build --workspace=apps/web`     | Build success           |
| Health probe    | `GET /health`                            | `{"status":"ok"}`       |
| Ready probe     | `GET /ready`                             | `{"status":"ready"}`    |
| Manager login   | POST /auth/login                         | JWT returned            |
| Products API    | GET /products?orgSlug=the-queue-lab      | 4 products              |
| Queue status    | GET /queue/:id/status                    | Queue open, count shown |
| Staff board     | GET /staff/my-queue                      | Entries with orders     |
| Dashboard stats | GET /orders/stats                        | Revenue, top products   |
