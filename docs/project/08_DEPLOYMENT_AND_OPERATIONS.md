# Deployment and Operations

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
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_ID`
- `LINE_LIFF_ID`
- `LINE_RICH_MENU_IMAGE_PATH` or an equivalent deployment-mounted Rich Menu PNG/JPEG asset path
- future PSP API/webhook keys and current demo payment webhook secret

`LINE_CHANNEL_ACCESS_TOKEN` authorizes outbound Messaging API calls and Rich Menu management. `LINE_CHANNEL_SECRET` verifies inbound webhook signatures and must come from the same Messaging API channel as the token. `LINE_CHANNEL_ID` is the separate LINE Login channel ID used for LIFF ID-token verification. `LINE_LIFF_ID` is the public LIFF app ID used by the backend to generate ticket deeplinks in LINE messages and Rich Menu LIFF routes.

Browser-visible configuration:

- `VITE_API_URL`
- `VITE_APP_NAME`
- `VITE_LIFF_ID`
- `VITE_LIFF_DEFAULT_BOOKING_PATH`
- `VITE_ENABLE_LEGACY_CUSTOMER_AUTH`
- payment mode/redirect base URL and webhook timing limits (identifiers/URLs only, never keys)

For production web builds, set `VITE_API_URL=/api`,
`VITE_ENABLE_LEGACY_CUSTOMER_AUTH=false`, and a real `VITE_LIFF_ID`. nginx in the web container
proxies `/api/*` to the internal `api:4000` service and preserves the `/api` prefix, which keeps
backend routes mounted at `/api/v1`. Every `VITE_*` value is compiled into the browser bundle at
build time and must be treated as public configuration, not as a secret.

Rotate any credential that has appeared in Git history, logs, screenshots, tickets, or examples.

## 3. Docker deployment

Production-like Compose:

```bash
npm run docker:prod:d
docker compose ps
```

The stack builds:

- PostgreSQL 16 with persistent `postgres_data`;
- API TypeScript build/Node runner reachable inside the Compose network as `api:4000`;
- Vite static bundle served by nginx on `WEB_PORT`, including same-origin `/api/*` proxying to the API service.

Image-based production Compose:

```bash
cp deploy/.env.example deploy/.env
docker compose --env-file deploy/.env -f deploy/docker-compose.yml pull
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d
docker compose --env-file deploy/.env -f deploy/docker-compose.yml ps
```

`deploy/docker-compose.yml` is kept byte-for-byte synchronized with the canonical `docker-compose.prod.yml` by an automated test. It expects prebuilt `LINE_QUEUE_API_IMAGE` and `LINE_QUEUE_WEB_IMAGE` values and does not publish PostgreSQL or API port `4000` to the host. Always replace image tags with immutable images built from the intended release commit; changing source code does not update an already-pushed tag automatically.

Use `--env-file deploy/.env` when invoking the file from the repository root. Without it, Compose interpolation may read a different `.env` from the current working directory even though the API container's `env_file` is resolved from the deploy directory.

The web image must be built ahead of time with public Vite values such as `VITE_API_URL=/api`, `VITE_LIFF_ID`, `VITE_LIFF_DEFAULT_BOOKING_PATH`, `VITE_ENABLE_LEGACY_CUSTOMER_AUTH=false`, `VITE_PAYMENT_MODE`, and `VITE_PAYMENT_REDIRECT_BASE_URL`. Backend-only secrets such as `JWT_SECRET`, database credentials, LINE channel secret/access token, and provider webhook keys are runtime API secrets only.

The current local media adapter writes to `/app/var/media`, backed by the persistent `media_data` volume. nginx proxies `/media/*` to the API so generated media URLs stay on the public web origin. This volume is a Compose durability baseline, not a substitute for production object storage, backup, scanning, and CDN policy.

For a real production environment, use managed PostgreSQL/object storage, TLS ingress, restricted network/security groups, centralized secrets/logs, and a deployment orchestrator. Compose is a packaging baseline, not high-availability infrastructure.

## 4. Deployment sequence

1. Back up database and verify recent restore test.
2. Build immutable API/web images from a reviewed commit.
   The API image contains canonical migrations and compiled demo seed scripts so
   deployment tooling can run them without TypeScript development dependencies.
   Production rollout applies migrations explicitly and must not seed demo data.
3. Run lint, typecheck, tests, build, and contract/migration checks.
4. Apply additive migrations with a production-safe role.
   Migration `000013` backfills Japanese translation rows and adds user, organization, and durable notification locale snapshots; verify row counts before enabling language selection.
5. Deploy API and verify `/health` plus `/ready`.
6. Deploy web with correct public environment values.
7. Run `npm run line:rich-menu:sync` only after the intended LINE credentials, LIFF ID, web origin, and Rich Menu image are configured.
8. Confirm manager copy/print QR resolves to the LIFF universal link, then smoke test business email login, public fallback QR, LIFF Home/Rich Menu navigation, booking, staff call, LINE sandbox, and payment mode.
   Run at least one browser/LIFF smoke in each supported locale (`ja`, `vi`, `en`) and confirm a Japanese fallback when an unsupported browser locale is used.
9. Monitor errors, latency, DB connections, job execution, stock/payment anomalies, and notification failures.
10. Record release in `CHANGELOG.md`.

Use expand/backfill/contract deployment for schema changes that cannot be completed atomically without downtime.

## 5. Health and observability

| Endpoint/signal | Meaning                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| `/health`       | API process plus DB status, scheduler state, and LINE configuration summary |
| `/ready`        | Database accepts connections; use for traffic readiness                     |
| `/metrics`      | In-memory Prometheus-format counters; restrict from public internet         |
| Pino HTTP logs  | Structured requests/errors with request ID                                  |
| Audit logs      | Administrative/resource changes in PostgreSQL                               |

Current metrics are process-local and reset on restart. Notification delivery counters include sent, retry-scheduled, and failed outbox outcomes, while the durable row state remains in PostgreSQL. Production should scrape frequently and add latency histograms, DB pool saturation, queue depth, job duration/failure, notification/payment states, stock conflicts, and webhook lag.

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

Check the intended Official Account, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_LIFF_ID`, `WEB_ORIGIN`, and `LINE_RICH_MENU_IMAGE_PATH`. Rerun `npm run line:rich-menu:sync`; use `-- --replace` only when intentionally replacing the managed menu. The API process does not create or update Rich Menus on startup.

### Duplicate LINE messages

Check whether event keys differ for the same domain event, whether old rows were manually replayed, and whether multiple external LINE channels are configured against the same recipient. The Phase 5 outbox prevents duplicate sends for the same `notifications.event_key`, but distinct event keys intentionally send separate lifecycle messages.

### Payment mismatch

Stop fulfillment/refund automation for affected transactions, compare provider dashboard/webhook logs to `payment_transactions` and per-item/order state, preserve raw evidence securely, then reconcile through an audited operation.

### Negative/incorrect stock

Disable affected product, inspect order and inventory-reservation history, reconcile atomically, and investigate cancellation/retry/concurrency path. Do not manually edit only `products.stock_quantity` without an audit trail.

## 10. CI/CD current state and target

GitHub Actions provides two required quality surfaces:

- full-history Gitleaks secret scanning;
- dependency audit, format, lint, typecheck, OpenAPI drift validation, API coverage thresholds, web/shared tests, clean PostgreSQL migration/status, repeated seed smoke, build, and mock-integration Playwright desktop/mobile E2E.

CI uses PostgreSQL 16 and does not receive real LINE, PSP, or customer credentials. Remaining production delivery work is container/image scanning, immutable image publication and provenance, staging deployment against sandbox integrations, manual production approval, and rollback metadata.

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
- End-to-end and load tests with defined SLOs.
- On-call ownership, dashboards, alerts, and incident communication.
