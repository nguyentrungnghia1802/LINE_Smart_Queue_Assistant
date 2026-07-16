# Repository Agent Instructions

These rules apply to coding agents and contributors working in this repository.

## Read first

For every task, read:

1. `README.md`
2. `AGENTS.md`
3. `docs/project/00_PROJECT_CONTEXT.md`
4. The relevant source files and tests

Add the following documents according to task type:

| Task                      | Required context                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Product behavior          | `docs/project/01_PRODUCT_REQUIREMENTS.md`, `docs/project/03_DOMAIN_AND_FLOWS.md`                                          |
| Architecture              | `docs/project/02_SYSTEM_ARCHITECTURE.md`, `docs/project/06_CODEBASE_GUIDE.md`, `docs/project/09_ROADMAP_AND_DECISIONS.md` |
| Database                  | `docs/project/04_DATABASE.md`, all migrations, repositories, integration tests                                            |
| API                       | `docs/project/05_API.md`, routes, validators, controllers, services, frontend clients                                     |
| Local development/testing | `docs/project/07_DEVELOPMENT_AND_TESTING.md`                                                                              |
| Deployment/operations     | `docs/project/08_DEPLOYMENT_AND_OPERATIONS.md`, Compose/Docker/CI files, `.env.example`                                   |

Do not read `docs/archive` unless the task requires historical investigation.

## Sources of truth

- Product intent and business rules: `docs/project/01_PRODUCT_REQUIREMENTS.md`
- Domain states and end-to-end flows: `docs/project/03_DOMAIN_AND_FLOWS.md`
- Runtime architecture: source code plus `docs/project/02_SYSTEM_ARCHITECTURE.md`
- Database: `db/migrations/node-pg-migrate`; `docs/project/04_DATABASE.md` is the human-readable map
- API: Express routes and Zod validators; `docs/project/05_API.md` is the human-readable index
- Runtime configuration: `.env.example`, `apps/api/src/config`, Vite config, Docker Compose
- Current limitations and accepted decisions: `docs/project/09_ROADMAP_AND_DECISIONS.md`

If code and canonical documentation disagree, verify behavior in code/tests, report the conflict, and update both sides in the same change.

## Product rules

- Visible application UI and customer messages use translation keys for `ja`, `vi`, and `en`; Japanese is the default and final fallback.
- Code identifiers, comments, logs, commit messages, and technical documentation use English.
- Platform `admin` is global. `manager` and `staff` authorization must be constrained by active `organization_members` membership.
- Public booking may be anonymous. LINE notifications require a linked LINE account and a queue entry with `line_user_id`.
- Products with `stock_quantity = NULL` are unlimited. Finite stock must be checked and changed atomically.
- Products with `requires_prepayment = TRUE` must be covered by a successful payment before order creation.
- Never trust payment amount, product price, role, organization ID, or payment status supplied by the browser without server-side verification.

## Architecture boundaries

- Routes declare endpoints and middleware.
- Controllers translate HTTP input/output and obtain actor context.
- Validators define request contracts with Zod.
- Services own application and business logic.
- Repositories own SQL and database mapping.
- Integrations hide third-party transports such as LINE.
- Shared package code must remain framework-independent.
- Do not place business logic in React components, Express routes, or repositories.
- Preserve the modular-monolith structure unless an accepted ADR changes it.

## Database changes

- Add a new forward migration; never rewrite a migration that may have been applied.
- Keep `db/schema/reset_line_queue_schema.sql` synchronized with migrations.
- Use a transaction for multi-table writes and concurrency-sensitive state changes.
- Define foreign keys, checks, indexes, deletion behavior, and rollback behavior explicitly.
- Run migration status and tests against a clean database when schema behavior changes.
- Never use the destructive reset script on shared, staging, or production data.

## API changes

- Keep the `/api/v1` prefix unless a deliberate versioning decision is recorded.
- Use the standard success/error envelopes from `apps/api/src/utils/response.ts`.
- Apply authentication, role checks, tenant ownership checks, validation, rate limiting, and idempotency as appropriate.
- Update backend tests, frontend API clients/types, Swagger source, and `docs/project/05_API.md` together.
- Do not expose stack traces, secrets, provider payloads, or cross-organization records.

## Security

- Never commit `.env`, access tokens, channel secrets, JWT secrets, passwords, or real customer data.
- Treat every `VITE_*` variable as public browser data.
- Verify LINE webhook signatures against the raw request body.
- Hash passwords and never log credentials or authorization headers.
- Uploaded data URLs require type/size validation; production media should move to object storage.
- Location collection requires explicit user consent, minimum retention, and documented deletion behavior.

## Required validation

Run the smallest relevant checks during development, then before handoff run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
```

For database changes also run:

```bash
npm run db:migrate:status
npm run db:migrate
```

If a check cannot be run, state exactly which check and why.

## Definition of done

A change is complete only when:

- behavior matches the documented business rules;
- authorization and tenant boundaries are enforced;
- loading, empty, error, and responsive UI states are handled;
- relevant tests pass and regression coverage is added;
- migrations are deployable and reversible where practical;
- observability does not expose sensitive data;
- affected canonical documents are updated;
- unrelated user changes remain untouched.

## Branch And Docs Workflow

For new feature or fix work, follow this sequence:

1. Commit the current work before starting a new task.
2. Merge the finished branch into `chore/dev`.
3. Create a new branch for the next task before editing code.
4. After each agent run, update the canonical docs so they reflect the latest code and product changes.
5. Keep docs changes aligned with the actual implementation, not just the request text.

Suggested branch names:

- `feat/<short-name>`
- `fix/<short-name>`
- `chore/<short-name>`
