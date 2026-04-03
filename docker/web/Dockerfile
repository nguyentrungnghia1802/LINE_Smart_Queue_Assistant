# ═══════════════════════════════════════════════════════════════════════════════
# apps/web — Multi-stage Dockerfile
#
# Stages:
#   base     — install all deps
#   dev      — Vite dev server with HMR                   ← docker-compose.dev.yml
#   builder  — Vite production build
#   runner   — nginx:alpine serve static assets           ← docker-compose.yml
#
# ⚠️  VITE_* variables are inlined at BUILD TIME by Vite (not runtime).
#     Pass them as --build-arg in CI or via compose build.args.
# ═══════════════════════════════════════════════════════════════════════════════

# ── base: install all workspace dependencies ───────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json                     ./
COPY packages/config/package*.json     ./packages/config/
COPY packages/shared/package*.json     ./packages/shared/
COPY apps/web/package*.json            ./apps/web/

RUN npm ci

# ── dev: Vite HMR dev server ──────────────────────────────────────────────────
# Source is mounted via docker compose volumes — NOT copied here.
FROM base AS dev
ENV NODE_ENV=development
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace=apps/web", "--", "--host", "0.0.0.0"]

# ── builder: Vite production build ─────────────────────────────────────────────
FROM base AS builder

# VITE_* vars must be available at build time — they are bundled into the JS output
ARG VITE_API_URL
ARG VITE_APP_NAME
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

COPY packages/config/   ./packages/config/
COPY packages/shared/   ./packages/shared/
COPY apps/web/          ./apps/web/

RUN npm run build --workspace=packages/shared && \
    npm run build --workspace=apps/web

# ── runner: nginx serve static assets ─────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/web/dist      /usr/share/nginx/html
COPY docker/nginx/default.conf              /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

