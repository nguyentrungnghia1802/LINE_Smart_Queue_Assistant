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

- [x] Document authorization: platform Admin sees all tenants; owner/branch manager sees permitted tenant scope only.
- [x] Add paginated repository queries for status, organization, branch, event type, and time range filters.
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
**Status:** [ ] Not started
**Priority:** P0
**Dependencies:** Approved launch-market PSP, merchant sandbox account, existing payment gateway abstraction

### Objective

Complete one real payment provider while preserving server-authoritative payment state, replay-safe
webhooks, audited refunds, and explicit demo-mode isolation.

### Implementation Checklist

- [ ] Record the selected PSP and market in an ADR before provider-specific implementation.
- [ ] Define provider configuration, secret ownership, credential rotation, timeout, and degraded-mode behavior.
- [ ] Implement intent creation, hosted checkout/QR mapping, return verification, webhook parsing, and error mapping.
- [ ] Verify webhook signature, timestamp, provider event ID, amount, currency, and merchant account server-side.
- [ ] Preserve payment state-machine rules and reject browser-declared success.
- [ ] Add idempotency for intent creation, webhook application, refund request, and provider callback replay.
- [ ] Implement provider-side full and partial refund execution through the existing payment service boundary.
- [ ] Distinguish retryable network/rate-limit failures from permanent provider rejection.
- [ ] Store only required normalized provider references and sanitized operational errors.
- [ ] Add organization capability/configuration state so an unverified provider cannot become active.
- [ ] Keep demo provider available only in explicit local/test or approved demonstration environments.
- [ ] Add forward migration and reset-schema synchronization only if the normalized transaction model needs new fields.

### Tests and Validation

- [ ] Add provider contract tests for request/response mapping, signature verification, timeout, and error categories.
- [ ] Add integration tests for duplicate webhooks, amount mismatch, concurrent callback/refund, and rollback.
- [ ] Add sandbox E2E for paid, failed, cancelled, full refund, and partial refund paths.
- [ ] Run lint, typecheck, tests, build, format, OpenAPI, migration status/up, and clean-database validation.

### Definition of Done

- [ ] Only verified server events can mark a transaction paid or refunded.
- [ ] Every provider action is idempotent, tenant-scoped, audited, and safely observable.
- [ ] Canonical architecture, API, database, product, deployment, and operations docs are updated.

---

## TASK-PROD-003: Payment Settlement and Reconciliation Workspace

**Idea:** 2. Production Payment, Refund, and Settlement Operations
**Status:** [ ] Not started
**Priority:** P0
**Dependencies:** TASK-PROD-002 completed; provider settlement/report API or approved import format

### Objective

Give authorized finance operators an auditable view of collected, refunded, fee, mismatch, and
expected-settlement amounts, with safe reconciliation controls.

### Implementation Checklist

- [ ] Define normalized settlement, fee, reconciliation status, mismatch reason, and external reference fields.
- [ ] Add forward migration with foreign keys, uniqueness, indexes, deletion behavior, and backfill strategy.
- [ ] Implement provider settlement fetch/import behind a provider-neutral adapter.
- [ ] Make scheduled reconciliation idempotent and safe across retries, restarts, and multiple replicas.
- [ ] Match provider records to transactions by trusted merchant, currency, amount, and external references.
- [ ] Keep unmatched, amount-mismatched, duplicate, and delayed settlements visible without mutating orders incorrectly.
- [ ] Add paginated branch/organization operations APIs with strict tenant authorization.
- [ ] Add guarded manual reconciliation requiring reason, actor, timestamp, and immutable audit evidence.
- [ ] Build responsive payment operations UI with summary totals, filters, detail, and discrepancy states.
- [ ] Keep receipt totals derived from verified net collected/refunded transactions.
- [ ] Add reconciliation backlog, mismatch, provider failure, and settlement-lag metrics.
- [ ] Document daily reconciliation, escalation, provider outage, and accounting export procedures.

### Tests and Validation

- [ ] Test matching, duplicates, partial settlement, fee differences, refund timing, and manual resolution.
- [ ] Test concurrent workers, retries, restart recovery, tenant isolation, pagination, and audit behavior.
- [ ] Test UI totals, filters, empty/error states, responsive layout, and locale fallback.
- [ ] Run all required code, OpenAPI, migration, clean-database, and provider-sandbox validations.

### Definition of Done

- [ ] Finance can explain each receipt, refund, fee, mismatch, and expected settlement from system records.
- [ ] Reconciliation never changes payment/order state without a verified and audited rule.
- [ ] Database, API, product, operations, deployment, and testing docs match implementation.

---

## TASK-PROD-004: SLO and Operations Console

**Idea:** 3. Service-Level Objectives and Operations Console
**Status:** [ ] Not started
**Priority:** P1
**Dependencies:** Existing Pino logs, metrics, OpenTelemetry, Sentry, health checks, release identifiers

### Objective

Define measurable reliability targets and provide a secure console that detects and scopes customer-
impacting incidents across API, workers, database, Redis, and external providers.

### Implementation Checklist

- [ ] Define SLOs and error budgets for booking latency, API availability, notification delay, and worker backlog.
- [ ] Record the approved telemetry/dashboard deployment boundary and ownership in an ADR or operations decision.
- [ ] Protect metrics access; do not expose internal metrics publicly or leak credentials/PII.
- [ ] Add release/environment identifiers to logs, traces, metrics, API, web, and worker processes.
- [ ] Export p50/p95/p99 latency for booking, queue transition, payment webhook, and LINE dispatch.
- [ ] Add PostgreSQL pool pressure, Redis degradation, worker heartbeat, and durable backlog indicators.
- [ ] Add safe provider availability for LINE, payment, email, routes, and object storage.
- [ ] Build platform and tenant-safe operational summaries without cross-tenant business data leakage.
- [ ] Add synthetic checks for public discovery, authenticated API health, and worker readiness.
- [ ] Define sustained error-budget alerts, ownership, escalation, and recovery procedures.
- [ ] Add incident correlation using safe request/trace IDs and deployment events.
- [ ] Validate degraded behavior when telemetry, Redis, worker, or an external provider is unavailable.

### Tests and Validation

- [ ] Test sanitization, authorization, metrics labels, fail-open telemetry, and release correlation.
- [ ] Validate dashboard values against controlled staging failure injection and synthetic checks.
- [ ] Run staged load tests for booking, call-next contention, SSE fan-out, and notification bursts.
- [ ] Run all required repository, security, Compose, and deployment configuration checks.

### Definition of Done

- [ ] Operators can detect, scope, and triage an incident from approved dashboards and runbooks.
- [ ] Alerts are actionable and observability failure cannot fail business operations.
- [ ] Architecture, deployment, operations, security, and scalability docs contain verified evidence.

---

## TASK-PROD-005: Calibrated Forecasting and Staff Planning

**Idea:** 4. Calibrated Demand Forecasting and Staff Planning
**Status:** [ ] Not started
**Priority:** P1
**Dependencies:** Sufficient production history, current forecast/staffing repositories, approved evaluation period

### Objective

Calibrate the transparent heuristic with measured history and provide explainable staffing ranges
without sending customer PII to an external AI service.

### Implementation Checklist

- [ ] Define forecast targets, minimum sample size, evaluation windows, error metrics, and fallback rules.
- [ ] Build privacy-safe features for branch, queue, weekday, hour, holidays, service mix, no-show, and cancellation.
- [ ] Preserve the current heuristic when history is sparse, stale, or outside confidence thresholds.
- [ ] Version every model/heuristic and persist version, confidence, sample size, and generated timestamp.
- [ ] Measure MAE/bias by branch, queue, weekday, hour, and service category without customer identifiers.
- [ ] Produce staffing ranges based on forecast workload rather than one false-precision value.
- [ ] Add a weekly manager view for expected arrivals, workload minutes, confidence, and risk periods.
- [ ] Explain recommendation factors in localized, nontechnical copy for `ja`, `vi`, and `en`.
- [ ] Let managers acknowledge or override a recommendation with an optional audited reason.
- [ ] Add drift detection when actual waits repeatedly exceed predicted confidence ranges.
- [ ] Run a shadow-evaluation period before recommendations influence operational planning.
- [ ] Add monthly accuracy reporting for branch managers and organization owners.

### Tests and Validation

- [ ] Test sparse history, closures, holidays, spikes, long services, missing data, and deterministic fallback.
- [ ] Test tenant/branch isolation, model version persistence, override audit, and locale fallback.
- [ ] Validate historical backtests and document measured accuracy before changing the default model.
- [ ] Run lint, typecheck, tests, build, format, migration checks if needed, and relevant browser E2E.

### Definition of Done

- [ ] Recommendations include confidence and evidence and measurably improve on the baseline heuristic.
- [ ] No generative-AI credential or external PII transfer is introduced without a separate approved ADR.
- [ ] Product, domain, database, API, codebase, testing, and roadmap docs reflect verified behavior.
