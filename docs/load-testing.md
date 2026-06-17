# Load Testing Guide

This document describes load test scenarios, targets, tooling, and sample scripts for LINE Smart Queue Assistant.

---

## 1. Objectives

Validate that the system can handle expected concurrent load without:

- Response time degrading beyond acceptable thresholds.
- Database connection pool exhaustion.
- Notification delivery falling behind.
- Queue ticket numbers becoming non-unique.

---

## 2. Target Environment

Run load tests against a **staging** environment that mirrors the production configuration:

- Single API container (`docker-compose.yml`, `runner` stage)
- PostgreSQL 16 with the same indexes as production
- `NODE_ENV=production`

Do **not** run against production.

---

## 3. Tooling

### Recommended: k6

[k6](https://k6.io) is the preferred tool — it runs in a single binary, handles concurrent VUs natively, and exports Prometheus-compatible metrics.

```bash
# macOS
brew install k6

# Windows (via Chocolatey)
choco install k6

# Docker
docker pull grafana/k6
```

### Alternative: autocannon (Node.js)

```bash
npm install -g autocannon
```

---

## 4. Scenarios

### Scenario 1 — 100 Concurrent Customers Join Queue

**Goal**: Baseline throughput and latency.

| Metric                 | Target   |
| ---------------------- | -------- |
| p50 latency            | < 100 ms |
| p99 latency            | < 500 ms |
| Error rate             | 0%       |
| DB connections at peak | < 20     |

**k6 script** (`scripts/load-test-100.js`):

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const QUEUE_ID = __ENV.QUEUE_ID || 'replace-with-real-queue-id';

export const options = {
  vus: 100,
  duration: '60s',
};

export default function () {
  const payload = JSON.stringify({ queueId: QUEUE_ID, guestName: `Guest-${__VU}` });
  const res = http.post(`${BASE_URL}/api/v1/queue/join`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 201 or 200': (r) => r.status === 201 || r.status === 200,
    'has ticket_display': (r) => {
      const body = JSON.parse(r.body);
      return body.data?.entry?.ticket_display != null;
    },
  });

  sleep(0.5);
}
```

---

### Scenario 2 — 500 Concurrent Customers Join Queue

**Goal**: Validate DB lock contention on `daily_ticket_counter` under medium load.

| Metric                   | Target     |
| ------------------------ | ---------- |
| p50 latency              | < 200 ms   |
| p99 latency              | < 1 000 ms |
| Error rate               | < 0.1%     |
| Ticket number uniqueness | 100%       |

**k6 options** (same script as Scenario 1, change options):

```js
export const options = {
  stages: [
    { duration: '30s', target: 500 }, // ramp up
    { duration: '60s', target: 500 }, // sustained
    { duration: '15s', target: 0 }, // ramp down
  ],
};
```

**Post-test check** — verify no duplicate ticket numbers:

```sql
SELECT queue_id, ticket_number, COUNT(*)
FROM queue_entries
GROUP BY queue_id, ticket_number
HAVING COUNT(*) > 1;
```

Expected: zero rows.

---

### Scenario 3 — 1 000 Concurrent Customers Join Queue

**Goal**: Identify hard limits and bottlenecks before scaling.

| Metric             | Acceptable                   |
| ------------------ | ---------------------------- |
| p50 latency        | < 500 ms                     |
| p99 latency        | < 3 000 ms                   |
| Error rate         | < 1%                         |
| DB connection pool | Monitor, should not saturate |

**k6 options**:

```js
export const options = {
  stages: [
    { duration: '60s', target: 1000 },
    { duration: '120s', target: 1000 },
    { duration: '30s', target: 0 },
  ],
};
```

**Expected bottlenecks at this scale**:

- PostgreSQL connection pool (default `max=20` in node-pg). Increase to 50 before this test.
- `daily_ticket_counter` row-level lock on the queues table — consider sharding queues if a single org needs > 1 000 joins/min.

---

## 5. Monitoring During Load Tests

Run these queries against the database during the test:

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Long-running queries (> 500 ms)
SELECT pid, state, query_start, query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '500 milliseconds';

-- Locks
SELECT relation::regclass, mode, granted
FROM pg_locks
WHERE NOT granted;

-- Index usage on hot tables
SELECT relname, idx_scan, seq_scan
FROM pg_stat_user_tables
WHERE relname IN ('queue_entries', 'orders', 'order_items', 'queues');
```

---

## 6. Scalability Assessment

### At 100 organizations, 10 000 users, 50 000 orders, 100 000 queue entries

| Resource                                         | Current limit                                 | Risk                                        |
| ------------------------------------------------ | --------------------------------------------- | ------------------------------------------- |
| PostgreSQL single node                           | ~10 000 writes/s                              | **Low** at this scale                       |
| `queue_entries` index scans                      | Covered by partial indexes                    | **Low**                                     |
| `orders` aggregation for dashboard               | Covered by new composite indexes              | **Low**                                     |
| In-memory caches (queue config, product catalog) | Per-process, lost on restart                  | **Medium** — acceptable for single-instance |
| Notification log (in-memory Map)                 | Bounded by active tickets                     | **Low**                                     |
| Node.js event loop                               | Single-threaded; CPU-bound ETA is synchronous | **Low** — ETA is O(1) per request           |

### Bottlenecks to address before scaling beyond one instance

1. **Queue ticket counter** — `UPDATE queues SET daily_ticket_counter = counter + 1` serialises all joins for a queue. If a single queue needs > 500 joins/minute, introduce a Postgres sequence or advisory lock partition.

2. **Notification log** — In-memory Map is not shared across replicas. If horizontal scaling is required, move to a Redis-backed implementation of `INotificationLogRepository`.

3. **In-process caches** — `queueConfigCache` and `productCatalogCache` are per-instance. Cache invalidation across replicas requires a pub/sub mechanism (Redis, pg_notify). Until then, TTLs provide eventual consistency.

4. **Dashboard `getStats`** — The merged CTE query still scans the full `orders` table for the summary. For orgs with > 50 000 orders, add a materialized summary table updated on order close.

---

## 7. Running with Docker

```bash
# Start staging stack
docker compose up -d

# Wait for healthy
docker compose ps

# Run Scenario 1 with k6 via Docker
docker run --rm --network host grafana/k6 run \
  -e BASE_URL=http://localhost:4000 \
  -e QUEUE_ID=<your-queue-id> \
  - < scripts/load-test-100.js
```

---

## 8. Interpreting Results

| Result                    | Action                                             |
| ------------------------- | -------------------------------------------------- |
| p99 > 3 s with 500 VUs    | Investigate DB slow query log                      |
| Error rate > 1%           | Check API logs for 429 / 503                       |
| Duplicate ticket numbers  | Inspect `daily_ticket_counter` increment atomicity |
| DB connections > pool max | Increase `DATABASE_POOL_MAX` env var               |
