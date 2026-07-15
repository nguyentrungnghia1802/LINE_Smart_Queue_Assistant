# Development and Testing

## 1. Prerequisites

- Node.js `>=20` (see `.nvmrc`)
- npm `>=10`
- Docker Desktop/Compose for the easiest local stack, or PostgreSQL 16 locally
- Optional: a LINE Developers provider with Login/LIFF and Messaging API channels for real integration tests

## 2. Environment setup

```bash
npm install
cp .env.example .env
```

Required production-like values include database credentials, a strong JWT secret, CORS/web origin, LINE Login channel ID, LINE Messaging channel secret/access token, and LIFF ID. `VITE_*` variables are compiled into browser code and must never contain secrets.

For ordinary UI/backend work without LINE credentials:

```dotenv
VITE_LIFF_MOCK=true
VITE_LIFF_MOCK_LOGGED_IN=true
VITE_PAYMENT_MODE=demo
```

The API uses `MockLineAdapter` in tests or whenever `LINE_CHANNEL_ACCESS_TOKEN` is absent.

## 3. Run with Docker

```bash
npm run docker:dev
```

| Service        | URL/port                |
| -------------- | ----------------------- |
| Web/Vite       | `http://localhost:5173` |
| API            | `http://localhost:4000` |
| PostgreSQL     | `localhost:5432`        |
| Node inspector | `localhost:9229`        |

Useful commands:

```bash
npm run docker:dev:d
npm run docker:dev:logs
npm run docker:dev:ps
npm run docker:dev:down
```

`npm run docker:clean` also removes development database volumes and is destructive.

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

The web API client/proxy expects the API on port `4000`. Start the API and database before diagnosing frontend `/api` failures.

## 5. Database commands

```bash
npm run db:migrate:status
npm run db:migrate
npm run db:seed
npm run db:seed:reset
npm run db:reset
```

- Root migrations use `scripts/migrate.mjs` and the canonical migration directory.
- `db:seed:reset` truncates/reseeds demo data.
- `db:reset` rebuilds local/dev schema and destroys data.
- Root migration rollback/redo commands are intentionally unavailable to prevent mixed runner state.

## 6. Demo baseline

After seeding, the main local accounts use password `123456`:

| Role     | Email                |
| -------- | -------------------- |
| Admin    | `admin@gmail.com`    |
| Manager  | `manager@gmail.com`  |
| Staff    | `staff@gmail.com`    |
| Customer | `customer@gmail.com` |

Public demo paths:

- Organization slug: `queue-lab-demo`
- QR token: `demo-queue-lab-2026`
- Customer page: `http://localhost:5173/qr/demo-queue-lab-2026`

Seed organization address/currency content is legacy demo data and is not representative of the final Japan configuration.

## 7. Validation commands

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run format:check
npm run spell:check
```

Target one workspace:

```bash
npm run test -w apps/api
npm run test -w apps/web
npm run test:watch -w apps/api
npm run test:ui -w apps/web
```

At the 2026-07-15 baseline, the repository contains 30 API test files and 4 web test files. Counts are informational and will change.

## 8. Test strategy

| Layer                          | Tool                                         | Focus                                                                                  |
| ------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| Pure unit                      | Jest/Vitest                                  | ETA, policy, helpers, adapters, validators                                             |
| Service/repository integration | Jest/Supertest/PostgreSQL doubles or test DB | Transactions, tenant checks, state transitions, stock/payment behavior                 |
| Route/API                      | Supertest                                    | Middleware, status/envelope, request validation                                        |
| Component                      | Testing Library/Vitest                       | Render states and critical interactions                                                |
| Browser E2E                    | Not established                              | Required for booking/payment return, role navigation, receipt/QR, responsive workflows |
| Load                           | Historical guide archived                    | Recreate against staging once SLOs and data isolation are defined                      |

Critical regression scenarios:

- Required-only vs all-item payment and draft restoration.
- Finite stock race/rollback and unlimited stock behavior.
- Cross-organization access attempts for every staff/manager command.
- Ticket transition races and duplicate call-next requests.
- LINE token absent, success, failure, duplicate scan, and process restart semantics.
- Organization registration transaction and duplicate email/slug.
- Mobile staff rail/detail layout and public QR/ticket pages.

## 9. Manual LINE verification

1. Configure LINE Login/LIFF and Messaging API under the intended provider.
2. Put secrets only in local `.env`; use the Messaging channel access token/secret and Login channel ID/LIFF ID correctly.
3. Run `npm run line:verify` and confirm the expected Official Account name/basic ID without exposing the token.
4. Expose the local API through HTTPS for LINE webhook testing and set `/api/v1/line/webhook` as the webhook URL.
5. Add/follow the LINE Official Account as required for push eligibility.
6. Open the customer flow inside LIFF and verify `/api/v1/auth/line` links a real `line_user_id`.
7. Create a booking, call the ticket from staff, and observe the Japanese message in LINE chat.
8. Optionally send a direct test with `npm run line:verify -- --send-to <LINE_USER_ID>`.
9. Check API logs/metrics and ensure `notificationDisabled` remains `false` for normal notifications.

Phone sound/banner ultimately follows the customer's LINE and OS notification settings; the server cannot override a muted device/chat.

## 10. Common errors

### Vite proxy `ECONNREFUSED`

Cause: API is not listening on the configured target, commonly because PostgreSQL/API was not started or crashed.

Check:

```bash
curl http://localhost:4000/health
npm run docker:dev:ps
npm run docker:dev:logs
```

### Shared package import/build error

Run `npm run build -w packages/shared` before starting/building dependent workspaces.

### Database connection failure

Verify `DATABASE_URL`, Docker database name/password, host (`localhost` natively, `postgres` inside Compose), and `/ready`.

### LINE push silently mocked

The API intentionally uses a mock when `LINE_CHANNEL_ACCESS_TOKEN` is empty or `NODE_ENV=test`. Read startup logs and `/health.notificationService`.

### Payment always succeeds

Expected when `VITE_PAYMENT_MODE=demo` or no external redirect base is configured. This is not a production payment proof.

## 11. Definition of done

Before handoff, run relevant tests plus lint, typecheck, build, and formatting. Verify migrations for schema work and manually exercise the changed role/viewport flow. Document any check that could not run and update affected canonical docs.
