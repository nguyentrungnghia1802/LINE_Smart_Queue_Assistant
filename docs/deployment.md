# Deployment Guide

This guide covers local development, Docker Compose deployment, and a basic single-server production setup.

## Prerequisites

- Node.js 20+
- npm 10+
- Docker and Docker Compose
- PostgreSQL 16 if running without Docker

## Environment Configuration

Create a root `.env` file before starting the stack.

Minimum required values for production-like use:

```env
NODE_ENV=production
API_PORT=4000
WEB_PORT=80
DB_NAME=line_queue
DB_USER=postgres
DB_PASSWORD=replace-me
JWT_SECRET=replace-with-strong-secret
LINE_CHANNEL_ACCESS_TOKEN=replace-me
LINE_CHANNEL_SECRET=replace-me
WEB_ORIGIN=http://localhost
```

Notes:

- Use strong unique secrets.
- Do not commit real credentials.
- In production, store secrets in a secret manager when possible.

## Local Development

Install dependencies:

```bash
npm install
```

Run the apps locally:

```bash
npm run dev --workspace=apps/api
npm run dev --workspace=apps/web
```

Or use the development Docker stack:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Docker Compose

Start the production-style stack:

```bash
docker compose up --build -d
```

Validate services:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/ready
curl http://localhost:4000/metrics
```

Stop the stack:

```bash
docker compose down
```

## Production Server

Recommended minimum setup:

- Linux server with Docker Engine
- Reverse proxy or load balancer in front of the web and API services
- TLS termination at the proxy layer
- Firewall rules that restrict database access

Suggested deployment flow:

1. Pull the target branch or release.
2. Update `.env` with production secrets.
3. Build images.
4. Run database migrations.
5. Start the stack.
6. Check health endpoints.
7. Smoke-test auth, queue join, staff operations, and notifications.

Migration command:

```bash
npm run db:migrate --workspace=apps/api
```

## Post-Deployment Checklist

- `/health` returns API, DB, scheduler, and notification status
- `/ready` returns `ready`
- `/metrics` is reachable from monitoring only
- JWT secret is not the default placeholder
- Docker containers are healthy and auto-restarting
- PostgreSQL backups are scheduled

## Rollback

If deployment fails:

1. Stop new traffic.
2. Roll back to the previous image or commit.
3. Restore database from backup if a migration corrupted data.
4. Re-run health checks before reopening traffic.
