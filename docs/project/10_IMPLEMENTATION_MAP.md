# Current Implementation Map

Last verified on 2026-08-11 after the persistent VPS-local media decision. The baseline rechecks
route/API/migration inventories, runtime configuration, demo fixtures, role journeys,
Storybook/browser evidence, security gates, media recreate behavior, and isolated recovery against
the executable repository.

This document is the maintenance index for the current repository. It connects product roles and
flows to source modules, routes, database history, runtime configuration, scheduled jobs, and
validation commands. It is an index rather than a second copy of every contract. Detailed
contracts remain in documents `01` through `09`.

## 1. Source-of-truth order

When a document and implementation disagree, verify in this order and update affected documents
in the same change:

1. Product behavior: `docs/project/01_PRODUCT_REQUIREMENTS.md` and
   `docs/project/03_DOMAIN_AND_FLOWS.md`.
2. Runtime behavior: `apps/api/src`, `apps/web/src`, and tests near the changed code.
3. Database behavior: `db/migrations/node-pg-migrate` and
   `db/schema/reset_line_queue_schema.sql`.
4. HTTP behavior: route modules, Zod validators,
   `apps/api/src/docs/api-endpoint-catalog.ts`, and `docs/project/05_API.md`.
5. Configuration and deployment: `apps/api/src/config/index.ts`, Vite config, Dockerfiles,
   Compose files, `.env.example`, and `deploy/.env.example`.
6. Decisions and accepted limitations: `docs/project/09_ROADMAP_AND_DECISIONS.md`.
7. Scalability evidence, representative scenarios, and SLOs:
   `docs/project/11_SCALABILITY_BASELINE.md`.

`README.md` is the short public orientation document. `docs/archive` is historical and is not
a source of current behavior.

## 2. Current product baseline

| Area                    | Current implementation                                                                                                                                | Acceptance boundary                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Customer identity       | LINE/LIFF ID token exchanged for a server JWT; customer email login is not supported                                                                  | LINE Console and real-device acceptance remain deployment work                          |
| Business identity       | Shared email/password login for Admin, Organization Owner, Branch Manager, and Staff                                                                  | Role and tenant scope are reloaded from PostgreSQL                                      |
| Business session        | 15-minute access JWT, rotating HttpOnly refresh session, 15-minute business idle timeout, 12-hour absolute limit                                      | Refresh and terminal cleanup are centralized in the auth service/client interceptor     |
| Customer session        | LINE-linked refresh session with a 30-day absolute limit                                                                                              | LIFF can re-authenticate with a fresh ID token                                          |
| Organization onboarding | Public application, server-priced demo payment, Admin review, Owner activation email                                                                  | Approval creates no branch or queue                                                     |
| Organization Owner      | Organization catalog/pricing, branches, owner managers, audit, aggregate analytics                                                                    | Owner is a `manager` with `isOrganizationOwner=true`, not a new global role             |
| Branch Manager          | One assigned branch, queues, queue catalog assignments, branch inventory, Staff, QR, calendar                                                         | Branch-only authorization is server-enforced                                            |
| Staff                   | One assigned branch and exactly one assigned queue; one queue may have many Staff                                                                     | Queue selector is not a Staff authority                                                 |
| Customer booking        | One stable Branch QR, queue selection, quantity/stock, required prepayment, one active order per LINE user and queue                                  | Terminal bookings remain separate historical records                                    |
| Queue operation         | Auto-call when an active slot is free, next eight entries in the Staff board, defer/no-show policy, completion modal                                  | Third absence cancels/refunds according to queue policy                                 |
| Payment                 | Production-oriented demo with Demo provider active; payOS/provider/refund boundaries retained                                                         | No real money; merchant credentials, settlement, and provider acceptance are deferred   |
| LINE messaging          | Durable PostgreSQL outbox, localized Flex/text fallback, event-key deduplication, retry/backoff                                                       | Real Official Account delivery and physical-device verification remain pending          |
| Browser realtime        | Shared authenticated SSE, query invalidation, bounded reconnect, lifecycle cleanup, retained REST polling fallback                                    | Production device/proxy capacity acceptance remains pending                             |
| Forecasting             | PostgreSQL measured heuristic for wait and staffing recommendations                                                                                   | It is not a generative-AI or trained ML model                                           |
| Media                   | Persistent VPS-local production-demo storage plus mock and optional S3/R2 adapters; WebP compression and stable URLs                                  | Off-host volume backup/restore and optional object-provider acceptance remain hardening |
| Component review        | Storybook 10.5.7 with i18n/provider decorators, deterministic queue/ticket/order fixtures, 21 story modules / 65 entries, and phone/desktop viewports | Static build and interaction stories are local/CI review gates; no real integrations    |

## 3. Repository and runtime map

| Path                                                                    | Responsibility                                                                     | Change with                                   |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------- |
| `apps/api/src/app.ts`                                                   | Express middleware, health, docs, and API composition                              | `02`, `05`, security tests                    |
| `apps/api/src/server.ts`                                                | API startup/shutdown and scheduler lifecycle                                       | `02`, `07`, `08`                              |
| `apps/api/src/worker.ts`                                                | Dedicated BullMQ worker startup, heartbeat, and graceful shutdown                  | `02`, `07`, `08`, ADR-030                     |
| `apps/api/src/config/index.ts`                                          | Backend environment parsing and defaults                                           | env examples, `08`                            |
| `apps/api/src/modules/payments`                                         | Runtime provider selection, intents, signed callbacks, reconciliation, and refunds | `01`, `02`, `03`, `05`, `07`, `08`, ADR-037   |
| `apps/api/src/infrastructure/redis`                                     | Shared Redis lifecycle and resilient distributed rate-limit store                  | `02`, `07`, `08`, ADR-028                     |
| `apps/api/src/infrastructure/bullmq`                                    | Versioned LINE dispatcher/delivery contracts and BullMQ runtime                    | `02`, `07`, `08`, ADR-030/031                 |
| `apps/api/src/observability`                                            | OTel/Sentry lifecycle, trace helpers, and sensitive-data sanitization              | `02`, `06`, `07`, `08`, ADR-033               |
| `apps/api/src/modules/media`                                            | Image validation/compression, storage adapters, metadata cleanup                   | `02`, `04`, `05`, `06`, `07`, `08`, ADR-034   |
| `apps/api/src/modules/notifications/notification-dispatcher.service.ts` | PostgreSQL-to-BullMQ deterministic outbox dispatch                                 | `02`, `04`, `08`, ADR-031                     |
| `apps/api/src/modules/notifications/notification-operations.*`          | Scoped safe delivery diagnostics and audited retry/cancel                          | `01`, `04`, `05`, `08`                        |
| `apps/web/src/pages/NotificationOperationsPage.tsx`                     | Responsive Branch Manager/Staff LINE delivery operations UI                        | `01`, `05`, `08`                              |
| `apps/api/src/modules/realtime`                                         | Authorized SSE streams and transient Redis Pub/Sub event fan-out                   | `02`, `05`, `07`, `08`, ADR-032               |
| `apps/api/src/routes/v1.routes.ts`                                      | `/api/v1` module mounting and ordering                                             | route modules, `05`, OpenAPI test             |
| `apps/api/src/modules/*`                                                | Domain route/controller/validator/service/repository code                          | relevant `01`, `03`, `04`, `05`, tests        |
| `apps/api/src/modules/queue/queue.service.ts`                           | Queue-locked join/transition concurrency and active-ticket replay                  | `03`, `04`, `07`, `11`                        |
| `apps/api/src/modules/shared/__tests__/shared-domain-contract.test.ts`  | Shared persisted enum parity with PostgreSQL/runtime notification constraints      | `04`, `06`, migrations, reset schema          |
| `apps/api/src/db/repositories`                                          | Parameterized SQL and row mapping                                                  | `04`, service tests, migrations               |
| `apps/api/src/jobs`                                                     | API-owned recurring jobs and shared LINE outbox delivery service                   | `02`, `03`, `07`, `08`                        |
| `apps/api/src/docs/api-endpoint-catalog.ts`                             | Runtime API catalog and OpenAPI metadata                                           | routes, validators, `05`                      |
| `apps/web/src/router.tsx`                                               | Lazy SPA page/layout modules plus synchronous compatibility redirects              | `02`, `05`, `06`, `07`, UI tests              |
| `apps/web/src/pages`                                                    | Role and customer page orchestration                                               | `01`, `03`, `06`, UI tests                    |
| `apps/web/src/components`                                               | Reusable layout, queue, ticket, product, i18n, and LIFF UI                         | `06`, UI tests, Storybook stories             |
| `apps/web/.storybook`                                                   | Storybook framework, global providers, locale toolbar, and viewports               | `06`, `07`, ADR-035                           |
| `apps/web/src/storybook`                                                | Deterministic Storybook fixtures, authenticated story provider, and fixture tests  | `07`, Storybook stories                       |
| `apps/web/src/services`                                                 | API clients, auth interceptor, LIFF and payment adapters                           | `02`, `05`, tests                             |
| `apps/web/src/observability`                                            | Sanitized browser Sentry initialization and runtime error capture                  | `06`, `07`, `08`, ADR-033                     |
| `apps/web/src/services/realtime`, `apps/web/src/hooks/useRealtime.ts`   | Shared SSE streams and authoritative REST-query reconciliation                     | `02`, `06`, `07`, `08`, ADR-032               |
| `apps/web/src/store` and `contexts`                                     | Auth state, session bootstrap, LIFF runtime state                                  | `02`, `06`, auth/LIFF tests                   |
| `apps/web/src/i18n/locales`                                             | `ja`, `vi`, `en` visible UI resources by domain                                    | `01`, `06`, locale tests                      |
| `packages/shared/src/types/enums.ts`                                    | Serializable persisted state values shared by API and web                          | migrations, reset schema, contract test       |
| `db/migrations/node-pg-migrate`                                         | Ordered executable schema history                                                  | `04`, repository/service tests                |
| `db/schema/reset_line_queue_schema.sql`                                 | Destructive local/dev schema snapshot                                              | every schema migration                        |
| `db/seeds`                                                              | Administrator-only baseline seed                                                   | `07`, `08`                                    |
| `db/fixtures/e2e`                                                       | Explicit isolated tenant and operational test data                                 | E2E tests only                                |
| `docker/nginx/default.conf`                                             | SPA fallback, same-origin API/media proxy, health and security headers             | `02`, `08`, Docker tests                      |
| `docker/api/Dockerfile`, `docker/web/Dockerfile`                        | Immutable API/Web build and runtime images                                         | `07`, `08`, deployment scripts                |
| `docker-compose.dev.yml`                                                | Hot-reload local stack                                                             | `07`                                          |
| `docker-compose.validation.yml`, `docker/nginx/validation.conf`         | Isolated two-API shared-dependency and failure topology                            | `02`, `07`, `08`, ADR-036                     |
| `deploy/docker-compose.yml`                                             | Production image stack and persistent API `media_data` volume                      | `08`, ADR-040, Compose/persistence validation |
| `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`              | Split CI quality/Compose jobs; manual environment-gated immutable-image CD         | `07`, `08`, ADR-039                           |
| `scripts/scalability`                                                   | Cross-platform HTTP load runner and integrated recovery orchestrator               | `07`, `08`, `11`, ADR-036                     |

## 4. Role and scope map

| Surface            | Global identity                                             | Tenant/branch scope                           | Main source                                             |
| ------------------ | ----------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| Public marketing   | none                                                        | none                                          | `apps/web/src/pages/marketing`, `/`                     |
| Business Applicant | none before submission                                      | application payload only                      | `BusinessRegistrationPage`, `organization-applications` |
| Platform Admin     | `admin`                                                     | global, but no tenant customer/revenue detail | `apps/web/src/pages/admin`, `modules/admin`             |
| Organization Owner | `manager` plus `isOrganizationOwner`                        | one organization; aggregate branches          | `ManagerLayout`, `requireOrganizationOwner`             |
| Branch Manager     | `manager` plus one branch membership                        | exactly one active organization/branch        | `ManagerLayout`, `requireBranchManager`                 |
| Staff              | `staff` plus one branch membership and one queue assignment | exactly one active organization/branch/queue  | `StaffLayout`, `requireBranchOperator`                  |
| Customer           | `customer` plus verified LINE link                          | own active tickets/orders only                | `LiffLayout`, `auth/line`, customer pages               |

Tenant IDs, role changes, branch IDs, queue IDs, prices, payment states, and LINE recipient IDs
are never accepted as browser authority. Controllers derive trusted identity from middleware and
services enforce organization/branch/queue scope again.

## 5. Frontend route inventory

The route source is `apps/web/src/router.tsx`. Layouts and backend authorization, not the path
alone, protect role surfaces.

### Public and account routes

| Route                                                      | Behavior                                               |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `/`                                                        | Marketing/product site                                 |
| `/business/register`                                       | Public business application                            |
| `/login`                                                   | Shared business login and LINE entry UI                |
| `/account`                                                 | Authenticated business profile/password page           |
| `/activate-account`, `/forgot-password`, `/reset-password` | Email action-token lifecycle                           |
| `/q/:orgSlug`, `/qr/:token`                                | Public branch discovery redirect into LIFF             |
| `/checkout/demo/:sessionId`                                | Demo payment page; LIFF has an equivalent nested route |
| `/dashboard`                                               | Role redirect to the authenticated business dashboard  |

### Compatibility redirects

`/register` redirects to `/login`; `/customer` redirects to `/liff/home`; `/app/*` redirects
to `/dashboard`; `/join/:queueId` redirects to `/liff/join/:queueId`; and `/ticket/:entryId`
redirects to `/liff/tickets/:entryId`. These routes are compatibility entries, not separate
customer authentication or business surfaces.

### Business workspaces

| Layout  | Routes                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Manager | `/manager`, `/manager/products`, `/manager/products/new`, `/manager/products/:id`, `/manager/products/:id/edit`, `/manager/queues`, `/manager/queues/new`, `/manager/queues/:id`, `/manager/queues/:id/manage`, `/manager/queues/:id/settings`, `/manager/users`, `/manager/users/:userId`, `/manager/branches`, `/manager/branches/:branchId`, `/manager/audit`, `/manager/notifications`, `/manager/qr`, `/manager/settings` |
| Staff   | `/staff`, `/staff/products`, `/staff/notifications`, `/staff/qr`                                                                                                                                                                                                                                                                                                                                                               |
| Admin   | `/admin`, `/admin/orgs`, `/admin/applications`, `/admin/operations`, `/admin/orgs/:orgId`                                                                                                                                                                                                                                                                                                                                      |

The Manager layout renders owner navigation or branch-manager navigation from the authenticated
capability. The same global `manager` role must not be treated as permission to cross that
boundary.

### LIFF customer workspace

`/liff` initializes the LIFF runtime once through `LiffLayout` and then exposes:

`/liff/home`, `/liff/join/:queueId`, `/liff/q/:orgSlug`, `/liff/qr/:token`,
`/liff/checkout/demo/:sessionId`, `/liff/tickets`, `/liff/tickets/:entryId`,
`/liff/history`, and `/liff/preferences`.

The public QR route supplies branch context. LIFF resolves the current active ticket from the
verified LINE identity when Home or Rich Menu opens without a fixed entry ID.

## 6. API inventory

The executable catalog in `apps/api/src/docs/api-endpoint-catalog.ts` currently contains 110
versioned operations. The OpenAPI contract test compares it with mounted Express routes and the
assembled Swagger document. Current operation counts by tag are:

| Tag                         | Operations |
| --------------------------- | ---------: |
| `admin`                     |          6 |
| `auth`                      |          8 |
| `bookings`                  |          2 |
| `branches`                  |         12 |
| `forecasts`                 |          2 |
| `line`                      |          4 |
| `location`                  |          4 |
| `media`                     |          2 |
| `notifications`             |          5 |
| `orders`                    |          7 |
| `organization-applications` |          5 |
| `organizations`             |          6 |
| `payments`                  |          7 |
| `products`                  |          6 |
| `queue-entry`               |         11 |
| `queues`                    |          6 |
| `staff`                     |          9 |
| `users`                     |          8 |

The full path and behavior index is `docs/project/05_API.md`. When an endpoint changes, update
the route, validator, controller/service behavior, client method/types, OpenAPI catalog, tests,
and that document together. `VALIDATION_ERROR.details.fieldErrors` must preserve complete nested
paths and `_form` for non-field issues.

## 7. Database and migration map

| Range             | Capability                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `000001`-`000004` | Core schema, admin role, payment/inventory, location/forecast tables                                     |
| `000005`-`000008` | Durable LINE outbox, payment foundation, operational correctness, reconciliation                         |
| `000009`-`000013` | Notification/location consent, booking history/calendar, forecasting baseline, media, i18n               |
| `000014`-`000019` | Applications, account lifecycle/branches, multi-queue scope, order fulfillment, hardening, review emails |
| `000020`          | Organization-owned catalog and generated product/service codes                                           |
| `000021`          | Role-aware access/refresh sessions                                                                       |
| `000022`          | Branch inventory and reservation branch scope                                                            |
| `000023`          | Branch Google place identity and formatted map address                                                   |
| `000024`          | Core schema normalization: branch-owned stock, tenant counters, notification cleanup                     |
| `000025`          | One active Staff queue assignment in `branch_memberships.queue_id`                                       |
| `000026`          | Durable BullMQ notification dispatch ownership, retry, recovery fields, and due/claim indexes            |
| `000027`          | Nullable next-retry timestamp after notification dispatch completes                                      |
| `000028`          | LIFF friendship as a valid LINE notification consent source                                              |

After `000028`, the reset schema contains 44 application tables, 602 application column
signatures, and 188 application index definitions; the `pgmigrations` bookkeeping table is not
included in those counts. `branch_memberships.queue_id` is nullable for managers, required for
active Staff, references a queue in the same organization and branch, and has a partial unique
index that prevents one Staff user from holding multiple current Staff assignments.

Use `docs/project/04_DATABASE.md` for the ERD, table catalog, constraints, transaction boundaries,
retention rules, and migration safety policy. Apply forward migrations in production; never run
the destructive reset schema or E2E fixtures against shared data.

## 8. Runtime configuration map

| Family          | Important variables                                                                                                                                                   | Exposure                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Database/API    | `DATABASE_URL`, `DB_*`, `API_*`, `CORS_ORIGIN`, `WEB_ORIGIN`                                                                                                          | API/server only                                          |
| Redis/BullMQ    | `REDIS_URL`, `REDIS_CONNECT_TIMEOUT_MS`, `REDIS_COMMAND_TIMEOUT_MS`, `REDIS_KEY_PREFIX`, `LINE_NOTIFICATION_DELIVERY_OWNER`, `BULLMQ_*`, `WORKER_*`                   | API/worker only; URL may contain credentials             |
| Auth            | `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `AUTH_*`                                                                                                                       | Secret plus server-only policy                           |
| LINE Login/LIFF | `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_LIFF_ID`, `LINE_ID_TOKEN_VERIFICATION_MODE`, `LINE_LIFF_ENDPOINT_PATH`                                                           | IDs/path are public; verification mode is server runtime |
| LINE Messaging  | `LINE_MESSAGING_CHANNEL_SECRET`, `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`, `LINE_NOTIFICATION_*`, `LINE_RICH_MENU_IMAGE_PATH`                                            | Server-only except non-secret tuning                     |
| Local LIFF mock | `VITE_LIFF_MOCK_*`, `LINE_ID_TOKEN_MOCK_*`                                                                                                                            | Local/test browser/API configuration                     |
| Email           | `EMAIL_*`, `SMTP_*`                                                                                                                                                   | API/server only; SMTP password and token key are secrets |
| Payment         | `PAYMENT_MODE=demo`, `DEMO_PAYMENT_WEBHOOK_SECRET`; `PAYOS_*` only for explicit external activation                                                                   | API/server only; never `VITE_*`                          |
| Location        | `LOCATION_*`, `GOOGLE_ROUTES_API_KEY`                                                                                                                                 | API/server only; provider key is secret                  |
| Forecasting     | `FORECAST_*`                                                                                                                                                          | Non-secret server tuning                                 |
| Media           | `MEDIA_STORAGE_PROVIDER`, `MEDIA_*`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE` | API/server runtime; access/secret values are secrets     |
| Frontend build  | `VITE_API_URL`, `VITE_APP_NAME`, `VITE_LIFF_ID`, `VITE_LIFF_ENDPOINT_PATH`, `VITE_LIFF_DEFAULT_BOOKING_PATH`, `VITE_PAYMENT_MODE`, `VITE_PAYMENT_REDIRECT_BASE_URL`   | Public build-time data                                   |
| Observability   | `OTEL_*`, `SENTRY_*`, `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE`                                                                             | OTLP headers/server DSN stay backend; VITE values public |

The root `.env.example` is the superset for native development. `deploy/.env.example` contains
API runtime and Compose values and intentionally omits `VITE_*` because those values are compiled
into the immutable Web image. Production uses an empty `VITE_API_URL`; the browser already calls
`/api/v1/...` and the Web nginx proxy preserves `/api`. Docker Web currently exposes build args
for production public values in `docker/web/Dockerfile`; mock-only `VITE_LIFF_MOCK_*` variables
are not needed in the production image. The current production-oriented demo selects local media,
fixes `MEDIA_LOCAL_DIR=/app/var/media`, and mounts the persistent Compose `media_data` volume at
that path. S3-compatible storage remains optional; its complete server-only configuration is
required only when `MEDIA_STORAGE_PROVIDER=s3` is selected.

Legacy `LINE_CHANNEL_ID`, `LINE_LIFF_ID`, `LINE_CHANNEL_SECRET`, and
`LINE_CHANNEL_ACCESS_TOKEN` aliases are accepted temporarily by backend config. New deployments
must use the namespaced variables and keep the Messaging API secret/token separate from the LINE
Login channel ID and LIFF ID.

## 9. Scheduled jobs and ownership

The API owns all recurring work except LINE notification delivery. `JobRunner` prevents
overlapping API cycles, and advisory locks prevent duplicate logical cycles across API replicas.
The dedicated BullMQ worker owns a deterministic dispatcher schedule and per-notification delivery
jobs. Dispatcher rows use `FOR UPDATE SKIP LOCKED`; delivery jobs carry only the notification UUID
and use a deterministic job ID plus LINE retry key. PostgreSQL remains authoritative for dispatch,
retry, and final sent/failed state.

| Job                    | Owner         |        Default interval | Durable boundary                                                                           |
| ---------------------- | ------------- | ----------------------: | ------------------------------------------------------------------------------------------ |
| `authSessionCleanup`   | API scheduler |                  1 hour | Removes expired/revoked refresh sessions after retention                                   |
| `etaUpdater`           | API scheduler |              30 seconds | Recalculates waiting-entry ETA                                                             |
| `etaWarning`           | API scheduler |              30 seconds | Enqueues exactly-five-ahead LINE events                                                    |
| `calledRenotify`       | API scheduler |              60 seconds | Repairs missed called notification enqueue                                                 |
| `inventoryExpiry`      | API scheduler |              60 seconds | Expires stale finite-stock reservations                                                    |
| `locationAlerts`       | API scheduler |              60 seconds | Leases due rows, calls travel provider outside transactions, atomically enqueues/finalizes |
| `locationCleanup`      | API scheduler |                  1 hour | Deletes/anonymizes expired location data                                                   |
| `notificationDispatch` | BullMQ worker |              15 seconds | Claims committed outbox rows and creates deterministic jobs                                |
| `notificationDelivery` | BullMQ worker |            Event-driven | Sends one LINE notification and persists the provider outcome                              |
| `counterReset`         | API scheduler |            1 hour check | Resets organization-local daily counters                                                   |
| `forecasting`          | API scheduler |                  1 hour | Persists wait and staffing measured heuristics                                             |
| `emailDelivery`        | API scheduler | 15 seconds when enabled | Claims and sends activation/reset/application email outbox rows                            |

Each external failure is isolated from the committed queue/order transition. LINE and email errors
are sanitized before persistence/logging, and provider secrets/payloads are not written to the
general operational log.

## 10. Validation and documentation update gate

Run targeted checks after a local change, then the complete repository gate before merging:

```text
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
npm run openapi:check
npm run db:migrate:status
npm run media:persistence:verify
```

For database changes, also apply migrations to a clean database and run the relevant migration,
repository, service, and fixture tests. For release acceptance, use `npm run e2e:all` after
loading only the explicit E2E fixtures. `docs/project/07_DEVELOPMENT_AND_TESTING.md` contains the
full local/CI sequence; `docs/project/08_DEPLOYMENT_AND_OPERATIONS.md` contains rollout and
incident procedures; `docs/guide/DEMO_ACCEPTANCE.md` contains the production-oriented demo
acceptance journey; production and real-device checklists remain separate.

When this map changes, update its verification revision/date and check the affected canonical
documents. Do not mark a feature as production-accepted merely because mock tests pass; record
LINE, payment provider, maps, SMTP, or object-storage acceptance separately.
