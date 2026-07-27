# LINE Smart Queue Assistant

LINE Smart Queue Assistant is a LINE-first queue, reservation, ordering, payment-foundation, and customer-notification platform for Japanese service businesses. Customers reserve from a QR code or LIFF, receive queue updates in LINE chat, and track their ticket without waiting beside the counter. Staff, managers, and platform admins use role-specific browser dashboards.

The project is currently a working modular monolith with a deployed LINE Login/LIFF customer path. Core queue, order, inventory, multilingual UI, LIFF login, role-aware revocable browser sessions, LINE notification outbox, Rich Menu navigation, and demo payment flows are implemented. Production PSP integration, complete physical-device messaging acceptance, and real travel-time provider integration are still pending.

## Table of contents

- [Problem](#problem)
- [What the system does](#what-the-system-does)
- [Current status](#current-status)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Why this stack](#why-this-stack)
- [Multilingual support](#multilingual-support)
- [Quick start](#quick-start)
- [Demo data](#demo-data)
- [LINE setup summary](#line-setup-summary)
- [Validation](#validation)
- [Documentation](#documentation)
- [License](#license)

## Problem

Many shops, salons, clinics, and service counters still make customers wait physically with poor visibility into their turn. At the same time, staff need to manage reservations, service items, stock, prepayment, receipts, queue states, and customer communication from one reliable workspace.

This project solves that by moving the customer-facing flow into QR and LINE while keeping business operations in web dashboards.

## What the system does

- Lets customers enter from QR or LINE LIFF, choose products/services, pay demo prepayment when required, and create a booking.
- Uses verified LINE identity in LIFF so queue notifications can be pushed to the customer's LINE chat.
- Shows ticket code, current status, people ahead, ETA, selected items, and payment state.
- Gives staff a queue workspace for calling, serving, completing, cancelling, marking no-show, updating payment, and printing receipts.
- Gives organization owners branch/manager/audit/revenue oversight, while branch managers configure
  products, multiple queues, staff, branch hours, and one branch QR.
- Provides a public product site and business service application, then gives platform admins an
  approval-only organization onboarding workflow without exposing tenant customer/revenue data.
- Keeps order, queue entry, payment transaction, and finite-stock inventory changes consistent through PostgreSQL transactions.
- Sends LINE lifecycle notifications through a durable PostgreSQL outbox with retry/backoff and text fallback.

## Current status

| Area                         | Status                            | Notes                                                                         |
| ---------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Customer QR/LIFF booking     | Implemented                       | QR/web entry redirects to LINE; booking requires verified LINE identity       |
| LINE Login and Messaging API | Login deployed; messaging in code | Complete notification/Rich Menu physical-device acceptance is still required  |
| Queue and staff operation    | Implemented                       | Ticket lifecycle, staff board, receipt access, and manual payment controls    |
| Products and inventory       | Implemented                       | Finite/unlimited stock, transactional reservation, release/consume lifecycle  |
| Payment                      | Production foundation implemented | Demo provider works; Stripe/KOMOJU/PayPay adapters are not connected yet      |
| Rich Menu                    | Implemented in code               | Explicit sync command; production asset and LINE account verification pending |
| Location alerts              | Partial                           | Consent-aware snapshot/mock flow exists; real travel-time provider pending    |
| ETA and staffing advice      | Heuristic baseline                | Measured workload and historical aggregates, not a trained ML system          |
| Internationalization         | Implemented                       | Japanese default with Vietnamese and English support                          |
| Deployment                   | Local/Compose ready               | Production infrastructure and secret management are environment-specific      |

## Screenshots

Screenshots are intentionally stored outside the app source so README updates do not mix with product code. Add real images later under:

```text
docs/assets/screenshots/
```

Recommended filenames:

| View                         | Suggested file                                    |
| ---------------------------- | ------------------------------------------------- |
| Customer LIFF home           | `docs/assets/screenshots/customer-liff-home.png`  |
| Customer booking             | `docs/assets/screenshots/customer-booking.png`    |
| Ticket status                | `docs/assets/screenshots/customer-ticket.png`     |
| Staff queue workspace        | `docs/assets/screenshots/staff-dashboard.png`     |
| Manager dashboard            | `docs/assets/screenshots/manager-dashboard.png`   |
| Manager QR settings          | `docs/assets/screenshots/manager-qr.png`          |
| Platform admin organizations | `docs/assets/screenshots/admin-organizations.png` |

After adding images, embed the most important ones here, for example:

```md
![Customer booking](docs/assets/screenshots/customer-booking.png)
```

## Architecture

The system is a TypeScript modular monolith:

```text
Customer Browser / LINE LIFF       Staff / Manager / Admin Browser
              |                                  |
              +-------------- HTTPS -------------+
                                 |
                         React + Vite SPA
                                 |
                         REST /api/v1 + JWT
                                 |
                         Express API process
                    +------------+-------------+
                    |            |             |
               PostgreSQL   Scheduled jobs   LINE APIs
                    ^             |          Login/OIDC +
                    |             +------> Messaging push
                    +------ durable notification outbox
```

Main workspaces:

| Component      | Location                        | Responsibility                                                         |
| -------------- | ------------------------------- | ---------------------------------------------------------------------- |
| Web SPA        | `apps/web`                      | Customer, LIFF, staff, manager, and admin interfaces                   |
| REST API       | `apps/api`                      | Auth, tenant checks, queue/order/payment logic, jobs, LINE integration |
| Shared package | `packages/shared`               | Framework-independent TypeScript types and constants                   |
| Database       | `db/migrations/node-pg-migrate` | Executable PostgreSQL schema history                                   |
| Docs           | `docs/project`                  | Canonical product, architecture, domain, API, and operations documents |

## Technology stack

- Node.js 20+, npm workspaces, TypeScript
- React, Vite, React Router, TanStack Query, Zustand
- `i18next` and `react-i18next`
- Express, Zod, PostgreSQL 16, `pg`
- LINE LIFF, LINE Login/OIDC, LINE Messaging API
- Demo payment provider with production-ready payment gateway boundaries
- Jest, Supertest, Vitest, Testing Library, Playwright
- Docker Compose for local and production-like runtime boundaries

## Why this stack

| Choice                      | Reason                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Modular monolith            | Keeps local development and deployment simple while preserving clear module boundaries for future extraction.              |
| React SPA                   | One browser application can serve customer, staff, manager, and admin experiences with shared UI conventions.              |
| PostgreSQL                  | Queue, order, payment, inventory, notification, and tenant isolation rules need strong transactions and indexes.           |
| LINE-first customer flow    | Japanese customers already use LINE, so booking, identity, ticket links, and notifications can live in a familiar channel. |
| Durable notification outbox | Queue/order changes should succeed even when LINE delivery is slow or temporarily failing.                                 |
| Demo payment provider       | Development can continue without paid PSP accounts while keeping a production-ready provider boundary.                     |
| i18next resources           | User-facing copy is separated by locale/domain, keeping Japanese default behavior while supporting Vietnamese and English. |

## Multilingual support

The product UI and customer-facing LINE messages support:

| Locale | Role                                   |
| ------ | -------------------------------------- |
| `ja`   | Default and final fallback             |
| `vi`   | Vietnamese user-facing UI and messages |
| `en`   | English user-facing UI and messages    |

Locale resolution follows:

```text
user preferred locale -> organization default locale -> browser/LIFF locale -> ja
```

Frontend translations are split by locale and domain. Backend LINE Flex Message and text fallback templates are also centralized per locale. API errors use stable error codes so the frontend can translate the display text.

## Quick start

```bash
npm install
cp .env.example .env
npm run docker:dev
```

The development API container builds the shared workspace and applies pending database migrations
before it starts. Seed data remains explicit: `npm run db:seed` creates only the platform admin.
Run `npm run db:fixture:e2e` only when isolated browser-test fixtures are required.

Development URLs:

| Service    | URL                              |
| ---------- | -------------------------------- |
| Web        | `http://localhost:5173`          |
| API        | `http://localhost:4000`          |
| Swagger UI | `http://localhost:4000/api/docs` |
| Health     | `http://localhost:4000/health`   |

Native development with a local PostgreSQL instance:

```bash
npm run build -w packages/shared
npm run db:migrate
npm run db:seed
npm run dev
```

The web app proxies `/api` to the API on port `4000`. If the API is not running, Vite will report proxy `ECONNREFUSED`.

## Demo data

The default seed creates only the platform administrator. It intentionally leaves organizations,
branches, managers, staff, customers, products, queues, orders, tickets, payments, and
notifications empty so a fresh local or server database starts from the real onboarding flow.
The local default password is `123456`; production seeding requires `SEED_ADMIN_PASSWORD`.

| Role  | Email             |
| ----- | ----------------- |
| Admin | `admin@gmail.com` |

Customer email/password login is intentionally disabled. Local customer flows use the LIFF mock
identity, while production customer flows use a verified LINE ID token.

The isolated E2E fixture creates these demo paths:

- QR token: `demo-queue-lab-2026`
- Customer entry: `http://localhost:5173/qr/demo-queue-lab-2026` (redirects into the local LIFF mock)
- LIFF mock booking path: `/liff/qr/demo-queue-lab-2026`

Create the isolated browser-test dataset with:

```bash
npm run db:fixture:e2e
```

For local work without real LINE credentials:

```dotenv
VITE_LIFF_MOCK=true
VITE_LIFF_MOCK_LOGGED_IN=true
VITE_LIFF_ENDPOINT_PATH=/liff
VITE_PAYMENT_MODE=demo
```

## LINE setup summary

The full LINE-first experience requires both LINE Login/LIFF and Messaging API:

- LINE Login/LIFF verifies the customer identity and lets the backend link a trusted LINE user ID.
- Messaging API sends queue notifications into the customer's LINE chat.
- Rich Menu opens LIFF routes such as Home, Booking, Current Ticket, and Usage Guide.

Production uses explicitly namespaced configuration:

| Capability    | Server/build variable                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| LINE Login    | `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_LIFF_ID`, public build arg `VITE_LIFF_ID`         |
| Messaging API | `LINE_MESSAGING_CHANNEL_SECRET`, `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`                 |
| Webhook       | Console URL `https://<web-origin>/api/v1/line/webhook`; no additional credential value |

The current LIFF ID-token exchange needs the LINE Login Channel ID, not the LINE Login Channel
Secret. Messaging credentials are backend-only secrets and must never use a `VITE_*` name.

Useful commands:

```bash
npm run line:verify
npm run line:rich-menu:sync
```

The deployed LIFF endpoint is configured as the SPA base path, normally
`https://<web-origin>/liff`. Customer permanent links append endpoint-relative paths, for example
`https://liff.line.me/{LIFF_ID}/qr/:token`; they must not append `/liff` a second time. Complete
real-device verification still includes HTTPS webhook exposure, Official Account follow/push
eligibility, Rich Menu synchronization, notification preferences, and confirmation that Flex
Messages open the correct ticket.

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
npm run openapi:check
npm run e2e:all
```

Run the checks relevant to the change before handoff. Schema work should also include migration status and seed/reset verification when appropriate.

## Documentation

Canonical documents:

1. [Project Context](docs/project/00_PROJECT_CONTEXT.md)
2. [Product Requirements](docs/project/01_PRODUCT_REQUIREMENTS.md)
3. [System Architecture](docs/project/02_SYSTEM_ARCHITECTURE.md)
4. [Domain and Flows](docs/project/03_DOMAIN_AND_FLOWS.md)
5. [Database](docs/project/04_DATABASE.md)
6. [API](docs/project/05_API.md)
7. [Codebase Guide](docs/project/06_CODEBASE_GUIDE.md)
8. [Development and Testing](docs/project/07_DEVELOPMENT_AND_TESTING.md)
9. [Deployment and Operations](docs/project/08_DEPLOYMENT_AND_OPERATIONS.md)
10. [Roadmap and Decisions](docs/project/09_ROADMAP_AND_DECISIONS.md)

Release checklists:

- [Production Readiness](docs/checklists/PRODUCTION_READINESS.md)
- [LINE Real-Device E2E](docs/checklists/LINE_REAL_DEVICE_E2E.md)

Historical files under `docs/archive` are not current product truth.

## License

MIT
