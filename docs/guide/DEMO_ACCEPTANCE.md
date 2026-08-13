# Demo Acceptance Guide

This guide is the executable acceptance path for the current production-oriented demonstration.
It uses isolated PostgreSQL data, mock LINE identity and delivery, and the Demo Payment Provider.
It does not prove real LINE-device delivery, merchant settlement, or real-money refunds.

## 1. Runtime boundary

| Capability        | Demo acceptance runtime                             | External production acceptance                                          |
| ----------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Customer identity | LIFF mock with a verified backend session           | Real LINE Login/LIFF channel and physical device                        |
| Notifications     | Durable PostgreSQL outbox, BullMQ, mock adapter     | Real Official Account quota, token, recipient, and device delivery      |
| Payments          | Server-authoritative Demo Payment Provider          | Merchant onboarding, PSP credentials, settlement, and refund acceptance |
| Email             | Durable outbox with disabled/mock transport allowed | SMTP credentials and delivered-email acceptance                         |
| Location          | Consent and mock/deterministic routing paths        | Approved travel provider, quota, privacy, and legal acceptance          |
| Media             | Persistent VPS-local Compose volume; mock in tests  | Off-host backup/restore and scanning; optional S3 migration acceptance  |

## 2. Isolated setup

Use only a disposable local database. Never load E2E fixtures into shared, staging, or production
data.

```powershell
docker compose -f docker-compose.dev.yml up -d postgres redis
npm run db:migrate
npm run db:migrate:status
npm run db:fixture:e2e
npm run e2e:all
```

For manual review, start the normal development processes after loading the fixture:

```powershell
npm run dev
```

The stable customer discovery URL is
`http://localhost:5173/qr/demo-queue-lab-2026`. Browser E2E uses isolated ports `5174` and `4100`
instead and never contacts LINE or a PSP.

## 3. Demo identities

All business-role fixture accounts use the local-only password `123456`.

| Role               | Email                | Scope                                                      |
| ------------------ | -------------------- | ---------------------------------------------------------- |
| Platform Admin     | `admin@gmail.com`    | Global application review and sanitized operational health |
| Organization Owner | `manager2@gmail.com` | Organization-wide branches, catalog, audit, and reporting  |
| Branch Manager     | `manager@gmail.com`  | Tokyo Main branch only                                     |
| Branch Manager     | `manager3@gmail.com` | Tokyo Priority branch only                                 |
| Staff              | `staff@gmail.com`    | Tokyo Main / Reception Counter A only                      |
| Staff              | `staff3@gmail.com`   | Tokyo Priority / Priority Reception only                   |

Customers do not use fixture email login. Open the LIFF route with mock mode enabled; the backend
verifies the configured mock ID token and creates the customer session.

## 4. Representative data

The E2E fixture provides two branches, two open queues, organization-owned products, branch stock,
and Staff assignments. It also provides eight deterministic orders/tickets spanning:

- waiting, called, serving, served, cancelled, and no-show queue states;
- unpaid, paid, fully refunded, and failed payment states;
- matching order, item, and demo transaction payment records;
- sent, pending, and failed LINE delivery records;
- cancellation and no-show penalty records.

Re-running `npm run db:fixture:e2e` restores the deterministic payment records for those eight
orders so prior refund acceptance runs do not leave contradictory fixture state.

## 5. Recommended demonstration

1. Open `/apply`, submit a business application, sign in as Platform Admin, and approve it. Confirm
   that provisioning happens only after approval and that activation delivery is queued.
2. Sign in as Organization Owner and review organization-wide branches, catalog, audit, and
   reporting. Confirm branch-management features remain separate from Platform Admin authority.
3. Sign in as Branch Manager and review the assigned branch, queue catalog, Staff assignments, QR,
   LINE delivery operations, and settings. In **LINE配信**, filter a seeded delivery, open its detail,
   verify the masked recipient and sanitized error, and use a reason of at least three characters for a
   permitted retry/cancel action. Confirm another branch is not visible. Sign in as Staff separately and
   confirm the same page is limited to the assigned queue and cannot cancel a delivery.
4. Open `/liff/qr/demo-queue-lab-2026`, select services, enter the required customer details,
   complete Demo Payment when required, create the booking, and reach `/liff/tickets/:entryId`.
5. Sign in as Staff, process the assigned queue, print the receipt, and complete the ticket. Verify
   the committed queue transition remains successful while delivery is observed through the mock
   outbox.
6. Sign in as Platform Admin and open Operational Health. Confirm payment reports `demo / demo`,
   components expose only safe aggregates, and tenant/customer details are absent.
7. Exercise the seeded paid order refund twice with the same idempotency key. Confirm one
   server-authoritative refund result and a final `refunded` order state.
8. Review the Staff, Manager, Admin, and Customer flows at desktop and phone widths, then switch the
   login language through Japanese, English, and Vietnamese and reload to confirm persistence.

## 6. Automated evidence map

| Acceptance area                                                                | Primary evidence                                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| LIFF booking, Demo Payment, ticket redirect                                    | `e2e/customer-booking.spec.ts`                                                   |
| Staff transition, notification scope, application approval, health, refund, QR | `e2e/operations.spec.ts`                                                         |
| Desktop/mobile navigation and overflow                                         | `e2e/responsive.spec.ts`                                                         |
| Japanese, English, Vietnamese, persisted locale                                | `e2e/localization.spec.ts` and i18n unit tests                                   |
| Tenant/branch/assigned-queue authorization                                     | API service/controller tests and operations E2E                                  |
| LINE delivery operations UI, sanitized detail, retry/cancel scope              | `NotificationOperationsPage` and notification operation service/controller tests |
| Payment authority, callback/refund idempotency                                 | Payment provider/service tests and operations E2E                                |
| Realtime, Redis recovery, worker restart, dependency failure                   | `npm run scale:validate`                                                         |
| Static component states and viewports                                          | `npm run storybook:build`                                                        |

### Optimization baseline map

| Phase   | Closure evidence                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| OPT-001 | Persisted enum contract alignment, dead-code/dependency review, targeted queue/Staff regressions                          |
| OPT-002 | Bounded Staff query shape, recoverable location claims, PostgreSQL plan evidence, isolated two-API recovery rehearsal     |
| OPT-003 | Lazy role routes, deferred media decoding, reduced-motion behavior, Storybook and responsive browser coverage             |
| OPT-004 | User-response allowlist, Admin/tenant boundary tests, trusted-proxy rate-limit keys, dependency and secret scans          |
| OPT-005 | Canonical/config reconciliation, deterministic fixtures, full quality gates, browser demo journey, and repository hygiene |

This map points to executable evidence, not release-environment claims. Exact suite counts and
the final closure decision are recorded in `docs/agent/tasks/task.md`; deferred commercial and
physical-device acceptance remains in section 8 and `docs/checklists/PRODUCTION_READINESS.md`.

## 7. Acceptance commands

```powershell
npm run audit:ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
npm run openapi:check
npm run storybook:build
npm run db:migrate
npm run db:migrate:status
npm run db:fixture:e2e
npm run e2e:all
npm run scale:validate
docker build --target runner -t line-smart-queue-api:media-persistence-validation -f docker/api/Dockerfile .
npm run media:persistence:verify
```

Also validate the development, validation, and production Compose files with `docker compose config`
before deployment. Record any command that cannot run and its residual risk; do not substitute a mock
check for external acceptance.

The GitHub Actions CI workflow runs the same static, test, migration, build, browser, and Compose
configuration gates for PRs targeting `main` and for the resulting `main` revision, including
immutable release-workflow and backup/deploy/rollback rehearsal. A successful `main` CI run starts
production CD automatically: it waits for `production` environment approval, then publishes
API/Web images as exact `git-<full SHA>` plus discovery-only `latest`. The VPS accepts only the
immutable tag, verifies a restore point, persists the two selected refs in its existing
`deploy/.env`, pulls, migrates, recreates, and checks health. A failed application rollout attempts
metadata-driven image rollback without automatic database/media restore. Runtime secrets remain
only in GitHub protected scopes or the server file; the workflow does not copy the latter.

## 8. Intentionally deferred external acceptance

- Real LINE Console webhook, Official Account friendship, physical-device login, push delivery,
  notification sound, and native Japanese copy review.
- Real PSP merchant onboarding, credentials, webhook registration, settlement, reconciliation,
  chargeback handling, and real-money refund verification.
- SMTP delivery reputation, VPS media off-host backup/restore and scanning, optional S3/CDN
  migration acceptance, approved maps/travel provider, privacy/legal review, and production-data
  forecast calibration.
- Production-like soak/capacity evidence, aggregate database pool sizing, SLO dashboards, alert
  routing, on-call ownership, backup/restore drill, and rollback rehearsal.

These items are release-environment acceptance requirements, not hidden implementation claims or
reasons to add fake credentials to the demo runtime.
