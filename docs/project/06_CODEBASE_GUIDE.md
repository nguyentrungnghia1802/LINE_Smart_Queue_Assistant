# Codebase Guide

Use [`10_IMPLEMENTATION_MAP.md`](10_IMPLEMENTATION_MAP.md) as the first navigation point when a
change crosses more than one layer. It lists the current route, API, migration, environment, and
worker source paths that must be reviewed together.

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
|   |-- seeds/               Idempotent administrator-only baseline
|   \-- fixtures/e2e/        Isolated browser-test tenant and operational data
|-- docker/                  API/web Dockerfiles and nginx config
|-- scripts/
|   |-- deployment/         Persistent-media validation
|   |-- release/            Automatic release-workflow contract tests
|   \-- scalability/        Isolated scale/failure runners
|-- deploy/
|   |-- docker-compose.yml   Production immutable-image stack and persistent volumes
|   |-- scripts/              Manual immutable build/push, deploy wrapper, and rehearsal
|   \-- backup/              Versioned VPS backup, verify, restore, deploy, rollback, and rehearsal tooling
|-- docs/                    Canonical documentation and historical archive
|-- .github/workflows/       PR/main CI gates and automatic validated-main production CD
|-- docker-compose.dev.yml   Hot-reload local stack
\-- docker-compose.validation.yml Isolated two-API failure/load topology
```

## 2. Backend layout

```text
apps/api/src/
|-- config/                  Environment parsing
|-- db/
|   |-- repositories/        SQL and row mapping
|   \-- transaction.ts       Transaction helper
|-- docs/                    Programmatic Swagger fragments
|-- jobs/                    In-process scheduler and reusable job functions
|-- infrastructure/bullmq/  Versioned job contracts, worker lifecycle, and heartbeat
|-- infrastructure/redis/   Shared Redis lifecycle, rate limits, and public read-model cache
|-- middlewares/             Auth, role, validation, rate, idempotency, logs, metrics
|-- modules/<domain>/        Route/controller/service/validator and tests
|-- modules/log-monitoring/ Bounded platform HTTP adapter and source instrumentation
|-- observability/           OpenTelemetry, Sentry, trace propagation, sanitization
|-- routes/                  Health and router composition
|-- types/                   Express/auth-local types
|-- utils/                   Errors, response, JWT, cache, logs, metrics
|-- app.ts                   Express composition without listening
|-- server.ts                HTTP process startup/shutdown and scheduler lifecycle
\-- worker.ts                Dedicated BullMQ worker process entry point
```

Payment runtime ownership is concentrated in `config/index.ts` (strict mode/credential parsing),
`modules/payments/payment-provider.registry.ts` (active adapter selection),
`modules/payments/providers` (demo and payOS transports), and `modules/payments/payments.service.ts`
(server-authoritative intent, callback, reconciliation, and refund orchestration). Frontend
checkout code may present or poll these flows but cannot set transaction state.

Operational health is concentrated in
`modules/admin/operational-health.service.ts`, exposed by the already Admin-protected
`admin.routes.ts`, and rendered by `pages/admin/AdminOperationsPage.tsx`. The service may read
infrastructure probes, process metrics, and aggregate outbox counts only. Never add tenant IDs,
customer records, notification payloads, payment transactions, or secret values to this contract.
`infrastructure/bullmq/worker-heartbeat.ts` maintains both the container health file and the
short-lived Redis heartbeat consumed by this read model.

The `modules/log-monitoring` adapter is intentionally fail-open and disabled
by default. When enabled with a project-scoped `LOG_MONITORING_API_KEY`, it
uses the platform batch ingestion contract with bounded queue memory, retry
and shutdown limits, server-admission-only `202` semantics, request/trace
correlation, and telemetry sanitization. It is called from high-value queue,
authentication, payment webhook, LINE, email, scheduler, error, and slow-query
failure paths; monitoring transport failure must never change business state.

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
|-- components/              Reusable layout/domain/UI components and form validation manager
|-- hooks/                   Query and integration hooks
|-- pages/
|   |-- admin/               Platform administration
|   |-- marketing/           Public product site and business onboarding
|   |-- manager/             Owner analytics/branches and branch operations
|   |-- staff/               Operational workspace
|   |-- customer/            Branch QR entry and LIFF booking composition
|   \-- liff/                LINE LIFF customer flow
|-- scripts/                 Post-build checks, including CSP bundle validation
|-- services/                API clients and LIFF real/mock adapters
|-- observability/           Browser Sentry initialization and PII scrubbing
|-- store/                   Zustand authentication state
|-- contexts/                Runtime providers such as LIFF initialization state
|-- types/                   Frontend-only contracts
|-- utils/                   Checkout storage, validation helpers, payment boundary, logo compression
|-- public/logo.svg               Shared SQA brand mark and browser favicon
|-- public/img/landing-hero.webp  Product-site hero poster and video fallback
|-- public/vid/banner.mp4         Muted looping product-site hero video
|-- router.tsx               Route map
|-- index.css                Shared design tokens/global styling
\-- main.tsx                 Browser entry
```

Pages orchestrate data and interactions. Reusable visual patterns belong in components, server calls in services/hooks, and non-React transformations in utils. `FormValidationManager` converts native browser constraints into one localized inline error per invalid control; API `fieldErrors` remain mapped by each form because their paths follow request contracts. Browser storage is for drafts and convenience, never authorization/payment truth.

`router.tsx` uses `React.lazy` for page and role-layout modules under one localized `Suspense`
fallback in `App.tsx`. Keep compatibility redirects synchronous, but add new page routes through the
same lazy helper so Admin, Manager, Staff, LIFF, and public code do not become one eager entry bundle.
Vite may isolate framework dependencies into stable manual chunks; do not force every
`node_modules` dependency into one vendor chunk because that makes route-only LIFF, QR, and other
feature dependencies part of every initial navigation.

The isolated component-review environment is `apps/web/.storybook/main.ts` and
`apps/web/.storybook/preview.tsx`. Reusable stories use the `*.stories.tsx` convention beside the
component, while deterministic shared fixtures and the no-network authenticated story provider
live in `apps/web/src/storybook/fixtures.ts` and `apps/web/src/storybook/providers.tsx`. The preview
owns the i18n locale toolbar (`ja`, `vi`, `en`), global CSS, TanStack Query provider, MemoryRouter,
autodocs defaults, story ordering, and phone/desktop viewport options. The current story set covers
brand and language controls, role shell/login chrome, loading/empty/error/pagination feedback,
queue and ticket states, manager time/location boundaries, customer order details, and LIFF
friendship/QR interactions. Story fixtures must not call real API, LINE, payment, maps, camera, or
object-storage services; integration-boundary behavior remains covered by isolated unit tests.

Persisted product and organization image fields use the shared `StoredImageUrlSchema` from
`modules/shared/shared.validator.ts`. It accepts only HTTP(S) URLs or generated same-origin
`/media/...` and `/mock-media/...` paths. Upload request data URLs terminate at the media service
and must not be written back into organization or product records.

The media boundary is implemented in `apps/api/src/modules/media`: `media.service.ts` owns
validation/compression and metadata failure semantics, `media-storage.ts` contains local/mock
providers, `s3-media-storage.ts` contains the AWS S3/R2-compatible adapter, and
`media.factory.ts` selects the provider from server-only configuration. Do not import the S3 SDK
from catalog, organization, or browser modules, and do not add browser direct-upload credentials.
The current production-oriented demo selects `local`; `deploy/docker-compose.yml` fixes
`MEDIA_LOCAL_DIR=/app/var/media` and mounts the named `media_data` volume there. Keep that path,
Compose mount, production configuration guard, and persistence regression aligned. Selecting `s3`
continues to require its complete server-only credential set, while local mode must not require it.

Shared text limits and API field-error extraction live in `apps/web/src/utils/formValidation.ts`.
Numeric domain bounds live in `packages/shared/src/constants/numericLimits.ts` and are consumed by
both Zod validators and browser forms. Numeric form controls use
`apps/web/src/components/ui/BoundedNumberInput.tsx` so keyboard and pasted values reject invalid
characters, signs, decimals, and out-of-range values consistently. New forms must set stable `name`
attributes, appropriate HTML input types and limits, and map API `details.fieldErrors` to the exact
field path. Client constraints are usability aids; matching Zod validators remain the security and
data-integrity boundary.

Authentication is split between `modules/auth/auth-session.policy.ts` (role timing),
`auth-session.repository.ts` (hashed PostgreSQL rows), `auth-session.service.ts`
(issue/rotation/revocation), and `auth.cookies.ts` (refresh-cookie boundary). The frontend
`AuthSessionManager` bootstraps the cookie session, tracks business-user activity, and keeps the
short-lived access token in module memory through `store/authSession.ts`.
`services/apiClient.ts` owns the authenticated-response interceptor and delegates refresh and
terminal cleanup to `store/authSession.ts`; components must not implement their own `401`, refresh,
or redirect flow. Refresh is single-flight and each request retries once. Terminal cleanup resets
the auth store through a listener and clears the singleton React Query client exported by
`services/queryClient.ts` before the guarded login redirect.
Authenticated business users change passwords through `usersService.changeMyPassword`; the new
hash and revocation of every active session are committed in one transaction. `AccountPage` owns
the shared Admin/Manager/Staff form and returns the user to email login after success.

`useLiff()` revokes both the backend refresh session and LIFF adapter state on customer logout. It
continues to exchange available LINE ID tokens, while a customer session already restored from the
secure cookie prevents an unnecessary interactive LINE login when the SDK is temporarily signed out.

LIFF child pages should consume `LiffRuntimeContext` from `LiffLayout` instead of calling `useLiff()` directly. The layout initializes LIFF once and shares profile/auth status with booking, ticket, and home routes.

`/liff/home` is the customer entry point for LINE Rich Menu. It should keep ticket resolution and booking navigation in the LIFF flow and must not hard-code queue entry IDs.

Manager pages use one global `manager` role with two explicit capabilities. An organization owner
has `isOrganizationOwner=true` and only owner navigation. A compatibility branch membership may
exist, but branch-operation authorization helpers always reject organization owners.
A branch manager has `isOrganizationOwner=false`, exactly one active branch assignment, and
branch inventory/queue/staff/QR/branch-settings navigation. The organization owner owns catalog
definition and pricing CRUD; branch managers maintain stock for their assigned branch and read the
catalog while assigning products to their queues. Backend authorization remains
authoritative even when the frontend hides routes.

## 4. Shared packages

`@line-queue/shared` is consumed by API and web. It may contain serializable types, constants, and
pure helpers only. It must not import Express, React, browser-only APIs, database clients, or
secrets. Persisted enum values in this package mirror the executable PostgreSQL schema and current
notification event constraint. Update the migration/reset schema, runtime mapping, shared enum,
and `shared-domain-contract.test.ts` together when adding or renaming a persisted state.

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
3. Put visible copy in domain resources under `apps/web/src/i18n/locales/<locale>`; do not hard-code display text in components.
4. Keep backend LINE copy in `modules/notifications/templates/<locale>.ts`.
5. Handle loading, empty, error, disabled, success, and retry states.
6. Use `RoleAppShell` for business-role navigation. It keeps role tabs in the desktop header and
   exposes every destination in the safe-area-aware mobile bottom navigation. Staff queue entries
   use a left rail from tablet widths and a horizontal ticket selector on phones.
7. Use semantic controls and existing icon library/style conventions.
8. Standalone auth and customer discovery redirects outside shared role layouts must preserve the
   compact language switcher where visible. Login keeps the control independently at the
   viewport's top-right so the authentication card remains vertically centered.
9. Add API methods/hooks outside the page and component tests for risky behavior.
10. Verify desktop and mobile routes in a browser, including navigation visibility, page-level
    horizontal overflow, modal fit, and fixed-navigation content clearance.
11. Public marketing video must remain muted and inline, retain an image poster fallback, and
    respect the browser's reduced-motion preference without making page content depend on playback.
12. Consume authenticated SSE through `services/realtime` and `hooks/useRealtime.ts`. Treat events
    as invalidation hints, reconcile through TanStack Query/REST, retain a polling fallback, and
    release subscriptions on route, visibility, network, logout, and session-expiry changes.
13. Lazy-load new page modules through `router.tsx`, retain the shared localized route-loading
    fallback, and use native lazy image loading for repeated off-screen catalog/list media. Keep
    above-the-fold identity/brand imagery eager when it contributes to the first useful render.

## 9. Error, logging, and transactions

- Throw operational `AppError` values with stable codes; frontend display copy is resolved from the code, not the backend message.
- Include request/tenant/resource IDs in structured logs, never tokens, passwords, payment secrets, or precise location unnecessarily.
- Keep third-party failure after-commit when failure must not roll back domain state, such as LINE delivery.
- Keep commercial/stock writes inside one transaction when partial state would be invalid.
- Invalidate caches only after commit.
- Keep Redis read-model keys versioned and tenant-scoped. Cache parsing must validate the expected
  organization/branch/queue identity, and cache failures must fall back to PostgreSQL.
- Never use cached public openness, capacity, inventory, payment, or tenant data to authorize a
  write or domain transition.
- Keep customer-facing LINE copy, Flex payloads, text fallback, and ticket deeplink construction inside `line-notification.templates.ts` and `lineNotificationService`; business services must not call the LINE SDK or adapter directly.
- Keep Rich Menu definition, image loading, LINE transport, and sync orchestration separated in `apps/api/src/modules/line/rich-menu.*`. Do not create or replace Rich Menus during API startup; use the explicit script command.

## 10. Files requiring extra care

- `.gitleaksignore`: exact historical false-positive fingerprints only. Never add a broad path or
  rule exclusion; review and document every new fingerprint before changing this baseline.
- `.env.example`: public template; placeholders only.
- `db/migrations/**`: immutable after application.
- `db/schema/reset_line_queue_schema.sql`: destructive and local/dev only.
- `apps/api/src/app.ts`: middleware ordering affects signatures, auth, limits, and errors.
- `apps/api/src/routes/v1.routes.ts` and `apps/web/src/router.tsx`: route ordering/coverage.
- `apps/web/vite-plugins/liffCspPlugin.ts`: reviewed compatibility boundary for the official LIFF
  message-bus bootstrap; SDK updates must pass the production CSP bundle check.
- `apps/api/src/modules/orders/orders.service.ts`: coupled payment/stock/order/ticket transaction.
- `apps/api/src/modules/staff/staff.service.ts`: Staff overview authorization plus bounded queue
  preview; preserve batch live-count and batch order enrichment rather than per-queue/per-entry reads.
- `apps/api/src/modules/location/**`: consented snapshots, recoverable alert claims, and travel-time
  integration. Provider calls must stay outside database transactions; enqueue and claim
  finalization remain atomic.
- `apps/api/src/modules/branches/branch-scope.ts`: owner, branch-manager, and branch-operator scope
  guards used by every branch-owned endpoint.
- `apps/api/src/modules/users/user-response.ts`: explicit API allowlist for repository user rows.
  Apply it to every controller-visible user result; never spread a `UserRow` into an HTTP response.
- `apps/api/src/middlewares/rateLimiter.middleware.ts`: derives IP keys from Express `req.ip` after
  configured proxy trust. Do not parse `X-Forwarded-For` independently of that trust boundary.
- `apps/api/src/modules/notifications/**`: LINE notification templates and durable PostgreSQL
  outbox/delivery semantics. `notification-operations.repository.ts` owns scoped diagnostic SQL;
  `notification-operations.service.ts` owns sanitization, failure categories, and guarded audited
  retry/cancel transitions. `notifications.controller.ts` derives Branch Manager branch scope and
  Staff queue scope from authenticated membership; Admin/Owner access is rejected. The responsive
  operator UI is `apps/web/src/pages/NotificationOperationsPage.tsx` and must use the safe
  operations API only.
- `apps/api/src/modules/realtime/**`: versioned minimal events, authorized SSE lifecycle, bounded
  local subscriptions, and dedicated Redis Pub/Sub transport. PostgreSQL/REST remains authoritative.
- `scripts/scalability/**`, `docker-compose.validation.yml`, and `docker/nginx/validation.conf`:
  destructive local-only load/failure validation. Never point this topology at production data or
  enable real LINE, payment, SMTP, maps, telemetry, or object-storage credentials.
- `apps/web/src/services/realtime/**` and `apps/web/src/hooks/useRealtime.ts`: centralized browser
  stream sharing, strict event parsing, reconnect/auth lifecycle, and REST-query reconciliation.
- `apps/api/src/modules/line/rich-menu.*` and `apps/api/src/scripts/sync-line-rich-menu.ts`: external LINE Rich Menu configuration; never log channel access tokens.
- `docs/archive/**`: historical; do not update as current truth.

## 11. Shared UI conventions

- `apps/web/src/components/ui/Pagination.tsx` is the shared 15-row pagination control. Pass labels
  from the active locale namespace; do not hard-code customer-facing pagination copy in pages.
- `AdminOrganizationApplicationsPage` intentionally uses a compact clickable summary list and keeps
  approval/edit controls in its detail modal. Summary rows contain only sequence, organization,
  submission time, plan, and status.
- `BranchManagerSettingsPage` updates existing `exceptionDays` through the business-calendar API;
  no separate holiday table is required for full-day closures. Month movement uses
  `utils/calendarMonth.ts` rather than UTC string conversion.
- `RoleAppShell` workspace content owns vertical scrolling on small screens so fixed/mobile
  navigation cannot hide form submission controls.
- `UserMenuName` is the shared account-name renderer for navigation menus. Keep its two-line clamp,
  adaptive length classes, and full-value `title`; account triggers do not render an avatar.
- Desktop management tables use fixed layout or explicit `minmax(0, ...)` grid tracks. Keep
  sequence/code/status/action cells non-wrapping, reserve flexible width for descriptive data, add
  truncation plus a full-value `title` where content can be long, and preserve mobile card views.
