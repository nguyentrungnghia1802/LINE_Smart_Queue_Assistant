# Development and Testing

The cross-layer source inventory and validation gate are summarized in
[`10_IMPLEMENTATION_MAP.md`](10_IMPLEMENTATION_MAP.md). This document remains the detailed local,
CI, fixture, test, and troubleshooting guide.

## 1. Prerequisites

- Node.js `>=20` (see `.nvmrc`)
- npm `>=10`
- Docker Desktop/Compose for the easiest local stack, or PostgreSQL 16 plus optional Redis locally
- Optional: a LINE Developers provider with Login/LIFF and Messaging API channels for real integration tests

## 2. Environment setup

```bash
npm install
cp .env.example .env
```

Required production-like values include database credentials, a strong JWT secret, CORS/web
origin, `LINE_LOGIN_CHANNEL_ID`, `LINE_MESSAGING_CHANNEL_SECRET`,
`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`, frontend `VITE_LIFF_ID`, backend
`LINE_LOGIN_LIFF_ID` for notification/Rich Menu deep links, and `LINE_RICH_MENU_IMAGE_PATH` for real
Rich Menu sync. `VITE_*` variables are compiled into browser code and must never contain secrets.

Authentication defaults are `JWT_ACCESS_EXPIRES_IN=15m`,
`AUTH_BUSINESS_IDLE_TIMEOUT_MINUTES=15`, `AUTH_BUSINESS_ABSOLUTE_TIMEOUT_HOURS=12`, and
`AUTH_CUSTOMER_SESSION_DAYS=30`. Local HTTP uses a non-secure `HttpOnly` refresh cookie;
production automatically adds `Secure`. Do not restore the removed `JWT_EXPIRES_IN=7d` behavior or
store access/refresh tokens in local storage.

Redis configuration is backend-only: `REDIS_URL`, `REDIS_CONNECT_TIMEOUT_MS`,
`REDIS_COMMAND_TIMEOUT_MS`, `REDIS_KEY_PREFIX`, `REDIS_PUBLIC_BRANCH_CACHE_TTL_MS`, and
`REDIS_PUBLIC_QUEUE_CACHE_TTL_MS`. Native development may leave `REDIS_URL` empty; public reads
then use PostgreSQL directly and protected policies use bounded local rate-limit counters. Compose
supplies `redis://redis:6379`. Never put a Redis URL or password in a `VITE_*` variable.

LINE notification delivery is durable by default. Compose sets
`LINE_NOTIFICATION_DELIVERY_OWNER=bullmq` and starts a separate worker. Bare native development may
keep `api` ownership when no worker process is running. BullMQ startup, job timeout, concurrency,
provider rate limits, and heartbeat use `BULLMQ_*`/`WORKER_*`; outbox dispatch claims and delivery
retry policy remain under `LINE_NOTIFICATION_*`. Never start API and BullMQ ownership together.

For ordinary UI/backend work without LINE credentials:

```dotenv
VITE_LIFF_MOCK=true
VITE_LIFF_MOCK_LOGGED_IN=true
VITE_LIFF_MOCK_FRIEND=true
VITE_LIFF_ENDPOINT_PATH=/liff
VITE_PAYMENT_MODE=demo
```

Native Vite development defaults to the mock LIFF adapter unless `VITE_LIFF_MOCK=false` is set
explicitly. The API defaults ID-token verification to `mock` outside production. The development
Compose file pins matching mock token/user values on both sides, so local customer authentication
still exercises ID token -> backend -> system JWT without contacting LINE.
Set `VITE_LIFF_MOCK_FRIEND=false` to exercise the Add Friend prompt locally; the mock request
transitions to the followed state without contacting LINE.

For local Rich Menu navigation demos, set `VITE_LIFF_DEFAULT_BOOKING_PATH` to a safe LIFF booking path such as `/liff/qr/demo-queue-lab-2026`.

Customer email registration and login are not a supported development fallback. Operational email
login remains available for staff, managers, and admins.

## 3. Run with Docker

```bash
npm run docker:dev
```

| Service        | URL/port                |
| -------------- | ----------------------- |
| Web/Vite       | `http://localhost:5173` |
| API            | `http://localhost:4000` |
| BullMQ worker  | no published port       |
| PostgreSQL     | `localhost:5432`        |
| Redis          | `localhost:6379`        |
| Node inspector | `localhost:9229`        |

The development API container builds `packages/shared` and applies pending canonical
`node-pg-migrate` migrations before starting the hot-reload server. It does not seed demo data
automatically. Run `npm run db:seed` to create only the platform administrator. Load operational
tenant data only through `npm run db:fixture:e2e` on an isolated non-production database.
Redis AOF data uses the separate `redis_dev_data` volume; `npm run docker:clean` removes it along
with the development database volume.

Useful commands:

```bash
npm run docker:dev:d
npm run docker:dev:logs
npm run docker:dev:ps
npm run docker:dev:down
```

For isolated frontend component review, Storybook uses the same Vite aliases, Tailwind design
tokens, i18n resources, and local component fixtures without starting the API or contacting any
external provider:

```bash
npm run storybook
npm run storybook:build
```

The toolbar provides Japanese, Vietnamese, and English locale selection plus phone and desktop
viewports. The 21 colocated story modules expose 65 entries covering shared brand/layout/i18n
controls, role shell and login chrome, loading/empty/error/pagination feedback, queue/ticket/order
states, manager form/map boundaries, and LIFF friendship/QR flows. Stories that change state use
Storybook interaction tests
for pagination, dismissible alerts, product selection, friendship requests, and QR navigation.
`apps/web/src/storybook/fixtures.ts` contains queue, ticket, order, and LIFF fixtures;
`apps/web/src/storybook/providers.tsx` supplies deterministic authenticated context without login,
storage, or network calls. Camera, maps, and API integration boundaries stay in Vitest tests with
explicit mocks. A Storybook static build is a development/CI review artifact and is not copied into
the production web image.

OPT-003 measured the production Web build before and after route-level splitting. The same
`npm run build -w apps/web` command (including the CSP scan) produced this local comparison:

| Evidence                      | Before                  | After                   |
| ----------------------------- | ----------------------- | ----------------------- |
| Eager page entry              | 728.14 kB / 156.56 gzip | 23.74 kB / 7.02 gzip    |
| Router chunk                  | 371.73 kB / 115.54 gzip | 92.11 kB / 30.59 gzip   |
| Catch-all eager vendor chunk  | 684.87 kB / 195.13 gzip | removed                 |
| Largest route-only LIFF chunk | included eagerly        | 542.78 kB / 146.09 gzip |

Sizes are minified Vite output, not network timing or a production capacity claim. Page chunks may
change hashes and sizes as features evolve. Review the generated `dist/index.html` preload list and
chunk table whenever adding a dependency: a large route-only chunk is acceptable when it is not
preloaded for unrelated roles, while a growing eager entry requires investigation.

`npm run docker:clean` also removes development database volumes and is destructive.

### Workspace hygiene

Generated build, coverage, browser-test, TypeScript cache, temporary Jest result, and log files are
excluded by `.gitignore` and `.dockerignore`; they must not be committed or copied into production
image contexts. `npm run clean` removes workspace build output and TypeScript build caches. Other
ignored artifacts may be removed after their process has stopped. Do not treat `.env`,
`apps/web/.env.local`, `deploy/.env`, `node_modules`, PostgreSQL volumes, or local media under `var`
as disposable cleanup targets unless an explicit environment reset is intended.

The production-oriented VPS demo also treats the Compose `media_data` volume as durable data.
Normal release commands may recreate `api`, but must not use `docker compose down --volumes` or
remove that named volume. `MEDIA_LOCAL_DIR` is fixed to `/app/var/media` in production Compose so
the local provider cannot drift onto the container's writable layer.

Before removing a tracked source, asset, Compose file, migration, fixture, or canonical document,
verify imports, runtime/static references, package scripts, tests, Docker `COPY` instructions, and
documentation links. `deploy/docker-compose.yml` is the one canonical production image stack and
fails closed unless both immutable image variables are supplied; `docker-compose.dev.yml` and
`docker-compose.validation.yml` are separate local/validation topologies and must not be treated as
production overlays.

## 4. Run natively

Create the database and set `DATABASE_URL`, then:

```bash
npm run build -w packages/shared
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run dev` starts workspace development processes. For isolated debugging:

```bash
npm run dev -w apps/api
npm run dev -w apps/web
npm run dev:worker
```

When running the worker natively, set `REDIS_URL` and
`LINE_NOTIFICATION_DELIVERY_OWNER=bullmq`; set the same owner on the API so its in-process scheduler
does not deliver the same outbox. If Redis is unavailable, the worker exits startup and the process
supervisor restarts it; the API continues committing notification outbox rows.

The web API client/proxy expects the API on port `4000`. Vite proxies both `/api/*` and persisted `/media/*` URLs to that API, so uploaded organization and product images work through the same local origin. Native Vite defaults its server-only `API_PROXY_TARGET` to `http://127.0.0.1:4000`; Docker Compose sets it to `http://api:4000` and mounts `apps/web/public` so static brand assets are available too. `API_PROXY_TARGET` is not a `VITE_*` value and is never compiled into browser code. Start the API and database before diagnosing frontend `/api` or `/media` failures.

## 5. Database commands

```bash
npm run db:migrate:status -w apps/api
npm run db:migrate -w apps/api
npm run db:migrate:status
npm run db:migrate
npm run db:seed
npm run db:seed:reset
npm run db:fixture:e2e
npm run db:reset
```

- Canonical schema migrations use `node-pg-migrate`, read `db/migrations/node-pg-migrate`, and are exposed consistently through both root and `apps/api` workspace commands.
- `db:seed` is idempotent and creates only `admin@gmail.com`; it does not create organizations,
  branches, managers, staff, customers, products, queues, or transactions.
- `db:seed:reset` truncates tenant/application data before reloading only that administrator. It is
  blocked in production; a non-loopback isolated development database requires
  `ALLOW_DESTRUCTIVE_SEED_RESET=true`.
- `db:fixture:e2e` loads deterministic organizations, branches, managers, staff, customers, queue
  catalogs, transactions, and notification data exclusively for browser tests. It is blocked when
  `NODE_ENV=production`.
- `db:reset`/`db:reset:local` destroy and rebuild only a local/dev schema, then migrate and load the minimal seed profile.
- `scripts/migrate.mjs` remains only as the local reset helper. Its historical SQL apply mode requires the explicit `ALLOW_LEGACY_SQL_MIGRATIONS=true` opt-in and must not be used for normal deployments.
- Historical numeric migration names can produce non-blocking timestamp-order warnings from `node-pg-migrate`; never rename already-applied migrations to silence them.

## 6. LINE Rich Menu sync

Rich Menu synchronization is an explicit operator action and does not run when the API starts:

```bash
npm run line:rich-menu:sync
npm run line:rich-menu:sync -- --replace
```

The command builds the centralized menu for `ホーム`, `予約する`, `現在の受付`, and `利用案内`,
reuses an existing menu with the same managed name, removes duplicates, uploads the configured
image, and sets it as default. When `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` is missing or
`NODE_ENV=test`, the mock adapter is used. Do not commit the token, and do not log it while
debugging.

Set `LINE_RICH_MENU_IMAGE_PATH` to a local PNG/JPEG with a production-valid LINE Rich Menu size before syncing against a real Official Account. If the image path is omitted, a generated placeholder is only suitable for mock/dev behavior.

## 7. Seed and fixture profiles

The only seed profile (`npm run db:seed`) creates one platform administrator and leaves all tenant,
operational, and commercial tables empty:

| Role  | Email             | Local fallback password |
| ----- | ----------------- | ----------------------- |
| Admin | `admin@gmail.com` | `123456`                |

Set `SEED_ADMIN_PASSWORD` explicitly outside local development; it is required when
`NODE_ENV=production`.

The E2E fixture profile (`npm run db:fixture:e2e`) creates isolated branch-owner, branch-manager,
staff, customer, multi-queue catalog, order, deterministic demo payment/refund, and LINE mock data. It is not a development baseline
or production bootstrap. Any fixture customer uses the local LIFF mock path, never email login.
The fixture keeps the browser-test public entry stable:

- Organization slug: `queue-lab-demo`
- QR token: `demo-queue-lab-2026`
- Customer page: `http://localhost:5173/qr/demo-queue-lab-2026`

Seed organization, customer, product, address, currency, and timezone data use the Japanese demo baseline. Use full demo fixtures only for scenarios that explicitly need them.

Internationalization tests cover locale precedence, Japanese fallback, Intl formatting, language resources, and LINE Flex/text templates. Add every semantic key to the `ja`, `vi`, and `en` domain resources.

## 8. Validation commands

```bash
npm run audit:ci
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run storybook:build
npm run format:check
npm run openapi:check
npm run spell:check
npm run e2e:all
npm run media:persistence:verify
```

The media persistence command expects the production API runner image. Build it first when the
validation tag is not already present:

```bash
docker build --target runner -t line-smart-queue-api:media-persistence-validation -f docker/api/Dockerfile .
npm run media:persistence:verify
```

The check creates a uniquely named temporary Docker volume, writes through the non-root API image,
starts a second container against the same volume, verifies the file, and removes only its temporary
containers and volume.

The GitHub Actions workflow runs these checks as separate jobs so a failure is isolated to one
quality surface: secret scan, dependency audit, formatting, spelling, lint, type-check, OpenAPI,
development/validation/production Compose config, API tests, web/shared tests, migration/seed
smoke, production build, local-media named-volume persistence, and browser E2E. The API tests,
migration smoke, and browser E2E jobs each
use their own PostgreSQL service. Browser E2E prepares its own database and loads the explicit
browser-only fixtures before starting Playwright. The E2E job waits for the static, unit, contract,
Compose, migration, and build jobs, so it does not hide an earlier failure behind a browser timeout.

`npm run audit:ci` audits dependencies shipped to production and fails on new
high/critical advisories. Its single explicit allowlist entry is documented in
`audit-ci.jsonc`: the React Router advisory requires RSC actions, which this
Vite SPA does not use. Development tooling is validated by the test/lint gates
but omitted from the production dependency audit. Do not add an advisory to the
allowlist without recording why it is unreachable and when it can be removed.

CI Gitleaks scans full Git history. `.gitleaksignore` contains only exact fingerprints for reviewed
historical test-password literals and obsolete example-environment placeholders. Do not suppress a
whole rule or path; a new finding must be investigated as a potential credential before any exact
fingerprint is added.

Production CD is manual and environment-gated. Type `DEPLOY` in the workflow dispatch form; the
workflow builds and pushes immutable API/Web images tagged with the selected commit, waits for
approval on the `production` environment, validates the remote Compose file, migrates the database,
waits for healthy services, and probes Web health. Runtime secrets stay on the server in
`deploy/.env`; CD never copies them from GitHub. The rollout uses `up -d` without `--volumes`, so the
VPS `media_data` volume survives API image replacement and container recreation. CD also inspects
the live API mount type and, in local mode, verifies the fixed path is writable before declaring the
release healthy.

Target one workspace:

```bash
npm run test -w apps/api
npm run test -w apps/web
npm run test:watch -w apps/api
npm run test:ui -w apps/web
```

### Integrated horizontal validation

TASK-11 adds a local-only topology with two API replicas, shared PostgreSQL/Redis, a dedicated
BullMQ worker, and an nginx gateway. It uses mock/disabled providers and an isolated Compose
project/volume; never point it at production data or real recipients.

```bash
npm run scale:validate:config
npm run scale:validate

# Optional focused HTTP run against an already running target.
npm run scale:load -- --url http://localhost:4180/api/v1/orgs/by-token/demo-queue-lab-2026 --requests 160 --concurrency 10
```

For backend query work, capture `EXPLAIN (ANALYZE, BUFFERS)` inside an explicit transaction and end
synthetic fixture measurements with `ROLLBACK`. OPT-002 records the exact representative shapes and
results in `11_SCALABILITY_BASELINE.md`. Its deterministic regression scope is:

```bash
npm run test -w apps/api -- --runInBand \
  src/modules/staff/__tests__/staff.my-queue.test.ts \
  src/modules/orders/__tests__/orders.repository.test.ts \
  src/modules/location/__tests__/location.repository.test.ts \
  src/modules/location/__tests__/location.service.performance.test.ts
```

`scale:validate` applies migrations and the explicit E2E fixture, then checks cross-instance auth,
shared strict rate limiting, cache loss, Redis interruption/recovery, durable worker restart,
cross-instance SSE, API restart, PostgreSQL readiness failure/recovery, metrics, and container
resource snapshots. It tears the stack down by default and writes the ignored evidence file to
`var/scalability/task-11-report.json`. This disruptive harness remains a manual engineering gate;
normal CI keeps the deterministic unit/config/infrastructure tests and does not run Docker failure
injection on every commit.

## 9. Test strategy

| Layer                          | Tool                                            | Focus                                                                                                                                   |
| ------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Pure unit                      | Jest/Vitest                                     | ETA, policy, helpers, adapters, validators                                                                                              |
| Service/repository integration | Jest/Supertest/PostgreSQL doubles or test DB    | Transactions, tenant checks, state transitions, stock/payment behavior                                                                  |
| Route/API                      | Supertest                                       | Middleware, status/envelope, request validation                                                                                         |
| Infrastructure lifecycle       | Jest plus Compose smoke tests                   | Redis lifecycle/cache/limits/Pub/Sub, SSE cleanup/fan-out, and BullMQ startup/restart/outage                                            |
| Component                      | Testing Library/Vitest                          | Render states and critical interactions                                                                                                 |
| Isolated component review      | Storybook 10 + React/Vite                       | Locale, phone/desktop viewport, and deterministic reusable-component states                                                             |
| Browser E2E                    | Playwright + isolated mock LINE/API ports       | Booking/payment return, refund idempotency, Staff/outbox scope, sanitized Admin health, Manager QR/settings, i18n, and responsive flows |
| Load/failure                   | Node HTTP runner plus isolated Compose topology | Use `scale:validate`; recreate against production-like staging before capacity claims                                                   |

API Jest runs do not load the repository `.env`. Configuration tests must set every relevant
environment value explicitly so local credentials and developer-specific limits cannot change
their result. Normal development and production processes continue to load the root `.env`.

Realtime tests cover strict event parsing, customer ownership, exact branch/Staff assignment,
organization-owner rejection, heartbeat and disconnect cleanup, connection fan-out, Redis
resubscription, duplicate suppression, and cross-tenant/cross-instance routing. Proxy tests assert
that `/api/v1/realtime/*` preserves the `/api` prefix and disables nginx buffering. Frontend tests
cover shared connections, delayed and duplicate events, bounded reconnect/degraded polling,
session expiry, visibility/navigation cleanup, and customer/Staff TanStack Query reconciliation.
Use the existing customer booking and Staff operations Playwright scopes for browser regression;
REST responses remain the assertion source rather than SSE payload contents.

Critical regression scenarios:

- User-profile authorization rejects Platform Admin, Organization Owner, Staff, and Customer reads
  of another user; a branch manager can read/list only Staff assigned to the manager's one branch.
  Safe-response tests assert that password hashes and internal actor metadata are absent.
- Session tests cover expiry and rotated-token replay; LINE tests cover missing/tampered signatures;
  payment tests cover signed provider payloads and duplicate webhook event IDs. Rate-limit tests
  assert that raw forwarded headers cannot override the Express proxy-validated client IP.

- every Admin, organization-owner, branch-manager, Staff, Customer, and LIFF primary destination remains reachable at desktop
  and phone viewports without page-level horizontal overflow;

- Browser locale switching covers Japanese, English, and Vietnamese plus persisted choice;
  locale resolution unit tests retain Japanese as the final fallback.

- Required-only vs all-item payment and draft restoration.
- Finite stock race/rollback and unlimited stock behavior.
- Cross-organization access attempts for every staff/manager command.
- Ticket transition races and duplicate call-next requests.
- Concurrent direct queue joins recheck active ownership after acquiring the queue lock; the losing
  request reuses the committed ticket and cannot increment the counter or enqueue a duplicate event.
- LINE token absent, success, failure, duplicate dispatch/job/worker execution, crash before/after
  enqueue, Redis outage, provider timeout/429/5xx/4xx, exhausted retry, multi-worker scheduler
  idempotency, and process restart/backlog semantics.
- LINE Flex Message payload, text fallback, deeplink URL, and no-rollback behavior for queue/order notifications.
- LIFF Home authentication, active-ticket/no-ticket states, Rich Menu route resolution, and Rich Menu sync idempotency/mock behavior.
- Media validation/compression, local/mock providers, S3/R2 command mapping, generated-key collision
  retry, tenant authorization, database registration failure cleanup, missing-object idempotency,
  provider failure recovery, production local-mode startup without `S3_*`, the production Compose
  mount contract, and a non-root API image reading a file written by an earlier container through
  the same named volume.
- Organization registration transaction and duplicate email/slug.
- Mobile staff rail/detail layout, Staff/Manager QR parity, LIFF booking availability states, and
  the body-portal QR camera dialog.
- Production web bundles contain no `eval(` or `new Function`; `npm run build -w apps/web` performs
  this CSP check after Vite emits the bundle.
- Critical public, LIFF, Staff, Manager, and Admin page modules remain lazy route elements under the
  shared accessible loading fallback; the router unit test guards those role-level boundaries.

Playwright uses API/web ports `4100`/`5174`, a unique mock LINE user for each run,
the demo payment provider, and the mock LINE messaging adapter. Prepare a migrated,
seeded local database, install Chromium once, and run:

```bash
npm run e2e:install
npm run db:fixture:e2e
npm run e2e:all
```

`LINE_ID_TOKEN_VERIFICATION_MODE=mock` is an explicit local/CI setting and is
rejected when `NODE_ENV=production`. Browser E2E never contacts LINE or a PSP.

`npm run scale:validate` is intentionally cross-platform and invokes Docker without an intermediary
shell so SQL passed through `docker compose exec ... psql -tAc` remains one argument on Windows and
Linux. A successful run is the recovery acceptance gate; do not infer success from container startup
alone. The generated `var/scalability/task-11-report.json` must show every check as `passed`.

Payment configuration tests must prove both sides of the runtime boundary. `PAYMENT_MODE=demo`
must start without `PAYOS_*`, select only `DemoPaymentProvider`, and keep signed completion,
duplicate callback, refund, and order-authority tests green. `PAYMENT_MODE=external` must fail
configuration loading when any required payOS credential is absent. Do not add placeholder PSP
credentials to CI to bypass this check. The customer booking Playwright scenario is the current
end-to-end demo-payment acceptance path and does not prove merchant or real-money acceptance.

The complete local acceptance sequence, fixture identities/state matrix, recommended role journey,
evidence map, and deferred external requirements are maintained in
`docs/guide/DEMO_ACCEPTANCE.md`.

Keep `OTEL_SDK_DISABLED=true` and Sentry DSNs empty in local/CI unless a test collector/project is
intentionally available. Targeted observability tests cover backend/browser sanitization,
fail-open capture, no-exporter spans, and BullMQ trace-carrier compatibility. In staging, verify
one API request and one notification delivery have trace/log correlation, then confirm the same
business operations succeed while collector and Sentry endpoints are unavailable. Never use real
customer contact or credentials as test fixtures.

## 10. Manual LINE verification

1. Configure LINE Login/LIFF and Messaging API under the intended provider.
2. Put secrets only in local `.env`; use the Messaging channel access token/secret and Login channel ID/LIFF ID correctly.
3. Run `npm run line:verify` and confirm the expected Official Account name/basic ID without exposing the token.
4. Expose the local API through HTTPS for LINE webhook testing and set `/api/v1/line/webhook` as the webhook URL.
5. Configure the LIFF app size as `Full`, link the intended Official Account, and keep the Add
   Friend option enabled. Open the LIFF app without following the account, confirm the localized
   prompt appears, complete its Add/Unblock action, and verify it disappears after the friendship
   state is synchronized.
6. With the LINE Console endpoint set to `https://<web-origin>/liff`, open
   `https://liff.line.me/{LIFF_ID}/qr/{publicQrToken}` and verify `/api/v1/auth/line` links a real
   `line_user_id` without producing `/liff/liff/...`.
7. Select products/services, complete demo prepayment if required, create a booking, and confirm the app redirects to `/liff/tickets/:entryId`.
8. Call the ticket from staff and observe the Flex Message in the customer's selected locale after the notification worker claims the outbox row. The card should include ticket code, status, people ahead, ETA, next action, and a button that opens the LIFF ticket detail. Japanese is the final locale fallback; text delivery is expected only when Flex delivery fails.
9. Configure `LINE_RICH_MENU_IMAGE_PATH`, run `npm run line:rich-menu:sync`, and confirm the Official Account Rich Menu opens LIFF Home, booking, current ticket, and usage guide routes.
10. Optionally send a direct test with `npm run line:verify -- --send-to <LINE_USER_ID>`.
11. Check API logs/metrics and the `notifications` table. Successful rows should move to `sent`; retryable failures return to `pending` with a future `next_retry_at`; exhausted rows remain `failed`. Ensure `notificationDisabled` remains `false` for normal notifications.

Phone sound/banner ultimately follows the customer's LINE and OS notification settings; the server cannot override a muted device/chat.

## 11. Common errors

### Vite proxy `ECONNREFUSED`

Cause: API is not listening on the configured target, commonly because PostgreSQL/API was not started or crashed.

Check:

```bash
curl http://localhost:4000/health
npm run docker:dev:ps
npm run docker:dev:logs
```

### Shared package import/build error

For native development, run `npm run build -w packages/shared` before starting/building dependent
workspaces. Docker development performs this build during API container startup. If
`@line-queue/shared/dist/index.js` is missing in Docker, recreate the API container from the current
`docker-compose.dev.yml`.

### Database connection failure

Verify `DATABASE_URL`, Docker database name/password, host (`localhost` natively, `postgres` inside Compose), and `/ready`.

If scheduler logs report missing relations such as `scheduler_job_runs` or `notifications`, verify
that the API startup migration completed successfully before the dev server started.

### API container is running but unhealthy

The development healthcheck must probe `http://127.0.0.1:4000/health`. Using `localhost` may resolve
to IPv6 inside Alpine while the API listener is bound to IPv4, producing a false
`connection refused` result.

### Dashboard/login flicker after reseeding

Cause: a browser tab may still hold a JWT and persisted user state from before the database was
reset or reseeded. The web app clears both values when an authenticated API request returns `401`,
so the next visit should settle on the login page instead of bouncing between role dashboards. Local
and test strict auth limits are intentionally higher than production to avoid reseed/debug loops
triggering `429 Too many requests`.

### LINE push silently mocked

The API intentionally uses a mock when `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` is empty or
`NODE_ENV=test`. Read startup logs and `/health.notificationService`.

### Rich Menu sync uses mock mode

Cause: `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` is empty or the command is running under
`NODE_ENV=test`.

Check the environment file loaded by the API workspace. The sync command should print a summary, not the token.

### Rich Menu image upload fails

Cause: `LINE_RICH_MENU_IMAGE_PATH` is missing, unreadable, wrong content type, or not a LINE-valid Rich Menu image size.

Use a PNG/JPEG asset prepared for Rich Menu and rerun `npm run line:rich-menu:sync -- --replace` only when intentionally replacing the managed menu.

### Payment always succeeds

Expected when both frontend and API are explicitly configured for demo. Completion still requires
the API-issued signed token and server transaction state; browser state is not payment authority.
This is a production-oriented demonstration, not proof of real-money PSP acceptance.

## 12. Definition of done

Before handoff, run relevant tests plus lint, typecheck, build, and formatting. Verify migrations for schema work and manually exercise the changed role/viewport flow. Document any check that could not run and update affected canonical docs.
