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
- future PSP API/webhook keys

Browser-visible configuration:

- `VITE_API_URL`
- `VITE_APP_NAME`
- `VITE_LIFF_ID`
- payment mode/redirect base URL (identifiers/URLs only, never keys)

Rotate any credential that has appeared in Git history, logs, screenshots, tickets, or examples.

## 3. Docker deployment

Production-like Compose:

```bash
npm run docker:prod:d
docker compose ps
```

The stack builds:

- PostgreSQL 16 with persistent `postgres_data`;
- API TypeScript build/Node runner on port `4000`;
- Vite static bundle served by nginx on `WEB_PORT`.

For a real production environment, use managed PostgreSQL/object storage, TLS ingress, restricted network/security groups, centralized secrets/logs, and a deployment orchestrator. Compose is a packaging baseline, not high-availability infrastructure.

## 4. Deployment sequence

1. Back up database and verify recent restore test.
2. Build immutable API/web images from a reviewed commit.
3. Run lint, typecheck, tests, build, and contract/migration checks.
4. Apply additive migrations with a production-safe role.
5. Deploy API and verify `/health` plus `/ready`.
6. Deploy web with correct public environment values.
7. Smoke test login, public org/QR, booking, staff call, LINE sandbox, and payment mode.
8. Monitor errors, latency, DB connections, job execution, stock/payment anomalies, and notification failures.
9. Record release in `CHANGELOG.md`.

Use expand/backfill/contract deployment for schema changes that cannot be completed atomically without downtime.

## 5. Health and observability

| Endpoint/signal | Meaning                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| `/health`       | API process plus DB status, scheduler state, and LINE configuration summary |
| `/ready`        | Database accepts connections; use for traffic readiness                     |
| `/metrics`      | In-memory Prometheus-format counters; restrict from public internet         |
| Pino HTTP logs  | Structured requests/errors with request ID                                  |
| Audit logs      | Administrative/resource changes in PostgreSQL                               |

Current metrics are process-local and reset on restart. Production should scrape frequently and add latency histograms, DB pool saturation, queue depth, job duration/failure, notification/payment states, stock conflicts, and webhook lag.

## 6. Scheduled jobs operations

Jobs run inside each API process. At one replica this is simple. At multiple replicas, every replica starts the scheduler and can duplicate work. Before scaling horizontally, use one of:

- dedicated worker process;
- PostgreSQL advisory locks/leader election;
- durable queue such as BullMQ with Redis when justified.

The daily counter reset currently follows UTC midnight rather than each organization timezone. Treat this as a production blocker for Japan-local daily numbering.

## 7. Backup and recovery

### Backup

Use encrypted PostgreSQL logical/managed backups with access controls and off-host retention. Include migration version, application commit, deployment configuration references, and object-storage media when introduced.

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

Check linked `line_user_id`, Official Account relationship, access token, channel pairing, `/health`, API logs/metrics, recipient block status, and device notification settings. Remember current deduplication/retry state is in memory.

### Duplicate LINE messages

Check API replica count/restarts and scanner overlap. Current process-local deduplication is insufficient; temporarily run one scheduler owner and prioritize durable notification idempotency.

### Payment mismatch

Stop fulfillment/refund automation for affected transactions, compare provider dashboard/webhook logs to `payment_transactions` and per-item/order state, preserve raw evidence securely, then reconcile through an audited operation.

### Negative/incorrect stock

Disable affected product, inspect order and inventory-reservation history, reconcile atomically, and investigate cancellation/retry/concurrency path. Do not manually edit only `products.stock_quantity` without an audit trail.

## 10. CI/CD current state and target

The GitHub Actions workflow currently installs dependencies, builds shared code, lints, typechecks, and builds workspaces. It does not run the test suite or migration smoke test. Production CI should add:

- API/web tests and coverage thresholds for critical modules;
- clean PostgreSQL migration/seed smoke test;
- dependency/container/security scanning;
- secret scanning;
- immutable image publication and provenance;
- staging deployment plus smoke/E2E gates;
- manual approval and rollback metadata for production.

## 11. Production readiness checklist

- Real secrets rotated and managed outside Git.
- HTTPS, secure domain/CORS, rate/edge protection, and restricted metrics/docs.
- Managed PostgreSQL backups and restore drill.
- Durable notification outbox/retry/idempotency.
- Verified payment intent/webhook/refund/reconciliation.
- Stock release/consume lifecycle and concurrency tests.
- Location consent, retention, deletion, and alert worker.
- Japan timezone/currency/seed/localization configuration.
- Multi-replica scheduler ownership or single-worker guarantee.
- End-to-end and load tests with defined SLOs.
- On-call ownership, dashboards, alerts, and incident communication.
