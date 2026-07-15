# Codebase Guide

## 1. Repository layout

```text
.
|-- apps/
|   |-- api/                 Express API, jobs, SQL repositories, integrations
|   \-- web/                 React SPA for every role
|-- packages/
|   |-- shared/              Framework-independent domain/API types and helpers
|   \-- config/              ESLint, Prettier, and TypeScript presets
|-- db/
|   |-- migrations/node-pg-migrate/
|   |-- schema/              Destructive local reset snapshot
|   \-- seeds/               Deterministic demo data
|-- docker/                  API/web Dockerfiles and nginx config
|-- scripts/                 Root migration/reset runners
|-- docs/                    Canonical documentation and historical archive
|-- .github/workflows/       CI
|-- docker-compose.dev.yml   Hot-reload local stack
\-- docker-compose.yml       Production-like stack
```

## 2. Backend layout

```text
apps/api/src/
|-- config/                  Environment parsing
|-- db/
|   |-- repositories/        SQL and row mapping
|   \-- transaction.ts       Transaction helper
|-- docs/                    Programmatic Swagger fragments
|-- jobs/                    In-process scheduler and job functions
|-- middlewares/             Auth, role, validation, rate, idempotency, logs, metrics
|-- modules/<domain>/        Route/controller/service/validator and tests
|-- routes/                  Health and router composition
|-- types/                   Express/auth-local types
|-- utils/                   Errors, response, JWT, cache, logs, metrics
|-- app.ts                   Express composition without listening
\-- server.ts                Process startup/shutdown and scheduler lifecycle
```

### Layer rules

| Layer               | May do                                                  | Must not do                                         |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| Route               | Endpoint order, middleware, controller binding          | Business logic or direct SQL                        |
| Middleware          | Cross-cutting request concern                           | Tenant business decisions hidden from services      |
| Validator           | Parse/validate request shape                            | Database access                                     |
| Controller          | Convert HTTP to service input and response              | Own domain rules                                    |
| Service             | Domain/application policy and transaction orchestration | Depend on React or format raw HTTP responses        |
| Repository          | Parameterized SQL and row mapping                       | Authorize HTTP actors or call third parties         |
| Integration adapter | External transport contract                             | Own queue/order state                               |
| Job                 | Query candidates and invoke services                    | Duplicate message/domain construction unnecessarily |

## 3. Frontend layout

```text
apps/web/src/
|-- components/              Reusable layout/domain/UI components
|-- hooks/                   Query and integration hooks
|-- pages/
|   |-- admin/               Platform administration
|   |-- manager/             Tenant management
|   |-- staff/               Operational workspace
|   |-- customer/, public/   QR customer flow
|   \-- liff/                LINE LIFF customer flow
|-- services/                API clients and LIFF real/mock adapters
|-- store/                   Zustand authentication state
|-- contexts/                Runtime providers such as LIFF initialization state
|-- types/                   Frontend-only contracts
|-- utils/                   Checkout storage, payment boundary, logo compression
|-- router.tsx               Route map
|-- index.css                Shared design tokens/global styling
\-- main.tsx                 Browser entry
```

Pages orchestrate data and interactions. Reusable visual patterns belong in components, server calls in services/hooks, and non-React transformations in utils. Browser storage is for drafts and convenience, never authorization/payment truth.

LIFF child pages should consume `LiffRuntimeContext` from `LiffLayout` instead of calling `useLiff()` directly. The layout initializes LIFF once and shares profile/auth status with booking, ticket, and home routes.

## 4. Shared packages

`@line-queue/shared` is consumed by API and web. It may contain serializable types, constants, and pure helpers only. It must not import Express, React, browser-only APIs, database clients, or secrets.

Known issue: some shared enum names/descriptions are legacy and differ from current PostgreSQL values. Verify migrations and runtime adapters before reusing them, then align shared types in a deliberate compatibility change.

`@line-queue/config` is tooling-only and must not be imported into runtime bundles.

## 5. Naming and file conventions

- TypeScript files use kebab-case for multi-word backend modules and PascalCase for React components/pages.
- Functions/variables use camelCase; types/components use PascalCase; database columns use snake_case.
- Route modules use `<domain>.routes.ts`; controllers/services/validators follow the same domain prefix.
- Tests live near code in `__tests__` and end in `.test.ts`/`.test.tsx`.
- Prefer domain-specific error codes/messages through `AppError` and the standard response helper.
- Comments explain constraints or non-obvious decisions, not line-by-line mechanics.

## 6. Adding a backend endpoint

1. Confirm requirement and business/state rules in docs `01` and `03`.
2. Add/update Zod request/params/query validators.
3. Add service behavior and repository methods with tenant constraints.
4. Use a transaction for coupled writes and idempotency for retryable commands.
5. Add the controller and route with auth/role/rate middleware.
6. Add unit/integration/route tests.
7. Update frontend client/types if consumed by web.
8. Update Swagger fragments and `docs/project/05_API.md`.

## 7. Adding a database capability

1. Add a new ordered migration; do not rewrite old migrations.
2. Define checks, FKs, indexes, deletion behavior, timestamps, and down path.
3. Update reset schema and seed only when needed.
4. Add repository mapping and transactional service behavior.
5. Update shared/frontend types only after confirming wire representation.
6. Add database/service tests and update `docs/project/04_DATABASE.md`.

## 8. Adding a frontend page or workflow

1. Place it in the correct role/domain page folder.
2. Reuse the role layout/navigation and shared components.
3. Keep all visible copy Japanese.
4. Handle loading, empty, error, disabled, success, and retry states.
5. Use responsive constraints; staff side queue remains a left rail that compacts on small screens.
6. Use semantic controls and existing icon library/style conventions.
7. Add API methods/hooks outside the page and component tests for risky behavior.
8. Verify desktop and mobile routes in a browser.

## 9. Error, logging, and transactions

- Throw operational `AppError` values for expected failures; unknown errors become generic `500` responses.
- Include request/tenant/resource IDs in structured logs, never tokens, passwords, payment secrets, or precise location unnecessarily.
- Keep third-party failure after-commit when failure must not roll back domain state, such as LINE delivery.
- Keep commercial/stock writes inside one transaction when partial state would be invalid.
- Invalidate caches only after commit.

## 10. Files requiring extra care

- `.env.example`: public template; placeholders only.
- `db/migrations/**`: immutable after application.
- `db/schema/reset_line_queue_schema.sql`: destructive and local/dev only.
- `apps/api/src/app.ts`: middleware ordering affects signatures, auth, limits, and errors.
- `apps/api/src/routes/v1.routes.ts` and `apps/web/src/router.tsx`: route ordering/coverage.
- `apps/api/src/modules/orders/orders.service.ts`: coupled payment/stock/order/ticket transaction.
- `apps/api/src/modules/notifications/**`: LINE notification templates, delivery semantics, and current process-local deduplication.
- `docs/archive/**`: historical; do not update as current truth.
