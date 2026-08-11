# LINE Smart Queue Assistant — Optimization Tasks

This phase starts after completion of the Production-Oriented Demo baseline.

The objective is to improve maintainability, performance, security, UX quality, operational clarity,
and stability of the existing system — **not to expand the product with major new capabilities**.

## Optimization Principles

- Audit and measure before modifying implementation; do not optimize based only on assumptions.
- Fix only demonstrated issues with clear technical or product value.
- Preserve validated business behavior unless a task explicitly requires a correction.
- Prefer small, targeted improvements over broad rewrites or speculative abstractions.
- Do not introduce new frameworks, infrastructure, or major subsystems unless a demonstrated problem
  cannot be solved safely with the existing architecture.
- Reuse existing architecture and shared boundaries where practical.
- Keep implementation, tests, configuration, and affected canonical documentation consistent.
- Treat unsupported production-scale claims as out of scope; record future improvements instead of
  implementing them without evidence.

---

## OPT-001: Codebase Cleanup and Technical Debt Reduction

**Status:** [x] Completed  
**Priority:** P0  
**Dependencies:** Completed production-oriented demo baseline

### Objective

Reduce avoidable code complexity and technical debt without changing validated business behavior.

This task should make the codebase easier to understand and maintain while avoiding large rewrites.

### Audit Scope

Inspect the current implementation for:

- dead code, unused files, unused exports, obsolete helpers, and stale compatibility paths;
- duplicated backend/frontend logic;
- stale `TODO`, `FIXME`, temporary workarounds, and comments that no longer reflect behavior;
- legacy shared types/enums that disagree with PostgreSQL/runtime mappings;
- inconsistent error handling, validation, naming, or module boundaries;
- oversized controllers/services/components where responsibilities are clearly mixed;
- duplicate auth/session/tenant-scope logic that should use existing shared boundaries;
- unnecessary dependencies or code paths no longer used by the current demo runtime;
- documentation references to removed or superseded implementation.

### Implementation Checklist

- [x] Produce a concise audit of demonstrated technical-debt findings before modifying code.
- [x] Classify findings as:
  - `P0`: correctness/security risk;
  - `P1`: maintainability or measurable runtime cost;
  - `P2`: cosmetic/low-value;
  - `Ignore`: not worth changing.
- [x] Fix all justified P0 findings.
- [x] Fix P1 findings only when the change is reasonably scoped and low-risk.
- [x] Remove dead/obsolete code only after verifying imports, scripts, tests, Docker references, and documentation.
- [x] Align shared types/enums with executable migrations/runtime mappings where safe.
- [x] Consolidate duplicated logic using existing architecture boundaries instead of creating new abstractions without value.
- [x] Keep route → controller → service → repository boundaries intact.
- [x] Avoid framework migrations, broad rewrites, or speculative abstractions.
- [x] Update tests and canonical docs for every material change.

### Tests and Validation

- [x] Run lint, typecheck, format, tests, OpenAPI checks, and production build required by `AGENTS.md`.
- [x] Run targeted regression tests for every refactored critical module.
- [x] Verify no role, tenant, branch, queue, payment, notification, or session behavior changed unintentionally.
- [x] Verify production/demo configuration still starts normally.

### Definition of Done

- [x] Demonstrated technical debt with meaningful value has been reduced.
- [x] No major architecture rewrite was introduced.
- [x] Critical business behavior remains unchanged and regression-tested.
- [x] Canonical docs accurately describe the cleaned implementation.

### Completion Evidence (2026-08-11)

- The classified audit and explicit retain/defer decisions are recorded in
  `docs/project/09_ROADMAP_AND_DECISIONS.md`.
- Shared persisted state values now match the reset schema and current notification event
  constraint, with `shared-domain-contract.test.ts` preventing drift.
- Removed only repository-wide unreferenced code and the obsolete React Router v5 declaration
  package; compatibility routes, historical migrations, deployment aliases, and backfills remain.
- Targeted validation passed for shared enum contracts, queue/staff call-next behavior, Storybook
  fixtures, and queue status badges.
- Full validation passed: lint, typecheck, formatting, OpenAPI (4 tests), API (110 suites/667 tests),
  web (54 files/182 tests), production build/CSP check, Storybook static build, and dependency audit.
- Existing payment runtime, development/production proxy configuration, role boundaries, and
  queue transitions remained covered by the full configuration and regression suites.

---

## OPT-002: Database and Backend Performance Optimization

**Status:** [x] Completed (2026-08-11)
**Priority:** P0  
**Dependencies:** OPT-001 completed

### Objective

Improve database/API efficiency using measurements from representative workloads while preserving
PostgreSQL as the authoritative business store.

Do not optimize for theoretical scale. Optimize only demonstrated hotspots.

### Measurement Scope

Prioritize these paths:

- public branch/QR/catalog resolution;
- booking/order creation;
- customer ticket/current-booking reads;
- Staff queue overview and queue transitions;
- Manager/Owner analytics;
- notification and ETA/background scans;
- inventory and payment/reconciliation queries;
- PostgreSQL pool/transaction behavior.

### Implementation Checklist

- [x] Capture a baseline for representative critical endpoints before optimization.
- [x] Inspect relevant SQL using `EXPLAIN (ANALYZE, BUFFERS)` with representative demo/validation data where practical.
- [x] Identify actual query fan-out, N+1 patterns, unnecessary repeated reads, expensive sorts/scans, or avoidable round trips.
- [x] Review existing indexes before adding new ones.
- [x] Add/change indexes only when query evidence justifies them.
- [x] Reduce avoidable database work while keeping authorization and write decisions PostgreSQL-authoritative.
- [x] Review cache usage and invalidation; do not allow Redis/cache state to become business authority.
- [x] Review transaction duration, lock scope, retry boundaries, and PostgreSQL pool usage.
- [x] Move external/provider work out of database transactions only when current implementation demonstrably holds transactions unnecessarily.
- [x] Keep booking, inventory, payment, queue transitions, and counters transactionally correct.
- [x] Preserve SSE/REST authoritative reconciliation behavior.
- [x] Add a forward migration only if schema/index changes are required.
- [x] Update scalability/performance documentation with measured before/after evidence.

### Suggested Performance Targets

Use existing project targets where available. At minimum, avoid regressions in:

- public/queue read latency;
- booking transaction latency;
- Staff queue operations;
- error rate under representative concurrency;
- PostgreSQL connection/pool pressure.

Targets are engineering guidance, not unsupported production capacity claims.

### Tests and Validation

- [x] Run targeted integration/concurrency tests for changed queries and transactions.
- [x] Run representative load measurements before and after changes.
- [x] Verify no oversell, duplicate ticket/order, double call-next, or payment-state regression.
- [x] Verify cache loss/Redis outage still falls back safely to PostgreSQL.
- [x] Run migration, lint, typecheck, tests, build, OpenAPI, Compose/config, and required validation from `AGENTS.md`.

### Completion Evidence (2026-08-11)

- Staff overview repository reads are bounded at six for the maximum preview shape instead of 21
  cold calls (19 with warm queue configuration) for two queues and eight entries.
- Rollback-only PostgreSQL plans measured batch counts at 0.372 ms, the indexed waiting preview at
  0.061 ms, batch enrichment at 4.140 ms, and a 50-row location claim from 1,000 due rows at
  10.751 ms. Existing indexes were sufficient, so no migration was added.
- Location alerts now use recoverable timestamp leases, perform provider I/O outside transactions,
  and atomically enqueue/finalize only the matching claim.
- Targeted Staff/order/location tests passed 18/18. Full API passed 112 suites/672 tests; Web passed
  54 files/182 tests. Lint, typecheck, formatting, OpenAPI (4/4), production build/CSP, dependency
  audit, migration status/apply, Compose config, and horizontal config validation passed.
- The isolated two-API validation passed 160/160 public reads with zero errors, both upstreams,
  Redis/cache fallback, durable worker recovery, cross-instance SSE, API restart, PostgreSQL
  readiness failure/recovery, and zero waiting PostgreSQL clients in the measured snapshot.

### Definition of Done

- [x] At least the measured hotspots have evidence-based improvements or are documented as already acceptable.
- [x] No optimization weakens transaction, authorization, or data-consistency guarantees.
- [x] Performance claims include reproducible evidence rather than assumptions.
- [x] Canonical database, architecture, testing, and scalability docs match the result.

---

## OPT-003: Frontend Performance and UX Polish

**Status:** [x] Completed (2026-08-11)
**Priority:** P1  
**Dependencies:** OPT-002 completed

### Objective

Improve perceived speed, browser efficiency, responsive usability, and interaction quality without
redesigning validated product workflows.

### Audit Scope

Inspect:

- Vite production bundle and route/component loading;
- duplicate API requests;
- TanStack Query caching/refetch behavior;
- SSE plus polling interaction;
- unnecessary React rerenders;
- large lists/tables and expensive derived state;
- image/media loading;
- responsive navigation and overflow;
- modal/dialog fit;
- loading, empty, error, disabled, retry, and success states;
- Japanese/Vietnamese/English label length;
- keyboard/focus/accessibility behavior.

### Implementation Checklist

- [x] Capture current production bundle/build evidence before changes.
- [x] Identify measurable duplicate fetches, rerender hotspots, or unnecessarily eager code loading.
- [x] Apply route/component lazy loading only where it provides real value and does not harm reliability.
- [x] Tune query stale/refetch/polling behavior without weakening realtime recovery.
- [x] Keep REST authoritative; SSE remains an invalidation/reconciliation mechanism.
- [x] Remove unnecessary renders/state duplication where demonstrated.
- [x] Improve image/media loading behavior where needed.
- [x] Verify shared navigation remains scalable with additional destinations and long localized labels.
- [x] Fix page-level overflow, modal clipping, hidden controls, and mobile layout issues found during audit.
- [x] Improve accessibility for keyboard navigation, focus, labels, ARIA, and reduced-motion behavior where gaps are found.
- [x] Keep all visible copy localized in `ja`, `vi`, and `en` with Japanese fallback.
- [x] Do not introduce a new frontend framework or redesign major information architecture.

### Tests and Validation

- [x] Add/update component tests for changed interactions.
- [x] Update Storybook stories for changed reusable UI states.
- [x] Run representative desktop/mobile browser E2E.
- [x] Verify no critical route has page-level horizontal overflow.
- [x] Verify customer LIFF, Staff, Manager, and Admin critical flows still work.
- [x] Run lint, typecheck, tests, Storybook build, production build/CSP, and required validation.

### Completion Evidence (2026-08-11)

- Production Vite evidence reduced the eager page entry from 728.14 kB / 156.56 kB gzip to
  23.74 kB / 7.02 kB gzip and removed the catch-all 684.87 kB eager vendor chunk. The LIFF-only
  dependency graph is now deferred to the LIFF route instead of loading for every role.
- Public, LIFF, Staff, Manager, and Admin pages/layouts use route-level React lazy loading with one
  localized accessible fallback. Repeated list/order images use native lazy loading and async
  decoding; the shared spinner respects reduced-motion preference.
- Existing TanStack Query stale/refetch policy and SSE-aware degraded polling were retained because
  the audit found no correctness or duplicate-fetch defect. REST remains authoritative and SSE
  remains an invalidation/reconciliation hint.
- Full API validation passed 112 suites / 672 tests; Web passed 56 files / 185 tests. Lint,
  typecheck, formatting, OpenAPI 4/4, production build/CSP, migration status, and Storybook static
  build passed.
- Playwright passed 8/8 desktop/mobile responsive cases across Customer LIFF, Staff, Manager, and
  Admin, including navigation availability and page-level horizontal-overflow assertions.
- No dependency, API, authorization, workflow, database schema, or migration change was required.

### Definition of Done

- [x] Demonstrated frontend inefficiencies or usability issues have been improved.
- [x] Critical flows remain stable across desktop/mobile and all supported locales.
- [x] Accessibility and responsive behavior do not regress.
- [x] No unnecessary frontend architecture rewrite was introduced.

---

## OPT-004: Security and Boundary Hardening

**Status:** [x] Completed (2026-08-11)
**Priority:** P1  
**Dependencies:** OPT-003 completed

### Objective

Perform a focused security hardening pass across the system's real attack surface and close
demonstrated weaknesses without adding enterprise security infrastructure that the project does not need.

### Audit Scope

Review:

- authentication and refresh-session lifecycle;
- JWT/cookie handling;
- role/tenant/branch/queue authorization;
- LINE identity/link verification;
- LINE and payment webhook verification;
- public write endpoints and rate limits;
- request validation and browser-authoritative fields;
- media upload/storage boundary;
- CORS, CSP, proxy/trust settings, and security headers;
- secret/config handling;
- logs, metrics, traces, audit records, and error sanitization.

### Required Authorization Regression Matrix

At minimum verify rejection of:

- Manager accessing another organization/branch;
- Staff accessing another branch or queue;
- Staff accessing notification operations outside assigned queue;
- Customer accessing another customer's ticket/order;
- Organization Owner using branch operational endpoints;
- Platform Admin using tenant-private operational endpoints not explicitly allowed;
- browser-supplied tenant/branch/queue/LINE/payment authority.

### Implementation Checklist

- [x] Audit current controls before changing implementation.
- [x] Fix demonstrated authorization, validation, rate-limit, session, webhook, upload, or secret-handling gaps.
- [x] Verify access/refresh tokens are not persisted insecurely in browser storage.
- [x] Verify sensitive provider/customer data is not exposed through errors, logs, metrics, traces, or operational APIs.
- [x] Verify webhook signature/idempotency behavior remains server-authoritative.
- [x] Verify production/demo configuration cannot accidentally activate real external payment behavior without explicit valid configuration.
- [x] Review dependency/security audit findings and fix applicable high-value issues.
- [x] Avoid adding WAF/SIEM/enterprise IAM infrastructure unless an actual requirement exists.
- [x] Update security, deployment, API, and operations docs for material changes.

### Tests and Validation

- [x] Add/extend authorization matrix regression tests.
- [x] Test invalid/replayed sessions and webhook requests.
- [x] Test unsafe cross-tenant/cross-queue access attempts.
- [x] Test sanitization of logs/errors/operational responses.
- [x] Run dependency audit, lint, typecheck, tests, build, OpenAPI, security/config checks, and required validation.

### Definition of Done

- [x] No known material security boundary defect remains in the tested project scope.
- [x] Tenant, branch, queue, customer, payment, and notification authority remains server-derived.
- [x] Sensitive data is not unnecessarily exposed.
- [x] Hardening remains appropriate for a production-oriented demo rather than an enterprise security platform.

### Completion Notes

- Removed unused generic Platform Admin user listing/create/deactivate authority and constrained
  user detail to self or assigned-branch Staff reads by a non-owner Branch Manager. The Staff list
  is now server-fixed to the authenticated manager's branch and the `staff` role.
- Added a shared explicit user-response allowlist across users, Admin owner recovery, and branch
  manager invitations so credential hashes and internal invitation/deactivation actor fields do
  not cross HTTP response boundaries.
- Rate-limit keys now use only Express's trusted-proxy-resolved `req.ip`; raw left-most
  `X-Forwarded-For` values cannot replace the client key.
- Targeted security validation passed 13 suites / 80 tests. Full API validation passed 114 suites /
  682 tests; Web passed 56 files / 185 tests. Dependency audit reported 0 vulnerabilities. Gitleaks
  staged and full-history scans passed after exact-fingerprint baselining of 10 historical test
  password literals and two obsolete example-environment placeholders. Lint, typecheck,
  formatting, OpenAPI 4/4, production build, and CSP bundle validation passed.
- No dependency, migration, external service, or enterprise security infrastructure was added.

---

## OPT-005: Final Maintainability, Documentation, and Demo Baseline

**Status:** [x] Completed (2026-08-11)
**Priority:** P2  
**Dependencies:** OPT-004 completed

### Objective

Consolidate the optimized system into a clean, maintainable, reproducible demo baseline with
accurate documentation and no unnecessary feature expansion.

This is a closure task, not a new feature task.

### Implementation Checklist

- [x] Review all optimization changes and confirm canonical docs match current implementation.
- [x] Synchronize README, architecture, implementation map, API, database, testing, operations, deployment, scalability, and demo guides where affected.
- [x] Remove or archive obsolete documentation that could be mistaken for current truth.
- [x] Review `.env.example` and deployment examples for obsolete, duplicated, unsafe, or misleading configuration.
- [x] Verify demo payment mode and deferred real-PSP acceptance are documented clearly.
- [x] Verify known limitations distinguish implementation defects from intentionally deferred commercial-production work.
- [x] Review remaining TODO/FIXME items and classify them as blocker, future work, or intentionally ignored.
- [x] Verify representative demo fixtures and demo accounts still reproduce the documented journey.
- [x] Verify the recommended demo path from onboarding through queue completion.
- [x] Verify Git repository hygiene: generated artifacts, temporary output, secrets, and local environment files are not tracked.
- [x] Do not add new major features or architecture during this task.
- [x] Record a concise optimization summary and final evidence map.

### Final Validation

Run the final project validation required by `AGENTS.md`, including applicable:

- dependency/security audit;
- formatting;
- lint;
- typecheck;
- API/Web/shared tests;
- OpenAPI contract;
- production build/CSP;
- Storybook build;
- browser E2E;
- migration status/clean isolated migration;
- demo fixture repeatability;
- Docker/Compose configuration validation;
- critical deployment/recovery smoke validation.

Do not rerun expensive validation redundantly if `AGENTS.md` explicitly permits reuse of fresh,
unchanged evidence. Final completion must still have traceable evidence for every required gate.

### Definition of Done

- [x] The optimized system is maintainable, documented, reproducible, and stable.
- [x] Critical business flows and authorization boundaries remain verified.
- [x] No major known blocker prevents reliable demonstration.
- [x] Documentation accurately distinguishes demo behavior, production-oriented architecture, and deferred commercial-production work.
- [x] No further optimization task is required unless future evidence identifies a specific problem.
- [x] The project is ready to be frozen as the next stable demo baseline.

### Completion Notes

- Audited OPT-001 through OPT-004 against the implementation, route/OpenAPI inventory, 28
  migrations, deterministic fixtures, runtime configuration, Compose topology, CI gates, and
  canonical documentation. No API or database contract change was required.
- Corrected the production environment template to require S3-compatible media storage because
  production Compose has no API media volume. Strengthened the configuration regression so a
  commented S3 example can no longer satisfy the production assertion.
- Classified all eighteen README illustration TODO markers as deferred, non-blocking content work;
  marked completed task history explicitly historical and removed one tracked zero-byte obsolete
  idea file. Generated output, local environments, reports, coverage, and media remain untracked.
- Full API validation passed 114 suites / 682 tests; Web passed 56 files / 185 tests; OpenAPI passed
  4/4; browser E2E passed 16/16 across desktop and mobile. Lint, typecheck, formatting, production
  build/CSP, Storybook, three Compose config checks, and dependency audit (0 vulnerabilities) passed.
- A clean isolated PostgreSQL 16 database accepted all 28 migrations, reported no pending
  migration, and accepted the browser fixture twice. The integrated two-API/Redis/worker recovery
  rehearsal passed every check, including cross-instance auth/SSE, distributed rate limiting,
  cache/Redis loss, worker recovery, API restart, and database interruption. Full-history Gitleaks
  scanned 197 commits with no leaks found.
- Demo payment/refund remains an explicit local fixture path. Real PSP, LINE device/account, SMTP,
  maps, object-storage policy, legal, backup/restore, staging soak, and release-operations acceptance
  remain deferred production work rather than demo defects. No dependency, migration, major feature,
  or architecture expansion was introduced.

---

## Out of Scope for This Optimization Phase

Do not implement these unless a new explicit requirement is approved:

- microservices migration;
- Kubernetes;
- Kafka/event-streaming platform;
- distributed SQL/database replacement;
- WebSocket replacement for working SSE solely for technology preference;
- frontend framework rewrite;
- backend framework rewrite;
- ORM migration without demonstrated value;
- enterprise SLO/error-budget/on-call platform;
- real merchant settlement/accounting reconciliation;
- production PSP onboarding solely for demo purposes;
- production ML/AI forecasting without real data and an approved use case;
- multi-region/high-availability architecture without measured need.

Future ideas should be recorded as deferred work rather than implemented automatically.
