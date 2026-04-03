# ═══════════════════════════════════════════════════════════════════════════════
# apps/api — Multi-stage Dockerfile
#
# Stages:
#   base       — install all deps (shared by dev + builder)
#   dev        — hot-reload dev server (ts-node-dev)       ← docker-compose.dev.yml
#   prod-deps  — install production-only deps
#   builder    — compile TypeScript
#   runner     — minimal production image                  ← docker-compose.yml
# ═══════════════════════════════════════════════════════════════════════════════

# ── base: install all workspace dependencies ───────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app

# Copy manifests only — maximises layer cache (re-install only when lockfile changes)
COPY package*.json                     ./
COPY packages/config/package*.json     ./packages/config/
COPY packages/shared/package*.json     ./packages/shared/
COPY apps/api/package*.json            ./apps/api/

RUN npm ci

# ── dev: hot-reload development target ────────────────────────────────────────
# Source is mounted via docker compose volumes — NOT copied here.
# Enables ts-node-dev live-reload without rebuilding the image.
FROM base AS dev
ENV NODE_ENV=development
EXPOSE 4000
EXPOSE 9229
CMD ["npm", "run", "dev", "--workspace=apps/api"]

# ── prod-deps: production-only dependencies ────────────────────────────────────
# Separate stage so runner image never contains devDependencies.
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json                     ./
COPY packages/config/package*.json     ./packages/config/
COPY packages/shared/package*.json     ./packages/shared/
COPY apps/api/package*.json            ./apps/api/
RUN npm ci --omit=dev

# ── builder: compile TypeScript ────────────────────────────────────────────────
FROM base AS builder
COPY packages/config/   ./packages/config/
COPY packages/shared/   ./packages/shared/
COPY apps/api/          ./apps/api/
RUN npm run build --workspace=packages/shared && \
    npm run build --workspace=apps/api

# ── runner: minimal production image ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Non-root user (OWASP A05: Security Misconfiguration)
RUN addgroup --system --gid 1001 appgroup && \
    adduser  --system --uid 1001 --ingroup appgroup appuser

# Production node_modules (no devDependencies)
COPY --from=prod-deps --chown=appuser:appgroup /app/node_modules               ./node_modules
# Root package.json required for npm workspace symlink resolution
COPY --from=builder   --chown=appuser:appgroup /app/package.json               ./package.json
# Compiled shared package (workspace symlink at node_modules/@line-queue/shared → /app/packages/shared)
COPY --from=builder   --chown=appuser:appgroup /app/packages/shared/dist       ./packages/shared/dist
COPY --from=builder   --chown=appuser:appgroup /app/packages/shared/package.json ./packages/shared/package.json
# Compiled API
COPY --from=builder   --chown=appuser:appgroup /app/apps/api/dist              ./apps/api/dist
COPY --from=builder   --chown=appuser:appgroup /app/apps/api/package.json      ./apps/api/package.json

USER appuser
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "apps/api/dist/server.js"]

