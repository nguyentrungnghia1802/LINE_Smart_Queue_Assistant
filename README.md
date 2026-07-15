# LINE Smart Queue Assistant

LINE Smart Queue Assistant is a multi-tenant queue, reservation, ordering, and customer-notification system for Japanese businesses. Customers enter from a public QR page or LINE LIFF, while staff, managers, and platform administrators use role-specific web dashboards.

The repository is an npm-workspaces monorepo. The application is functional as a local/demo system; real payment processing, durable LINE delivery, location-triggered alerts, and predictive staffing still require production work.

## Main components

| Component         | Location                                | Responsibility                                                              |
| ----------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| Web SPA           | `apps/web`                              | Customer, LIFF, staff, manager, and admin interfaces                        |
| REST API          | `apps/api`                              | Authentication, tenant isolation, queue/order logic, LINE integration, jobs |
| Shared package    | `packages/shared`                       | Shared TypeScript types, enums, constants, and helpers                      |
| PostgreSQL schema | `db/migrations/node-pg-migrate`         | Executable database history and canonical migrations                        |
| Reset schema      | `db/schema/reset_line_queue_schema.sql` | Destructive local/dev schema rebuild                                        |
| Runtime stack     | `docker`, `docker-compose*.yml`         | Development and production-like containers                                  |

## Technology

- Node.js 20+, npm 10+, TypeScript 5
- React 18, React Router 7, Vite 8, Tailwind CSS 4, TanStack Query, Zustand
- Express 4, Zod, PostgreSQL 16, `pg`
- LINE LIFF for customer identity and LINE Messaging API for chat notifications
- Jest/Supertest for API tests and Vitest/Testing Library for web tests

## Quick start

```bash
npm install
cp .env.example .env
npm run docker:dev
```

Development URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Swagger UI (non-production): `http://localhost:4000/api/docs`
- Health: `http://localhost:4000/health`

For native development with a local PostgreSQL instance:

```bash
npm run build -w packages/shared
npm run db:migrate
npm run db:seed
npm run dev
```

The API must be running on port `4000` when the Vite web app proxies `/api`; otherwise Vite reports `ECONNREFUSED`.

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
```

## LINE setup

LINE Login/LIFF and the Messaging API solve different problems and are both required for the full customer experience:

- LINE Login/LIFF identifies the customer and provides a verified LINE user ID.
- The Messaging API sends queue messages into the customer's LINE chat and controls notification sound through LINE's normal notification settings.

Without a linked LINE identity, public QR booking still works, but LINE push notifications cannot be delivered.

After configuring the Messaging API token in the ignored `.env`, verify that it belongs to the intended Official Account:

```bash
npm run line:verify
```

The webhook additionally requires the Messaging API channel secret and a public HTTPS URL. A token alone is sufficient for outbound push calls, but not for validating inbound follow/message events.

See [System Architecture](docs/project/02_SYSTEM_ARCHITECTURE.md) and [Domain and Flows](docs/project/03_DOMAIN_AND_FLOWS.md).

## Documentation

Read the canonical documents in this order:

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

`docs/archive` contains historical artifacts only. It is not a source of truth unless a task explicitly investigates project history.

## Source-of-truth order

When information conflicts, use this precedence:

1. Executable migrations and runtime configuration
2. Current routes, validators, services, repositories, and tests
3. Canonical documents `docs/project/00` through `docs/project/09`
4. Historical artifacts under `docs/archive`

Report and resolve any discrepancy instead of silently choosing an outdated document.

## License

MIT
