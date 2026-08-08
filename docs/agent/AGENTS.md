# Repository Agent Instructions

These rules apply to coding agents and contributors working in this repository.

The purpose of this file is to define stable repository-wide working rules.

It is intentionally independent from temporary task plans, issue files, roadmap fragments,
or one-off implementation documents.

Additional task files are read only when the current prompt explicitly asks for them.

---

# 1. Read First

For every task, read:

1. `AGENTS.md`
2. `docs/project/00_PROJECT_CONTEXT.md`
3. The relevant source files and tests

Add the following documents according to task type:

| Task                      | Required context                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Product behavior          | `docs/project/01_PRODUCT_REQUIREMENTS.md`, `docs/project/03_DOMAIN_AND_FLOWS.md`                                          |
| Architecture              | `docs/project/02_SYSTEM_ARCHITECTURE.md`, `docs/project/06_CODEBASE_GUIDE.md`, `docs/project/09_ROADMAP_AND_DECISIONS.md` |
| Database                  | `docs/project/04_DATABASE.md`, all relevant migrations, repositories, integration tests                                   |
| API                       | `docs/project/05_API.md`, routes, validators, controllers, services, frontend clients                                     |
| Local development/testing | `docs/project/07_DEVELOPMENT_AND_TESTING.md`                                                                              |
| Deployment/operations     | `docs/project/08_DEPLOYMENT_AND_OPERATIONS.md`, Compose/Docker/CI files, `.env.example`                                   |

Do not read `docs/archive` unless the task requires historical investigation.

Do not load unrelated canonical documents merely because they exist.

Prefer the smallest context set that is sufficient to understand the requested change correctly.

---

# 2. Task Intake And Scope

The current user/agent prompt defines the task to execute.

Additional planning files such as:

- `task.md`
- issue descriptions
- implementation plans
- security plans
- roadmap fragments
- migration plans

are task context only when the current prompt explicitly asks the agent to read or execute them.

Do not assume that a planning file is active merely because it exists in the repository.

Before editing:

1. Identify the exact requested outcome.
2. Identify affected modules and contracts.
3. Load only the relevant canonical documentation and implementation context.
4. Inspect existing behavior before proposing changes.
5. Identify whether the task affects:
   - product behavior;
   - architecture;
   - database;
   - API;
   - frontend;
   - security;
   - operations;
   - documentation.
6. Keep the implementation within the requested scope.

Do not:

- implement adjacent roadmap items opportunistically;
- perform unrelated refactors;
- introduce new infrastructure without a concrete requirement or demonstrated need;
- change established product behavior merely to simplify implementation;
- expand the task because another improvement looks convenient.

When requirements are ambiguous:

1. Resolve them from canonical documentation and existing behavior when possible.
2. State any necessary assumption explicitly.
3. Ask for clarification before making a material product or architecture decision that cannot be safely inferred.

---

# 3. Sources Of Truth

Use the following source hierarchy.

## Product intent and business rules

`docs/project/01_PRODUCT_REQUIREMENTS.md`

## Domain states and end-to-end flows

`docs/project/03_DOMAIN_AND_FLOWS.md`

## Accepted architecture decisions and known limitations

`docs/project/09_ROADMAP_AND_DECISIONS.md`

## Runtime implementation

Source code and automated tests.

## Database schema

`db/migrations/node-pg-migrate`

`docs/project/04_DATABASE.md` is the human-readable database map.

## API executable contract

Express routes and Zod validators.

`docs/project/05_API.md` is the human-readable API index.

## Runtime configuration

- `.env.example`
- `apps/api/src/config`
- Vite configuration
- Docker Compose
- deployment configuration

---

# 4. Resolving Documentation And Implementation Conflicts

When canonical documentation and implementation disagree:

1. Distinguish **intended behavior** from **currently implemented behavior**.
2. Use:
   - product requirements;
   - accepted ADRs;
   - domain flows;
   - database constraints;
   - automated tests;
   - surrounding implementation;
     to determine the intended behavior.
3. Do not document an apparent implementation bug as intended behavior merely because current code behaves that way.
4. Do not silently change a documented business rule merely because the implementation differs.
5. Report material ambiguity before changing product behavior.
6. Once intended behavior is established, update:
   - implementation;
   - tests;
   - affected canonical documentation;
     together in the same change.

If the disagreement cannot be resolved safely, stop before making the material behavior change and report the conflict.

---

# 5. Product Rules

These are repository-wide product invariants.

- Visible application UI and customer messages use translation keys for `ja`, `vi`, and `en`.
- Japanese is the default locale and final fallback.
- Code identifiers, comments, logs, commit messages, and technical documentation use English.
- Platform `admin` is global.
- `manager` and `staff` authorization must be constrained by active `organization_members` membership.
- Branch-scoped roles must not gain authority from body parameters supplied by the browser.
- Public branch URLs are discovery redirects into LIFF.
- Booking requires a verified LINE customer session.
- LINE notifications additionally require:
  - an active linked LINE account;
  - the relevant queue entry to have a valid `line_user_id`.
- Products with `stock_quantity = NULL` are unlimited.
- Finite stock must be checked and changed atomically.
- Products with `requires_prepayment = TRUE` must be covered by a successful verified payment before order creation.
- Never trust browser-supplied:
  - payment amount;
  - product price;
  - role;
  - organization ID;
  - branch authority;
  - payment status;
    without server-side verification.

When a task affects product behavior, verify the relevant rule in canonical product/domain documentation before implementation.

---

# 6. Architecture Boundaries

Preserve the current modular-monolith architecture unless an accepted ADR explicitly changes it.

## Backend layering

### Routes

Routes declare:

- endpoints;
- route-level middleware;
- versioned API structure.

Routes must not own business logic.

### Controllers

Controllers:

- translate HTTP input/output;
- obtain trusted actor context;
- invoke services;
- map application results to standard responses.

Controllers must not own domain policy.

### Validators

Validators define request contracts with Zod.

Validation must happen before untrusted input reaches business logic.

### Services

Services own:

- application logic;
- business rules;
- transaction orchestration;
- authorization-sensitive workflow decisions where appropriate.

### Repositories

Repositories own:

- SQL;
- database mapping;
- persistence access.

Repositories must not become business-policy layers.

### Integrations

Integrations hide third-party transports such as:

- LINE;
- payment providers;
- email;
- routing providers;
- media/object storage.

Business services should depend on stable integration boundaries instead of provider-specific transport details.

### Shared package

Shared package code must remain framework-independent.

Do not place business logic in:

- React components;
- Express routes;
- repositories;
- provider adapters.

---

# 7. Dependency And Infrastructure Changes

Before adding a new runtime dependency or infrastructure component:

1. Identify the concrete problem it solves.
2. Check whether the repository already has a mechanism solving the same problem.
3. Prefer extending an existing abstraction over introducing a parallel architecture.
4. Define:
   - ownership;
   - lifecycle;
   - failure behavior;
   - degraded-mode behavior;
   - observability;
   - rollback implications.
5. Define where authoritative state lives.
6. Add:
   - configuration;
   - tests;
   - health/observability;
   - deployment documentation;
   - operational guidance;
     as appropriate.

Do not add technology solely to expand the technology stack.

Do not replace a working architecture boundary with a new tool without a measurable or documented reason.

---

# 8. Database Changes

For every schema change:

- Add a new forward migration.
- Never rewrite a migration that may already have been applied.
- Keep `db/schema/reset_line_queue_schema.sql` synchronized with migrations.
- Use transactions for:
  - multi-table writes;
  - concurrency-sensitive state changes;
  - writes that must commit atomically.
- Define explicitly:
  - foreign keys;
  - check constraints;
  - indexes;
  - uniqueness;
  - deletion behavior;
  - rollback behavior.
- Review concurrency implications.
- Review tenant isolation implications.
- Review existing data/backfill implications.
- Test migration behavior against a clean database when relevant.

Never use the destructive reset script on:

- shared data;
- staging;
- production.

Executable migration state takes precedence over stale human-readable schema documentation.

---

# 9. API Changes

Keep the `/api/v1` prefix unless a deliberate API versioning decision is recorded.

Use the standard success/error envelopes from:

`apps/api/src/utils/response.ts`

For every affected endpoint, apply as appropriate:

- authentication;
- role checks;
- organization/branch ownership checks;
- validation;
- rate limiting;
- idempotency;
- transaction boundaries.

When API behavior changes, update together:

- routes;
- validators;
- controllers;
- services;
- repositories if affected;
- backend tests;
- frontend API clients;
- frontend types;
- Swagger/OpenAPI source;
- `docs/project/05_API.md`.

Do not expose:

- stack traces;
- secrets;
- internal provider payloads;
- authorization headers;
- cross-organization records;
- sensitive implementation details.

Browser-supplied IDs are selectors, not authority.

---

# 10. Security

Security rules apply to every task.

Never commit:

- `.env`;
- access tokens;
- channel secrets;
- JWT secrets;
- passwords;
- real customer data;
- payment-provider secrets;
- object-storage credentials;
- Redis credentials.

Treat every `VITE_*` variable as public browser data.

## Authentication and authorization

- Never trust browser-provided role or tenant authority.
- Always derive trusted actor identity from server-side authentication/session state.
- Verify active membership before tenant-scoped business access.
- Enforce branch scope server-side.

## LINE

- Verify LINE webhook signatures against the raw request body.
- Never trust browser-supplied `line_user_id`.

## Passwords and credentials

- Hash passwords using the established password-hashing mechanism.
- Never log credentials.
- Never log authorization headers.

## Uploads

Uploaded data URLs/files require:

- type validation;
- size validation;
- content validation as appropriate.

Production media should use object storage rather than container-local persistence.

## Location

Location collection requires:

- explicit user consent;
- purpose limitation;
- minimum retention;
- documented deletion behavior.

## Telemetry

Logs, metrics, traces, and error monitoring must not expose:

- credentials;
- access tokens;
- refresh tokens;
- cookies;
- authorization headers;
- unnecessary PII;
- raw payment/provider secrets.

---

# 11. Frontend Changes

Keep business authority on the server.

React components may:

- render state;
- collect input;
- trigger API actions;
- manage local presentation behavior.

React components must not become the source of truth for:

- authorization;
- payment validity;
- stock correctness;
- queue transition correctness;
- tenant ownership.

Use existing project conventions for:

- TanStack Query;
- authentication/session management;
- localization;
- routing;
- reusable components.

For user-facing changes, handle applicable states:

- loading;
- empty;
- error;
- disabled;
- success;
- responsive/mobile behavior.

Visible text must use translation keys unless the existing architecture explicitly treats the text as technical/internal.

---

# 12. Background Jobs And Concurrency

For background processing and schedulers:

- Preserve idempotency.
- Prevent duplicate business effects.
- Use existing PostgreSQL/advisory-lock/outbox mechanisms where applicable.
- Do not introduce unsafe database-to-queue dual writes.
- Define retry behavior explicitly.
- Define permanent vs retryable failures.
- Avoid uncontrolled retry storms.
- Respect external provider rate limits.
- Ensure provider failure cannot corrupt committed business state.

When a job runs in multiple processes or replicas, define ownership/coordination explicitly.

---

# 13. Observability

New behavior should be diagnosable without exposing sensitive data.

Use existing logging/metrics conventions.

Where applicable include:

- request correlation;
- structured logs;
- safe error codes;
- relevant metrics;
- worker/job visibility;
- provider-failure visibility.

Do not add high-cardinality metric labels such as:

- user IDs;
- order IDs;
- ticket IDs;
- request IDs.

Observability failure must not fail business operations.

---

# 14. Required Validation

During development, run the smallest relevant checks needed for fast feedback.

Before handoff, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
```

Additional validation depends on the change type.

## API contract changes

Run:

```bash
npm run openapi:check
```

## Database changes

Run:

```bash
npm run db:migrate:status
npm run db:migrate
```

Also validate schema behavior against a clean database where relevant.

## Critical browser workflow changes

Run the relevant Playwright E2E scope.

Do not run unrelated E2E suites unnecessarily if a narrower validated scope is sufficient.

## Dependency/security-sensitive changes

Run the repository dependency/security checks required by CI when applicable.

## Deployment/Compose changes

Validate affected Docker/Compose configuration and smoke-test the changed runtime path where practical.

If a required check cannot be run, report:

1. the exact command;
2. why it could not run;
3. what risk remains.

Do not claim validation passed when it was not executed.

---

# 15. Definition Of Done

If the task comes from an explicitly referenced task-plan file, update its status/checklist accurately after successful implementation and validation.
A change is complete only when all applicable conditions are satisfied.

## Behavior

- Behavior matches documented business rules.
- Existing compatible behavior is preserved unless intentionally changed.
- Edge cases introduced by the change are handled.

## Authorization

- Authentication is correct.
- Tenant boundaries are enforced.
- Branch boundaries are enforced where applicable.
- Browser input is not treated as authority.

## UI

For user-facing changes:

- loading state handled;
- empty state handled;
- error state handled;
- responsive behavior handled;
- locale behavior remains correct.

## Data

- Database changes are deployable.
- Transactions protect multi-table/concurrent writes where required.
- Rollback behavior is understood.
- No destructive migration behavior is hidden.

## Reliability

- Idempotency is preserved where required.
- Retry/degraded-mode behavior is defined for new dependencies.
- No duplicate business effect is introduced.

## Security

- No secret or sensitive data is exposed.
- Observability remains safe.
- New external inputs are validated.

## Testing

- Relevant tests pass.
- Regression coverage is added for changed behavior.
- Failure paths are covered where meaningful.

## Documentation

- Affected canonical documents are updated.
- Configuration examples are updated.
- Documentation describes actual implementation, not requested future behavior.

## Repository hygiene

- Unrelated user changes remain untouched.
- No accidental debug configuration remains.
- No temporary test bypass remains.
- No unnecessary compatibility code remains unintentionally.

---

# 16. Documentation Synchronization

Canonical documentation must reflect the latest verified implementation.

After implementing a task, update only the affected canonical documents.

Do not update documentation merely to mirror request wording.

Documentation must describe what is actually implemented.

Typical mapping:

| Change type               | Documentation to review                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Product/business behavior | `01_PRODUCT_REQUIREMENTS.md`, `03_DOMAIN_AND_FLOWS.md`                             |
| Architecture              | `02_SYSTEM_ARCHITECTURE.md`, `06_CODEBASE_GUIDE.md`, `09_ROADMAP_AND_DECISIONS.md` |
| Database                  | `04_DATABASE.md`                                                                   |
| API                       | `05_API.md`                                                                        |
| Development/testing       | `07_DEVELOPMENT_AND_TESTING.md`                                                    |
| Deployment/operations     | `08_DEPLOYMENT_AND_OPERATIONS.md`                                                  |
| Project scope/status      | `00_PROJECT_CONTEXT.md`                                                            |

Do not read or modify `docs/archive` unless historical work is explicitly required.

Major architecture decisions should be recorded through ADRs or the established decision section in `09_ROADMAP_AND_DECISIONS.md`.

Do not silently rewrite historical architecture decisions.

Supersede them explicitly when necessary.

---

# 17. Branch Workflow

Before editing repository state:

1. Inspect the current branch.
2. Inspect the working tree.
3. Identify unrelated uncommitted user changes.
4. Preserve unrelated work.

For new feature/fix work, use an appropriately named task branch when branch creation is part of the requested workflow.

Suggested branch names:

- `feat/<short-name>`
- `fix/<short-name>`
- `chore/<short-name>`

Keep commits focused on the current task.

Do not:

- rewrite shared branch history;
- force-push unless explicitly requested and confirmed safe;
- discard unrelated changes;
- reset unrelated files;
- clean the working tree destructively to simplify the task.

If unrelated user work prevents safe implementation, report the conflict rather than overwriting it.

---

# 18. Commit, Merge, Push, And Remote Finalization

Commit, merge, push, and branch deletion are repository-state-changing operations.

They must only be performed when:

- the current prompt explicitly requests finalization/remote synchronization; or
- the current prompt explicitly instructs the agent to follow this finalization workflow.

Do not automatically merge or push merely because implementation is complete.

## When finalization is explicitly requested

Follow this sequence:

1. Ensure implementation, tests, and canonical documentation updates are complete.
2. Ensure required validation passes.
3. Inspect the working tree and branch state.
4. Commit only completed task changes.
5. Merge the completed task branch into `chore/dev`.
6. Resolve conflicts only when safe and unambiguous.
7. Push `chore/dev`.
8. Merge the updated `chore/dev` into `main`.
9. Push `main`.
10. Verify both remote branches contain the completed work.
11. Only after verification, delete the completed task branch locally and remotely.
12. Never delete:
    - `main`;
    - `chore/dev`.

Expected final repository state:

- `chore/dev` contains the completed work locally and remotely.
- `main` contains the same completed work locally and remotely.
- The completed task branch has been deleted locally and remotely.
- No completed task changes remain uncommitted.
- Unrelated user changes remain untouched.

## Stop conditions

Do not merge, push, or delete branches if:

- required validation failed;
- remote state has unexpected commits;
- merge conflicts are materially ambiguous;
- unrelated user work would be overwritten;
- destructive resolution would be required.

Report the blocker instead.

---

# 19. Handoff Requirements

Before ending a coding task, provide a concise handoff containing:

1. What was implemented.
2. Important architecture/business decisions.
3. Files changed.
4. Migrations added, if any.
5. Tests/checks executed and their results.
6. Documentation/configuration updated.
7. Remaining risks, limitations, or deferred work.
8. Any required manual verification.
9. Whether the requested task is fully complete.

Do not claim completion if required validation or critical manual verification is still missing.

---

# 20. General Engineering Principles

Prefer:

- correctness over cleverness;
- explicitness over hidden behavior;
- existing abstractions over parallel implementations;
- incremental evolution over rewrites;
- measured optimization over speculative complexity;
- durable state over ephemeral state for business truth;
- backward compatibility over unnecessary breaking changes;
- clear failure behavior over silent degradation.

Avoid:

- premature microservices;
- unnecessary infrastructure;
- duplicated business logic;
- speculative abstractions;
- silent product-rule changes;
- undocumented operational dependencies;
- technology additions made only for portfolio value.

The goal is not to maximize the number of technologies in the repository.

The goal is to keep the system correct, understandable, secure, maintainable, and production-ready as it evolves.
