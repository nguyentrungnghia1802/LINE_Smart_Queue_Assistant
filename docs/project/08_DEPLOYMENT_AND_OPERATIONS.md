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
- payOS merchant keys, future PSP secrets, and the current demo payment webhook secret
- `GOOGLE_ROUTES_API_KEY` for server-side branch geocoding and walking-route estimates

Role-aware session settings are non-secret runtime values:

- `JWT_ACCESS_EXPIRES_IN=15m`
- `AUTH_BUSINESS_IDLE_TIMEOUT_MINUTES=15`
- `AUTH_BUSINESS_ABSOLUTE_TIMEOUT_HOURS=12`
- `AUTH_CUSTOMER_SESSION_DAYS=30`
- `AUTH_SESSION_CLEANUP_INTERVAL_MS=3600000`
- `AUTH_REVOKED_SESSION_RETENTION_DAYS=7`

Deploy the complete ordered migration history through `000025` before serving the updated API.
Migrations `000021` through `000025` are additive/normalization changes that preserve business
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

Browser-visible configuration:

- `VITE_API_URL`
- `VITE_APP_NAME`
- `VITE_LIFF_ID`
- `VITE_LIFF_ENDPOINT_PATH`
- `VITE_LIFF_DEFAULT_BOOKING_PATH`
- payment mode/redirect base URL and webhook timing limits (identifiers/URLs only, never keys)

For production web builds, keep `VITE_API_URL` empty, set `VITE_LIFF_ENDPOINT_PATH=/liff`, provide
a real `VITE_LIFF_ID`, and keep `VITE_LIFF_DEFAULT_BOOKING_PATH` empty for multi-organization
deployments. Frontend request
paths already start with `/api/v1`; nginx proxies `/api/*` to the internal `api:4000` service and
preserves that prefix. Setting `VITE_API_URL=/api` would incorrectly produce
`/api/api/v1/...`. Every `VITE_*` value is compiled into the browser bundle at build time and
must be treated as public configuration, not as a secret.

Rotate any credential that has appeared in Git history, logs, screenshots, tickets, or examples.

### payOS and Google Maps

To enable real VND checkout, set `PAYMENT_MODE=external`, configure
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
docker compose ps
```

The stack builds:

- PostgreSQL 16 with persistent `postgres_data`;
- Redis 7.4 with AOF-backed `redis_data`, private to the Compose network;
- API TypeScript build/Node runner reachable inside the Compose network as `api:4000`;
- Vite static bundle served by nginx on `WEB_PORT`, including same-origin `/api/*` proxying to the API service.

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

`deploy/docker-compose.yml` is kept byte-for-byte synchronized with the canonical `docker-compose.prod.yml` by an automated test. It expects prebuilt `LINE_QUEUE_API_IMAGE` and `LINE_QUEUE_WEB_IMAGE` values and does not publish PostgreSQL or API port `4000` to the host. Always replace image tags with immutable images built from the intended release commit; changing source code does not update an already-pushed tag automatically.

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
matches the forwarded client IP used by rate limiters. If ingress topology changes, update this
value and smoke test login/rate limiting before rollout.

The current local media adapter writes to `/app/var/media`, backed by the persistent `media_data` volume. nginx proxies `/media/*` to the API so generated media URLs stay on the public web origin. This volume is a Compose durability baseline, not a substitute for production object storage, backup, scanning, and CDN policy.

For a real production environment, use managed PostgreSQL/object storage, TLS ingress, restricted network/security groups, centralized secrets/logs, and a deployment orchestrator. Compose is a packaging baseline, not high-availability infrastructure.

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

| Endpoint/signal | Meaning                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `/health`       | API/DB status, safe Redis lifecycle state, scheduler, and LINE summary  |
| `/ready`        | Database accepts connections; Redis state is reported but is not a gate |
| `/metrics`      | In-memory Prometheus-format counters; restrict from public internet     |
| Pino HTTP logs  | Structured requests/errors with request ID                              |
| Audit logs      | Administrative/resource changes in PostgreSQL                           |

Current metrics are process-local and reset on restart. Notification delivery counters include sent, retry-scheduled, and failed outbox outcomes, while the durable row state remains in PostgreSQL. Production should scrape frequently and add latency histograms, DB pool saturation, queue depth, job duration/failure, notification/payment states, stock conflicts, and webhook lag.

Redis connection errors, command timeouts, and rate-limit fallback requests are exported as safe
process-local counters. During a Redis outage, strict auth/webhook and write policies fall back to
bounded in-process counters; they never become unlimited. Existing status codes, thresholds, error
envelopes, and proxy-derived client keys are preserved. PostgreSQL-backed domain operations remain
available. Investigate Redis health and restore it promptly because limits are only instance-local
during the outage.

## 6. Scheduled jobs operations

Jobs run inside each API process. Notification delivery claims due rows with PostgreSQL row locks, and stale `processing` rows are reclaimable after `LINE_NOTIFICATION_PROCESSING_TIMEOUT_SECONDS`. Other logical jobs, including forecasting, use session-level PostgreSQL advisory locks and record safe scheduler health. A dedicated worker may still be useful at larger scale, but is not required for correctness of the current job set.

Before scaling horizontally, use one of:

- dedicated worker process;
- PostgreSQL advisory locks/leader election;
- durable queue such as BullMQ with Redis when justified.

Daily counters are checked hourly and reset when the organization-local date changes. Keep organization timezone configuration accurate and monitor `scheduler_job_runs` for missed cycles.

## 7. Backup and recovery

### Backup

Use encrypted PostgreSQL logical/managed backups with access controls and off-host retention. Include migration version, application commit, deployment configuration references, and object-storage media when introduced.

Local development media is written under `MEDIA_LOCAL_DIR` and served from `MEDIA_PUBLIC_BASE_URL`. It is not a production durability boundary. Production deployment must provide and verify an object-storage client, backups/lifecycle, CDN/access policy, malware scanning if required, and orphan cleanup before switching away from local storage.

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

`.github/workflows/ci.yml` runs on every pushed branch and pull request. It
provides two required quality surfaces:

- full-history Gitleaks secret scanning;
- dependency audit, format, lint, typecheck, OpenAPI drift validation, API coverage thresholds, web/shared tests, clean PostgreSQL migration/status, repeated seed smoke, build, and mock-integration Playwright desktop/mobile E2E.

CI uses PostgreSQL 16 and does not receive real LINE, PSP, SMTP, SSH, or customer
credentials. `npm run audit:ci` blocks new high/critical advisories in
production dependencies and keeps its single narrow, reviewed exception in
`audit-ci.jsonc`.

`.github/workflows/deploy.yml` starts only after `CI Quality Gates` succeeds for
`main`. It checks out the exact tested commit, publishes API and Web images with
both `latest` and `sha-<full-commit>` tags, then connects to the production host,
pulls images, applies migrations, recreates API/Web, and verifies container
health. Configure a GitHub Environment named `production`; use required
reviewers there when manual approval is desired.

Production GitHub Actions variables:

| Variable                 | Example                 | Purpose                             |
| ------------------------ | ----------------------- | ----------------------------------- |
| `DOCKERHUB_USERNAME`     | `trungnghia2703`        | Docker Hub image namespace          |
| `VITE_LIFF_ID`           | LINE Login LIFF ID      | Public Web build-time configuration |
| `PRODUCTION_DEPLOY_PATH` | `/opt/line-smart-queue` | Server directory containing Compose |

Production GitHub Actions secrets:

| Secret                       | Purpose                                                |
| ---------------------------- | ------------------------------------------------------ |
| `DOCKERHUB_TOKEN`            | Docker Hub access token with push permission           |
| `PRODUCTION_SSH_HOST`        | Production hostname or IP                              |
| `PRODUCTION_SSH_PORT`        | SSH port; may be omitted to use `22`                   |
| `PRODUCTION_SSH_USER`        | Restricted deployment user                             |
| `PRODUCTION_SSH_PRIVATE_KEY` | Private half of a dedicated deployment key             |
| `PRODUCTION_SSH_KNOWN_HOSTS` | Pinned server host-key line from trusted `ssh-keyscan` |

The matching public key belongs in the deployment user's
`~/.ssh/authorized_keys`. Give that user only the Docker/Compose permissions
needed under the deploy directory. Keep runtime values such as database, JWT,
LINE Messaging, SMTP, and payment secrets in the server-side `.env`; the
workflow does not copy or regenerate that file. If Docker Hub repositories are
private, log the server into Docker Hub once with a read-only token.

Remaining delivery hardening includes container/image scanning, signed image
provenance, staging deployment against sandbox integrations, automated rollback
metadata, and tested production backup/restore procedures.

## 11. Production readiness checklist

The canonical executable release gate is `docs/checklists/PRODUCTION_READINESS.md`. Physical LINE client acceptance is intentionally separate in `docs/checklists/LINE_REAL_DEVICE_E2E.md` and must not be inferred from mock CI.

- Real secrets rotated and managed outside Git.
- HTTPS, secure domain/CORS, rate/edge protection, and restricted metrics/docs.
- Managed PostgreSQL backups and restore drill.
- Durable notification outbox/retry/idempotency and operational visibility for failed rows.
- Real Rich Menu image asset synced and verified on a physical LINE client.
- Verified payment intent/webhook/refund/reconciliation.
- Stock release/consume lifecycle and concurrency tests.
- Location consent, retention, deletion, and alert worker.
- Japan timezone/currency/seed/localization configuration.
- Multi-replica scheduler ownership or single-worker guarantee.
- End-to-end and load tests against the scenarios and SLOs in
  [`11_SCALABILITY_BASELINE.md`](11_SCALABILITY_BASELINE.md).
- On-call ownership, dashboards, alerts, and incident communication.

# Transactional email configuration

Local development uses `EMAIL_TRANSPORT=mock` and writes preview HTML files under `var/email-preview`. Production must set `EMAIL_TRANSPORT=smtp`, sender details, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and an independent `EMAIL_TOKEN_ENCRYPTION_KEY` of at least 32 random characters. These are backend secrets and must never use a `VITE_*` name.

The scheduler claims durable `email_outbox` rows after the business transaction commits. Failed messages use bounded exponential retry and do not roll back organization or personnel operations.
