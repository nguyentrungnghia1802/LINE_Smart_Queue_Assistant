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

## Quick Start

> See the full guides below for [with Docker](#running-locally--with-docker) and [without Docker](#running-locally--without-docker).

```bash
# 1 — clone & install
git clone https://github.com/nguyentrungnghia1802/LINE_Smart_Queue-_Assistant.git
cd LINE_Smart_Queue-_Assistant
nvm use          # switch to Node 20
npm install

# 2 — configure environment
cp .env.example .env
# Edit .env — at minimum set: DB_PASSWORD, JWT_SECRET, LINE credentials

# Option A — Docker (recommended, zero local PostgreSQL setup)
npm run docker:dev          # starts postgres + api + web with hot-reload

# Option B — native Node.js (requires local PostgreSQL)
psql -U postgres -c "CREATE DATABASE line_queue;"
npm run build -w packages/shared
npm run dev
# API  → http://localhost:4000
# Web  → http://localhost:5173
```

---

## Running Locally — with Docker

> **Prerequisite:** Docker Desktop running, `.env` created from `.env.example`.

### Development stack (hot-reload + debugger)

```bash
cp .env.example .env        # fill in values (DB_PASSWORD required)
npm run docker:dev          # build images and start in foreground
# or in detached mode:
npm run docker:dev:d
```

Services:

| Service  | Port  | Notes                                     |
|----------|-------|-------------------------------------------|
| Web      | 5173  | Vite HMR — changes reflect instantly      |
| API      | 4000  | ts-node-dev restarts on file changes       |
| Debugger | 9229  | Node.js inspector (attach VS Code/Chrome) |
| Postgres | 5432  | Dev DB (`line_queue_dev`)                 |

Source directories are mounted as volumes — **no image rebuild needed** when you edit code.

To attach the VS Code debugger to the running API container, add this to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to Docker API",
  "port": 9229,
  "remoteRoot": "/app",
  "localRoot": "${workspaceFolder}"
}
```

Useful commands:

```bash
npm run docker:dev:logs     # tail all service logs
npm run docker:dev:ps       # show container status
npm run docker:dev:down     # stop and remove containers
npm run docker:clean        # stop + remove containers AND volumes (wipe dev DB)
```

### Production stack

```bash
# DB_PASSWORD must be set — compose will refuse to start without it
DB_PASSWORD=supersecret docker compose up --build
# or set it in .env and run:
npm run docker:prod
npm run docker:prod:d       # detached
npm run docker:prod:down    # stop
```

Services:

| Service  | Port | Notes                              |
|----------|------|------------------------------------|
| Web      | 80   | nginx serving the Vite production build |
| API      | 4000 | Node.js (compiled JS, non-root user) |
| Postgres | 5432 | Named volume `postgres_data`        |

---

## Running Locally — without Docker

Use this path when you want faster iteration without container overhead.

### 1 — Prerequisites

- Node.js ≥ 20 (`nvm use`)
- PostgreSQL 16 running locally (or via `brew install postgresql` / `choco install postgresql`)

### 2 — Install & configure

```bash
npm install
cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgresql://postgres:<your-pg-password>@localhost:5432/line_queue
#   JWT_SECRET=<random 64-byte hex>
#   LINE_CHANNEL_ACCESS_TOKEN=...
#   LINE_CHANNEL_SECRET=...
```

### 3 — Create the database

```bash
psql -U postgres -c "CREATE DATABASE line_queue;"
```

### 4 — Build shared packages, then start both apps

```bash
# Build shared package first (api and web both depend on it)
npm run build -w packages/shared

# Start API and Web in parallel (hot-reload enabled for both)
npm run dev
```

Or start each app individually:

```bash
npm run dev -w apps/api     # http://localhost:4000
npm run dev -w apps/web     # http://localhost:5173
```

### 5 — Verify

```bash
curl http://localhost:4000/health    # → { "status": "ok" }
# Open http://localhost:5173 in a browser
```

---

## Available npm Scripts

| Script                   | Description                                              |
|--------------------------|----------------------------------------------------------|
| `npm run dev`            | Start all apps in watch/hot-reload mode                  |
| `npm run build`          | Build all packages and apps                              |
| `npm run test`           | Run all test suites                                      |
| `npm run lint`           | Lint all workspaces                                      |
| `npm run lint:fix`       | Auto-fix lint issues                                     |
| `npm run format`         | Prettier-format everything                               |
| `npm run format:check`   | Check formatting (CI-friendly)                           |
| `npm run typecheck`      | TypeScript type-check all workspaces                     |
| `npm run spell:check`    | cspell spell check on all TS/MD files                    |
| `npm run clean`          | Remove all `dist/` and `*.tsbuildinfo` artifacts         |
| `npm run docker:dev`     | Build + start dev stack (foreground)                     |
| `npm run docker:dev:d`   | Build + start dev stack (detached)                       |
| `npm run docker:dev:down`| Stop dev stack                                           |
| `npm run docker:dev:logs`| Tail dev stack logs                                      |
| `npm run docker:dev:ps`  | Show dev container status                                |
| `npm run docker:prod`    | Build + start prod stack (foreground)                    |
| `npm run docker:prod:d`  | Build + start prod stack (detached)                      |
| `npm run docker:prod:down`| Stop prod stack                                         |
| `npm run docker:clean`   | Stop dev stack + wipe volumes (destroys dev DB data)     |

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

Copy `.env.example` → `.env`. The file is split into sections with inline comments explaining each variable.

### Naming conventions

| Prefix    | Scope                           | Example                       |
|-----------|---------------------------------|-------------------------------|
| `DB_*`    | PostgreSQL connection            | `DB_PASSWORD`, `DB_NAME`      |
| `API_*`   | Express server config            | `API_PORT`, `API_HOST`        |
| `JWT_*`   | Auth tokens (⚠️ backend-only)   | `JWT_SECRET`, `JWT_EXPIRES_IN`|
| `LINE_*`  | LINE platform keys (⚠️ backend-only) | `LINE_CHANNEL_SECRET`    |
| `VITE_*`  | Frontend vars (**browser-visible**) | `VITE_API_URL`, `VITE_LIFF_ID` |
| `WEB_*`   | Web container / nginx config     | `WEB_PORT`, `WEB_ORIGIN`      |

### Backend-only variables (never expose to the browser)

| Variable                      | Description                                         |
|-------------------------------|-----------------------------------------------------|
| `DATABASE_URL`                | Full PostgreSQL connection string                   |
| `DB_HOST / DB_PORT / DB_NAME` | Individual DB connection parts (used by Compose)    |
| `DB_USER / DB_PASSWORD`       | PostgreSQL credentials                              |
| `JWT_SECRET`                  | Long random secret for JWT signing                  |
| `JWT_EXPIRES_IN`              | Access token lifetime (e.g. `7d`)                   |
| `JWT_REFRESH_EXPIRES_IN`      | Refresh token lifetime (e.g. `30d`)                 |
| `LINE_CHANNEL_ACCESS_TOKEN`   | LINE Messaging API channel token                    |
| `LINE_CHANNEL_SECRET`         | LINE webhook signature verification key             |

### Frontend variables (inlined into the JS bundle at build time)

> ⚠️ `VITE_*` variables are **embedded into the browser bundle** by Vite. Treat them as public. Never put credentials here.

| Variable         | Description                                          |
|------------------|------------------------------------------------------|
| `VITE_API_URL`   | API base URL as seen by the browser                  |
| `VITE_APP_NAME`  | Application display name                             |
| `VITE_LIFF_ID`   | LINE LIFF App ID (public identifier, safe to expose) |

> **Security**: Never commit `.env`. It is listed in `.gitignore`.

---

## Contributing

1. Create a feature branch from `main`
2. Run `npm run lint && npm run typecheck && npm run test` before opening a PR
3. Ensure `npm run format:check` passes (CI enforced)

---

## License

MIT

