# LINE Smart Queue Assistant — Scalability & Production Engineering Tasks

> **Purpose:** Incrementally evolve the current LINE Smart Queue Assistant modular monolith toward a production-oriented architecture capable of supporting substantially higher concurrent traffic while preserving correctness, tenant isolation, and operational simplicity.
>
> **Primary execution rules:** `docs/agent/AGENTS.md`
>
> **Canonical context:** `docs/project/00_PROJECT_CONTEXT.md` through
> `docs/project/11_SCALABILITY_BASELINE.md`
>
> **Execution model:** One task at a time. Do not automatically continue to the next task.

---

# 0. How to use this file

This file defines the implementation sequence for the scalability and production-engineering initiative.

It does **not** replace:

- `AGENTS.md`;
- canonical project documentation;
- database migrations;
- runtime source code;
- automated tests.

For every task, the coding agent must:

1. Read `AGENTS.md` first and follow it for the entire task.
2. Read the complete task and its parent phase.
3. Load only the canonical docs, source files, tests, migrations, configuration, Docker/CI/deployment files relevant to the task.
4. Inspect the current implementation before editing.
5. Verify assumptions against code/tests/migrations instead of implementing from this plan blindly.
6. Report any conflict between this file, canonical docs, and runtime behavior.
7. Implement only the requested task.
8. Do not automatically continue to the next task.
9. Add/update relevant tests and failure-path coverage.
10. Update affected canonical docs and configuration in the same change.
11. Run all validation required by `AGENTS.md`.
12. Mark a task complete only when its acceptance criteria are satisfied.

---

## Standard task execution prompt

Use this prompt when asking an agent to execute one task:

Follow AGENTS.md for the entire task.

Execute only TASK-XX from task.md.
Do not start any later task automatically.

Before editing:

- Read TASK-XX and its complete parent phase.
- Read only the canonical documentation, source files, tests, migrations,
  configuration, Docker/CI/deployment files required by AGENTS.md and this task.
- Inspect the current implementation before making changes.
- Verify every architectural assumption against current code/tests/migrations.
- Report conflicts between task.md, canonical docs, migrations, tests, and runtime behavior.
- Produce a concise implementation plan.
- Identify affected modules and files.

Implementation rules:

- Preserve the current modular-monolith architecture.
- Preserve Route -> Controller -> Service -> Repository boundaries.
- PostgreSQL remains the authoritative durable business store.
- Preserve tenant, organization, and branch authorization boundaries.
- Preserve backward compatibility unless an accepted ADR explicitly authorizes a breaking change.
- Make the smallest production-quality change that satisfies the task.
- Do not implement future tasks opportunistically.
- Do not introduce unrelated refactors.
- Add relevant tests, including failure paths.
- Update affected canonical documentation and configuration in the same change.

Before finishing:

Review the implementation for:

- correctness;
- race conditions;
- idempotency;
- duplicate execution;
- authorization;
- tenant isolation;
- security;
- sensitive-data leakage;
- performance;
- retry behavior;
- degraded-mode behavior;
- resource leaks;
- provider rate limits;
- deployment compatibility;
- maintainability.

Run all relevant validation required by AGENTS.md.

Fix discovered issues before handoff.

Handoff report:

1. What was implemented.
2. Architecture/design decisions.
3. Files changed.
4. Tests and commands executed with results.
5. Documentation/configuration updated.
6. Remaining risks or known limitations.
7. Whether TASK-XX is fully complete.
8. Recommended next task, but do not start it.

---

# 1. Initiative-wide architecture invariants

These rules apply to every phase.

## 1.1 PostgreSQL remains authoritative

PostgreSQL remains the source of truth for durable business state, including:

- organizations;
- branches;
- users;
- organization memberships;
- branch memberships;
- authentication sessions;
- products;
- branch inventory;
- queues;
- queue entries;
- booking groups;
- orders;
- order items;
- payment transactions;
- payment reconciliation;
- inventory reservations;
- notification intents;
- notification delivery history;
- queue history;
- audit logs.

Redis, BullMQ, SSE, Sentry, OpenTelemetry, and object storage must not become alternative business truth stores.

---

## 1.2 Redis is an acceleration and coordination layer

Redis may be used for:

- cache;
- distributed rate limiting;
- ephemeral derived state;
- temporary coordination;
- Pub/Sub;
- BullMQ infrastructure.

Redis must **not** become the only storage location for:

- ticket state;
- queue state;
- order state;
- payment state;
- stock state;
- authorization;
- memberships;
- durable notification history;
- audit history.

Deleting the Redis dataset must not corrupt durable business state.

---

## 1.3 Preserve the PostgreSQL transactional outbox

The current PostgreSQL notification outbox is a core reliability boundary.

Required architecture after BullMQ is introduced:

```text
Business transaction
        |
        v
PostgreSQL
  business state
  durable notification intent
        |
      COMMIT
        |
        v
Outbox Dispatcher
        |
        v
BullMQ
        |
        v
Worker
        |
        v
LINE / external provider
        |
        v
PostgreSQL durable delivery outcome
```

Do not replace this with:

```text
COMMIT database
    ->
BullMQ.add(...)
```

when BullMQ would become the only delivery guarantee.

---

## 1.4 SSE is transient

SSE is a realtime delivery mechanism.

It is not the database.

REST remains responsible for:

- initial state;
- reconnect recovery;
- missed-event recovery;
- authoritative refresh.

---

## 1.5 Observability is non-authoritative

Failures in:

- Sentry;
- OpenTelemetry exporters;
- metrics exporters;
- tracing backends;

must never fail:

- booking;
- payment;
- queue transitions;
- notification intent creation;
- authentication.

---

## 1.6 Preserve the media adapter boundary

Production object storage must be implemented behind the existing media abstraction.

Expected design:

```text
MediaService
    |
MediaStorageAdapter
    |
    +-- LocalMediaStorage
    +-- MockMediaStorage
    +-- S3CompatibleMediaStorage
```

Development and CI must remain possible without AWS/R2 credentials.

---

## 1.7 No technology rewrites

This initiative does not authorize migration to:

- NestJS;
- Prisma;
- Next.js;
- microservices;
- Kafka;
- Kubernetes;
- LLM/chatbot infrastructure.

Those require a separate architecture decision.

---

# PHASE 0 — Scalability Baseline & Architecture Plan

## Goal

Establish a measurable baseline before introducing new infrastructure.

Every later technology must solve an identified problem rather than being added only for the technology stack.

---

# TASK-01 — Current-State Scalability Audit & Target Architecture

**Status:** [x] Completed (2026-08-08)
**Priority:** P0
**Dependencies:** None

## Objective

Create an accurate map of the current runtime architecture, identify scale boundaries, define representative load scenarios, and establish the target architecture for subsequent tasks.

## Required investigation

Inspect:

- API process lifecycle;
- PostgreSQL connection pool;
- critical database queries;
- current scheduler;
- notification delivery worker;
- ETA updater;
- ETA warning scan;
- called retry scan;
- location worker;
- inventory expiry;
- forecasting;
- authentication-session cleanup;
- counter reset;
- queue/public read endpoints;
- customer ticket polling;
- staff dashboard polling;
- current rate limiting;
- existing cache utilities;
- health/readiness endpoints;
- metrics;
- structured logs;
- current media storage;
- deployment topology;
- current horizontal-scaling blockers.

## Required work

Identify:

- correctness-critical process-local state;
- performance-only process-local state;
- high-frequency read paths;
- expensive/repeated queries;
- asynchronous work suitable for worker isolation;
- current PostgreSQL advisory locks;
- current `FOR UPDATE SKIP LOCKED` flows;
- external-provider bottlenecks;
- provider rate-limit risks.

Define representative load scenarios for:

### Scenario A — Normal traffic

Representative organizations, branches, active queues, customers, staff operations, booking, and notification activity.

### Scenario B — Booking burst

Many customers simultaneously:

- create orders;
- reserve inventory;
- create tickets;
- validate payment;
- query queue status.

### Scenario C — Large active queue population

Large number of simultaneously active tickets generating:

- ticket status reads;
- ETA reads;
- warning scans;
- queue-summary reads;
- staff operations.

### Scenario D — Notification provider slowdown

LINE becomes slow/unavailable while notification intent continues to accumulate.

## Baseline metrics

Capture where practical:

- requests/sec;
- concurrent users;
- active tickets;
- booking throughput;
- queue read throughput;
- notification intents/sec;
- notifications/sec;
- p50 latency;
- p95 latency;
- p99 latency;
- API error rate;
- PostgreSQL connections;
- database CPU/IO where available;
- scheduler execution duration;
- notification backlog age.

## Define SLO targets

At minimum define target expectations for:

- queue-read latency;
- booking latency;
- staff-action latency;
- queue-state freshness;
- notification delay;
- API error rate;
- service availability.

## Target architecture

Update architecture documentation with the planned role of:

- Redis;
- BullMQ;
- dedicated workers;
- SSE;
- Redis Pub/Sub;
- OpenTelemetry;
- Sentry;
- S3/R2-compatible storage.

## Constraints

Do not implement new infrastructure in this task.

Do not describe a speculative bottleneck as a measured fact.

## Acceptance criteria

- [x] Current single-instance assumptions are documented.
- [x] High-frequency read candidates are documented.
- [x] Background-worker candidates are documented.
- [x] Scale scenarios exist.
- [x] Baseline metrics exist where practical.
- [x] Target SLOs are defined.
- [x] Later tasks have clear technical motivation.

**Completion evidence:** `docs/project/11_SCALABILITY_BASELINE.md`, ADR-027, and the linked
architecture/testing/operations updates. A 100-request warm public-read Docker baseline was captured
with explicit environment limits; unmeasured production metrics remain identified as later work.

---

# PHASE 1 — Redis

## Goal

Introduce Redis as a distributed acceleration/coordination layer while PostgreSQL remains authoritative.

---

# TASK-02 — Redis Infrastructure & Distributed Rate Limiting

**Status:** [x] Completed (2026-08-08)
**Priority:** P0
**Dependencies:** TASK-01

**Completion evidence:** Centralized `ioredis` lifecycle and safe degraded mode,
Redis-backed distributed limiters with bounded local fallback, private Compose
Redis services, safe health/metrics, environment validation, multi-instance and
failure-path tests, and canonical architecture/operations documentation.

## Objective

Introduce Redis cleanly and prepare one shared Redis infrastructure layer for:

- distributed rate limiting;
- caching;
- BullMQ;
- future Pub/Sub.

## Required implementation

### Redis client

- Select a Redis client compatible with the BullMQ version planned for Phase 2.
- Add centralized Redis configuration.
- Add centralized client/factory lifecycle.
- Avoid creating ad-hoc Redis clients inside business modules.

### Environment

Add only configuration actually required, such as:

```dotenv
REDIS_URL=
REDIS_CONNECT_TIMEOUT_MS=
REDIS_KEY_PREFIX=sqa
```

Validate environment values centrally.

### Docker

Add Redis to development Compose.

Include:

- service;
- persistence policy suitable for development;
- health check;
- network configuration.

### Lifecycle

Implement:

- connect;
- reconnect;
- command error handling;
- timeout handling;
- graceful shutdown.

### Degraded mode

Redis must not be required for core durable business correctness.

Define exactly how the API behaves when Redis is temporarily unavailable.

### Health

Expose safe Redis health information where appropriate without exposing:

- host credentials;
- password;
- full Redis URL.

---

## Distributed rate limiting

Audit all current limiters, including:

- global API limits;
- login;
- LINE authentication;
- organization application writes;
- booking;
- payment;
- LINE webhook;
- protected actions.

Move only policies requiring distributed consistency to Redis-backed storage.

Preserve:

- existing status codes;
- existing error envelopes;
- endpoint-specific thresholds;
- existing proxy/IP behavior.

## Security requirement

Strict authentication protection must not silently disappear if Redis fails.

Choose and document a safe strategy such as:

- fail closed for strict auth endpoints;
- bounded local fallback;
- explicit temporary rejection.

## Tests

Cover:

- Redis available;
- Redis unavailable at startup;
- disconnect during runtime;
- reconnect;
- command timeout;
- graceful shutdown;
- API instance A and API instance B sharing one rate-limit counter;
- strict login limiter during Redis outage;
- proxy-derived client IP.

## Documentation

Update relevant:

- `.env.example`;
- Docker Compose;
- system architecture;
- development/testing docs;
- deployment/operations docs;
- roadmap/ADR.

## Acceptance criteria

- [x] Redis lifecycle is centralized.
- [x] Redis credentials stay backend-only.
- [x] Business correctness does not depend on Redis.
- [x] Distributed rate limits work across multiple API processes.
- [x] Authentication protection does not silently degrade.
- [x] Development remains reproducible.

---

# TASK-03 — Redis Queue & Public Read-Model Caching

**Status:** [ ] Not started
**Priority:** P1
**Dependencies:** TASK-02 + TASK-01 baseline

## Objective

Reduce repeated PostgreSQL reads for high-frequency read models without turning cached data into business authority.

## Candidate cache targets

Evaluate before implementation:

- public branch QR resolution;
- branch active queues;
- queue summary;
- waiting count;
- called count;
- serving count;
- ETA summary;
- queue-specific public catalog;
- organization/branch public metadata.

Do not cache every endpoint automatically.

## Cache design

Define a versioned key strategy such as:

```text
sqa:v1:org:{organizationId}:...
sqa:v1:branch:{branchId}:...
sqa:v1:queue:{queueId}:...
```

Keys must guarantee tenant isolation.

For each cached object define:

- source of truth;
- key;
- TTL;
- invalidation event;
- maximum stale tolerance;
- cache-miss behavior;
- Redis-failure behavior.

## Implementation

Use cache-aside:

```text
Request
  |
Redis
  |
  +-- HIT -> return cached read model
  |
  +-- MISS
       |
       v
   PostgreSQL
       |
       v
     Redis
```

Implement:

- safe serialization;
- safe parsing;
- TTL;
- invalidation;
- failure fallback;
- corrupted-value fallback.

## Invalidation rule

Cache invalidation must occur **after successful database commit**.

Never invalidate based on an operation that later rolls back.

## Redis must not authorize

Cached state must never prove:

- payment success;
- current stock during commit;
- current queue openness during booking;
- tenant authorization;
- queue transition validity;
- queue capacity authority.

Booking/payment/order/transition services must still reload authoritative PostgreSQL data.

## Metrics

Add:

- cache hits;
- cache misses;
- cache errors;
- hit ratio;
- Redis latency.

Compare database/read latency against TASK-01 baseline.

## Tests

Cover:

- hit;
- miss;
- expiration;
- invalidation;
- rollback;
- Redis outage;
- corrupted cache;
- stale queue data;
- cross-tenant key isolation.

## Acceptance criteria

- [ ] PostgreSQL remains authoritative.
- [ ] Cache loss affects performance only.
- [ ] Selected cache paths provide measurable benefit.
- [ ] Cache TTL/invalidation policy is documented.
- [ ] No authorization/payment/inventory correctness uses cached authority.

---

# PHASE 2 — BullMQ & Dedicated Workers

## Goal

Move appropriate asynchronous processing out of the HTTP API process while preserving PostgreSQL durability.

---

# TASK-04 — BullMQ Foundation & Dedicated Worker Runtime

**Status:** [ ] Not started
**Priority:** P0
**Dependencies:** TASK-02

## Objective

Add BullMQ and a dedicated worker process without converting the modular monolith into microservices.

## Required analysis

Review current jobs:

- LINE notification delivery;
- email delivery;
- ETA updates;
- ETA warning;
- called retry;
- location warnings;
- inventory expiration;
- forecasting;
- session cleanup;
- counter reset.

For each job decide:

- remain in scheduler;
- move to worker;
- move to BullMQ;
- defer.

Do not migrate every scheduler merely because BullMQ exists.

LINE notification delivery is the preferred initial target.

## BullMQ design

Define:

- queue names;
- job names;
- job contract versions;
- payload schemas;
- deterministic job IDs;
- timeout;
- attempts;
- backoff;
- job retention;
- concurrency;
- provider throttling.

## Job payload rule

Prefer identifiers over duplicated business state.

Do not place in Redis jobs:

- provider secrets;
- access tokens;
- passwords;
- raw customer data;
- unnecessary phone/email/location;
- raw payment-provider payloads.

## Dedicated worker

Add a dedicated worker process inside the same repository.

It must:

- initialize only needed infrastructure;
- reuse application services;
- reuse integrations;
- avoid duplicating business rules;
- support graceful shutdown;
- drain/finish in-flight work safely;
- report safe health/metrics.

## Docker/deployment

Add worker service where appropriate.

Ensure:

```text
API down? -> worker may continue where safe
Worker down? -> API business transactions still work
```

## Duplicate ownership

When a job moves to BullMQ, ensure the former in-process scheduler does not also execute the same work.

## Tests

Cover:

- worker startup;
- Redis unavailable;
- worker restart;
- graceful shutdown;
- API with worker offline;
- multiple workers;
- invalid job contract;
- duplicate scheduling prevention.

## Acceptance criteria

- [ ] Worker is operationally separate from HTTP serving.
- [ ] Domain logic is reused rather than duplicated.
- [ ] BullMQ contracts/retry policies are explicit.
- [ ] Scheduler ownership remains unambiguous.
- [ ] Worker downtime does not block durable API transactions.

---

# TASK-05 — PostgreSQL Outbox → BullMQ → LINE Worker

**Status:** [ ] Not started
**Priority:** P0
**Dependencies:** TASK-04

## Objective

Scale LINE notification processing while keeping PostgreSQL as the durable notification source.

## Required architecture

```text
Queue / Order transaction
        |
        v
PostgreSQL notification outbox
        |
        v
Outbox Dispatcher
        |
        v
BullMQ
        |
        v
LINE Worker
        |
        v
LINE Messaging API
        |
        v
PostgreSQL delivery status
```

## Outbox dispatcher

Implement a dispatcher that:

- claims committed rows safely;
- works with existing row-lock semantics;
- creates deterministic BullMQ jobs;
- tolerates duplicate dispatch;
- tolerates Redis outage;
- retries undispatched rows later.

## Critical crash scenarios

Correctly handle:

### Case A

```text
claim outbox
   ↓
process crash
   ↓
before BullMQ enqueue
```

Notification must remain recoverable.

### Case B

```text
BullMQ enqueue succeeds
   ↓
dispatcher crashes
   ↓
before DB acknowledgement
```

Redispatch must not create harmful duplicate execution.

## LINE worker

Preserve current behavior:

- Japanese/Vietnamese/English;
- Japanese fallback;
- Flex Message;
- text fallback;
- ticket deep links;
- friendship/preferences;
- durable event keys;
- sanitized provider errors.

## Retry policy

Classify:

- retryable timeout;
- `429`;
- provider `5xx`;
- permanent validation/provider errors.

Implement:

- bounded retry count;
- exponential backoff;
- provider-aware throttling;
- retry-storm protection.

Evaluate jitter if needed.

## Durable status

Do not mark `notifications.sent` merely because a BullMQ job was created.

Only update durable delivery outcome based on actual processing result.

## Failure behavior

LINE failure must never roll back:

- ticket creation;
- queue transition;
- order completion;
- cancellation;
- no-show;
- other committed business state.

## Metrics

At minimum:

- undispatched outbox rows;
- oldest undispatched age;
- dispatched jobs;
- BullMQ waiting;
- active jobs;
- delayed jobs;
- failed jobs;
- retries;
- worker processing time;
- provider latency;
- provider failures.

## Tests

Cover:

- dispatch success;
- crash before enqueue;
- crash after enqueue;
- duplicate dispatcher;
- duplicate job;
- duplicate worker execution;
- Redis unavailable;
- worker unavailable;
- LINE timeout;
- LINE `429`;
- LINE `5xx`;
- Flex fail/text fallback;
- exhausted attempts;
- worker restart/backlog recovery.

## Acceptance criteria

- [ ] No committed notification intent can be lost because Redis/BullMQ is unavailable.
- [ ] Duplicate execution is safe.
- [ ] Existing LINE behavior remains compatible.
- [ ] Queue/order correctness is independent of LINE success.
- [ ] Notification backlog is observable.
- [ ] Workers can scale independently.

---

# PHASE 3 — Server-Sent Events

## Goal

Provide secure realtime queue/ticket updates while keeping REST as the authoritative recovery path.

---

# TASK-06 — SSE Backend, Event Model & Redis Pub/Sub

**Status:** [ ] Not started
**Priority:** P1
**Dependencies:** TASK-02; TASK-03 recommended

## Objective

Create a stable realtime domain-event layer and authorized SSE endpoints capable of working across multiple API instances.

## Realtime event model

Define application-level events instead of exposing raw database events.

Candidates:

```text
ticket.created
ticket.called
ticket.serving
ticket.completed
ticket.cancelled
ticket.deferred
ticket.no_show
ticket.eta_updated
queue.summary_updated
```

For each event define:

- event name;
- version;
- producer;
- intended subscribers;
- tenant scope;
- branch scope;
- ticket scope;
- minimal payload;
- duplicate semantics;
- ordering assumptions;
- client recovery behavior.

## Customer SSE

Implement the smallest appropriate customer stream design.

Possible design:

```text
GET /api/v1/realtime/tickets/:entryId
```

or another consistent contract.

Must enforce:

- authenticated customer;
- ticket ownership;
- active valid system session;
- no foreign customer access.

## Staff / branch manager SSE

Where useful, expose a branch/queue stream.

Must enforce:

- appropriate business role;
- active organization membership;
- exact branch membership;
- resource belongs to branch;
- owner compatibility membership does not grant branch operations.

## SSE runtime behavior

Implement:

- `Content-Type: text/event-stream`;
- proper cache headers;
- keep-alive;
- disconnect detection;
- abort cleanup;
- connection limits;
- safe retry/reconnect guidance.

Do not include unnecessary PII in events.

Avoid including:

- phone;
- email;
- LINE user ID;
- payment information;
- exact location.

## Redis Pub/Sub

For multi-instance fan-out:

```text
API / Worker A
     |
publish
     v
Redis Pub/Sub
     |
     +---- API A SSE clients
     |
     +---- API B SSE clients
```

Redis Pub/Sub is transient only.

PostgreSQL remains the recovery source.

Define:

- channel namespace;
- versioning;
- tenant/branch/ticket routing;
- reconnect behavior;
- duplicate publication behavior.

## Nginx/proxy

Review the actual path:

```text
Browser
  ->
Host TLS nginx
  ->
Web nginx
  ->
API
```

Configure/test as needed:

- proxy buffering;
- read timeout;
- keep-alive;
- compression;
- connection duration.

## Metrics

Add:

- active SSE connections;
- connections opened;
- connections closed;
- event count;
- send failures;
- reconnect count where observable;
- connection duration.

## Tests

Cover:

- own customer ticket;
- foreign customer ticket;
- business role on customer stream;
- own branch;
- foreign branch;
- organization owner branch restriction;
- connection cleanup;
- keep-alive;
- multiple subscribers;
- Redis Pub/Sub;
- Redis restart;
- cross-instance fan-out;
- cross-tenant isolation.

## Acceptance criteria

- [ ] Event contracts are stable and minimal.
- [ ] Authorization is enforced server-side.
- [ ] Redis Pub/Sub is not used as durable truth.
- [ ] SSE works through the production proxy topology.
- [ ] Multiple API replicas can deliver relevant events.

---

# TASK-07 — React / LIFF SSE Integration

**Status:** [ ] Not started
**Priority:** P1
**Dependencies:** TASK-06

## Objective

Use realtime events to improve customer ticket freshness and staff queue responsiveness without making frontend event payloads authoritative.

## Centralized client

Create a centralized SSE layer through an appropriate:

- service;
- hook;
- context;
- connection manager.

Do not create one independent SSE connection per component.

## Customer integration

Integrate active customer ticket views.

Potential updates:

- status;
- people ahead;
- ETA;
- called state;
- completed/cancelled/no-show.

## Staff integration

Integrate staff queue workspace where realtime provides meaningful value.

## TanStack Query strategy

Preferred:

```text
SSE event
   ↓
identify affected resource
   ↓
invalidate / refetch TanStack Query
   ↓
REST authoritative state
```

Use direct local query mutation only where deterministic and safe.

## Reconnect

Implement:

- bounded reconnect;
- backoff;
- session-expiry handling;
- clean logout shutdown;
- route cleanup;
- LIFF/mobile lifecycle handling.

Avoid reconnect storms.

## Fallback

Retain REST/polling fallback when SSE:

- is unavailable;
- disconnects;
- is unsupported;
- repeatedly fails.

## Tests

Cover:

- connect;
- disconnect;
- reconnect;
- duplicate events;
- delayed events;
- missing event;
- REST reconciliation;
- customer updates;
- staff updates;
- session expiration;
- SSE unavailable;
- LIFF/mobile navigation lifecycle.

## Acceptance criteria

- [ ] Duplicate/missed events cannot make UI permanently incorrect.
- [ ] REST remains authoritative.
- [ ] Realtime measurably improves freshness or polling load.
- [ ] No SSE resource leak exists.
- [ ] Logout/session expiry closes private streams.

---

# PHASE 4 — OpenTelemetry & Sentry

## Goal

Provide actionable production observability across frontend, API, PostgreSQL, Redis, BullMQ workers, and external integrations.

---

# TASK-08 — OpenTelemetry + Sentry Observability Stack

**Status:** [ ] Not started
**Priority:** P1
**Dependencies:** Redis/BullMQ recommended

## Objective

Build a coherent observability architecture instead of adding isolated monitoring SDKs.

## Existing signals

Audit and preserve where useful:

- Pino;
- request IDs;
- `/health`;
- `/ready`;
- `/metrics`;
- scheduler health;
- notification metrics;
- audit logs.

Avoid duplicated telemetry that produces noise.

---

## OpenTelemetry

Instrument where safe:

- incoming Express HTTP requests;
- PostgreSQL;
- Redis;
- BullMQ;
- worker jobs;
- outbound LINE HTTP;
- payment provider;
- Google Routes;
- S3-compatible storage after TASK-09.

## Custom high-value spans

Consider:

- create order;
- extend order;
- queue transition;
- auto-call;
- payment reconciliation;
- refund;
- notification dispatch;
- notification delivery.

Avoid tracing every trivial helper.

## Trace propagation

Where practical preserve correlation:

```text
HTTP Request
   |
   v
Service
   |
   v
PostgreSQL
   |
   v
Outbox
   |
   v
Dispatcher
   |
   v
BullMQ Job
   |
   v
Worker
   |
   v
LINE
```

Add trace IDs to structured logs where useful.

---

## Sentry backend and workers

Implement:

- unhandled exception capture;
- unhandled rejection capture;
- selected actionable handled errors;
- release metadata;
- environment metadata;
- safe shutdown/flush.

---

## Sentry frontend

Implement:

- React runtime error capture;
- error boundary integration;
- release/environment metadata;
- source map policy if appropriate;
- preserve localized user-facing error behavior.

---

## Sensitive-data policy

Never export/log blindly:

- passwords;
- password hashes;
- access JWT;
- refresh token;
- cookies;
- authorization headers;
- LINE channel access tokens;
- LINE channel secrets;
- SMTP credentials;
- Redis credentials;
- S3/R2 secret keys;
- payment provider secrets.

Minimize or redact:

- customer phone;
- customer email;
- LINE user ID;
- exact coordinates;
- raw payment payload;
- raw provider payload;
- invitation/reset tokens.

Do not enable broad request-body capture by default.

---

## Metrics

Review/add where practical:

### HTTP

- rate;
- latency;
- error rate.

### PostgreSQL

- pool usage;
- pool wait;
- relevant query latency.

### Redis

- latency;
- errors;
- hit ratio.

### BullMQ

- queue depth;
- job duration;
- retries.

### Notifications

- outbox backlog;
- oldest pending age;
- sent/retry/failed.

### SSE

- active connections;
- send failures;
- reconnects.

### External providers

- LINE latency/error;
- payment latency/error;
- Google Routes latency/error;
- object storage latency/error.

Do not create high-cardinality metric labels from:

- user IDs;
- order IDs;
- ticket IDs.

---

## Environment policy

Define behavior for:

- local;
- CI;
- staging;
- production.

Telemetry failure must never break application behavior.

---

## Verification

Test:

- sanitization;
- frontend capture;
- backend capture;
- worker capture;
- trace correlation;
- exporter unavailable;
- Sentry unavailable.

## Acceptance criteria

- [ ] Representative API/background operations can be correlated.
- [ ] Sensitive values are demonstrably scrubbed.
- [ ] Observability failure does not affect business correctness.
- [ ] Existing Pino/health/metrics remain coherent.
- [ ] Operator visibility meaningfully improves.

---

# PHASE 5 — S3-Compatible Object Storage

## Goal

Remove production dependence on API-container local storage for uploaded media.

---

# TASK-09 — S3 / Cloudflare R2-Compatible Media Storage

**Status:** [ ] Not started
**Priority:** P1

## Objective

Add an S3-compatible production storage adapter while retaining local/mock media providers.

## Audit current media implementation

Inspect:

- media routes;
- controller/service;
- storage adapter;
- `media_assets`;
- MIME/type validation;
- file size validation;
- pixel limits;
- WebP compression;
- generated storage key;
- persisted URLs;
- organization logo flow;
- product image flow;
- deletion;
- `/media/*` proxy;
- Docker media volume.

## Adapter architecture

Maintain:

```text
MediaService
     |
MediaStorageAdapter
     |
     +-- Local
     +-- Mock
     +-- S3Compatible
```

Business/catalog modules must not import an S3 SDK directly.

## Configuration

Support only required values, such as:

```dotenv
MEDIA_STORAGE_PROVIDER=s3

S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
S3_FORCE_PATH_STYLE=false
```

Exact names should follow current configuration conventions.

## Required implementation

- add S3-compatible SDK;
- implement upload;
- implement delete;
- support custom S3-compatible endpoint;
- support AWS S3/R2-style provider configuration;
- generate object keys server-side;
- set validated content type;
- set appropriate cache headers;
- keep local/mock providers;
- persist safe media metadata;
- return stable public/CDN URL.

## Security

Never expose storage credentials to the browser.

Browser must not choose arbitrary:

- bucket;
- object key;
- storage credentials.

Preserve existing server validation:

- actual decoded bytes;
- content type;
- size;
- dimensions;
- compression.

## Failure semantics

Design safe behavior for:

```text
upload succeeds
but DB write fails
```

and:

```text
DB state changes
but object delete fails
```

Handle:

- repeated delete;
- object already missing;
- provider timeout;
- provider unavailable;
- replacement image;
- orphan object;
- orphan DB reference.

Document orphan reconciliation/cleanup strategy.

## Direct browser uploads

Do **not** add presigned browser upload by default.

Initial design should remain:

```text
Browser
   ->
API validation/compression
   ->
Object Storage
```

Only introduce signed direct upload later if measured API bandwidth becomes a bottleneck.

## Tests

Cover:

- upload;
- delete;
- repeated delete;
- invalid file;
- provider failure;
- DB failure;
- missing object;
- generated key collision;
- tenant authorization;
- local provider;
- mock provider.

## Production operations

Document:

- bucket/provider setup;
- least-privilege credentials;
- CDN/public access policy;
- retention/lifecycle;
- backup/versioning expectations;
- scanning policy;
- container redeploy persistence;
- staging verification.

## Acceptance criteria

- [ ] Production media no longer depends on container filesystem.
- [ ] Existing local development remains simple.
- [ ] Provider secrets stay server-side.
- [ ] Partial failures have safe/recoverable behavior.
- [ ] Organization/product media contracts remain compatible.

---

# PHASE 6 — Storybook

## Goal

Create an isolated component-development environment for the multi-role, responsive, three-locale frontend.

---

# TASK-10 — Storybook Component Environment

**Status:** [ ] Not started
**Priority:** P2

## Objective

Use Storybook where isolated state, locale, responsive, and visual review provides real frontend value.

Storybook complements:

- Vitest;
- Testing Library;
- Playwright.

It does not replace them.

## Setup

Implement:

- Storybook compatible with React + Vite + TypeScript;
- global styles;
- current design tokens;
- Vite aliases;
- i18n provider;
- router provider where needed;
- TanStack Query provider where needed;
- deterministic mocks/fixtures;
- development script;
- static build script.

Storybook must not call real:

- LINE;
- payment provider;
- Google Routes;
- production API.

## Story conventions

Define:

- file naming;
- folder/hierarchy;
- fixtures;
- mock API behavior;
- locale control;
- viewport control;
- interaction testing conventions.

## Required locales

Important reusable stories should support:

- Japanese;
- Vietnamese;
- English.

Japanese should receive special attention for long-copy/primary-market layout behavior.

## Required viewports

At minimum:

- phone;
- desktop.

Add tablet where behavior meaningfully differs.

## Priority components

Select only real reusable or visually risky components.

Candidates:

- buttons;
- inputs/forms;
- dialogs/modals;
- pagination;
- badges;
- queue/ticket cards;
- ticket status components;
- staff ticket selector;
- receipt modal;
- product/service cards;
- low-stock/out-of-stock/unlimited inventory states;
- payment summary;
- prepayment states;
- navigation primitives;
- Add Friend prompt;
- active/no-current-ticket UI;
- location consent UI.

Do not artificially refactor one-off page code merely to increase story count.

## State matrix

Where relevant cover:

- default;
- loading;
- empty;
- error;
- disabled;
- success;
- long text;
- mobile;
- desktop.

Queue components should cover relevant states such as:

- waiting;
- called;
- serving;
- served;
- deferred;
- cancelled;
- no-show.

## CI

Evaluate adding static Storybook build to CI.

Add it when:

- stable;
- reasonably fast;
- useful as a regression gate.

Accessibility checks may be added where practical.

Visual-regression tooling is optional.

Do not introduce a paid service merely for technology completeness.

## Acceptance criteria

- [ ] Storybook runs locally.
- [ ] Static Storybook build succeeds.
- [ ] Important reusable components can be reviewed independently.
- [ ] Critical locale and responsive states are represented.
- [ ] Production app runtime/bundle behavior is unaffected.
- [ ] Storybook complements existing automated tests.

---

# PHASE 7 — Integrated Scale & Failure Validation

## Goal

Prove the final architecture provides measurable benefit and safe degraded behavior.

---

# TASK-11 — Load, Failure Injection, Horizontal Readiness & Final Documentation

**Status:** [ ] Not started
**Priority:** P0
**Dependencies:** TASK-02 through TASK-10 as applicable

## Objective

Validate the combined system rather than treating installed packages as proof of scalability.

---

## Part A — Repeat scalability tests

Re-run TASK-01 scenarios.

Measure:

- requests/sec;
- booking throughput;
- queue-read throughput;
- p50 latency;
- p95 latency;
- p99 latency;
- API error rate;
- PostgreSQL pool usage;
- PostgreSQL load;
- Redis latency;
- cache hit ratio;
- BullMQ queue depth;
- BullMQ processing throughput;
- notification outbox age;
- SSE active connections;
- SSE reconnect rate;
- API CPU;
- worker CPU;
- memory usage.

Compare before/after.

Document:

- measurable improvements;
- regressions;
- bottlenecks that remain.

If an added layer provides no meaningful value, simplify/remove it instead of preserving complexity for the tech stack.

---

## Part B — Failure injection

Test controlled failure of:

### Redis

- unavailable at startup;
- runtime disconnect;
- restart;
- cache loss.

### BullMQ / workers

- worker stops;
- dispatcher stops;
- Redis/BullMQ unavailable;
- large backlog;
- worker restart.

### SSE

- API restart;
- connection drop;
- Redis Pub/Sub restart;
- client reconnect.

### Database

- temporary database interruption;
- recovery behavior.

### LINE

- timeout;
- `429`;
- `5xx`;
- provider recovery.

### Object storage

- provider timeout;
- invalid credentials;
- upload/delete failure.

### Observability

- Sentry unavailable;
- telemetry exporter unavailable.

For each scenario document:

- customer impact;
- staff impact;
- business-data correctness;
- automatic recovery;
- operator action;
- logs;
- metrics;
- traces.

---

## Part C — Horizontal API readiness

Run at least:

```text
Load Balancer
     |
     +-- API #1
     |
     +-- API #2

Shared:
- PostgreSQL
- Redis
- Worker infrastructure
```

Verify:

- authentication works across instances;
- session handling remains correct;
- distributed rate limiting is shared;
- Redis cache works safely;
- SSE events reach clients connected to another API instance;
- no correctness-critical process-local singleton remains;
- scheduler ownership remains safe;
- workers do not duplicate incorrect business effects;
- PostgreSQL connection-pool budget remains acceptable.

Do not introduce Kubernetes just to complete this task.

---

## Part D — Final documentation reconciliation

Review/update:

- `AGENTS.md` when rules/commands changed;
- `docs/00_PROJECT_CONTEXT.md`;
- `docs/01_PRODUCT_REQUIREMENTS.md` only when product behavior changed;
- `docs/02_SYSTEM_ARCHITECTURE.md`;
- `docs/03_DOMAIN_AND_FLOWS.md`;
- `docs/04_DATABASE.md`;
- `docs/05_API.md`;
- `docs/06_CODEBASE_GUIDE.md`;
- `docs/07_DEVELOPMENT_AND_TESTING.md`;
- `docs/08_DEPLOYMENT_AND_OPERATIONS.md`;
- `docs/09_ROADMAP_AND_DECISIONS.md`;
- `.env.example`;
- Docker/Compose;
- CI/CD;
- production readiness checklists.

Major architectural decisions must be added/superseded through ADRs instead of silently rewriting accepted decisions.

## Acceptance criteria

- [ ] Scale improvements are evidence-backed.
- [ ] Redis loss does not corrupt business truth.
- [ ] BullMQ/worker failure does not lose durable notification intent.
- [ ] SSE failure has authoritative REST recovery.
- [ ] Observability outage does not break business flows.
- [ ] Object-storage failures have safe recovery behavior.
- [ ] Multiple API instances operate correctly at the intended baseline.
- [ ] Canonical docs match code.
- [ ] Tech stack contains only technologies actually implemented and validated.

---

# Phase Tracking

| Phase   | Description                  | Status |
| ------- | ---------------------------- | ------ |
| Phase 0 | Baseline & Architecture Plan | [ ]    |
| Phase 1 | Redis                        | [ ]    |
| Phase 2 | BullMQ & Workers             | [ ]    |
| Phase 3 | SSE                          | [ ]    |
| Phase 4 | OpenTelemetry & Sentry       | [ ]    |
| Phase 5 | S3/R2 Object Storage         | [ ]    |
| Phase 6 | Storybook                    | [ ]    |
| Phase 7 | Integrated Validation        | [ ]    |

A phase is complete only when all tasks inside it satisfy their acceptance criteria.

---

# Recommended Execution Order

```text
TASK-01
Scalability baseline
       |
       v
TASK-02
Redis infrastructure
       |
       v
TASK-03
Redis caching
       |
       v
TASK-04
BullMQ + Worker
       |
       v
TASK-05
Outbox -> BullMQ -> LINE
       |
       v
TASK-06
SSE Backend + Redis Pub/Sub
       |
       v
TASK-07
Frontend SSE
       |
       v
TASK-08
OpenTelemetry + Sentry
       |
       v
TASK-09
S3 / R2
       |
       v
TASK-10
Storybook
       |
       v
TASK-11
Integrated validation
```

Independent later concerns may be implemented on separate branches when appropriate, but each coding-agent run must execute only the explicitly requested task.

---

# Expected Target Architecture

```text
                           Internet / LINE
                                 |
                                 v
                            TLS / nginx
                                 |
                           React/Vite SPA
                                 |
                                 v
                          Load Balancer
                                 |
                     +-----------+-----------+
                     |                       |
                  API #1                  API #2
                     |                       |
                     +-----------+-----------+
                                 |
                +----------------+----------------+
                |                |                |
                v                v                v
           PostgreSQL          Redis       Object Storage
         Durable Truth        Fast Layer      S3 / R2
                |                |
                |                +-- Cache
                |                +-- Rate Limit
                |                +-- Pub/Sub
                |                +-- BullMQ
                |
                v
          Durable Outbox
                |
                v
         Outbox Dispatcher
                |
                v
              BullMQ
                |
         +------+------+------+
         |             |      |
         v             v      v
     LINE Worker    Future   Future
                    Worker   Worker
         |
         v
  LINE Messaging API


Customer / Staff Browser
         ^
         |
         +------ SSE ------ API
                           |
                           +--- Redis Pub/Sub
                                for cross-instance fan-out


Observability:

Browser ------> Sentry

API ----------> OpenTelemetry
             -> Sentry
             -> Pino
             -> Metrics

Workers ------> OpenTelemetry
             -> Sentry
             -> Metrics
```

---

# Technology Responsibilities After Completion

Only after successful implementation and validation should the project claim these responsibilities:

| Technology               | Responsibility                                                  |
| ------------------------ | --------------------------------------------------------------- |
| PostgreSQL               | Durable business truth, transactions, outbox, audit             |
| Redis                    | Distributed cache, rate limiting, Pub/Sub, BullMQ backing store |
| BullMQ                   | Job distribution, retry/backoff, worker execution               |
| SSE                      | Realtime server-to-browser queue/ticket updates                 |
| OpenTelemetry            | Distributed tracing/correlation                                 |
| Sentry                   | Frontend/backend/worker error monitoring                        |
| S3/R2-compatible storage | Durable production media storage                                |
| Storybook                | Isolated component development/testing/documentation            |
| Swagger/OpenAPI          | API documentation and contract coverage                         |

Do not list a technology merely because its dependency exists in `package.json`.

It must have a real architectural responsibility and verified implementation.

---

# Final Maintenance Rule

After TASK-11 is complete:

- keep this file as implementation history;
- canonical documentation becomes the normal source of current architecture;
- normal bug fixes and maintenance should no longer be driven by this file;
- future architecture changes must be justified by:
  - new product requirements;
  - incidents;
  - measured bottlenecks;
  - production scale;
  - explicit ADR decisions;

- do not continue adding infrastructure merely to expand the technology list.
