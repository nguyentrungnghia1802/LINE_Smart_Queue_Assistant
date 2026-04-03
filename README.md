# LINE Smart Queue Assistant

A production-ready, monorepo-based queue management system integrated with the LINE Messaging API. Customers join queues via LINE LIFF / chatbot; staff manage queues through a web dashboard.

---

## Architecture

```
line-smart-queue/                      ← monorepo root (npm workspaces)
│
├── apps/
│   ├── api/                           ← Express REST API (Node.js + TypeScript)
│   │   └── src/
│   │       ├── config/                ← env/config loader
│   │       ├── controllers/           ← HTTP request handlers
│   │       ├── middleware/            ← auth, validation, rate-limit…
│   │       ├── models/                ← DB query layer (pg)
│   │       ├── routes/                ← Express router registration
│   │       ├── services/              ← business logic (no Express imports)
│   │       ├── types/                 ← API-local TS types
│   │       ├── utils/                 ← pure helpers
│   │       ├── app.ts                 ← Express app factory
│   │       └── server.ts              ← process entry point
│   │
│   └── web/                           ← React + Vite SPA (TypeScript)
│       └── src/
│           ├── assets/                ← images, SVGs, fonts
│           ├── components/            ← reusable UI components
│           ├── hooks/                 ← custom React hooks
│           ├── pages/                 ← route-level views
│           ├── services/              ← API client functions
│           ├── store/                 ← global state management
│           ├── types/                 ← frontend-only types
│           ├── utils/                 ← pure helpers
│           ├── test/setup.ts          ← Vitest global setup
│           ├── App.tsx                ← root component
│           └── main.tsx               ← React DOM entry
│
├── packages/
│   ├── shared/                        ← types, constants, utils shared by api + web
│   │   └── src/
│   │       ├── types/                 ← domain entities, API response shapes
│   │       ├── constants/             ← HTTP codes, error codes, limits
│   │       └── utils/                 ← pure utility functions
│   │
│   └── config/                        ← shared tooling config (never imported at runtime)
│       ├── eslint/                    ← base + react ESLint presets
│       ├── prettier/                  ← shared Prettier config
│       └── typescript/                ← base / node / react tsconfig presets
│
├── docker/
│   ├── api/Dockerfile                 ← multi-stage build (deps → builder → runner)
│   └── web/Dockerfile                 ← Vite build → nginx:alpine
│
├── docker-compose.yml                 ← production stack (postgres + api + web)
├── docker-compose.dev.yml             ← development overrides (hot-reload, debugger)
├── .env.example                       ← template — copy to .env and fill secrets
└── README.md
```

---

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Frontend   | React 18 · Vite 5 · TypeScript 5              |
| Backend    | Express 4 · Node.js 20 · TypeScript 5         |
| Database   | PostgreSQL 16                                 |
| Shared     | `@line-queue/shared` npm workspace package    |
| Testing    | Vitest (web) · Jest / ts-jest (api)           |
| Containers | Docker · Docker Compose                       |
| Linting    | ESLint 8 · Prettier 3                         |

---

## Prerequisites

- **Node.js** ≥ 20 (use `nvm use` — see [.nvmrc](.nvmrc))
- **npm** ≥ 10
- **Docker** + **Docker Compose** (for containerised dev/prod)
- A PostgreSQL 16 instance (or use the provided Compose stack)

---

## Quick Start (local)

```bash
# 1 — clone & install all workspace dependencies
git clone https://github.com/nguyentrungnghia1802/LINE_Smart_Queue-_Assistant.git
cd LINE_Smart_Queue-_Assistant
nvm use          # switch to Node 20
npm install

# 2 — configure environment
cp .env.example .env
# Edit .env: set DB credentials, JWT_SECRET, LINE keys…

# 3 — build shared packages first
npm run build -w packages/config -w packages/shared

# 4 — start all apps in dev mode (hot-reload)
npm run dev
# API  → http://localhost:4000
# Web  → http://localhost:5173
```

### Start only one app

```bash
npm run dev -w apps/api
npm run dev -w apps/web
```

---

## Docker

```bash
# Production stack (builds both images)
docker compose up --build

# Development stack (mounts source, enables hot-reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Services exposed:

| Service  | Port |
|----------|------|
| Web      | 80   |
| API      | 4000 |
| Postgres | 5432 |

---

## Available npm Scripts

| Script            | Description                                              |
|-------------------|----------------------------------------------------------|
| `npm run dev`     | Start all apps in watch/hot-reload mode                  |
| `npm run build`   | Build all packages and apps                              |
| `npm run test`    | Run all test suites                                      |
| `npm run lint`    | Lint all workspaces                                      |
| `npm run lint:fix`| Auto-fix lint issues                                     |
| `npm run format`  | Prettier-format everything                               |
| `npm run format:check` | Check formatting (CI-friendly)                    |
| `npm run typecheck` | TypeScript type-check all workspaces                  |
| `npm run clean`   | Remove all `dist/` and `*.tsbuildinfo` artifacts         |

Pass `-w <workspace>` to scope to a single package, e.g. `npm run test -w apps/api`.

---

## Testing

```bash
# All tests
npm run test

# With coverage
npm run test:coverage

# API — Jest TDD watch mode
npm run test:watch -w apps/api

# Web — Vitest interactive UI
npm run test:ui -w apps/web
```

---

## Environment Variables

Copy `.env.example` → `.env`. Key variables:

| Variable                    | Description                              |
|-----------------------------|------------------------------------------|
| `DATABASE_URL`              | Full PostgreSQL connection string        |
| `JWT_SECRET`                | Long random secret for JWT signing       |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API channel token         |
| `LINE_CHANNEL_SECRET`       | LINE webhook signature verification      |
| `VITE_API_URL`              | API base URL as seen by the browser      |

> **Security**: Never commit `.env`. It is listed in `.gitignore`.

---

## Contributing

1. Create a feature branch from `main`
2. Run `npm run lint && npm run typecheck && npm run test` before opening a PR
3. Ensure `npm run format:check` passes (CI enforced)

---

## License

MIT

