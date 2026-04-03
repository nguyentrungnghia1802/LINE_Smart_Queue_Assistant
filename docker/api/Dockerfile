# ── Stage 1: install all workspace dependencies ────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
COPY packages/config/package*.json   ./packages/config/
COPY packages/shared/package*.json   ./packages/shared/
COPY apps/api/package*.json          ./apps/api/

RUN npm ci --workspace=packages/config \
           --workspace=packages/shared \
           --workspace=apps/api

# ── Stage 2: compile TypeScript ────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/packages/config       ./packages/config
COPY --from=deps /app/packages/shared       ./packages/shared
COPY --from=deps /app/apps/api              ./apps/api

COPY packages/config/  ./packages/config/
COPY packages/shared/  ./packages/shared/
COPY apps/api/         ./apps/api/

RUN npm run build -w packages/shared && \
    npm run build -w apps/api

# ── Stage 3: production runner (minimal image) ─────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 appgroup && \
    adduser  --system --uid 1001 --ingroup appgroup appuser

COPY --from=builder --chown=appuser:appgroup /app/apps/api/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/apps/api/package.json ./package.json
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

USER appuser
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]
