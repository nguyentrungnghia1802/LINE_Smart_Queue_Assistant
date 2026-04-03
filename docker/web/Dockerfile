# ── Stage 1: install & build ───────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/config/package*.json   ./packages/config/
COPY packages/shared/package*.json   ./packages/shared/
COPY apps/web/package*.json          ./apps/web/

RUN npm ci --workspace=packages/config \
           --workspace=packages/shared \
           --workspace=apps/web

COPY packages/config/  ./packages/config/
COPY packages/shared/  ./packages/shared/
COPY apps/web/         ./apps/web/

RUN npm run build -w packages/shared && \
    npm run build -w apps/web

# ── Stage 2: serve with nginx ──────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# SPA fallback: route all requests to index.html
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
  location /health {\n\
    return 200 "ok";\n\
    add_header Content-Type text/plain;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
