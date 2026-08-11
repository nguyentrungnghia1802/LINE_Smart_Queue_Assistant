# Deployment and Operations

Use [`10_IMPLEMENTATION_MAP.md`](10_IMPLEMENTATION_MAP.md) to trace a deployment-sensitive change
from source module to environment variable, migration, worker, and validation command. This
document remains the canonical deployment and incident-response guide.

## 1. Environment model

| Environment | Purpose                    | Data/integration policy                                         |
| ----------- | -------------------------- | --------------------------------------------------------------- |
| Local       | Development and demos      | Mock LIFF/payment allowed; disposable database                  |
| Test/CI     | Automated verification     | Isolated database/mocks; no real credentials                    |
| Staging     | Production-like acceptance | Separate LINE/provider sandbox and sanitized data               |
| Production  | Real business operation    | Managed secrets, backups, HTTPS, monitoring, verified providers |

Never share database volumes, LINE channels, provider keys, or JWT secrets across staging and production.

## 2. Configuration and secrets

Copy `.env.example` only as a template. Production secrets must come from the deployment platform's secret manager, not a checked-in `.env`.

Backend-only secrets:

- `DATABASE_URL` or database credentials
- `JWT_SECRET`
- `LINE_MESSAGING_CHANNEL_SECRET`
- `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`
- `LINE_RICH_MENU_IMAGE_PATH` or an equivalent deployment-mounted Rich Menu PNG/JPEG asset path
- `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` only when the optional `s3` media provider is enabled
- payOS merchant keys, future PSP secrets, and the current demo payment webhook secret
- `GOOGLE_ROUTES_API_KEY` for server-side branch geocoding and walking-route estimates

Role-aware session settings are non-secret runtime values:

- `JWT_ACCESS_EXPIRES_IN=15m`
- `AUTH_BUSINESS_IDLE_TIMEOUT_MINUTES=15`
- `AUTH_BUSINESS_ABSOLUTE_TIMEOUT_HOURS=12`
- `AUTH_CUSTOMER_SESSION_DAYS=30`
- `AUTH_SESSION_CLEANUP_INTERVAL_MS=3600000`
- `AUTH_REVOKED_SESSION_RETENTION_DAYS=7`

Deploy the complete ordered migration history through `000028` before serving the updated API.
Migrations `000021` through `000028` are additive/normalization changes that preserve business
data when applied through the forward migration command; they do not require seed/reset. Access
tokens issued by older releases have no session-family claim and are intentionally rejected; users
sign in once after rollout. The same-origin production proxy
is required so the path-scoped refresh cookie reaches `/api/v1/auth/*`. Keep CORS credentials
enabled only for the configured web origin.

LINE production configuration is intentionally separated by channel:

| LINE Console source                                        | Variable                                   | Secret              | Where to provide it                    |
| ---------------------------------------------------------- | ------------------------------------------ | ------------------- | -------------------------------------- |
| LINE Login channel, Basic settings, Channel ID             | `LINE_LOGIN_CHANNEL_ID`                    | No                  | Server `deploy/.env`                   |
| LINE Login channel, LIFF app, LIFF ID                      | `LINE_LOGIN_LIFF_ID`                       | No                  | Server `deploy/.env`                   |
| Same LIFF app ID                                           | `VITE_LIFF_ID`                             | No, browser-visible | Web image build argument               |
| Messaging API channel, Basic settings, Channel secret      | `LINE_MESSAGING_CHANNEL_SECRET`            | Yes                 | Server `deploy/.env` or secret manager |
| Messaging API channel, Messaging API, Channel access token | `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`      | Yes                 | Server `deploy/.env` or secret manager |
| Messaging API channel, Webhook settings                    | `https://<web-origin>/api/v1/line/webhook` | No                  | LINE Developers Console                |

`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` authorizes outbound push/reply and Rich Menu operations.
`LINE_MESSAGING_CHANNEL_SECRET` verifies inbound webhook signatures; both must come from the same
Messaging API channel. `LINE_LOGIN_CHANNEL_ID` verifies LIFF ID tokens.
`LINE_LOGIN_LIFF_ID` lets the backend generate LINE deeplinks.

The current ID-token verification request does not use the LINE Login Channel Secret. Developer
`Your user ID`, Assertion Signing Key, and its public/private keys are also not runtime
configuration for the current long-lived Messaging API token flow.

The runtime temporarily accepts legacy `LINE_CHANNEL_ID`, `LINE_LIFF_ID`, `LINE_CHANNEL_SECRET`,
and `LINE_CHANNEL_ACCESS_TOKEN` names for migration. New deployments must use the namespaced
variables above; a new value takes precedence over its legacy alias.

For native local API development and the root Compose stack, copy `.env.example` to the repository
root as `.env`. For the production image-based stack, place runtime values in the untracked
`deploy/.env` file and invoke Compose with `--env-file deploy/.env`. The public `VITE_LIFF_ID` is
different: provide it as a web-image build argument (and optionally in `apps/web/.env.local` for a
native local Vite process). Never place the Messaging API secret or access token in a `VITE_*`
variable.

The root `.env.example` is the superset for native development and image builds.
`deploy/.env.example` intentionally contains only production API/runtime and Compose interpolation
values. It omits all `VITE_*` values because an already-built web image cannot read or change them
from the server `.env`; rebuild the web image when public frontend configuration changes. Runtime
variables shared by the production API must remain synchronized between both examples.

Redis runtime configuration is backend-only. Set `REDIS_URL=redis://redis:6379` for the bundled
Compose service, plus bounded connect/command timeouts and a deployment-specific key prefix when
multiple environments share one managed Redis. Do not expose Redis port `6379` publicly and do not
place Redis credentials in frontend build arguments.

SSE runtime limits are backend-only: `SSE_KEEP_ALIVE_MS`, `SSE_RETRY_MS`,
`SSE_MAX_CONNECTION_DURATION_MS`, `SSE_MAX_CONNECTIONS`, and
`SSE_MAX_CONNECTIONS_PER_USER`. Defaults are documented in `.env.example`; keep the maximum
connection duration below the outer proxy timeout and size connection limits from measured file
descriptor/memory capacity rather than increasing them blindly.

The web client needs no additional realtime environment variable. It opens authenticated
same-origin `/api/v1/realtime/*` fetch streams through the existing `VITE_API_URL` boundary, shares
connections per endpoint, and falls back to REST polling. Browser visibility/offline events pause
streams; route cleanup, logout, and terminal session expiry abort private connections. A sustained
increase in fallback REST traffic is therefore a useful signal of proxy, Redis Pub/Sub, or SSE
availability problems even when the customer and Staff workflows remain functional.

Set `LINE_NOTIFICATION_DELIVERY_OWNER=bullmq` when the dedicated worker service is deployed. The
API then stops scheduling LINE delivery while the worker maintains the versioned BullMQ dispatcher
scheduler and per-notification jobs. `api` remains available if Redis or the worker is unavailable because queue/order
transactions commit their notification intent to the PostgreSQL outbox only. Use `api` ownership
only for native development without a worker, never concurrently with the BullMQ owner.

`REDIS_PUBLIC_BRANCH_CACHE_TTL_MS` defaults to `5000`, and
`REDIS_PUBLIC_QUEUE_CACHE_TTL_MS` defaults to `3000`. These entries are performance-only and may be
deleted at any time. Keep TTLs short unless staging measurements justify a change; a longer value
increases how long public queue counts, ETA, catalog, or opening-state displays may remain stale.

Browser-visible configuration:

- `VITE_API_URL`
- `VITE_APP_NAME`
- `VITE_LIFF_ID`
- `VITE_LIFF_ENDPOINT_PATH`
- `VITE_LIFF_DEFAULT_BOOKING_PATH`
- payment mode/redirect base URL and webhook timing limits (identifiers/URLs only, never keys)

### Payment runtime

The current deployment is intentionally a production-oriented demo. Keep API
`PAYMENT_MODE=demo` and Web `VITE_PAYMENT_MODE=demo`. This activates `DemoPaymentProvider`, moves
no real money, requires no `PAYOS_*` value, and makes no payOS request. `/health` reports
`paymentService.mode=demo`, `activeProvider=demo`, and `realPspConfigured=false` without degrading
overall health.

Do not place placeholder merchant credentials in deployment files. External activation is a
separate release decision after merchant onboarding and legal/commercial acceptance. It requires
`PAYMENT_MODE=external`, all three backend-only `PAYOS_*` values, an aligned external Web build,
provider webhook configuration, and sandbox/production acceptance. The API fails startup if the
external credential set is incomplete. Browser return state never marks a transaction paid or
refunded.

For production web builds, keep `VITE_API_URL` empty, set `VITE_LIFF_ENDPOINT_PATH=/liff`, provide
a real `VITE_LIFF_ID`, and keep `VITE_LIFF_DEFAULT_BOOKING_PATH` empty for multi-organization
deployments. Frontend request
paths already start with `/api/v1`; nginx proxies `/api/*` to the internal `api:4000` service and
preserves that prefix. Setting `VITE_API_URL=/api` would incorrectly produce
`/api/api/v1/...`. Every `VITE_*` value is compiled into the browser bundle at build time and
must be treated as public configuration, not as a secret.

Rotate any credential that has appeared in Git history, logs, screenshots, tickets, or examples.

### payOS and Google Maps

To enable real VND checkout after external acceptance, set `PAYMENT_MODE=external`, configure
`PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, and `PAYOS_CHECKSUM_KEY`, and configure the payOS webhook as
`https://<web-origin>/api/v1/payments/webhooks/payos`. Branch payment settings must use provider
`payos` and currency `VND`. These values are backend secrets and must never be exposed through
`VITE_*`. A browser return does not mark a transaction paid; verify a real sandbox/merchant payment
and webhook before enabling the workflow for customers. Provider-side automatic refund execution
is still pending.

To enable map search and travel warnings, set `LOCATION_TRAVEL_PROVIDER=google_routes`, provide a
restricted backend `GOOGLE_ROUTES_API_KEY`, and enable the Google Geocoding API and Routes API for
the project. Restrict the key to the API server and required APIs. The worker requests walking
alternatives, uses the longest returned duration, adds
`LOCATION_TRAVEL_BUFFER_MINUTES` (default 8), and enqueues a LINE warning only when that total
exceeds the current ETA. Location capture remains consent-based and stops when the customer has no
active ticket. Monitor provider quota/cost and complete privacy/legal acceptance before production.
`LOCATION_ALERT_CLAIM_TIMEOUT_SECONDS` defaults to 900 seconds and must exceed the worst expected
sequential processing time for one configured alert batch. An expired claim is recoverable; the
claim timestamp prevents a stale worker from finalizing a newer attempt. Provider requests do not
run inside a database transaction.

The current forecast/staffing implementation does not require `OPENAI_API_KEY`,
`GEMINI_API_KEY`, or another model-provider secret. It is a measured PostgreSQL heuristic. Do not
add an AI key to either env file until a backend-only provider adapter, cost controls, privacy
review, and a concrete product flow are approved. Google Routes, LINE Messaging push volume, SMTP,
and payment-provider settlement may incur external charges according to the selected provider plan;
these should be monitored independently of application hosting.

### LINE webhook verification troubleshooting

The production webhook URL is
`https://<web-origin>/api/v1/line/webhook`. A LINE Console verification request with a valid
signature and an empty `events` array returns `200`. The API logs one of these safe diagnostic
events without logging the signature, body, or secret:

- `line.webhook.verification_acknowledged`: signature passed and the verification request returned
  `200`;
- `line.webhook.signature_invalid`: the configured secret does not match the Messaging API channel
  that signed the request;
- `line.webhook.signature_missing`: the request did not contain `x-line-signature`;
- `line.webhook.secret_missing`: no Messaging API Channel Secret is configured.

Inspect the running container with `docker compose logs --tail=100 api`. If the diagnostic
`secretSource` is `LINE_CHANNEL_SECRET (legacy)`, migrate `deploy/.env` to
`LINE_MESSAGING_CHANNEL_SECRET` and copy the Channel Secret from the **Messaging API channel**
Basic settings, never from the LINE Login channel. Recreate the API container after changing an
environment variable.

## 3. Docker deployment

Production-like Compose:

```bash
npm run docker:prod:d
docker compose --env-file deploy/.env -f deploy/docker-compose.yml ps
```

The stack builds:

- PostgreSQL 16 with persistent `postgres_data`;
- Redis 7.4 with AOF-backed `redis_data`, private to the Compose network;
- API TypeScript build/Node runner reachable inside the Compose network as `api:4000`;
- a dedicated worker from the same API image, with no published port, for BullMQ-owned LINE delivery;
- Vite static bundle served by nginx on `WEB_PORT`, including same-origin `/api/*` proxying to the API service.
- VPS-local media in the persistent `media_data` named volume mounted only into the API at
  `/app/var/media`; it survives API container recreation and normal image-based redeployment.

Image-based production Compose:

```bash
cp deploy/.env.example deploy/.env
docker compose --env-file deploy/.env -f deploy/docker-compose.yml pull
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d
docker compose --env-file deploy/.env -f deploy/docker-compose.yml ps
```

The project-specific Docker build, tag, push, inspection, local Compose, health-check, and cleanup
commands are collected in
[`docs/archive/scripts/DOCKER_COMMANDS.md`](../archive/scripts/DOCKER_COMMANDS.md). The current
Docker Hub repositories are `trungnghia2703/line-smart-queue-api` and
`trungnghia2703/line-smart-queue-web`; production deployments should prefer an immutable
`git-<commit>` tag while optionally updating `latest`.

`deploy/docker-compose.yml` is the canonical production Compose file. It requires prebuilt
`LINE_QUEUE_API_IMAGE` and `LINE_QUEUE_WEB_IMAGE` values (there is no silent `latest` fallback) and
does not publish PostgreSQL or API port `4000` to the host. Always replace the template tags with
immutable images built from the intended release commit; changing source code does not update an
already-pushed tag automatically.

Use `--env-file deploy/.env` when invoking the file from the repository root. Without it, Compose interpolation may read a different `.env` from the current working directory even though the API container's `env_file` is resolved from the deploy directory.

The web image must be built ahead of time with a real public `VITE_LIFF_ID`. The Dockerfile
provides production-safe defaults for the other public values: empty `VITE_API_URL` for
same-origin routing, `VITE_LIFF_ENDPOINT_PATH=/liff`, empty
`VITE_LIFF_DEFAULT_BOOKING_PATH`, `VITE_LIFF_MOCK=false`, `VITE_PAYMENT_MODE=demo`, and an empty
`VITE_PAYMENT_REDIRECT_BASE_URL`. Therefore the normal production build command only needs to
override `VITE_LIFF_ID`. `VITE_LIFF_ID` must equal the runtime API's
`LINE_LOGIN_LIFF_ID`; it is
compiled into the image and cannot be supplied later through production Compose. In LINE
Developers Console, set the LIFF endpoint to the deployed HTTPS base path such as
`https://<web-origin>/liff`. Permanent links then append endpoint-relative paths such as
`/qr/:token`; do not include another `/liff`, which would resolve to `/liff/liff/...`. Backend-only
secrets such as `JWT_SECRET`, database credentials, LINE channel secret/access token, and provider
webhook keys are runtime API secrets only.

The API runner image copies both root and `apps/api` production `node_modules`. npm workspaces may
retain compatible packages in the workspace directory instead of hoisting them; omitting that
directory can pass compilation but fail container startup with `MODULE_NOT_FOUND`.

The canonical production origin is `https://smartqueue.io.vn`. Set
`WEB_ORIGIN=https://smartqueue.io.vn` in the server-side deployment environment, configure the host
TLS reverse proxy for `smartqueue.io.vn`, and set the LINE Login LIFF Endpoint URL to
`https://smartqueue.io.vn/liff`. Public fallback QR links are then generated under
`https://smartqueue.io.vn/qr/:publicQrToken`; LIFF-first QR links continue to use the LINE universal
link and resolve through the configured LIFF endpoint. Retire redirects and certificates for any
former production domain only after QR, login callback, webhook, media, and email-link smoke tests
pass on the new origin.

Configure the LIFF app view size as `Full`, link the Messaging API Official Account to the LINE
Login channel, include the `profile` scope, and keep the Add Friend option on. `On (normal)` remains
valid but optional on the consent screen, so customers may skip it. The LIFF shell therefore checks
`liff.getFriendship()` and offers the native `liff.requestFriendship()` Add/Unblock flow when needed;
the application cannot silently add an Official Account without customer consent.

Enable **Scan QR** on the LIFF app in the LINE Login channel. LIFF Home calls
`liff.scanCodeV2()` first; LINE requires the `Full` view size for the in-app scanner on supported
mobile devices. The browser-camera scanner remains a local/external fallback, but it does not
replace the Console setting required by the native LINE reader.

The production web build also runs a CSP bundle gate. The project uses a minimal LIFF adapter and a
reviewed CSP-safe replacement for the SDK sub-window iframe bootstrap; do not work around a failed
gate by adding `unsafe-eval` to host nginx. Review the LIFF SDK change and update the compatibility
transform instead.

Keeping `/liff` in the LINE Developers Console endpoint is intentional. Do not shorten the endpoint
to the web origin unless both `VITE_LIFF_ENDPOINT_PATH` and `LINE_LIFF_ENDPOINT_PATH` are explicitly
changed to `/` and the permanent-link tests are rerun. The recommended production configuration is
the `/liff` endpoint because it isolates the LIFF application surface from business-role routes and
keeps callback/deeplink behavior deterministic.

`VITE_LIFF_DEFAULT_BOOKING_PATH` is only an optional single-store demo convenience. It must not
contain a demo organization token in a shared production image. Manager QR links are generated
per organization as `/liff/qr/:publicQrToken`; a generic LIFF Home without organization context
asks the customer to scan the intended store QR instead of selecting a tenant implicitly.

Production ingress currently has two proxy hops before the API: the host nginx terminates HTTPS
and forwards to the web nginx container, then the web nginx container proxies `/api/*` to
`api:4000`. The API intentionally uses Express `trust proxy = 2` for this topology so `req.ip`
matches the forwarded client IP used by rate limiters. Rate limiters trust only that resolved
`req.ip`; they do not parse the raw left-most `X-Forwarded-For` value. If ingress topology changes,
update the trust value and smoke test login/rate limiting, including a spoofed forwarded-header
case, before rollout.

The web-container nginx has a dedicated `^~ /api/v1/realtime/` location that preserves the full
path, uses HTTP/1.1, disables proxy buffering/cache/gzip, clears the hop-by-hop `Connection` header,
and uses six-minute read/send timeouts. The host TLS nginx must apply equivalent SSE behavior for
this path, especially `proxy_buffering off` and a read timeout longer than
`SSE_MAX_CONNECTION_DURATION_MS`; otherwise the inner proxy cannot prevent the outer hop from
buffering or closing the stream. Do not add a trailing slash to `proxy_pass http://api:4000`.

The current production-oriented VPS demo sets `MEDIA_STORAGE_PROVIDER=local`, serves stable
same-origin `/media/*` URLs through nginx/API, and fixes `MEDIA_LOCAL_DIR=/app/var/media` in Compose.
The named `media_data` volume is outside the API container writable layer. `docker compose up -d`,
`--force-recreate`, image replacement, and the CD workflow preserve it; `docker compose down -v` or
explicit volume removal destroys it and is prohibited during normal rollout.

S3-compatible storage remains implemented and optional. To enable it later, explicitly set
`MEDIA_STORAGE_PROVIDER=s3` plus `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_BASE_URL`. `S3_ENDPOINT` is empty for AWS S3 and set to the
provider endpoint for R2 or another compatible service. `S3_PUBLIC_BASE_URL` must use HTTPS in
production. Local mode does not require or read a complete `S3_*` credential set; do not add fake
values merely to satisfy an obsolete deployment assumption. The unused local volume may remain
mounted during a future S3 migration so rollback does not discard existing VPS media.

### VPS-local media operations

1. Keep the production Compose project/deploy path stable and confirm `media_data` appears in
   `docker compose ... config` before rollout. Do not rename the volume casually.
2. Verify ownership by uploading an image through the API. The runner creates `/app/var/media` for
   UID/GID `1001`; a new named volume copies that safe directory metadata on first mount.
3. Before and after an API recreate, verify the same `/media/...` URL and a reviewed storage object.
   Repository validation uses a fresh non-root API container twice against one temporary volume:

   ```bash
   docker build --target runner -t line-smart-queue-api:media-persistence-validation -f docker/api/Dockerfile .
   npm run media:persistence:verify
   ```

4. Back up `media_data` together with the database release record and test restoration into an
   isolated volume. Store backups off the VPS according to the approved RPO/RTO.
5. For disk pressure, identify reviewed unreferenced objects by comparing dated purpose prefixes
   with active `media_assets.storage_key` rows. Never delete the whole volume or run an automated
   orphan sweep without a backup and grace period.

### Optional S3-compatible object-storage operations

1. Create a dedicated production bucket per environment or an equivalent isolated prefix. Enable
   provider versioning/retention when the business recovery policy requires it.
2. Create a least-privilege API credential limited to the media bucket/prefix with object
   `PutObject`, `DeleteObject`, and any required metadata/read permission. Never grant bucket
   administration to the API credential and never put it in a `VITE_*` variable.
3. Configure public-read/CDN behavior only for the generated media prefix. Keep the bucket control
   plane private; if the CDN is private, replace this adapter with a reviewed signed-delivery
   boundary before launch.
4. Configure lifecycle retention and malware/content scanning according to the provider and legal
   policy. The API normalizes supported uploads to WebP but does not claim to be an antivirus
   scanner.
5. Before redeploying, verify one upload, one replacement, one delete, and one repeated delete in
   staging. Confirm the returned URL is reachable from the web origin and that recreating the API
   container does not remove the object.
6. For partial failures, retry active metadata whose delete failed; for upload cleanup failures,
   compare provider inventory with active `media_assets.storage_key` rows under the dated purpose
   prefixes and remove only reviewed unreferenced objects. Do not run an automated destructive
   orphan sweep without a backup and an explicit grace period.

For a higher-availability or multi-host production environment, evaluate managed PostgreSQL and
S3-compatible object storage, plus TLS ingress, restricted network/security groups, centralized
secrets/logs, and a deployment orchestrator. The current VPS-local volume is the official
production-oriented demo baseline, not shared multi-host or high-availability storage.

## 4. Deployment sequence

1. Back up database and verify recent restore test.
2. Build immutable API/web images from a reviewed commit.
   The API image contains canonical migrations and compiled demo seed scripts so
   deployment tooling can run them without TypeScript development dependencies.
   Production rollout applies migrations explicitly and must not seed demo data.
3. Run lint, typecheck, tests, build, CSP bundle validation, and contract/migration checks.
4. Apply additive migrations with a production-safe role.
   Migration `000013` backfills Japanese translation rows and adds user, organization, and durable notification locale snapshots; verify row counts before enabling language selection.
5. Deploy API and verify `/health` plus `/ready`.
6. Deploy web with correct public environment values.
7. Run `npm run line:rich-menu:sync` only after the intended LINE credentials, LIFF ID, web origin, and Rich Menu image are configured.
8. Confirm manager copy/print QR resolves to the permanent LIFF link without a duplicated endpoint path and that a signed-out customer is redirected through LINE Login before booking. Then smoke test business email login, web-to-LIFF QR redirect, LIFF Home/Rich Menu navigation, booking, friendship/preferences sync, staff call, LINE sandbox, and payment mode.
   Run at least one browser/LIFF smoke in each supported locale (`ja`, `vi`, `en`) and confirm a Japanese fallback when an unsupported browser locale is used.
9. Monitor errors, latency, DB connections, job execution, stock/payment anomalies, and notification failures.
10. Record release in `CHANGELOG.md`.

Use expand/backfill/contract deployment for schema changes that cannot be completed atomically without downtime.

## 5. Health and observability

| Endpoint/signal       | Meaning                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `/health`             | API/DB status, safe Redis lifecycle state, scheduler, and LINE summary   |
| `/ready`              | Database accepts connections; Redis state is reported but is not a gate  |
| `/metrics`            | In-memory Prometheus-format counters; restrict from public internet      |
| Worker heartbeat file | BullMQ worker startup/readiness refreshed without publishing HTTP        |
| Pino HTTP logs        | Structured requests/errors with request ID                               |
| Audit logs            | Administrative/resource changes in PostgreSQL                            |
| OpenTelemetry traces  | Optional OTLP correlation across API, PostgreSQL, Redis, jobs, providers |
| Sentry events         | Optional sanitized browser, API, and worker exception reporting          |

Current metrics are process-local and reset on restart. They include the latest HTTP latency,
PostgreSQL pool total/idle/waiting counts, Redis/cache, BullMQ, notification, provider, and SSE
signals. Notification delivery counters include sent, retry-scheduled, and failed outbox outcomes,
while the durable row state remains in PostgreSQL. Production should scrape frequently and use the
OTel backend for latency distributions rather than treating process-local latest-value gauges as
histograms.

Set `OTEL_SDK_DISABLED=false`, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, a private
`OTEL_EXPORTER_OTLP_HEADERS` value when required, `OTEL_SERVICE_NAME`, and a bounded
`OTEL_TRACES_SAMPLER_ARG` to export traces. The API service name is suffixed as `-worker` in the
dedicated worker when the configured name ends in `-api`. Set backend `SENTRY_DSN`,
`SENTRY_ENVIRONMENT`, and immutable `SENTRY_RELEASE` for error reporting. Telemetry endpoints and
Sentry outages are degraded observability only and must not fail startup or business work.

Browser Sentry uses public build-time `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, and
`VITE_SENTRY_RELEASE`. Never place a Sentry auth token in `VITE_*`. Production source maps are not
included in the static image; a future trusted CI upload may use a server-side auth token and must
delete maps before publication. The sanitizer removes credentials, auth/session material, customer
contact/LINE identity, exact coordinates, and raw provider/payment payloads. Request-body capture
is disabled.

SSE exports active/opened/closed connections, sent events, send failures, reconnect hints, and the
latest connection duration. Redis Pub/Sub exports publish/parse/connection/reconnect failures.
Aggregate these process-local metrics across API replicas. A Redis Pub/Sub outage affects freshness
only: connected clients on the publishing replica still receive local events, cross-replica clients
recover by reconnecting and refetching REST, and committed queue/order state remains unchanged.

Redis connection errors, command timeouts, and rate-limit fallback requests are exported as safe
process-local counters. During a Redis outage, strict auth/webhook and write policies fall back to
bounded in-process counters; they never become unlimited. Existing status codes, thresholds, error
envelopes, and proxy-derived client keys are preserved. PostgreSQL-backed domain operations remain
available. Investigate Redis health and restore it promptly because limits are only instance-local
during the outage.

Public read-model cache telemetry is exported as `redis_cache_hits_total`,
`redis_cache_misses_total`, `redis_cache_errors_total`, `redis_cache_hit_ratio`, and
`redis_cache_latency_seconds` under the existing `line_queue_` Prometheus prefix. Cache errors do
not fail public reads; PostgreSQL is queried instead. A sustained low hit ratio indicates TTL or
invalidation churn, while rising error counts with degraded Redis health indicate fallback load on
PostgreSQL.

### Replica and database connection budget

Set `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, and `DB_POOL_CONNECTION_TIMEOUT_MS` per API/worker
process. Budget before scaling replicas:

```text
(API replicas x API pool max) + (worker replicas x worker pool max) + migration/admin headroom
    <= PostgreSQL max_connections safety budget
```

The defaults are development-safe starting points, not a production sizing result. The TASK-11
two-API topology used pool maximum 5 per process and observed no waiting clients during its local
run. Rehearse the intended replica count and workload in staging, alert on waiting clients and
connection saturation, then tune the aggregate rather than increasing each pool independently.

### Controlled dependency recovery

`npm run scale:validate` is a destructive local/staging rehearsal with mock providers. Its expected
operator behavior is: Redis loss disables shared cache/Pub/Sub/BullMQ while PostgreSQL-backed reads
continue; worker loss leaves durable notification rows pending; API loss is absorbed by the other
replica; PostgreSQL loss makes `/ready` return `503`; restored dependencies recover without data
reset. LINE timeout/429/5xx, S3 timeout/credential/upload/delete failures, and telemetry/Sentry
outages are covered by deterministic adapter tests. Do not inject these failures into production.

Recovery procedure for the validated topology:

1. Record `/health`, `/ready`, worker heartbeat, outbox backlog/oldest age, and sanitized logs before
   restarting anything. Never reset PostgreSQL to recover an optional dependency.
2. Restore Redis first when cache, Pub/Sub, shared rate limits, and BullMQ are all degraded. API
   domain reads/writes remain PostgreSQL-authoritative; expect temporary per-instance limits and
   REST polling while Redis is unavailable.
3. Restore the dedicated worker after Redis is healthy. Pending PostgreSQL outbox rows are
   redispatched with deterministic job IDs; confirm backlog age falls and rows become `sent`.
4. Restart API replicas one at a time behind the gateway. Existing refresh sessions and committed
   queue/order state survive because they are stored in PostgreSQL. Confirm `/ready` and one
   authenticated REST read before restarting the next replica.
5. After SSE reconnect, force an authoritative REST refetch. Never replay a staff/customer command
   merely because an event was missed; use its stable idempotency key or current domain state.
6. For PostgreSQL interruption, keep instances out of readiness until the database is healthy.
   Resume writes only after migration status and queue/order/payment/inventory consistency checks.

On 2026-08-11 the isolated two-API validation passed Redis stop/start, worker backlog recovery,
cross-replica SSE, one-API restart, PostgreSQL stop/start, distributed rate limiting, cache loss,
and 160 public reads with zero errors. The rehearsal also verified that its Docker/psql command
arguments are preserved on Windows; this is recovery evidence, not a production capacity claim.

## 6. Scheduled jobs operations

LINE notification delivery is the only BullMQ-owned workload. The dedicated worker registers the
deterministic `line-notification-delivery-sweep-v1` scheduler on queue `line-notifications`; the
scheduler now runs `line.notification-outbox.dispatch.v1`. Dispatcher claims contain no PII and
produce deterministic `line.notification-delivery.v1` jobs with only a notification UUID. The
worker uses bounded attempts, exponential backoff with jitter, provider `Retry-After`, configurable
throttling, and graceful drain before closing Redis. PostgreSQL `notifications` rows and event keys
remain authoritative. Stale dispatch claims recover after
`LINE_NOTIFICATION_DISPATCH_CLAIM_TIMEOUT_SECONDS`; LINE requests time out after
`LINE_MESSAGING_REQUEST_TIMEOUT_MS` and use provider retry keys for duplicate safety.

Monitor `notifications_undispatched`, oldest undispatched age, BullMQ waiting/active/delayed/failed,
outbox retry/failure totals, worker processing time, and LINE provider latency/failures. A rising
undispatched age with a healthy database indicates Redis/dispatcher trouble; rising delayed jobs
with `429` indicates provider throttling.

The API scheduler retains ETA updates/warnings, called-reminder backfill, email delivery, inventory
expiry, location work, forecasting, session cleanup, and counter reset. Those logical jobs continue
to use session-level PostgreSQL advisory locks and safe `scheduler_job_runs` status. Do not enable
API and BullMQ ownership for LINE delivery at the same time. A worker or Redis outage grows the
durable outbox backlog but does not roll back or reject queue/order transactions.

Location-alert cycles additionally lease due rows with `processing_started_at`. The scheduler's
advisory lock still owns the logical cycle, but the travel provider is called without the former
second long-held transaction/client. Monitor job duration against
`LOCATION_ALERT_CLAIM_TIMEOUT_SECONDS`; reduce the batch or increase the lease only from measured
provider latency and quota evidence.

Platform Admin can inspect the same safe operational signals at `/admin/operations`. The page
reads `GET /api/v1/admin/operations/health`, refreshes every 30 seconds, and shows only sanitized
component states and cross-tenant aggregates. Dedicated workers publish a credential-free
`{ status, updatedAt }` heartbeat to `${REDIS_KEY_PREFIX}:worker:heartbeat` with a short TTL while
retaining the container health file. A missing heartbeat marks worker delivery unavailable but
does not interrupt queue/order writes. When notification delivery is owned by the API, scheduler
state is used instead.

Operational status interpretation:

- `healthy`: the dependency probe or configured runtime is operating;
- `degraded`: local fallback or partial service remains available;
- `unavailable`: the critical probe or current worker heartbeat failed;
- `not_configured`: an optional integration, such as LINE or Redis, is intentionally absent;
- `not_applicable`: reserved for components that do not apply to the active runtime.

Set `APP_RELEASE` or `SENTRY_RELEASE` to the immutable image/commit identifier so the page can
identify a deployment. A demo payment runtime is healthy without `PAYOS_*`; only explicit
`PAYMENT_MODE=external` requires those server-side credentials.

Daily counters are checked hourly and reset when the organization-local date changes. Keep organization timezone configuration accurate and monitor `scheduler_job_runs` for missed cycles.

## 7. Backup and recovery

### Backup

Use encrypted PostgreSQL logical/managed backups with access controls and off-host retention.
Include migration version, application commit, deployment configuration references, and a
consistent backup of the production `media_data` volume. Database metadata and stored media must be
recoverable from the same documented restore point.

Local-provider media is written under `MEDIA_LOCAL_DIR` and served from `MEDIA_PUBLIC_BASE_URL`.
In production Compose that directory is the persistent `media_data` volume, not the API container
filesystem. Stop or quiesce media writes for a filesystem-level snapshot, and copy the volume to
encrypted off-host storage with a restricted operator account. If S3 is enabled later, use the
provider's versioning/export/backup controls instead.

Example logical backup:

```bash
pg_dump --format=custom --no-owner --file=line_queue.dump "$DATABASE_URL"
```

Do not store dumps in Git or on an unencrypted developer desktop for real customer data.

### Restore

```bash
psql "$ADMIN_DATABASE_URL" -c "CREATE DATABASE line_queue_restore;"
pg_restore --no-owner -d line_queue_restore line_queue.dump
```

Post-restore checks:

1. migration status and table/enum presence;
2. organization/member counts and tenant isolation spot checks;
3. order/item/payment/stock referential consistency;
4. active queue/ticket state and counters;
5. API `/ready`, login, booking, and staff smoke tests;
6. LINE/provider endpoints remain pointed at the intended environment.
7. restored `media_assets` URLs resolve to the restored volume objects, and an API container
   recreate does not remove them.

Run a documented restore drill on a schedule. Define RPO/RTO with the business before launch.

## 8. Rollback

- Prefer application rollback to the prior image while keeping backward-compatible expanded schema.
- Do not automatically roll back destructive/data migrations.
- For a failing additive migration, stop rollout, capture error/state, restore from backup only when forward repair is unsafe.
- Payment/notification webhooks require special care during rollback so events are not dropped or processed twice.
- Keep old web/API compatibility for at least the rollout window when clients can be cached.

## 9. Incident runbooks

### API unavailable / Vite proxy refused

Check container/process status, API logs, port binding, then database readiness. Restore API before changing frontend proxy settings unless the target is actually wrong.

### Database unavailable

Remove instance from readiness, inspect credentials/network/storage/connections, stop write traffic if needed, and avoid repeated destructive migration/reset attempts.

### LINE messages missing

Check linked `line_user_id`, Official Account relationship, access token, channel pairing, `/health`, API logs/metrics, recipient block status, and device notification settings. Inspect the `notifications` outbox rows for the ticket: `pending` means waiting for the worker, `processing` means claimed, `sent` means delivery succeeded, and `failed` means retry limit was reached. Errors are sanitized; do not paste access tokens into tickets/logs.

Use **LINE delivery** in the Branch Manager or Staff navigation before querying PostgreSQL. Branch
Managers see their assigned branch and Staff see only their assigned queue; platform Admin and
Organization Owner are intentionally denied. Filter by status/event/time, then open the row
detail. Failure categories
`timeout`, `rate_limited`, `provider_5xx`, `network`, and `unknown` may be manually retried after the
provider or network has recovered. `blocked_recipient`, `invalid_recipient`, and `provider_4xx` are
permanent until the recipient/account/configuration is corrected and cannot be manually retried.
Every manual action requires an operator reason and writes `notification_manual_retry` or
`notification_manual_cancel` to `audit_logs`.

For an outage, first confirm `line_queue_bullmq_worker_ready`,
`line_queue_notification_worker_heartbeat_unixtime`, outbox backlog, oldest-pending age, delivery
latency, and failure count. Restore Redis/worker/provider connectivity before scheduling retries;
retry rows in small batches and watch rate-limit signals. For invalid credentials, rotate the
Messaging API token/secret in the secret store, recreate API/worker containers, verify `/health`,
then retry only recoverable failed rows. Exhausted retries remain `failed` for investigation.
Cancel is available only for stale `pending` rows whose ticket is already `served`, `cancelled`, or
`no_show`; it never changes ticket/order state.

Retention policy: keep sent/cancelled delivery metadata for at least 90 days and failed/audited
operator records for at least 180 days unless local legal/privacy policy requires longer. Archive or
delete in bounded batches by `created_at`; preserve `audit_logs` and aggregate metrics, and never
archive pending/processing rows. Automated archival is not enabled by the application yet.

### Rich Menu missing or outdated

Check the intended Official Account, `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`,
`LINE_LOGIN_LIFF_ID`, `WEB_ORIGIN`, and `LINE_RICH_MENU_IMAGE_PATH`. Rerun
`npm run line:rich-menu:sync`; use `-- --replace` only when intentionally replacing the managed
menu. The API process does not create or update Rich Menus on startup.

### Duplicate LINE messages

Check whether event keys differ for the same domain event, whether old rows were manually replayed, and whether multiple external LINE channels are configured against the same recipient. The Phase 5 outbox prevents duplicate sends for the same `notifications.event_key`, but distinct event keys intentionally send separate lifecycle messages.

### Payment mismatch

Stop fulfillment/refund automation for affected transactions, compare provider dashboard/webhook logs to `payment_transactions` and per-item/order state, preserve raw evidence securely, then reconcile through an audited operation.

### Negative/incorrect stock

Disable affected product, inspect order and inventory-reservation history, reconcile atomically,
and investigate the cancellation/retry/concurrency path. Do not manually edit only
`branch_product_inventories.stock_quantity` without an audit trail.

## 10. CI/CD

`.github/workflows/ci.yml` runs on every pushed branch and pull request. It splits the validation
gate into independent jobs so failures are easy to locate:

- full-history Gitleaks secret scanning;
- dependency audit;
- formatting, spelling, lint, type-check, and OpenAPI contract checks;
- development, validation, and production Compose configuration checks;
- API tests with coverage thresholds;
- Web/shared tests;
- clean PostgreSQL migration/status and repeated administrator seed smoke;
- production build;
- mock-integration Playwright desktop/mobile browser E2E.

The API tests, migration smoke, and browser E2E jobs use separate PostgreSQL services. Browser E2E
waits for the earlier quality and Compose jobs, applies migrations, loads only the explicit browser
fixtures, and then starts the API/Web test servers. CI uses PostgreSQL 16 and does not receive real
LINE, PSP, SMTP, SSH, or customer credentials. `npm run audit:ci` blocks new high/critical
advisories in production dependencies and keeps its single narrow, reviewed exception in
`audit-ci.jsonc`.

Production delivery is manual and environment-gated. `.github/workflows/deploy.yml` requires the
operator to type `DEPLOY`, builds the API and Web `runner` images from the selected commit, pushes
immutable tags (`git-<commit SHA>` by default) to Docker Hub, and waits for approval on the
GitHub `production` environment before connecting to the server. The SSH host key is pinned with
`PRODUCTION_SSH_KNOWN_HOSTS`. The remote sequence validates Compose, pulls only the selected API
and Web images, applies canonical migrations, waits for healthy services, and probes the Web health
endpoint. It never copies, prints, or regenerates the server-side `deploy/.env`.
The remote rollout does not run `down -v` or remove volumes: `postgres_data`, `redis_data`, and the
production `media_data` volume remain attached across API/Web image updates. A release that changes
the media volume name or mount target requires a separate migration and backup plan.
After recreation, CD inspects the live API mount as a Docker volume and, when local media is active,
verifies that `/app/var/media` is both the configured path and writable by the non-root process.

Production GitHub Actions variables:

| Variable                 | Example                 | Purpose                                               |
| ------------------------ | ----------------------- | ----------------------------------------------------- |
| `DOCKERHUB_USERNAME`     | `trungnghia2703`        | Docker Hub image namespace                            |
| `VITE_LIFF_ID`           | LINE Login LIFF ID      | Public Web build-time configuration                   |
| `PRODUCTION_DEPLOY_PATH` | `/opt/line-smart-queue` | Server directory containing Compose and `deploy/.env` |

Production GitHub Actions secrets:

| Secret                       | Purpose                                                |
| ---------------------------- | ------------------------------------------------------ |
| `DOCKERHUB_TOKEN`            | Docker Hub access token with push permission           |
| `PRODUCTION_SSH_HOST`        | Production hostname or IP                              |
| `PRODUCTION_SSH_PORT`        | SSH port; may be omitted to use `22`                   |
| `PRODUCTION_SSH_USER`        | Restricted deployment user                             |
| `PRODUCTION_SSH_PRIVATE_KEY` | Private half of a dedicated deployment key             |
| `PRODUCTION_SSH_KNOWN_HOSTS` | Pinned server host-key line from trusted `ssh-keyscan` |

The matching public key belongs in the deployment user's `~/.ssh/authorized_keys`. Give that user
only the Docker/Compose permissions needed under the deploy directory. Keep runtime values such as
database, JWT, LINE Messaging, SMTP, and payment secrets in the server-side `.env`; the workflow
does not copy or regenerate that file. If Docker Hub repositories are private, log the server into
Docker Hub once with a read-only token.

Remaining delivery hardening includes container/image scanning, signed image
provenance, staging deployment against sandbox integrations, automated rollback
metadata, and tested production backup/restore procedures.

## 11. Production readiness checklist

The canonical executable release gate is `docs/checklists/PRODUCTION_READINESS.md`. The isolated
production-oriented demo procedure is `docs/guide/DEMO_ACCEPTANCE.md`. Physical LINE client
acceptance is intentionally separate in `docs/checklists/LINE_REAL_DEVICE_E2E.md` and must not be
inferred from mock CI.

- Real secrets rotated and managed outside Git.
- HTTPS, secure domain/CORS, rate/edge protection, and restricted metrics/docs.
- Managed PostgreSQL backups and restore drill.
- Encrypted off-host `media_data` backup and an isolated media restore/recreate drill.
- Durable notification outbox/retry/idempotency and operational visibility for failed rows.
- Real Rich Menu image asset synced and verified on a physical LINE client.
- Verified payment intent/webhook/refund/reconciliation.
- Stock release/consume lifecycle and concurrency tests.
- Location consent, retention, deletion, and alert worker.
- Japan timezone/currency/seed/localization configuration.
- Verified BullMQ worker heartbeat/backlog alerts and explicit ownership for every remaining scheduler.
- End-to-end and load tests against the scenarios and SLOs in
  [`11_SCALABILITY_BASELINE.md`](11_SCALABILITY_BASELINE.md).
- On-call ownership, dashboards, alerts, and incident communication.

# Transactional email configuration

Local development uses `EMAIL_TRANSPORT=mock` and writes preview HTML files under `var/email-preview`. Production must set `EMAIL_TRANSPORT=smtp`, sender details, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and an independent `EMAIL_TOKEN_ENCRYPTION_KEY` of at least 32 random characters. These are backend secrets and must never use a `VITE_*` name.

The scheduler claims durable `email_outbox` rows after the business transaction commits. Failed messages use bounded exponential retry and do not roll back organization or personnel operations.
