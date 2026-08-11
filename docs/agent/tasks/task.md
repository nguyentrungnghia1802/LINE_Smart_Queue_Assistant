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

**Status:** [x] Completed
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

- [x] Audit existing health checks, logs, metrics, OpenTelemetry/Sentry, worker heartbeat, and provider status before adding new logic.
- [x] Provide health/status visibility for API, PostgreSQL, Redis, background worker, SSE/realtime, and LINE notification delivery.
- [x] Show safe aggregate notification backlog, oldest pending age, and worker heartbeat without tenant/customer detail.
- [x] Show active payment mode/provider clearly.
- [x] Treat intentionally configured `demo` payment mode without real PSP credentials as a valid healthy state.
- [x] Only report missing/invalid real PSP configuration as an error when that real provider is explicitly enabled.
- [x] Add environment/release/version identifiers useful for deployment troubleshooting.
- [x] Add basic latency/error indicators for critical flows using existing telemetry where practical.
- [x] Represent dependencies consistently as `healthy`, `degraded`, `unavailable`, or `not configured/not applicable`.
- [x] Build a responsive Platform Admin operations dashboard with loading, healthy, degraded, unavailable, and error states.
- [x] Add concise operator guidance for common database, Redis, worker, LINE, and payment configuration failures.
- [x] Reuse existing observability infrastructure; add only instrumentation needed for trustworthy dashboard states.
- [x] Do not expand this task into enterprise SLO/error-budget/on-call infrastructure or complex monitoring platforms.

### Tests and Validation

- [x] Test Platform Admin authorization and denial for all other roles.
- [x] Test response sanitization and absence of cross-tenant/business data.
- [x] Test healthy, degraded, unavailable, and intentionally-not-configured states.
- [x] Test demo payment mode without real PSP credentials as healthy.
- [x] Test Redis, worker, and provider failure states with controlled mocks/failure injection.
- [x] Test responsive dashboard states and locale behavior where applicable.
- [x] Run required validation according to `AGENTS.md`.

### Definition of Done

- [x] Platform Admin can quickly identify the health of critical runtime components from one approved surface.
- [x] Demo-only configuration is not incorrectly reported as a production failure.
- [x] Dashboard exposes no tenant/customer operational detail or secrets.
- [x] Observability failure cannot break core business operations.
- [x] Canonical architecture, operations, deployment, security, API, and codebase docs match verified behavior.

---

## TASK-PROD-004: Production-Oriented Demo Hardening and Recovery

**Status:** [x] Completed (2026-08-11)
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

- [x] Audit existing concurrency, transaction, idempotency, retry, timeout, fallback, and recovery behavior before modifying implementation.
- [x] Verify Redis outage/recovery keeps PostgreSQL authoritative and uses existing safe fallback behavior.
- [x] Verify LINE worker outage preserves durable notification backlog and resumes delivery safely after recovery.
- [x] Verify API/web/worker restart does not corrupt committed domain state or persistent sessions.
- [x] Verify SSE disconnect/reconnect and REST fallback recover authoritative state without duplicate business actions.
- [x] Verify duplicate booking, order, payment, refund, webhook/callback, and notification operations remain idempotent.
- [x] Verify concurrent queue operations cannot double-call customers, corrupt ticket state, bypass assigned scope, or create invalid transitions.
- [x] Verify concurrent inventory/order operations cannot oversell or leave committed inventory inconsistent.
- [x] Verify LINE, email, routes, payment, and media timeout/failure cannot incorrectly commit provider-dependent success.
- [x] Review critical transaction boundaries, locks, timeouts, bounded retries, and cleanup behavior.
- [x] Preserve demo payment as the current runtime; real PSP availability is not required for this task.
- [x] Fix only correctness/recovery gaps demonstrated by tests or implementation audit.
- [x] Add concise recovery/runbook guidance for validated failure scenarios.

### Tests and Validation

- [x] Add or extend deterministic failure/recovery tests for the critical scenarios above.
- [x] Test Redis and worker outage/recovery using the existing Docker/validation topology where practical.
- [x] Test duplicate and concurrent requests for critical state transitions.
- [x] Test restart/reconnect behavior for applicable API, worker, and realtime flows.
- [x] Confirm failures do not leak credentials, secrets, raw provider payloads, or unnecessary PII.
- [x] Run required repository, security, Compose, migration, application, and concurrency validation according to `AGENTS.md`.

### Completion Evidence

- The audit retained existing PostgreSQL outbox/event-key authority, queue transition locks,
  conditional finite-stock updates, payment/refund/webhook reconciliation, Redis fallback, BullMQ
  restart behavior, SSE REST reconciliation, bounded provider retries, and sanitized telemetry.
- A demonstrated direct-join race was fixed by repeating the active-ticket lookup after the queue
  row lock. Deterministic tests prove the losing concurrent request cannot increment the ticket
  counter, create an entry, enqueue a notification, or publish a duplicate realtime mutation.
- The integrated validation runner now invokes Docker without a platform shell, preserving SQL
  arguments on Windows and Linux. The 2026-08-11 isolated run passed Redis stop/start, worker
  backlog recovery, cross-replica SSE, API restart, PostgreSQL stop/start, cache loss, distributed
  rate limiting, and 160 public reads with zero errors.
- Validation passed: security audit, format, lint, typecheck, OpenAPI, 109 API suites/664 tests,
  54 Web files/181 tests, production build/CSP, validation config tests, and development,
  validation, and deployment Compose config rendering. No migration was added or changed.

### Definition of Done

- [x] Tested infrastructure/provider failures degrade safely without corrupting PostgreSQL-authoritative business state.
- [x] Recovery does not create duplicate booking, payment, refund, notification, order, inventory, or queue transitions.
- [x] Critical concurrency and idempotency boundaries have deterministic regression coverage.
- [x] No unnecessary infrastructure was added solely for theoretical production scale.
- [x] Canonical operations, architecture, testing, security, deployment, and scalability docs contain verified behavior rather than theoretical claims.

---

## TASK-PROD-005: End-to-End Demo Readiness and Final Acceptance

**Status:** [x] Completed (2026-08-11)
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

- [x] Audit critical journeys for Platform Admin, Organization Owner, Branch Manager, Staff, and Customer.
- [x] Validate organization lifecycle: application → Admin approval → Owner activation → organization setup.
- [x] Validate business setup: branch → catalog → queue → staff assignment → QR/customer entry.
- [x] Validate customer journey: QR/LIFF → queue/service selection → order → demo payment → ticket → LINE notification → queue processing → completion/history.
- [x] Validate Branch Manager and Staff queue operations, including Notification Operations and strict branch/assigned-queue authorization.
- [x] Validate Platform Admin Operational Health Dashboard without exposing tenant/customer detail.
- [x] Validate demo payment/refund behavior and clearly distinguish it from retained real-PSP production architecture.
- [x] Review desktop/mobile responsive behavior and fix blocking navigation, overflow, loading, empty, error, disabled, and success-state issues.
- [x] Validate critical journeys in `ja`, `vi`, and `en` with Japanese fallback.
- [x] Review representative demo fixtures so normal, busy queue, failed notification, payment/refund, and recovery scenarios can be demonstrated consistently.
- [x] Run final security regression for authentication, tenant isolation, role/scope enforcement, browser-authoritative fields, secrets, and sensitive responses.
- [x] Run final deployment smoke tests for Web, API, PostgreSQL, Redis, worker, SSE/realtime, LINE/mock integration, and demo payment.
- [x] Review remaining TODO/FIXME/known limitations that affect critical demo flows and resolve only blockers or material correctness issues.
- [x] Update README/demo guide with setup, demo accounts/data, recommended demonstration flow, known limitations, and intentionally deferred commercial-production capabilities.
- [x] Document real PSP merchant acceptance, settlement/reconciliation, enterprise SLO/on-call infrastructure, and production-data forecast calibration as future production work where relevant.

### Tests and Validation

- [x] Ensure automated E2E covers the highest-value critical journeys and authorization boundaries.
- [x] Run lint, typecheck, tests, build, format, OpenAPI, Storybook/browser tests, migration checks, and deployment validation required by `AGENTS.md`.
- [x] Perform final smoke validation against a clean isolated demo environment.
- [x] Verify representative demo data can reproduce the intended demonstration flow.
- [x] Record remaining external acceptance requirements separately from implementation defects.

### Completion Evidence

- The browser acceptance suite verifies mock-LIFF friendship synchronization and booking/payment
  return, Staff queue transitions and receipt access, strict LINE delivery scope, public application
  approval, sanitized Admin health, server-authoritative idempotent demo refunds, branch QR/settings,
  desktop/mobile navigation, and persisted Japanese/English/Vietnamese locale selection.
- The E2E fixture is repeatable and provides deterministic paid, unpaid, failed, and fully refunded
  orders with matching item and demo transaction state. A clean migration through `000028` produces
  the same 44 application tables, 602 application column signatures, and 188 application indexes as
  the synchronized reset schema.
- A LIFF friendship consent-source mismatch found during the end-to-end audit was corrected with a
  forward migration and reset-schema parity. The customer flow now fails visibly in E2E if backend
  friendship synchronization regresses.
- Required repository validation passed: dependency audit, formatting, lint, typecheck, OpenAPI,
  109 API suites/664 tests, 54 Web files/181 tests, production build/CSP, Storybook static build,
  16 Playwright scenarios, migration/fixture repeatability, all Compose configuration renders, and
  the isolated TASK-11 runtime/recovery smoke topology.
- `docs/guide/DEMO_ACCEPTANCE.md` records the executable demo journey, identities, evidence map,
  known runtime boundaries, and external LINE/merchant/SMTP/storage/legal/operational acceptance
  gates. Those deferred gates are not represented as implementation defects or mock acceptance.

### Definition of Done

- [x] The complete primary business journey can be demonstrated reliably from onboarding through queue completion.
- [x] All primary roles have verified authorization boundaries and usable critical journeys.
- [x] Critical queue, inventory, payment, notification, realtime, and recovery behavior has regression coverage.
- [x] Demo deployment is stable and documentation accurately distinguishes implemented behavior from deferred commercial-production acceptance.
- [x] No known blocker prevents LINE Smart Queue Assistant from being presented as a production-oriented demo.
- [x] No further major production capability is required for the current project scope.
