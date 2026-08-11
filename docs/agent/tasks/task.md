# Production Capability Implementation Tasks

These tasks implement the four highest-priority proposals from `idea.md`: Notification Operations
Center, Production Payment Operations, Service-Level Objectives and Operations Console, and
Calibrated Demand Forecasting and Staff Planning.

## Execution Rules

- Execute exactly one task at a time in the order listed unless a dependency is explicitly resolved.
- Do not start the next task automatically after completing the current task.
- Read `docs/agent/AGENTS.md` and the task-specific canonical documents before editing.
- Update implementation, tests, canonical documentation, configuration, and task status together.
- Use forward migrations only; never reset shared, staging, or production data.
- Do not commit provider credentials, customer data, or browser-visible secrets.
- Mark a task completed only after every required validation and Definition of Done item passes.

---

## TASK-PROD-001: Notification Operations Center

**Idea:** 1. Notification Operations Center
**Status:** [x] Completed
**Priority:** P0
**Dependencies:** Existing PostgreSQL notification outbox, BullMQ dispatcher, audit log, metrics

### Objective

Provide authorized operators with a safe dashboard for diagnosing and recovering failed LINE
notifications without direct database access or duplicate customer messages.

### Implementation Checklist

- [x] Document authorization: Branch Manager sees their assigned branch; Staff sees their assigned queue; platform Admin and Organization Owner are denied.
- [x] Add paginated repository queries with server-derived organization/branch/queue scope plus status, event type, and time range filters.
- [x] Return only safe delivery fields; never expose access tokens, headers, raw provider payloads, or unnecessary PII.
- [x] Normalize safe failure categories for blocked recipient, invalid recipient, timeout, rate limit, provider 4xx, and provider 5xx.
- [x] Add detail API with event key, locale, attempt count, timestamps, ticket reference, and sanitized last error.
- [x] Add guarded retry API for retryable `failed` deliveries using the existing event key and idempotent dispatcher.
- [x] Add guarded cancellation API for obsolete `pending` deliveries whose related ticket is terminal.
- [x] Record retry and cancellation actions in the audit log with actor and reason.
- [x] Add backlog age, delivery latency, failure count, and worker heartbeat metrics without high-cardinality labels.
- [x] Build responsive operations list/detail UI with loading, empty, error, disabled, and success states.
- [x] Add `ja`, `vi`, and `en` translation keys with Japanese fallback.
- [x] Add retention guidance and an operator runbook for LINE outage, invalid credentials, and exhausted retries.

### Tests and Validation

- [x] Test tenant isolation, role checks, pagination, filters, and sanitized API responses.
- [x] Test retry/cancel idempotency, invalid transitions, audit records, and concurrent operator actions.
- [x] Test dashboard responsive states and API failures with mock messaging only.
- [x] Run lint, typecheck, targeted/full tests, build, format check, and OpenAPI contract validation.

### Definition of Done

- [x] An authorized operator can find and diagnose a missed LINE notification without SQL access.
- [x] Manual recovery cannot send a duplicate message or alter committed queue/order state.
- [x] Canonical API, product, operations, and codebase documents match verified behavior.

---

## TASK-PROD-002: Production PSP Adapter and Refund Execution

**Idea:** 2. Production Payment, Refund, and Settlement Operations
**Status:** [x] Completed
**Priority:** P0
**Dependencies:** Existing payment gateway abstraction; merchant onboarding and external acceptance are deferred

**Post-completion correction (2026-08-11):** TASK-PROD-002 remains completed because the
production-oriented provider, webhook, reconciliation, idempotency, audit, and refund boundaries
are implemented and retained. The current deployment intentionally activates
`DemoPaymentProvider`, processes no real money, requires no real PSP credentials, and makes no real
PSP calls. payOS merchant onboarding, production credentials, real-money payment/refund acceptance,
settlement, and commercial/legal approval are future external activation gates, not current runtime
requirements.

### Objective

Complete one real payment provider while preserving server-authoritative payment state, replay-safe
webhooks, audited refunds, and explicit demo-mode isolation.

### Implementation Checklist

- [x] Record the selected payOS/VND adapter boundary and activation decision in canonical ADRs.
- [x] Define provider configuration, secret ownership, credential validation, and safe mode behavior.
- [x] Implement intent creation, hosted checkout/QR mapping, return verification, webhook parsing, and error mapping.
- [x] Verify webhook signature, timestamp, provider event ID, amount, currency, and transaction ownership server-side.
- [x] Preserve payment state-machine rules and reject browser-declared success.
- [x] Add idempotency for intent creation, webhook application, refund request, and provider callback replay.
- [x] Retain audited full/partial refund orchestration; provider-side real-money acceptance remains deferred.
- [x] Distinguish retryable transport/rate-limit failures from permanent provider rejection.
- [x] Store only required normalized provider references and sanitized operational errors.
- [x] Prevent an unconfigured external provider from becoming active.
- [x] Keep the demo provider behind explicit demo configuration without calling a real PSP.
- [x] Keep migration/reset-schema synchronization aligned with the normalized transaction model.

### Tests and Validation

- [x] Add provider contract tests for request/response mapping, signature verification, timeout, and error categories.
- [x] Add integration tests for duplicate webhooks, amount mismatch, callback/refund idempotency, and rollback.
- [x] Add deterministic demo/provider flow coverage; real merchant sandbox acceptance remains deferred.
- [x] Run required code, contract, migration, build, and formatting validation.

### Definition of Done

- [x] Only verified server events can mark a transaction paid or refunded.
- [x] Every provider action is idempotent, tenant-scoped, audited, and safely observable.
- [x] Canonical architecture, API, database, product, deployment, and operations docs are updated.

---

## TASK-PROD-003: Operational Health and Runtime Visibility

**Status:** [ ] Not started
**Priority:** P1
**Dependencies:** Existing health checks, logs, metrics, Redis, worker, notification outbox, and payment runtime

### Objective

Provide Platform Admin with a lightweight, secure operational view of critical runtime health without
building a full enterprise observability platform or exposing tenant/customer business data.

### Authorization

- Platform Admin only.
- Organization Owner, Branch Manager, Staff, and Customer are denied.
- Expose only sanitized platform/infrastructure health and aggregate operational indicators.
- Never expose tenant notification details, payment transaction details, customer data, provider payloads, credentials, secrets, or cross-tenant business records.

### Implementation Checklist

- [ ] Audit existing health checks, logs, metrics, OpenTelemetry/Sentry, worker heartbeat, and provider status before adding new logic.
- [ ] Provide health/status visibility for API, PostgreSQL, Redis, background worker, SSE/realtime, and LINE notification delivery.
- [ ] Show safe aggregate notification backlog, oldest pending age, and worker heartbeat without tenant/customer detail.
- [ ] Show active payment mode/provider clearly.
- [ ] Treat intentionally configured `demo` payment mode without real PSP credentials as a valid healthy state.
- [ ] Only report missing/invalid real PSP configuration as an error when that real provider is explicitly enabled.
- [ ] Add environment/release/version identifiers useful for deployment troubleshooting.
- [ ] Add basic latency/error indicators for critical flows using existing telemetry where practical.
- [ ] Represent dependencies consistently as `healthy`, `degraded`, `unavailable`, or `not configured/not applicable`.
- [ ] Build a responsive Platform Admin operations dashboard with loading, healthy, degraded, unavailable, and error states.
- [ ] Add concise operator guidance for common database, Redis, worker, LINE, and payment configuration failures.
- [ ] Reuse existing observability infrastructure; add only instrumentation needed for trustworthy dashboard states.
- [ ] Do not expand this task into enterprise SLO/error-budget/on-call infrastructure or complex monitoring platforms.

### Tests and Validation

- [ ] Test Platform Admin authorization and denial for all other roles.
- [ ] Test response sanitization and absence of cross-tenant/business data.
- [ ] Test healthy, degraded, unavailable, and intentionally-not-configured states.
- [ ] Test demo payment mode without real PSP credentials as healthy.
- [ ] Test Redis, worker, and provider failure states with controlled mocks/failure injection.
- [ ] Test responsive dashboard states and locale behavior where applicable.
- [ ] Run required validation according to `AGENTS.md`.

### Definition of Done

- [ ] Platform Admin can quickly identify the health of critical runtime components from one approved surface.
- [ ] Demo-only configuration is not incorrectly reported as a production failure.
- [ ] Dashboard exposes no tenant/customer operational detail or secrets.
- [ ] Observability failure cannot break core business operations.
- [ ] Canonical architecture, operations, deployment, security, API, and codebase docs match verified behavior.

---

## TASK-PROD-004: Production-Oriented Demo Hardening and Recovery

**Status:** [ ] Not started
**Priority:** P1
**Dependencies:** TASK-PROD-003 completed; existing transaction, idempotency, Redis, BullMQ, SSE, and recovery foundations

### Objective

Verify and harden the production-oriented demo against realistic failures so temporary infrastructure,
provider, restart, duplicate-request, or concurrency problems cannot corrupt authoritative business state.

### Scope Boundary

This is primarily a reliability/correctness task, not a new user-facing feature.

Audit existing behavior first and fix only demonstrated gaps. Do not introduce distributed infrastructure,
complex recovery systems, or theoretical scalability mechanisms without evidence that they are needed.

### Implementation Checklist

- [ ] Audit existing concurrency, transaction, idempotency, retry, timeout, fallback, and recovery behavior before modifying implementation.
- [ ] Verify Redis outage/recovery keeps PostgreSQL authoritative and uses existing safe fallback behavior.
- [ ] Verify LINE worker outage preserves durable notification backlog and resumes delivery safely after recovery.
- [ ] Verify API/web/worker restart does not corrupt committed domain state or persistent sessions.
- [ ] Verify SSE disconnect/reconnect and REST fallback recover authoritative state without duplicate business actions.
- [ ] Verify duplicate booking, order, payment, refund, webhook/callback, and notification operations remain idempotent.
- [ ] Verify concurrent queue operations cannot double-call customers, corrupt ticket state, bypass assigned scope, or create invalid transitions.
- [ ] Verify concurrent inventory/order operations cannot oversell or leave committed inventory inconsistent.
- [ ] Verify LINE, email, routes, payment, and media timeout/failure cannot incorrectly commit provider-dependent success.
- [ ] Review critical transaction boundaries, locks, timeouts, bounded retries, and cleanup behavior.
- [ ] Preserve demo payment as the current runtime; real PSP availability is not required for this task.
- [ ] Fix only correctness/recovery gaps demonstrated by tests or implementation audit.
- [ ] Add concise recovery/runbook guidance for validated failure scenarios.

### Tests and Validation

- [ ] Add or extend deterministic failure/recovery tests for the critical scenarios above.
- [ ] Test Redis and worker outage/recovery using the existing Docker/validation topology where practical.
- [ ] Test duplicate and concurrent requests for critical state transitions.
- [ ] Test restart/reconnect behavior for applicable API, worker, and realtime flows.
- [ ] Confirm failures do not leak credentials, secrets, raw provider payloads, or unnecessary PII.
- [ ] Run required repository, security, Compose, migration, application, and concurrency validation according to `AGENTS.md`.

### Definition of Done

- [ ] Tested infrastructure/provider failures degrade safely without corrupting PostgreSQL-authoritative business state.
- [ ] Recovery does not create duplicate booking, payment, refund, notification, order, inventory, or queue transitions.
- [ ] Critical concurrency and idempotency boundaries have deterministic regression coverage.
- [ ] No unnecessary infrastructure was added solely for theoretical production scale.
- [ ] Canonical operations, architecture, testing, security, deployment, and scalability docs contain verified behavior rather than theoretical claims.

---

## TASK-PROD-005: End-to-End Demo Readiness and Final Acceptance

**Status:** [ ] Not started
**Priority:** P1
**Dependencies:** TASK-PROD-004 completed; representative demo data and deployable environment

### Objective

Prepare LINE Smart Queue Assistant as a complete, stable, production-oriented demonstration and
validate its critical user journeys without introducing new large product capabilities.

### Scope Boundary

This is the final integration, quality, UX, security, and demo-acceptance task.

Do not add major new subsystems during this task. Fix blocking defects and important UX/integration
issues; document non-blocking future enhancements instead of expanding project scope.

### Implementation Checklist

- [ ] Audit critical journeys for Platform Admin, Organization Owner, Branch Manager, Staff, and Customer.
- [ ] Validate organization lifecycle: application → Admin approval → Owner activation → organization setup.
- [ ] Validate business setup: branch → catalog → queue → staff assignment → QR/customer entry.
- [ ] Validate customer journey: QR/LIFF → queue/service selection → order → demo payment → ticket → LINE notification → queue processing → completion/history.
- [ ] Validate Branch Manager and Staff queue operations, including Notification Operations and strict branch/assigned-queue authorization.
- [ ] Validate Platform Admin Operational Health Dashboard without exposing tenant/customer detail.
- [ ] Validate demo payment/refund behavior and clearly distinguish it from retained real-PSP production architecture.
- [ ] Review desktop/mobile responsive behavior and fix blocking navigation, overflow, loading, empty, error, disabled, and success-state issues.
- [ ] Validate critical journeys in `ja`, `vi`, and `en` with Japanese fallback.
- [ ] Review representative demo fixtures so normal, busy queue, failed notification, payment/refund, and recovery scenarios can be demonstrated consistently.
- [ ] Run final security regression for authentication, tenant isolation, role/scope enforcement, browser-authoritative fields, secrets, and sensitive responses.
- [ ] Run final deployment smoke tests for Web, API, PostgreSQL, Redis, worker, SSE/realtime, LINE/mock integration, and demo payment.
- [ ] Review remaining TODO/FIXME/known limitations that affect critical demo flows and resolve only blockers or material correctness issues.
- [ ] Update README/demo guide with setup, demo accounts/data, recommended demonstration flow, known limitations, and intentionally deferred commercial-production capabilities.
- [ ] Document real PSP merchant acceptance, settlement/reconciliation, enterprise SLO/on-call infrastructure, and production-data forecast calibration as future production work where relevant.

### Tests and Validation

- [ ] Ensure automated E2E covers the highest-value critical journeys and authorization boundaries.
- [ ] Run lint, typecheck, tests, build, format, OpenAPI, Storybook/browser tests, migration checks, and deployment validation required by `AGENTS.md`.
- [ ] Perform final smoke validation against a clean isolated demo environment.
- [ ] Verify representative demo data can reproduce the intended demonstration flow.
- [ ] Record remaining external acceptance requirements separately from implementation defects.

### Definition of Done

- [ ] The complete primary business journey can be demonstrated reliably from onboarding through queue completion.
- [ ] All primary roles have verified authorization boundaries and usable critical journeys.
- [ ] Critical queue, inventory, payment, notification, realtime, and recovery behavior has regression coverage.
- [ ] Demo deployment is stable and documentation accurately distinguishes implemented behavior from deferred commercial-production acceptance.
- [ ] No known blocker prevents LINE Smart Queue Assistant from being presented as a production-oriented demo.
- [ ] No further major production capability is required for the current project scope.
