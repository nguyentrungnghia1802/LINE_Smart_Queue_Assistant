# Repository Agent Instructions

These rules apply to coding agents and contributors working in this repository.

This file defines stable repository-wide rules only. Task plans, issue files, implementation plans,
roadmaps, and temporary instructions are context only when the current prompt explicitly asks for them.

The current prompt defines the requested task and the allowed level of Git/remote finalization.

---

# 1. Read First

For every task, read:

1. `AGENTS.md`
2. `docs/project/00_PROJECT_CONTEXT.md`
3. The relevant source files and tests

Add only the canonical documents needed for the task:

| Task                      | Required context                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Product behavior          | `docs/project/01_PRODUCT_REQUIREMENTS.md`, `docs/project/03_DOMAIN_AND_FLOWS.md`                                          |
| Architecture              | `docs/project/02_SYSTEM_ARCHITECTURE.md`, `docs/project/06_CODEBASE_GUIDE.md`, `docs/project/09_ROADMAP_AND_DECISIONS.md` |
| Database                  | `docs/project/04_DATABASE.md`, relevant migrations, repositories, integration tests                                       |
| API                       | `docs/project/05_API.md`, routes, validators, controllers, services, frontend clients                                     |
| Local development/testing | `docs/project/07_DEVELOPMENT_AND_TESTING.md`                                                                              |
| Deployment/operations     | `docs/project/08_DEPLOYMENT_AND_OPERATIONS.md`, Docker/Compose/CI files, `.env.example`                                   |

Do not read `docs/archive` unless historical investigation is required.

Prefer the smallest context set that is sufficient to understand and implement the requested change correctly.

---

# 2. Task Intake, Scope, And Sources Of Truth

The current prompt defines the task.

Additional files such as `task.md`, issue descriptions, migration plans, or implementation plans are active
only when the current prompt explicitly references them.

Before editing:

1. Inspect the current branch and working tree.
2. Identify the exact requested outcome.
3. Inspect the relevant implementation, tests, configuration, and dependencies.
4. Identify affected contracts: product, architecture, database, API, frontend, security, operations, documentation.
5. Preserve unrelated user work.
6. Keep implementation inside the requested scope.

Do not:

- implement adjacent roadmap items opportunistically;
- perform unrelated refactors;
- introduce new infrastructure without a concrete requirement;
- change established product behavior merely to simplify implementation;
- treat a planning file as active merely because it exists.

When requirements are ambiguous:

1. Resolve them from canonical documentation and existing behavior when possible.
2. State any necessary assumption explicitly.
3. Ask before making a material product or architecture decision that cannot be safely inferred.

Use this source hierarchy:

1. Product intent: `docs/project/01_PRODUCT_REQUIREMENTS.md`
2. Domain states/flows: `docs/project/03_DOMAIN_AND_FLOWS.md`
3. Accepted architecture/limitations: `docs/project/09_ROADMAP_AND_DECISIONS.md`
4. Runtime behavior: source code and automated tests
5. Database executable state: `db/migrations/node-pg-migrate`
6. API executable contract: Express routes and Zod validators
7. Runtime configuration: `.env.example`, API config, Vite config, Docker Compose, deployment config

Human-readable database/API docs are maps, not substitutes for executable state.

When documentation and implementation disagree:

- distinguish intended behavior from currently implemented behavior;
- use product requirements, accepted ADRs, domain flows, constraints, tests, and surrounding code to resolve intent;
- do not document an apparent bug as intended behavior;
- do not silently change a documented business rule;
- update implementation, tests, and affected canonical docs together once intent is established;
- stop and report if the conflict cannot be resolved safely.

---

# 3. Repository-Wide Product Invariants

These rules apply whenever relevant:

- Visible application UI and customer messages use translation keys for `ja`, `vi`, and `en`.
- Japanese is the default locale and final fallback.
- Code identifiers, comments, logs, commit messages, and technical documentation use English.
- Platform `admin` is global.
- `manager` and `staff` authorization requires active `organization_members` membership.
- Branch-scoped roles must not gain authority from browser-supplied body/query parameters.
- Public branch URLs are discovery redirects into LIFF.
- Booking requires a verified LINE customer session.
- LINE notifications additionally require:
  - an active linked LINE account;
  - a valid `line_user_id` on the relevant queue entry.
- `stock_quantity = NULL` means unlimited stock.
- Finite stock must be checked and changed atomically.
- `requires_prepayment = TRUE` requires successful verified payment before order creation.
- Never trust browser-supplied:
  - payment amount;
  - product price;
  - role;
  - organization ID;
  - branch authority;
  - payment status.

Verify affected product rules against canonical product/domain docs before changing behavior.

---

# 4. Architecture And Dependency Boundaries

Preserve the modular-monolith architecture unless an accepted ADR explicitly changes it.

Backend ownership:

- Routes: endpoints, middleware, API version structure.
- Controllers: HTTP translation, trusted actor context, service invocation, standard responses.
- Validators: Zod request contracts and untrusted-input validation.
- Services: business rules, application workflows, transaction orchestration, authorization-sensitive decisions.
- Repositories: SQL, database mapping, persistence access.
- Integrations: third-party transports such as LINE, payment, email, routing, media/object storage.
- Shared package: framework-independent shared code.

Do not place business logic in:

- React components;
- Express routes;
- repositories;
- provider adapters.

Before adding a runtime dependency or infrastructure component:

1. Identify the concrete problem it solves.
2. Check whether an existing mechanism already solves it.
3. Prefer extending an existing abstraction over creating a parallel architecture.
4. Define ownership, lifecycle, failure/degraded behavior, observability, rollback implications, and authoritative state.
5. Add configuration, tests, health/observability, and operational documentation as appropriate.

Do not add technology solely to expand the stack.

---

# 5. Database And API Rules

## Database

For schema changes:

- add a new forward migration;
- never rewrite a migration that may already have been applied;
- keep `db/schema/reset_line_queue_schema.sql` synchronized;
- use transactions for multi-table or concurrency-sensitive writes;
- define foreign keys, checks, indexes, uniqueness, deletion behavior, and rollback behavior explicitly;
- review concurrency, tenant isolation, existing data, and backfill implications;
- validate against a clean database where relevant.

Never use the destructive reset script on shared, staging, or production data.

## API

Keep `/api/v1` unless a deliberate versioning decision is recorded.

Use the standard success/error envelopes from:

`apps/api/src/utils/response.ts`

For affected endpoints, apply as appropriate:

- authentication;
- role checks;
- organization/branch ownership checks;
- validation;
- rate limiting;
- idempotency;
- transaction boundaries.

When API behavior changes, update the affected:

- routes;
- validators;
- controllers;
- services;
- repositories;
- backend tests;
- frontend API clients/types;
- Swagger/OpenAPI source;
- `docs/project/05_API.md`.

Do not expose stack traces, secrets, provider payloads, authorization headers, cross-organization records,
or sensitive implementation details.

Browser-supplied IDs are selectors, not authority.

---

# 6. Security And Privacy

Security applies to every task.

Never commit or expose:

- `.env`;
- access tokens;
- channel secrets;
- JWT secrets;
- passwords;
- real customer data;
- payment-provider secrets;
- object-storage credentials;
- Redis credentials;
- SSH private keys;
- production backup payloads.

Treat every `VITE_*` variable as public browser data.

Authentication/authorization:

- derive trusted identity from server-side authentication/session state;
- verify active tenant membership;
- enforce branch scope server-side;
- never trust browser-provided role or tenant authority.

LINE:

- verify webhook signatures against the raw request body;
- never trust browser-supplied `line_user_id`.

Credentials/logging:

- use the established password hashing mechanism;
- never log credentials, authorization headers, cookies, refresh tokens, or raw provider secrets.

Uploads:

- validate type, size, and content as appropriate.

Production media:

- use durable storage outside the writable container layer;
- current production demo uses the `media_data` volume at `/app/var/media`;
- S3-compatible storage remains optional for later external/multi-host deployment.

Location collection requires explicit consent, purpose limitation, minimum retention, and documented deletion behavior.

Telemetry must avoid unnecessary PII and high-cardinality labels such as user/order/ticket/request IDs.

Observability failure must not fail business operations.

---

# 7. Frontend, Background Jobs, And Concurrency

## Frontend

React components may render state, collect input, trigger API actions, and manage presentation behavior.

They must not become the source of truth for:

- authorization;
- payment validity;
- stock correctness;
- queue transition correctness;
- tenant ownership.

Use existing project conventions for TanStack Query, auth/session state, localization, routing, and reusable components.

For user-facing changes, handle applicable loading, empty, error, disabled, success, responsive, and locale states.

## Background jobs

Preserve idempotency and prevent duplicate business effects.

Use existing PostgreSQL/advisory-lock/outbox mechanisms where applicable.

Do not introduce unsafe database-to-queue dual writes.

Define:

- retry behavior;
- retryable vs permanent failures;
- ownership/coordination for multi-process execution.

Avoid retry storms and respect provider rate limits.

Provider failure must not corrupt committed business state.

---

# 8. Validation

Validation follows the impact surface of the change.

Test the changed component and its direct dependents first.

Do not run unrelated repository-wide tests merely because they exist.

Before choosing validation:

1. Identify the changed files/modules.
2. Identify the behavior or contracts they affect.
3. Identify direct dependents that could regress.
4. Select the narrowest checks that provide reasonable confidence.
5. Expand validation only when the impact surface or observed failures justify it.

## Default validation strategy

Use targeted checks by default.

Examples:

| Change                                | Expected validation                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| Documentation/task status only        | formatting, spell/docs checks if applicable                                             |
| Shell/deployment script               | ShellCheck/static validation, script rehearsal/dry-run, affected Compose/runtime checks |
| Nginx/Compose/config                  | syntax/config validation and affected runtime smoke test                                |
| React component/page                  | relevant frontend tests, affected lint/typecheck, E2E only for critical flow changes    |
| API controller/service/route          | relevant API unit/integration tests, affected lint/typecheck                            |
| API contract                          | relevant API tests plus `npm run openapi:check`                                         |
| Repository/data access                | relevant repository/integration tests                                                   |
| Database migration/schema             | migration/status/schema/integration checks, clean database validation when relevant     |
| Worker/background job                 | relevant worker/job tests, retry/idempotency/concurrency checks                         |
| Shared package                        | shared tests plus directly dependent workspaces                                         |
| Security-sensitive behavior           | relevant targeted tests plus applicable security/dependency checks                      |
| Cross-cutting/release-critical change | broaden validation; full repository suite may be appropriate                            |

Do not run API tests for a documentation-only change.

Do not run the entire frontend suite for an isolated backend-only change unless the changed contract is consumed by the frontend.

Do not run the entire repository build/test suite for an isolated operational script when script-specific validation provides sufficient confidence.

## When to broaden validation

Expand beyond targeted checks when one or more of these applies:

- shared contracts or shared packages changed;
- multiple workspaces/modules are materially affected;
- database/API/frontend behavior crosses module boundaries;
- authentication, authorization, payment, stock, queue transitions, or other critical business invariants changed;
- infrastructure/release behavior can affect the whole deployment;
- targeted validation reveals failures outside the initial scope;
- the impact surface cannot be determined confidently;
- the current prompt explicitly requests broader/full validation;
- repository CI/release requirements require broader checks.

## Full repository validation

The full suite is not the default.

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
```

only when justified by the impact surface, release risk, CI requirements, or explicit prompt.

## Additional change-specific checks

### API contract changes

```bash
npm run openapi:check
```

### Database changes

```bash
npm run db:migrate:status
npm run db:migrate
```

Also validate relevant schema behavior against a clean database where appropriate.

### Critical browser workflow changes

Run the relevant Playwright E2E scope.

Do not run unrelated E2E suites when a narrower scope is sufficient.

### Dependency/security-sensitive changes

Run the applicable repository dependency/security checks.

### Deployment/Compose changes

Validate the affected Docker/Compose/Nginx configuration and smoke-test or rehearse the changed runtime path where practical.

## Validation reporting

Always report:

- which checks were run;
- what scope they covered;
- whether they passed;
- why that validation was sufficient for the observed impact surface.

If a relevant check cannot be run, report:

1. the exact command/check;
2. why it could not run;
3. what risk remains.

Never claim a check passed when it was not executed.

---

# 9. Definition Of Done And Documentation

If the task comes from an explicitly referenced task-plan file, update its status/checklist accurately
after successful implementation and validation.

A change is complete only when all applicable conditions are satisfied:

- behavior matches intended business rules;
- existing compatible behavior is preserved unless intentionally changed;
- authentication and tenant/branch boundaries remain correct;
- edge cases and meaningful failure paths are covered;
- database changes are deployable and transaction/concurrency behavior is understood;
- idempotency and retry/degraded behavior are preserved where required;
- no secret or sensitive data is exposed;
- relevant targeted validation passes;
- regression coverage is added for changed behavior where meaningful;
- affected canonical docs/config examples describe the verified implementation;
- unrelated user changes remain untouched;
- no temporary bypass/debug configuration remains.

Update only affected canonical documents:

| Change type           | Documentation to review                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| Product/business      | `01_PRODUCT_REQUIREMENTS.md`, `03_DOMAIN_AND_FLOWS.md`                             |
| Architecture          | `02_SYSTEM_ARCHITECTURE.md`, `06_CODEBASE_GUIDE.md`, `09_ROADMAP_AND_DECISIONS.md` |
| Database              | `04_DATABASE.md`                                                                   |
| API                   | `05_API.md`                                                                        |
| Development/testing   | `07_DEVELOPMENT_AND_TESTING.md`                                                    |
| Deployment/operations | `08_DEPLOYMENT_AND_OPERATIONS.md`                                                  |
| Project scope/status  | `00_PROJECT_CONTEXT.md`                                                            |

Do not modify `docs/archive` unless historical work is explicitly required.

Record major architecture decisions through the established ADR/decision mechanism.

Do not silently rewrite historical decisions; supersede them explicitly.

---

# 10. Branch And Repository Safety

Before editing repository state:

1. Inspect the current branch.
2. Inspect the working tree.
3. Identify unrelated uncommitted changes.
4. Preserve unrelated work.

For new feature/fix work, use an appropriately named task branch when branch creation is part of the requested workflow.

Suggested names:

- `feat/<short-name>`
- `fix/<short-name>`
- `chore/<short-name>`

Keep commits focused on the current scope.

Do not:

- rewrite shared history;
- force-push unless explicitly requested and confirmed safe;
- discard unrelated changes;
- reset unrelated files;
- destructively clean the working tree;
- bypass branch protection, required CI, repository rules, or approvals.

If unrelated user work prevents safe implementation, report the conflict instead of overwriting it.

---

# 11. Git And Remote Finalization

Git/remote operations require explicit authorization from the current prompt.

The prompt may authorize any of these levels:

1. Implementation only.
2. Commit only.
3. Commit + push task branch.
4. Commit + push + create/update Pull Request.
5. Commit + push + Pull Request + merge/auto-merge.

Never perform a higher level than the prompt explicitly requests.

Do not assume that "complete the task" means create PR, merge, push protected branches, enable auto-merge,
or delete branches.

Before any authorized finalization:

- ensure implementation, targeted validation, task status, and affected docs are complete;
- inspect branch, diff, working tree, and relevant remote state;
- commit only intended changes;
- exclude secrets, runtime `.env`, credentials, production backup data, and temporary artifacts.

Remote CI is asynchronous by default and must not block ordinary finalization.

- For level 3, push the task branch, verify that the push succeeded, and stop.
- For level 4, push the task branch, create/update the Pull Request, verify that the remote operation succeeded, and stop.
- Do not wait for CI/status checks after push or Pull Request creation unless the current prompt explicitly asks to wait, monitor, diagnose, or merge.
- Do not repeatedly poll CI/status checks merely to report their eventual result.
- A pending remote CI run does not make level 3 or level 4 incomplete.
- If an already-known CI failure is directly relevant to the requested work, report it; do not expand scope automatically unless the prompt authorizes fixing it.

Pull Request creation and merge are separate permissions:

- "create PR" means create/update the PR and stop before merge; remote CI may continue asynchronously;
- "create PR and merge" means merge only after required checks/rules pass;
- level 5 may wait for required CI/status checks because they are a prerequisite for the explicitly authorized merge;
- enable auto-merge only when explicitly requested.

Do not push task changes directly to protected `main`.

Do not use local merge + push as a workaround for protected PR workflow.

`chore/dev` is used only when the current prompt or active repository workflow explicitly requires it.

Branch deletion is allowed only when explicitly authorized, safely merged/no longer needed, and remote state is verified.

Never delete `main`. Do not delete `chore/dev` unless explicitly requested and confirmed safe.

Stop and report instead of continuing when:

- required targeted local validation failed;
- CI failed when the current prompt explicitly requires waiting for CI or completing a merge;
- remote state contains unexpected commits;
- merge conflicts are materially ambiguous;
- unrelated user work would be overwritten;
- repository rules block the requested operation;
- required approval is missing;
- destructive resolution would be required.

Leave the repository in the safest completed state and report the exact remaining action.

---

# 12. Handoff

Before ending a coding task, provide a concise handoff containing:

1. What was implemented.
2. Important architecture/business decisions.
3. Files changed.
4. Migrations added, if any.
5. Tests/checks executed and results.
6. Why the selected validation matched the change impact.
7. Documentation/configuration updated.
8. Remaining risks, limitations, or deferred work.
9. Required manual verification.
10. Whether the requested task is fully complete.

Do not claim completion when relevant validation or critical manual verification is still missing.

---

# 13. Engineering Principles

Prefer:

- correctness over cleverness;
- explicitness over hidden behavior;
- existing abstractions over parallel implementations;
- incremental evolution over rewrites;
- measured optimization over speculative complexity;
- durable state over ephemeral state for business truth;
- backward compatibility over unnecessary breaking changes;
- clear failure behavior over silent degradation;
- targeted validation over unrelated exhaustive validation.

Avoid:

- premature microservices;
- unnecessary infrastructure;
- duplicated business logic;
- speculative abstractions;
- silent product-rule changes;
- undocumented operational dependencies;
- technology additions made only for portfolio value;
- running broad validation without a concrete impact-based reason.

The goal is to keep the system correct, understandable, secure, maintainable, and production-ready
without wasting engineering time on unrelated work or validation.
