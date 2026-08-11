# Production Readiness Checklist

Last reviewed: 2026-08-11. This checklist distinguishes repository verification from external production acceptance. A checked code item does not prove that LINE, a payment provider, or production infrastructure is configured.

## Workstream status

| #   | Workstream                   | Repository status                                                                                                          | Production acceptance                                                    |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Inventory lifecycle          | Implemented and automated tests pass                                                                                       | Pending staged concurrency/load validation                               |
| 2   | Payment reconciliation       | Provider-neutral lifecycle and demo provider implemented                                                                   | Pending real PSP selection, sandbox, settlement, and refund verification |
| 3   | Notification operations      | Tenant-scoped APIs, audit controls, metrics, and tests implemented                                                         | Pending operator dashboard and alert routing                             |
| 4   | LINE preferences and consent | API, LIFF UI, worker enforcement, and tests implemented                                                                    | Pending native-copy and real-account acceptance                          |
| 5   | Location alerts and privacy  | Consent, snapshot, mock provider, worker, retention, deletion, and tests implemented                                       | Pending legal review and approved travel-time provider                   |
| 6   | Booking groups and history   | Customer/staff APIs, LIFF history, ownership, pagination, and tests implemented                                            | Pending real-device usability acceptance                                 |
| 7   | Queue concurrency            | Capacity, call-next, order number, and ticket counter controls implemented                                                 | Pending production-scale stress test                                     |
| 8   | Japan localization           | Timezone, calendar, address, seed, and Japanese UI baseline implemented                                                    | Pending native Japanese and legal-copy review                            |
| 9   | Forecasting and staffing     | Measured heuristic, history, recommendations, manager UI, and tests implemented                                            | Pending production calibration; this is not an ML model                  |
| 10  | OpenAPI contracts            | Runtime route coverage and drift checks implemented                                                                        | Detailed provider schemas may expand with a real PSP                     |
| 11  | Browser E2E                  | Mock desktop/mobile critical flows pass                                                                                    | Real LINE device checklist remains pending                               |
| 12  | CI/CD gates                  | PostgreSQL, security, contract, test, build, idempotent seed, and mock E2E gates implemented                               | Pending image publication, staging deployment, and approval policy       |
| 13  | Horizontal runtime           | Two-API shared PostgreSQL/Redis, worker recovery, SSE fan-out, dependency interruption, and pool metrics validated locally | Pending production-like staging soak and aggregate pool sizing           |
| 14  | Media storage                | Validation/compression plus local/mock/S3-compatible adapters and failure tests implemented                                | Pending real object storage, malware scanning, and CDN policy            |
| 15  | Documentation                | Canonical docs and acceptance checklists updated                                                                           | Must be reviewed for each release                                        |
| 16  | Business onboarding          | Public application, admin approval, owner activation, branch-manager/staff invite, and email outbox implemented            | Pending SMTP credentials and delivered-email acceptance                  |
| 17  | Branch-scoped operations     | Owner vs branch-manager boundaries, branch QR, queue-specific catalog, receipt snapshots, and staff scope implemented      | Pending tenant isolation acceptance on staging                           |

## Release gate

- [ ] Release commit is reviewed and the worktree is clean.
- [ ] CI passes format, lint, typecheck, OpenAPI drift, coverage, web/shared tests, clean migration, repeated seed, build, secret scan, dependency audit, and mock E2E.
- [ ] Seed smoke creates only the platform administrator, is idempotent, and the isolated E2E fixture can load after repeated seed runs.
- [ ] Production secrets are rotated, stored outside Git, and belong to the intended environment.
- [ ] Database backup and restore drill evidence is current.
- [ ] Migrations were rehearsed against a production-like database with a rollback plan.
- [ ] Migration `000021` is applied before the new API starts; business idle expiry, customer
      30-day refresh, logout revocation, and the one-time legacy-session re-login are verified.
- [ ] Deployment migrations include branch-scoped queue/catalog/order snapshot changes and are verified before enabling branch-manager workflows.
- [ ] HTTPS, CORS, edge rate limits, restricted `/metrics` and API docs, and secure headers are verified.
- [ ] Scheduler ownership, notification backlog alerts, payment mismatch alerts, and incident ownership are configured.
- [ ] Inventory concurrency and scheduler behavior pass a production-like load/soak test.
- [ ] Intended API/worker replica counts fit the reviewed aggregate PostgreSQL connection budget.
- [ ] The physical LINE device checklist is complete with evidence.
- [ ] SMTP is configured for organization owner activation, staff invitation, password reset, and durable email retry monitoring.
- [ ] A real PSP sandbox and webhook/reconciliation/refund flow pass before enabling external payment mode.
- [ ] An approved object-storage provider, scanning policy, retention, and orphan cleanup are configured before external media storage is enabled.
- [ ] Location consent and retention copy have legal approval; a real travel-time provider is separately accepted before enabling it.
- [ ] Native Japanese review covers customer UI, LINE copy, payment wording, errors, confirmations, and receipts.
- [ ] Owner-manager, branch-manager, staff, admin, QR booking, and LIFF routes pass responsive acceptance on phone and desktop viewports.
- [ ] SLOs, dashboards, alert destinations, on-call owner, rollback owner, and release communication are recorded.

## Evidence record

For each deployment, record the release commit, environment, migration result, CI run URL, reviewer, test timestamps, unresolved exceptions, and rollback reference in the release ticket. Never paste access tokens, exact customer coordinates, full LINE user IDs, or provider payloads into evidence.

The repository-level demo acceptance procedure and evidence map are maintained in
`docs/guide/DEMO_ACCEPTANCE.md`. TASK-PROD-005 verifies deterministic payment/refund fixtures,
mock LIFF booking, Staff/outbox scope, sanitized Admin health, responsive role navigation, and
Japanese/English/Vietnamese switching. These checks establish a production-oriented demo baseline;
they do not satisfy the unchecked external release gates above.

## Current verdict

The repository is production-oriented in architecture and automated test coverage. Local TASK-11
evidence covers two API replicas and controlled dependency recovery, but production acceptance is
**not complete** because production-like soak/capacity evidence, real LINE Console/device E2E, SMTP
acceptance, a real PSP, object storage, a travel-time provider, legal/native-language review, and
branch-scale tenant isolation acceptance remain pending.
