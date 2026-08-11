# Scalability Baseline and Target Architecture

Last consolidated on 2026-08-11 after adopting persistent VPS-local media for the current
production-oriented demo. This document records the current runtime boundary, reproducible local
evidence, target SLOs, and remaining production acceptance work. It does not claim production
capacity. Redis, bounded public caches, BullMQ LINE delivery, cross-replica SSE, optional
observability, persistent local media, and an optional S3-compatible adapter are implemented.

## 1. Scope and evidence

The audit covered:

- API startup, shutdown, Express middleware, PostgreSQL pool, health, metrics, and logging;
- queue/public reads, booking/order transactions, ticket counters, staff actions, and analytics;
- ETA, warning, called-reminder, notification, email, inventory, location, forecasting, session
  cleanup, and counter-reset jobs;
- frontend customer, ticket, staff, manager, and location polling;
- PostgreSQL advisory locks, row locks, `FOR UPDATE SKIP LOCKED`, indexes, and durable outboxes;
- LINE, SMTP, Google Routes, payOS, local/S3 media adapters, Docker Compose, Nginx, and GitHub deployment;
- process-local state that changes behavior when more than one API instance is introduced.

Primary evidence lives in:

- `apps/api/src/server.ts`, `apps/api/src/app.ts`, `apps/api/src/db/client.ts`;
- `apps/api/src/jobs`, `apps/api/src/db/repositories`, and `apps/api/src/modules`;
- `apps/web/src/hooks/useQueueEntry.ts`, `apps/web/src/hooks/useStaffQueue.ts`, manager/staff pages,
  and `apps/web/src/components/liff/ActiveLocationTracker.tsx`;
- `db/migrations/node-pg-migrate`, Compose files, Dockerfiles, Nginx configuration, and workflows.

## 2. Current runtime topology

```text
LINE / browser
       |
host TLS proxy -> web Nginx -> Express API process -> PostgreSQL 16
                                  |       |
                                  |       +-> VPS media_data volume (current demo)
                                  |       +-> S3-compatible provider (optional/future)
                                  |
                                  +-> API-owned interval scheduler
                                  +-> LINE Messaging API
                                  +-> SMTP
                                  +-> Google Routes
                                  +-> payOS when configured

PostgreSQL outbox -> dispatcher -> private Redis/BullMQ -> dedicated LINE worker
                                                               |
                                                               +-> LINE Messaging API -> PostgreSQL outcome
```

The production Compose definition contains one API service, one dedicated worker, one Web service,
PostgreSQL, and a private Redis service. The API, worker, and Redis ports are private to the Compose
network. The current production-oriented VPS demo mounts the named `media_data` volume at
`/app/var/media` on the API; it survives container recreation but is neither shared multi-host nor
high-availability storage. S3-compatible media remains an optional future/external provider. Only LINE notification
delivery runs through BullMQ; all other scheduled work remains in
the API process. PostgreSQL remains authoritative for domain state, sessions, payment events,
notification/email outboxes, inventory reservations, and job-run health. Redis coordinates
protected rate-limit counters, two performance-only public read models, and BullMQ orchestration.
Losing Redis pauses LINE delivery but does not remove domain data or block API transactions.

The PostgreSQL pool is created once per API/worker process. `DB_POOL_MAX`,
`DB_POOL_IDLE_TIMEOUT_MS`, and `DB_POOL_CONNECTION_TIMEOUT_MS` configure its maximum, idle timeout,
and connection timeout. Every replica adds its configured maximum to the aggregate budget; staging
must leave explicit database headroom for migrations, administration, and recovery.

## 3. Current background work

| Workload             | Default cadence | Coordination and current execution                                                                         |
| -------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| Session cleanup      | 1 hour          | Advisory lock; bounded delete of expired/revoked sessions                                                  |
| ETA update           | 30 seconds      | Advisory lock; one concurrent window-function update per open queue                                        |
| ETA warning scan     | 30 seconds      | Advisory lock; global candidate scan and durable notification enqueue                                      |
| Called reminder scan | 60 seconds      | Advisory lock; recent-called scan and durable event-key deduplication                                      |
| Inventory expiry     | 60 seconds      | Advisory lock plus `SKIP LOCKED`; bounded order cancellation/release transaction                           |
| Location alerts      | 60 seconds      | Advisory cycle lock plus recoverable row leases; sequential Google Routes calls occur outside transactions |
| Location cleanup     | 1 hour          | Advisory lock; bounded location anonymization                                                              |
| LINE dispatch        | 15 seconds      | `SKIP LOCKED` committed-row claims and deterministic per-notification BullMQ jobs                          |
| LINE delivery        | Event-driven    | Bounded provider-aware retry/backoff and durable PostgreSQL sent/failed state                              |
| Email delivery       | 15 seconds      | `SKIP LOCKED`; sequential batch delivery when email is enabled                                             |
| Counter reset        | 1 hour          | Advisory lock; organization-timezone-aware bulk update                                                     |
| Forecasting          | 1 hour          | Advisory lock; all-branch slot aggregation, current-load calculation, persistence, and expiry              |

`JobRunner` prevents overlapping cycles only inside one API process. Advisory locks provide
cross-process ownership for the named API jobs. The BullMQ worker uses one versioned deterministic
dispatcher scheduler and one deterministic delivery job per outbox row. Delivery attempts are
bounded, jittered, provider-aware, throttled, and drained gracefully. The PostgreSQL outbox and
event key remain the delivery authority; Redis outages leave rows undispatched and recoverable.

## 4. Process-local state

| State                                    | Classification                             | Multi-instance effect                                                                                                                  |
| ---------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Successful idempotency responses         | Process-local response-replay optimization | A retry on another replica may recompute/read the result; PostgreSQL constraints and transaction locks remain the correctness boundary |
| Protected-write/auth rate limits         | Shared ephemeral Redis state               | Healthy replicas share counters; Redis outage uses bounded per-instance fallback with logs/metrics                                     |
| Global/read rate-limit counters          | Coarse process-local protection            | Non-sensitive limits apply per instance; no domain authorization depends on them                                                       |
| Legacy organization/product/queue caches | Process-local performance-only             | Replicas can serve different values until TTL/invalidation; PostgreSQL remains authoritative                                           |
| Public branch/queue read models          | Shared ephemeral Redis cache               | Replicas reuse validated snapshots; misses/outage/corruption fall back to PostgreSQL                                                   |
| Job overlap set and timers               | Local execution control                    | Advisory locks or row claims preserve covered jobs; the local set alone is not distributed                                             |
| Metrics counters and gauges              | Observability-only                         | Values reset on restart and cannot be aggregated correctly across replicas                                                             |
| Frontend query cache/auth timers         | Browser-local UX state                     | Does not coordinate browsers or API replicas                                                                                           |

Distributed protected-write/auth rate limiting is now defined. Cross-replica response replay can
still be improved, but it is not the business correctness boundary for validated writes. Cache
invalidation can remain best-effort only for explicitly non-authoritative reads. Domain correctness
continues to rely on PostgreSQL transactions, locks, constraints, and durable event keys rather
than Redis availability.

## 5. High-frequency read paths

| Client/read path                      | Current frequency         | Server work and scale candidate                                                                     |
| ------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| Ticket detail                         | SSE plus degraded polling | Ticket, queue position, order, and item reads                                                       |
| Customer active tickets               | 30 seconds/client         | Active actor tickets plus queue/order enrichment                                                    |
| Customer queue status/current         | 30 seconds/view           | Waiting counts and current queue state                                                              |
| Staff queue overview                  | SSE plus degraded polling | One batch live-count query, one bounded selected-queue preview, and one batch order/item enrichment |
| Manager branch order statistics       | 30 seconds/view           | Summary, 12-month series, top products, queue/product metrics, and best-staff queries               |
| Owner branch analytics                | 60 seconds/view           | Cross-branch summaries and revenue series                                                           |
| Active-location ticket/consent checks | 30/60 seconds             | Active-ticket and consent reads; snapshots can be posted at most once per minute                    |
| Public QR catalog                     | on entry/refresh          | Organization, branch calendar, queue catalog, waiting counts, and products per queue                |

Fallback polling load grows approximately with the number of open browser views, not only the
number of organizations. Active ticket and Staff views now use SSE invalidation with authoritative
REST reconciliation; polling remains the recovery path. Continue measuring query plans and
response reuse before adding cache to any additional route.

## 6. Query and contention candidates

These are code-review candidates, not measured production bottlenecks:

- Public QR resolution loads queue catalogs and performs per-queue waiting/product work. A branch
  with many queues can create query fan-out.
- Staff overview now selects from batch live counts, loads only the selected queue's maximum
  eight-entry combined preview, and enriches all preview orders/items in one query. Its degraded
  polling interval still makes the constant six-repository-read shape worth monitoring.
- Queue status enrichment asks for ahead IDs and workloads for active tickets. Large active queues
  increase sort/window and response work.
- ETA update runs one window-function update per open queue concurrently every 30 seconds. The
  statement is set-based, but total work scales with open queues and waiting entries.
- ETA warning scans rank all waiting entries by queue before filtering to the configured milestone.
- Manager statistics execute several aggregate queries in parallel, including 12 generated monthly
  buckets and product/staff summaries.
- Forecasting creates 168 weekday/hour slots for every active branch and aggregates eight weeks of
  arrivals/completions before writing a new cycle.
- Location delivery atomically leases due rows, commits, performs sequential external route
  estimates, and opens only short per-result finalization transactions. The claim timeout is
  recoverable and configurable; provider quota/latency remains the worker-isolation candidate.
- Inventory expiry processes a bounded batch sequentially in one transaction. Batch duration and
  row-lock wait must be measured before increasing its limit.

Existing indexes cover common queue status/order, outbox due, inventory expiry, location due,
forecast slot, and session-expiry paths. Every future query change still requires `EXPLAIN
(ANALYZE, BUFFERS)` against representative row counts; index presence alone is not evidence of an
acceptable plan.

## 7. Concurrency controls already in place

Correctness-critical transaction controls include:

- queue row locks for ticket counter allocation and daily ticket-code uniqueness;
- organization/order advisory transaction locks for active booking-group/order merging;
- order, queue-entry, payment, and inventory row locks for state transitions;
- unique notification/email event keys and provider webhook idempotency records;
- `FOR UPDATE SKIP LOCKED` claims for LINE/email outboxes, inventory expiry, and location alerts;
- session-level advisory job locks with `scheduler_job_runs` status for singleton logical jobs.

Advisory-locked jobs hold a dedicated pool client for the entire job. Concurrent long-running jobs
therefore consume pool capacity even when their inner query is idle or waiting on external work.

## 8. External provider boundaries

| Provider        | Current protection                                                                       | Capacity/availability risk                                                                             |
| --------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| LINE Messaging  | Durable outbox, bounded timeout, provider-aware retry/backoff and retry key              | Real quota/account/device acceptance remains external                                                  |
| SMTP            | Durable outbox, max attempts, backoff                                                    | Sequential batches; throughput and timeout behavior depend on the SMTP adapter/provider                |
| Google Routes   | 10-second request timeout, bounded location batch                                        | One request per claimed alert; external calls currently occur inside a DB transaction                  |
| payOS           | 10-second intent timeout, signed webhook, idempotency                                    | Intent creation is synchronous on the API request; provider quota and outage affect checkout           |
| VPS local media | Server validation/compression, non-root API writes, named-volume mount and recreate test | Single-host capacity, off-host backup/restore, scanning, and recovery acceptance remain operational    |
| S3/R2 media     | Retained bounded adapter, stable object key and failure tests; disabled by default       | Credentials, lifecycle, CDN, scanning, migration, and recovery acceptance are required before enabling |

Provider rate limits and quotas must be read from the contracted provider account before setting
worker concurrency. Retry logic must respect provider retry guidance and jitter; blindly increasing
parallelism can worsen throttling.

## 9. Representative scale scenarios

The numbers below define repeatable test shapes, not supported production limits.

### Scenario A: normal traffic

- 25 organizations, 2 branches each, 2 open queues per branch;
- 500 active tickets, 100 staff sessions, 1,000 customer sessions;
- 20 booking writes/minute, 40 staff transitions/minute, and 10 notification intents/minute;
- run for 30 minutes with normal frontend polling and one provider-mock worker.

### Scenario B: booking burst

- one popular branch with 4 queues and finite-stock products;
- ramp 0 to 100 concurrent customers in 30 seconds;
- 300 booking attempts over 5 minutes, including duplicate idempotency keys and stock contention;
- verify no oversell, duplicate active order/ticket, counter collision, or consumed invalid payment.

### Scenario C: large active queue population

- 100 open queues, 200 waiting tickets per queue, 20,000 active tickets total;
- 2,000 ticket views polling at the current 15-second interval and 200 staff views at 10 seconds;
- run ETA update/warning scans concurrently with staff transitions for 30 minutes;
- capture query plans, pool saturation, job duration, freshness, and lock waits.

### Scenario D: notification provider slowdown

- enqueue 20 notification intents/second for 10 minutes;
- provider mock returns 2-second latency, then 429/5xx for 5 minutes, then recovers;
- run at least two delivery workers to verify row-claim safety;
- measure backlog age, retry distribution, sent duplication, database connections, and recovery time.

All scenarios require isolated staging data, deterministic provider mocks, and cleanup. They must
not run against production tenants or real LINE recipients.

## 10. Measured development baseline

One small warm-read baseline was captured on 2026-08-08. It is evidence that the harness path
works, not a production capacity claim.

| Property               | Value                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Runtime                | One Node 20 Alpine API container and one PostgreSQL 16 Alpine container            |
| Data                   | E2E fixture: 1 organization, 1 branch, 1 open queue, 3 waiting tickets, 7 products |
| Request                | `GET /api/v1/orgs/by-token/demo-queue-lab-2026`                                    |
| Sample                 | 100 requests, concurrency 10, warm application/catalog path                        |
| Throughput             | 103.57 requests/second                                                             |
| Latency                | p50 72.61 ms; p95 209.81 ms; p99 245.42 ms                                         |
| Errors                 | 0/100                                                                              |
| API pool configuration | Maximum 20 connections; actual peak was not captured                               |

The run included Docker Desktop and host-to-container networking, so results are workstation- and
environment-specific. Database CPU/IO, scheduler duration, booking throughput, active-user limit,
and provider capacity were not measured in this first baseline.

### TASK-03 read-amplification comparison

The selected cache paths were compared with the baseline query shape using deterministic loader
tests. A repeated valid cache key invokes its PostgreSQL loader once rather than once per request;
TTL expiry, explicit invalidation, corrupt data, or Redis outage invokes the loader again safely.

For the measured one-queue public QR fixture, an uncached branch-token request executes the token
and base-organization resolution plus localized organization, branch-open, active-queue, waiting,
and queue-product reads (seven repository reads). A warm branch read-model hit retains only token
and base-organization resolution (two repository reads), a 5/7 or approximately 71% reduction in
database reads on that path. Each additional queue avoids two more fan-out reads. A warm public
queue-summary hit removes its waiting-count query while queue configuration remains separately
bounded by its existing configuration cache. This is query-count evidence, not a new production
latency claim; TASK-11 provides the separate integrated HTTP timing below.

### OPT-002 Staff and location measurements

On 2026-08-11, OPT-002 audited the current Docker PostgreSQL 16 development fixture (one
organization, two branches, two queues, eight entries/orders). Additional waiting entries and
location alerts were inserted only inside explicit measurement transactions and rolled back. The
commands used `EXPLAIN (ANALYZE, BUFFERS)`; values are workstation evidence, not production limits.

| Measured shape                                                  | Plan/result                                                                                    |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Batch live counts for two queues and 1,005 live entries         | 0.372 ms; one grouped scan; 15 shared-buffer hits                                              |
| Selected-queue preview from 1,004 waiting entries, `LIMIT 8`    | 0.061 ms; `idx_qe_queue_status_ticket` index scan; 3 shared-buffer hits                        |
| Batch order/item/LINE-name enrichment for eight fixture entries | 4.140 ms; indexed item/product/LINE joins; 87 shared-buffer hits plus 4 reads                  |
| Atomic location claim from 1,000 due rows, `LIMIT 50`           | 10.751 ms including updates, triggers, and FK checks; existing due index selected pending rows |

Before the Staff change, the maximum two-queue/eight-entry overview shape made 21 cold repository
reads (`1 + 6Q + E`), or 19 when both queue-config reads hit the local cache. The revised path makes
six repository reads independent of queue/preview count: scoped queues, batch live counts, waiting
preview, called entry, serving entry, and batch orders. This is a 71% cold-shape reduction (68% with
warm queue config), enforced by service/repository tests; it is query-count evidence rather than an
HTTP latency multiplier.

The location plan was already acceptable for the bounded local shape, so no speculative index or
migration was added. The material improvement is the transaction boundary: claim rows atomically,
commit, perform each travel-provider call, and then open a short transaction for durable
notification enqueue plus claim finalization. A 900-second default recoverable lease covers the
configured sequential batch and 10-second provider timeout. Deterministic tests verify provider I/O
occurs before the finalization transaction and that stale-claim timestamps guard completion.

### TASK-11 integrated local validation

On 2026-08-09, `npm run scale:validate` ran nginx -> two API replicas -> shared PostgreSQL/Redis
with a dedicated BullMQ worker. Providers were mock/disabled and the database used the explicit E2E
fixture. The public branch read run produced:

| Property    | TASK-01 baseline | TASK-11 local run |
| ----------- | ---------------- | ----------------- |
| Requests    | 100              | 160               |
| Concurrency | 10               | 10                |
| Throughput  | 103.57 req/s     | 210.75 req/s      |
| p50         | 72.61 ms         | 41.69 ms          |
| p95         | 209.81 ms        | 78.49 ms          |
| p99         | 245.42 ms        | 168.50 ms         |
| Errors      | 0                | 0                 |

Both API upstreams served requests. The direction is favorable and consistent with the measured
71% warm-cache query reduction, but it is not a controlled production benchmark: the harness,
runtime state, cache, topology, and sample count differ from TASK-01. It must not be presented as a
production capacity multiplier.

The same run established these failure/recovery facts:

| Injection/verification               | Customer/staff impact                                                | Business truth and recovery                                         | Operator evidence/action                             |
| ------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Cache deletion                       | Next read may be slower                                              | PostgreSQL fallback returned `200`                                  | Cache miss/error metrics; no action unless sustained |
| Redis stop/restart                   | Reads stayed available; realtime/limits degraded per fallback policy | PostgreSQL state remained intact; cache/Pub/Sub reconnected         | Redis health/reconnect metrics; restore promptly     |
| Worker stop/restart                  | LINE delivery delayed                                                | Outbox row remained pending and became `sent` after worker recovery | Backlog age/depth and worker heartbeat               |
| Cross-instance SSE                   | No visible loss in tested transition                                 | API 2 commit reached a client on API 1; REST remained authoritative | SSE/Pub/Sub metrics and reconnect logs               |
| API 1 restart                        | Gateway continued through API 2                                      | Restarted replica recovered REST service                            | Per-replica health and gateway upstream headers      |
| PostgreSQL stop/restart              | API readiness returned `503`; domain requests unavailable            | No reset/corruption; readiness recovered after restart              | Database health, pool, and recovery runbook          |
| LINE timeout/429/5xx                 | Notification delayed, business transition succeeds                   | Durable bounded retry/final state in PostgreSQL                     | Provider/error/retry metrics and sanitized logs      |
| Local volume recreate                | Second non-root API container reads the first container's probe file | Named volume retains bytes outside the container writable layer     | Preserve mount/name; restore from volume backup      |
| S3 timeout/credentials/upload/delete | Optional media action fails safely when that provider is selected    | No domain authorization bypass; retry/reconciliation path retained  | Adapter errors/metrics; fix credentials/provider     |
| OTel/Sentry outage                   | No customer/staff business interruption                              | Fail-open instrumentation; domain transaction unchanged             | Local logs, exporter/Sentry diagnostics              |

TASK-PROD-004 repeated the isolated recovery rehearsal on 2026-08-11 after adding a post-lock
active-ticket recheck for direct queue joins. All topology checks passed: both API replicas served
authenticated traffic; 160 public reads at concurrency 10 returned `200` with zero errors; Redis
stop/start preserved public and authenticated reads; a pending LINE row became `sent` after worker
startup; cross-replica SSE delivered the tested transition; API restart recovered REST with `200`;
and PostgreSQL interruption produced readiness `503` before recovery. The harness now executes
Docker directly rather than through a platform shell, preserving `psql -tAc` SQL arguments on both
Windows and Linux. These results verify recovery behavior only and do not revise capacity limits.

The run observed two PostgreSQL connections with no waiting clients after recovery; API pools were
capped at five per process. API memory snapshots were about 89.77 MiB and 57.35 MiB, worker memory
59.55 MiB; CPU snapshots were below 0.1% for APIs and the active worker. The oldest
active notification was five seconds. These point-in-time Docker statistics are diagnostic only,
not capacity limits. API 1 metrics reset on its intentional restart, demonstrating why production
metrics must be scraped and aggregated externally.

OPT-002 reran the unchanged isolated topology after the Staff/location changes. All recovery checks
passed again. The public control path returned 160/160 responses with no errors through both API
upstreams at 380.06 req/s, with p50 23.27 ms, p95 44.39 ms, and p99 94.38 ms. PostgreSQL reported
two connections and no waiting pool clients in the captured API metrics. This fresh run establishes
non-regression and fallback behavior on the current workstation; because the changed Staff endpoint
requires authenticated interactive traffic, its improvement claim remains the deterministic query
count and PostgreSQL plan evidence above, not the unrelated public-route latency.

## 11. Target SLOs

These are initial engineering targets to validate in staging and revise with business traffic.

| Surface                        | Initial target                                                               |
| ------------------------------ | ---------------------------------------------------------------------------- |
| Queue/public read              | p95 <= 300 ms, p99 <= 750 ms                                                 |
| Booking transaction            | p95 <= 1.0 s, p99 <= 2.5 s, excluding customer time on external checkout     |
| Staff state transition         | p95 <= 500 ms, p99 <= 1.0 s                                                  |
| Customer queue-state freshness | 95% within 15 seconds; 99% within 30 seconds                                 |
| Staff queue-state freshness    | 95% within 5 seconds after SSE; current polling baseline is up to 10 seconds |
| LINE delivery when healthy     | 95% enqueue-to-sent <= 30 seconds; 99% <= 120 seconds                        |
| Notification backlog           | Oldest due pending row < 5 minutes during healthy provider operation         |
| API server error rate          | < 1% over 5 minutes, excluding validated 4xx/client errors                   |
| Service availability           | 99.9% monthly for authenticated/public API and booking entry                 |

Alerts need both short burn-rate and sustained windows. No SLO is considered enforced until
latency histograms, request/error dimensions, pool metrics, and external-provider telemetry are
exported to a durable monitoring system.

## 12. Target architecture and staged motivation

PostgreSQL remains the source of truth throughout the target evolution.

1. **Redis:** shared protected-write/auth rate-limit counters, bounded public read-model caches, and
   transient Pub/Sub fan-out are implemented. Redis failure must not authorize invalid domain state.
2. **BullMQ:** the versioned PostgreSQL dispatcher and per-notification LINE worker are implemented
   with deterministic jobs, crash-safe redispatch, bounded provider-aware attempts/backoff,
   concurrency/throttling, backlog metrics, and health signals. PostgreSQL outbox/event keys remain
   the business-delivery record. Other workloads remain later tasks.
3. **Dedicated workers:** LINE delivery is isolated from HTTP serving. Email delivery,
   ETA/notification scans, location routes, inventory expiry, forecasting, session cleanup, and
   counter reset remain API-owned until separately justified and migrated. Singleton jobs retain
   distributed ownership; row workloads retain safe claims.
4. **SSE and Redis Pub/Sub:** active ticket/Staff views use transient cross-replica invalidation;
   clients reconnect and refetch PostgreSQL-backed REST, so event loss does not lose state.
5. **OpenTelemetry and Sentry:** optional sanitized tracing/error boundaries are implemented and
   fail open. Production exporters, dashboards, alerts, and release correlation remain deployment work.
6. **Media storage:** the current VPS demo uses a persistent named volume with a fixed non-root API
   mount and recreate validation. The S3/R2 server-mediated adapter remains implemented for a later
   external/multi-host migration. Off-host volume backup/restore, scanning, and any future
   bucket/CDN lifecycle and migration acceptance remain operational work.

The modular monolith remains one codebase. API and worker processes should reuse the existing
services/repositories and be separated by entry point and deployment role, not duplicated business
logic or premature microservices.

## 13. Exit conditions for later tasks

Later scaling tasks have clear motivation only when they preserve these rules:

- add shared infrastructure for a documented process-local or measured workload problem;
- keep domain writes transactional in PostgreSQL;
- retain idempotency, event keys, row claims, and tenant boundaries;
- add failure-mode tests before increasing concurrency;
- compare staging measurements with this baseline and the target SLOs;
- update this document with measured results rather than replacing evidence with estimates.
