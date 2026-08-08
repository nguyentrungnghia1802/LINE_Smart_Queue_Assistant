# Scalability Baseline and Target Architecture

Verified against the TASK-04 working tree on 2026-08-08. This document records the current runtime
boundary, a small reproducible development baseline, target SLOs, and the technical motivation for
later scaling work. It does not claim production capacity. Redis and the initial BullMQ worker are
implemented; SSE and the remaining worker migrations are staged future work.

## 1. Scope and evidence

The audit covered:

- API startup, shutdown, Express middleware, PostgreSQL pool, health, metrics, and logging;
- queue/public reads, booking/order transactions, ticket counters, staff actions, and analytics;
- ETA, warning, called-reminder, notification, email, inventory, location, forecasting, session
  cleanup, and counter-reset jobs;
- frontend customer, ticket, staff, manager, and location polling;
- PostgreSQL advisory locks, row locks, `FOR UPDATE SKIP LOCKED`, indexes, and durable outboxes;
- LINE, SMTP, Google Routes, payOS, local media, Docker Compose, Nginx, and GitHub deployment;
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
                                  |       +-> local media volume
                                  |
                                  +-> API-owned interval scheduler
                                  +-> LINE Messaging API
                                  +-> SMTP
                                  +-> Google Routes
                                  +-> payOS when configured

private Redis 7.4 -> BullMQ LINE delivery scheduler -> dedicated worker -> PostgreSQL outbox
                                                               |
                                                               +-> LINE Messaging API
```

The production Compose definition contains one API service, one dedicated worker, one Web service,
PostgreSQL, and a private Redis service. The API, worker, and Redis ports are private to the Compose
network. Only LINE notification delivery runs through BullMQ; all other scheduled work remains in
the API process. PostgreSQL remains authoritative for domain state, sessions, payment events,
notification/email outboxes, inventory reservations, and job-run health. Redis coordinates
protected rate-limit counters, two performance-only public read models, and BullMQ orchestration.
Losing Redis pauses LINE delivery but does not remove domain data or block API transactions.

The PostgreSQL pool is created once per API process with a hard-coded maximum of 20 connections in
non-test environments, an idle timeout of 30 seconds, and a connection timeout of 5 seconds. Every
additional API replica therefore adds capacity for up to 20 database connections unless this is
made configurable and bounded against the database connection budget.

## 3. Current background work

| Workload             | Default cadence | Coordination and current execution                                                                    |
| -------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| Session cleanup      | 1 hour          | Advisory lock; bounded delete of expired/revoked sessions                                             |
| ETA update           | 30 seconds      | Advisory lock; one concurrent window-function update per open queue                                   |
| ETA warning scan     | 30 seconds      | Advisory lock; global candidate scan and durable notification enqueue                                 |
| Called reminder scan | 60 seconds      | Advisory lock; recent-called scan and durable event-key deduplication                                 |
| Inventory expiry     | 60 seconds      | Advisory lock plus `SKIP LOCKED`; bounded order cancellation/release transaction                      |
| Location alerts      | 60 seconds      | Advisory lock plus `SKIP LOCKED`; sequential Google Routes calls while one DB transaction is open     |
| Location cleanup     | 1 hour          | Advisory lock; bounded location anonymization                                                         |
| LINE delivery        | 15 seconds      | BullMQ worker sweep; `SKIP LOCKED`, bounded batch retry/backoff, durable PostgreSQL sent/failed state |
| Email delivery       | 15 seconds      | `SKIP LOCKED`; sequential batch delivery when email is enabled                                        |
| Counter reset        | 1 hour          | Advisory lock; organization-timezone-aware bulk update                                                |
| Forecasting          | 1 hour          | Advisory lock; all-branch slot aggregation, current-load calculation, persistence, and expiry         |

`JobRunner` prevents overlapping cycles only inside one API process. Advisory locks provide
cross-process ownership for the named API jobs. The BullMQ worker uses one versioned deterministic
scheduler, one active sweep per worker policy, bounded retries, and graceful drain. LINE and email
delivery services rely on PostgreSQL row claims, allowing separate processes to handle different
rows safely. BullMQ job state is operational only; the PostgreSQL outbox and event key are the
delivery authority across restarts or Redis loss.

## 4. Process-local state

| State                                    | Classification                         | Multi-instance effect                                                                                               |
| ---------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Successful idempotency responses         | Correctness-sensitive request behavior | A retry routed to another instance cannot reuse the first response; durable DB constraints cover only some commands |
| Protected-write/auth rate limits         | Shared ephemeral Redis state           | Healthy replicas share counters; Redis outage uses bounded per-instance fallback with logs/metrics                  |
| Global/read rate-limit counters          | Coarse process-local protection        | Non-sensitive limits apply per instance; no domain authorization depends on them                                    |
| Legacy organization/product/queue caches | Process-local performance-only         | Replicas can serve different values until TTL/invalidation; PostgreSQL remains authoritative                        |
| Public branch/queue read models          | Shared ephemeral Redis cache           | Replicas reuse validated snapshots; misses/outage/corruption fall back to PostgreSQL                                |
| Job overlap set and timers               | Local execution control                | Advisory locks or row claims preserve covered jobs; the local set alone is not distributed                          |
| Metrics counters and gauges              | Observability-only                     | Values reset on restart and cannot be aggregated correctly across replicas                                          |
| Frontend query cache/auth timers         | Browser-local UX state                 | Does not coordinate browsers or API replicas                                                                        |

Distributed protected-write/auth rate limiting is now defined; correctness-sensitive idempotency
behavior still requires shared treatment before unrestricted horizontal API scaling. Cache
invalidation can remain best-effort only for explicitly non-authoritative reads. Domain correctness
continues to rely on PostgreSQL transactions, locks, constraints, and durable event keys rather
than Redis availability.

## 5. High-frequency read paths

| Client/read path                      | Current frequency | Server work and scale candidate                                                       |
| ------------------------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| Ticket detail                         | 15 seconds/ticket | Ticket, queue position, order, and item reads                                         |
| Customer active tickets               | 30 seconds/client | Active actor tickets plus queue/order enrichment                                      |
| Customer queue status/current         | 30 seconds/view   | Waiting counts and current queue state                                                |
| Staff queue overview                  | 10 seconds/staff  | Waiting/called/serving counts followed by entry/order enrichment                      |
| Manager branch order statistics       | 30 seconds/view   | Summary, 12-month series, top products, queue/product metrics, and best-staff queries |
| Owner branch analytics                | 60 seconds/view   | Cross-branch summaries and revenue series                                             |
| Active-location ticket/consent checks | 30/60 seconds     | Active-ticket and consent reads; snapshots can be posted at most once per minute      |
| Public QR catalog                     | on entry/refresh  | Organization, branch calendar, queue catalog, waiting counts, and products per queue  |

Polling load grows approximately with the number of open browser views, not only the number of
organizations. Candidate optimization order is: measure query plans and response reuse, remove
duplicate reads, add bounded cache where stale data is acceptable, then introduce SSE for active
ticket/staff state after a durable event publication path exists.

## 6. Query and contention candidates

These are code-review candidates, not measured production bottlenecks:

- Public QR resolution loads queue catalogs and performs per-queue waiting/product work. A branch
  with many queues can create query fan-out.
- Staff overview performs count/state reads and enriches waiting/called/serving entries with order
  data. Its 10-second polling interval makes query count and returned-list bounds important.
- Queue status enrichment asks for ahead IDs and workloads for active tickets. Large active queues
  increase sort/window and response work.
- ETA update runs one window-function update per open queue concurrently every 30 seconds. The
  statement is set-based, but total work scales with open queues and waiting entries.
- ETA warning scans rank all waiting entries by queue before filtering to the configured milestone.
- Manager statistics execute several aggregate queries in parallel, including 12 generated monthly
  buckets and product/staff summaries.
- Forecasting creates 168 weekday/hour slots for every active branch and aggregates eight weeks of
  arrivals/completions before writing a new cycle.
- Location delivery holds claimed rows and one PostgreSQL transaction while sequential external
  route estimates run, each with a 10-second timeout. This is the clearest worker-isolation and
  transaction-boundary candidate.
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

| Provider       | Current protection                                    | Capacity/availability risk                                                                         |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| LINE Messaging | Durable outbox, event key, max attempts, backoff      | Sequential batches; adapter has no request timeout; provider quota/429 handling is not specialized |
| SMTP           | Durable outbox, max attempts, backoff                 | Sequential batches; throughput and timeout behavior depend on the SMTP adapter/provider            |
| Google Routes  | 10-second request timeout, bounded location batch     | One request per claimed alert; external calls currently occur inside a DB transaction              |
| payOS          | 10-second intent timeout, signed webhook, idempotency | Intent creation is synchronous on the API request; provider quota and outage affect checkout       |
| Local media    | Size/type validation and persistent Docker volume     | Local filesystem is not a shared, horizontally scalable object store                               |

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
notification throughput, and backlog age were not measured because the repository does not yet
have a stable isolated load harness or production-like staging telemetry. Those gaps are explicit
inputs to later observability and load-test tasks.

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
latency claim; the prior 103.57 requests/second and p50/p95/p99 figures remain the only HTTP timing
baseline until an isolated repeatable load harness exists.

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

1. **Redis:** shared protected-write/auth rate-limit counters and bounded public read-model caches
   are implemented. Short-lived coordination and Pub/Sub fan-out remain later tasks. Redis failure
   must not authorize invalid domain state.
2. **BullMQ:** the versioned LINE notification-delivery sweep and dedicated worker are implemented
   with deterministic scheduling, bounded attempts/backoff, concurrency/throttling, and health
   signals. PostgreSQL outbox/event keys remain the business-delivery record. Per-notification
   dispatch and other workloads remain later tasks.
3. **Dedicated workers:** LINE delivery is isolated from HTTP serving. Email delivery,
   ETA/notification scans, location routes, inventory expiry, forecasting, session cleanup, and
   counter reset remain API-owned until separately justified and migrated. Singleton jobs retain
   distributed ownership; row workloads retain safe claims.
4. **SSE:** replace high-frequency ticket/staff polling with server-pushed state invalidation. REST
   remains the snapshot/recovery contract.
5. **Redis Pub/Sub:** propagate committed queue-change hints to SSE gateways across API replicas.
   Clients reconnect and refetch from PostgreSQL-backed REST, so Pub/Sub loss does not lose state.
6. **OpenTelemetry:** request, SQL, job, queue, and provider traces/metrics with p50/p95/p99,
   connection-pool, lock-wait, backlog-age, and scheduler-duration visibility.
7. **Sentry:** sanitized exception aggregation and release correlation for API, worker, and browser;
   it complements rather than replaces metrics/traces.
8. **S3/R2-compatible storage:** immutable shared object keys, signed/controlled upload boundary,
   CDN delivery, lifecycle policy, and removal of the local-volume horizontal scaling blocker.

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
