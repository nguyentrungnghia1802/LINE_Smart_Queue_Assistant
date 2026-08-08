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

LINE notification delivery is durable by default. Local defaults are usually enough, but the worker can be tuned with `LINE_NOTIFICATION_BATCH_SIZE`, `LINE_NOTIFICATION_WORKER_INTERVAL_MS`, `LINE_NOTIFICATION_MAX_ATTEMPTS`, `LINE_NOTIFICATION_RETRY_BASE_SECONDS`, and `LINE_NOTIFICATION_PROCESSING_TIMEOUT_SECONDS`.

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

`npm run docker:clean` also removes development database volumes and is destructive.

### Workspace hygiene

Generated build, coverage, browser-test, TypeScript cache, temporary Jest result, and log files are
excluded by `.gitignore` and `.dockerignore`; they must not be committed or copied into production
image contexts. `npm run clean` removes workspace build output and TypeScript build caches. Other
ignored artifacts may be removed after their process has stopped. Do not treat `.env`,
`apps/web/.env.local`, `deploy/.env`, `node_modules`, PostgreSQL volumes, or local media under `var`
as disposable cleanup targets unless an explicit environment reset is intended.

Before removing a tracked source, asset, Compose file, migration, fixture, or canonical document,
verify imports, runtime/static references, package scripts, tests, Docker `COPY` instructions, and
documentation links. The canonical and deploy production Compose files intentionally have identical
content and are both required by the documented deployment workflow.

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
```

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
staff, customer, multi-queue catalog, order, and LINE mock data. It is not a development baseline
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
npm run format:check
npm run openapi:check
npm run spell:check
npm run e2e:all
```

`npm run audit:ci` audits dependencies shipped to production and fails on new
high/critical advisories. Its single explicit allowlist entry is documented in
`audit-ci.jsonc`: the React Router advisory requires RSC actions, which this
Vite SPA does not use. Development tooling is validated by the test/lint gates
but omitted from the production dependency audit. Do not add an advisory to the
allowlist without recording why it is unreachable and when it can be removed.

Target one workspace:

```bash
npm run test -w apps/api
npm run test -w apps/web
npm run test:watch -w apps/api
npm run test:ui -w apps/web
```

## 9. Test strategy

| Layer                          | Tool                                             | Focus                                                                                       |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Pure unit                      | Jest/Vitest                                      | ETA, policy, helpers, adapters, validators                                                  |
| Service/repository integration | Jest/Supertest/PostgreSQL doubles or test DB     | Transactions, tenant checks, state transitions, stock/payment behavior                      |
| Route/API                      | Supertest                                        | Middleware, status/envelope, request validation                                             |
| Infrastructure lifecycle       | Jest plus Compose smoke tests                    | Redis lifecycle, shared counters, cache hit/miss/TTL, invalidation, corruption, outage      |
| Component                      | Testing Library/Vitest                           | Render states and critical interactions                                                     |
| Browser E2E                    | Playwright + isolated mock LINE/API ports        | Booking/payment return, staff/outbox, receipt, admin, manager QR/settings, responsive flows |
| Load                           | Scenario definitions and a small Docker baseline | Use `11_SCALABILITY_BASELINE.md`; recreate against isolated staging before capacity claims  |

Critical regression scenarios:

- every Admin, organization-owner, branch-manager, Staff, Customer, and LIFF primary destination remains reachable at desktop
  and phone viewports without page-level horizontal overflow;

- Required-only vs all-item payment and draft restoration.
- Finite stock race/rollback and unlimited stock behavior.
- Cross-organization access attempts for every staff/manager command.
- Ticket transition races and duplicate call-next requests.
- LINE token absent, success, failure, duplicate scan, durable outbox retry, and process restart semantics.
- LINE Flex Message payload, text fallback, deeplink URL, and no-rollback behavior for queue/order notifications.
- LIFF Home authentication, active-ticket/no-ticket states, Rich Menu route resolution, and Rich Menu sync idempotency/mock behavior.
- Organization registration transaction and duplicate email/slug.
- Mobile staff rail/detail layout, Staff/Manager QR parity, LIFF booking availability states, and
  the body-portal QR camera dialog.
- Production web bundles contain no `eval(` or `new Function`; `npm run build -w apps/web` performs
  this CSP check after Vite emits the bundle.

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

Expected when `VITE_PAYMENT_MODE=demo` or no external redirect base is configured. This is not a production payment proof.

## 12. Definition of done

Before handoff, run relevant tests plus lint, typecheck, build, and formatting. Verify migrations for schema work and manually exercise the changed role/viewport flow. Document any check that could not run and update affected canonical docs.
