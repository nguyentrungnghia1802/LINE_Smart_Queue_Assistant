# Project Context

Last verified against the repository on 2026-08-12 after the production backup/recovery tooling audit.

## 1. Problem

Physical queues make customers wait near a counter with little visibility. Businesses also need one place to manage reservations, products/services, prepayment, stock, staff workload, and customer communication. LINE Smart Queue Assistant moves the customer journey to QR/LINE while keeping operational control in a browser dashboard.

## 2. Target users

| Actor              | Need                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Customer           | Select products/services, satisfy required prepayment, reserve a place, track the ticket, and receive LINE reminders |
| Staff              | See the active queue and order, call/serve/complete customers, update payment, and print receipts                    |
| Organization owner | Manage branches and branch managers, review audit history, and compare aggregate branch performance                  |
| Branch manager     | Operate one assigned branch, including its named queues, queue catalogs, staff, QR, hours, and forecasts             |
| Business applicant | Review the product, choose a plan, submit organization/work-email details, and complete demo payment                 |
| Platform admin     | Review applications and manage approved organizations/managers without reading tenant customer or revenue data       |
| System operator    | Deploy, monitor, back up, restore, and troubleshoot the platform                                                     |

## 3. Product goals

- Reduce time customers must physically wait at the business.
- Use the customer's LINE identity and LINE chat for high-visibility queue notifications.
- Keep queue, order, payment, inventory, and tenant data consistent.
- Give each role a focused, responsive interface in Japanese, Vietnamese, and English, with Japanese as default.
- Support multiple organizations with strict tenant isolation.
- Provide an upgrade path from demo payment and heuristic ETA to production providers and forecasting.

## 4. Current system status

The project is a production-oriented demo modular monolith, not yet a production-accepted
real-money payment or notification platform.

| Area                      | Status                                              | Meaning                                                                                                                                                                                                                                                                                                 |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization onboarding   | Implemented                                         | Public product site and server-priced demo-paid application; admin approval atomically creates an inactive organization, owner invitation, and email delivery record; the activated owner creates branches later                                                                                        |
| Catalog and QR booking    | Implemented                                         | One stable QR per branch, customer queue selection, queue-specific products/services, stock display, quantity selection, and LIFF-first booking                                                                                                                                                         |
| Queue and staff operation | Implemented                                         | Ticket lifecycle, staff board, call/serve/complete/no-show/cancel                                                                                                                                                                                                                                       |
| Orders and inventory      | Operational lifecycle implemented                   | Atomic reserve/decrement, consume on fulfillment, release/restore on cancellation or no-show, expiry worker, transition history, and idempotent guarded transitions                                                                                                                                     |
| Payment                   | Production-oriented demo active                     | Demo Payment Provider is active and moves no real money; server-created intents, signed completion, provider abstraction, payOS adapter, state machine, webhook idempotency, reconciliation, and audited refund boundaries are retained for future external activation                                  |
| LINE                      | Customer login deployed; message acceptance partial | LIFF login verifies ID tokens, customer booking requires linked LINE identity, webhook events are signature-checked, lifecycle push uses the durable PostgreSQL outbox with Flex/text fallback, and Rich Menu/LIFF Home code exists; full notification and Rich Menu physical-device acceptance remains |
| Location alerts           | Provider-ready flow implemented                     | Explicit verified-user consent, active-ticket snapshots, leased PostgreSQL claims, Google Routes calls outside database transactions, durable LINE enqueue, retry state, configurable retention and deletion exist; restricted production credentials and provider acceptance remain pending            |
| Booking history           | Implemented                                         | Authenticated server-side group history is paginated across devices; customers and tenant staff can inspect independent orders/tickets without merging payment, cancellation, or receipt state                                                                                                          |
| ETA                       | Measured heuristic implemented                      | Position/workload calculation, 30-second updater, persisted forecast history, version/confidence/explanation, retention, and manager API/dashboard                                                                                                                                                      |
| Staffing recommendation   | Measured heuristic baseline implemented             | Eight-week weekday/hour demand and service-duration aggregates produce explainable staffing suggestions; this is deliberately not described as ML                                                                                                                                                       |
| Deployment                | Backup-gated VPS workflow implemented               | Immutable-image CD, durable VPS-local media, verified PostgreSQL/media snapshots, guarded restore, application-only rollback, and isolated recovery rehearsal exist; off-host replication and production acceptance remain operator responsibilities                                                    |

## 5. Implemented features

- Email/password authentication for admin, manager, and staff roles; customer email login is rejected.
- LINE LIFF login with server-side ID-token verification and linked `line_accounts` records.
- Fifteen-minute signed access JWTs with PostgreSQL-backed rotating refresh sessions:
  business roles expire after 15 idle minutes or 12 hours absolute; LINE customers can resume for
  30 days.
- User APIs return an explicit safe profile allowlist. Password hashes and internal invitation or
  deactivation actor fields never cross the HTTP response boundary; Platform Admin uses dedicated
  organization/owner endpoints and cannot browse tenant-private user profiles.
- LINE-only customer authentication: public organization slug/token entries redirect to LIFF, while local development uses the paired LIFF mock identity.
- Localized customer, staff, manager, and admin portals with persisted language selection.
- Storybook 10.5.7 component review environment with shared design tokens, i18n/provider
  decorators, deterministic queue/ticket/order fixtures, Japanese/Vietnamese/English toolbar
  control, phone/desktop viewport states, and interaction coverage for selected reusable
  components.
- Route-level React lazy loading with a localized accessible fallback keeps Customer, Staff,
  Manager, Admin, and public page code out of unrelated initial navigation; repeated catalog and
  order images use deferred browser loading/decoding while visible identity imagery stays eager.
- Shared responsive role navigation with full desktop tabs, icon-labelled mobile bottom navigation,
  safe-area spacing, and mobile card/list variants for dense manager operations.
- Public business onboarding with organization/contact/address/usage/plan details, a work-email
  owner invitation, optional compressed logo, server-calculated demo payment, and admin
  approval/rejection. Applicants do not submit account credentials.
- Platform Admin organization management defaults to active tenants, can filter suspended/all
  tenants, and records a required suspension reason plus an optional note while retaining the
  organization detail and audit history.
- Organization-level product/service CRUD for owners, including prepayment flag, service duration,
  and active state; stock is branch-owned and may be finite or unlimited, while queue configuration
  owns the queue-to-product catalog mapping.
- Multiple named queues per branch with opening state, capacity configuration, ticket prefix/counter,
  three-slot absence deferral, ETA configuration, and branches that can start without a queue.
- Atomic order, queue-entry, order-item, payment-transaction, inventory-reservation, and optional location writes.
- Per-item payment status and full-order payment status for required-only or all-item checkout.
- Server-side payment intent boundary with the Demo Payment Provider active, localized payment
  method UI, signed demo completion, return status, and reconciliation hooks. Demo mode requires
  no real PSP credentials and makes no real PSP call.
- Staff order details with booking name, telephone, verified LINE display name, item images, manual payment/status controls, queue actions, and receipt printing.
- Staff product cards use fixed, aspect-preserving cropped media and fixed-height truncated text
  regions so mixed catalog content stays aligned; the full content remains available in a read-only
  detail dialog with a prominent, accessible close control.
- Customer ticket and Staff queue views share a centralized authenticated SSE client. Events only
  invalidate TanStack Query snapshots; REST remains authoritative, polling stays active at a lower
  frequency while connected, and returns to the existing frequency when realtime is unavailable.
- LINE push for the standard customer journey at booking-created, exactly five people ahead,
  called, and completed, plus exceptional cancelled, deferred, and no-show events on queue entries
  that contain a verified linked LINE user ID.
- Centralized Japanese, Vietnamese, and English LINE Flex Message and text fallback templates for ticket lifecycle notifications, with Japanese as the final locale fallback.
- Durable LINE notification outbox/delivery log in PostgreSQL with unique event keys, worker claim, retry/backoff, sent/failed state, and mock-mode delivery.
- Tenant-scoped LINE notification operations center for Branch Managers and assigned Staff, with
  safe diagnosis, sanitized failure categories, audited retry of recoverable failures, and
  Branch-Manager-only cancellation of obsolete pending deliveries. Platform Admin and Organization
  Owner do not receive tenant operational access.
- LINE notification ticket deeplinks that open `/liff/tickets/:entryId`.
- LIFF Home at `/liff/home` as the common customer entry point from Rich Menu, including active-ticket resolution, ticket opening, booking start, and localized empty states.
- Central Rich Menu definition for `ホーム`, `予約する`, `現在の受付`, and `利用案内`, plus an explicit idempotent `npm run line:rich-menu:sync` command with mock mode.
- LINE webhook signature verification and basic follow, unfollow, and message command handling.
- LIFF friendship detection and an in-app Add/Unblock Official Account prompt for customers who
  are not yet eligible to receive LINE push messages.
- Scheduled ETA refresh, approaching-turn scan, called-message retry scan, and daily counter reset,
  plus a PostgreSQL-outbox dispatcher and independently scalable BullMQ LINE notification worker.
- Rate limits, request IDs, structured logging, basic Prometheus text metrics, health/readiness endpoints, and audit logs.
- Configurable per-process PostgreSQL pool limits and an isolated horizontal validation harness that
  exercises two API replicas, shared Redis/PostgreSQL, a dedicated worker, cross-instance SSE,
  distributed rate limits, and controlled dependency recovery.
- Staff queue overview selects the active queue from one batch count, bounds the visible preview to
  eight entries, and loads all preview orders/items in one query instead of per-entry reads.
- Playwright browser coverage for LIFF mock authentication, required-item demo payment, booking/ticket redirect, staff transitions, durable mock notification delivery, receipt access, public application/admin approval, manager QR/settings, complete role navigation, and desktop/mobile overflow checks.
- Database structures for booking groups, location snapshots/alerts, forecast history, and staffing recommendations.
- Japan-oriented organization addresses, `Asia/Tokyo` defaults, normalized weekly hours,
  locale-independent 24-hour manager controls, and exception-day configuration.

## 6. Incomplete features

- payOS VND collection code retains signed requests, hosted/QR checkout, and callback verification,
  but it is inactive in the current demo runtime. Merchant onboarding, provider production
  credentials, real-money payment/refund acceptance, settlement/reconciliation operations, and
  Japan PSP selection remain external launch gates.
- LINE operator APIs and customer preferences are implemented; production Rich Menu asset/E2E verification, an operator dashboard, and multi-organization channel configuration remain pending.
- Location alerts support deterministic mock travel time and a Google Routes walking adapter.
  Restricted provider credentials, quota monitoring, privacy/legal review, and physical-device E2E
  remain deployment gates.
- Forecasting uses a measured heuristic baseline rather than an ML model; production calibration and longer-term accuracy evaluation remain pending.
- No OpenAI or Gemini SDK/API is used by the current forecasting path. A generative-AI key is not a runtime requirement unless a future backend provider adapter and an approved product use case are added.
- Inventory lifecycle is implemented; production load testing and operator reconciliation UI remain pending.
- Payment reconciliation keeps transaction, order, and item summaries aligned with audited manual operations, replay-safe webhook transitions, partial/full refund amounts, and guarded receipt access. Real PSP refund execution remains pending.
- Expand generic OpenAPI operation entries into detailed component schemas where provider/client generation requires stronger typing; runtime route coverage and contract drift tests are complete.
- Production-scale concurrency and browser/device acceptance tests against real LINE and provider environments.
- Production stress testing for the implemented scheduler ownership, queue-capacity, call-next, and counter locks.
- The current production-oriented VPS demo stores media in a persistent Docker named volume mounted
  outside the API container's writable layer. Versioned tooling now creates and verifies matched
  PostgreSQL/media snapshots outside Git, rehearses isolated restore, and gates CD on a valid
  pre-deployment snapshot. Encrypted off-host replication, malware scanning, capacity alerting,
  production restore evidence, and orphan reconciliation remain operational acceptance. The S3/R2
  adapter remains optional for a future/external provider, while legacy data URLs remain readable.

## 7. Out of scope for the current baseline

- Native iOS/Android applications.
- Microservices or a mandatory message broker.
- A built-in real banking/payment provider account.
- Continuous background GPS tracking.
- Automated staff scheduling or payroll.
- Cross-organization customer/revenue analytics for platform admins.
- Guaranteed SMS/email delivery.

## 8. Main technical constraints

- Node.js 20+, npm workspaces, and PostgreSQL 16.
- One React SPA serves all role surfaces.
- HTTP serving and LINE notification delivery use separate Node processes from the same modular
  monolith. The API retains the remaining in-process PostgreSQL-coordinated schedulers.
- Public routes must work without authentication, but LINE push requires a verified linked identity.
- Database migrations are the executable schema source of truth.
- Visible application copy is translated for `ja`, `vi`, and `en`; Japanese is the default/fallback, while technical code and documentation are English.
- Browser build variables, including `VITE_*` and `LINE_LOGIN_LIFF_ID`, are public at build time;
  secrets stay on the API side.

## 9. Known problems and risks

- Shared queue, ticket, payment, penalty, and notification enums are contract-tested against the
  executable PostgreSQL/runtime values. Migrations remain authoritative whenever a new persisted
  state is introduced.
- Demo organization, catalog, queue names, address, timezone, and currency are localized for Japan; native-language and legal-copy review remains required.
- Queue capacity, call-next, daily ticket numbering, and organization order numbering use transactional row locks/counters; production-scale write stress testing remains pending.
- TASK-11 measurements prove local Docker horizontal behavior and degraded recovery, but they are
  workstation evidence rather than a production capacity or SLO acceptance claim.
- Anonymous public booking cannot receive LINE notifications unless the session is linked to LINE and the queue entry stores a verified linked `line_user_id`; production customer entry should therefore use the LIFF-first flow.
- One Messaging API channel is still shared by the deployment; multi-organization LINE channels are not implemented.
- Location data is snapshot-only with configurable retention and deletion, but the production retention period and consent wording still require legal approval.
- The checked-in `.env.example` previously contained a secret-shaped value; credentials must be rotated if that value was ever real.

## 10. Documentation map

| Document                          | Canonical responsibility                                          |
| --------------------------------- | ----------------------------------------------------------------- |
| `01_PRODUCT_REQUIREMENTS.md`      | Actors, requirements, rules, acceptance criteria                  |
| `02_SYSTEM_ARCHITECTURE.md`       | Containers, modules, dependencies, integrations                   |
| `03_DOMAIN_AND_FLOWS.md`          | Domain model, state machines, end-to-end behavior                 |
| `04_DATABASE.md`                  | Tables, constraints, transactions, migration policy               |
| `05_API.md`                       | HTTP contract and endpoint inventory                              |
| `06_CODEBASE_GUIDE.md`            | Repository layout and placement conventions                       |
| `07_DEVELOPMENT_AND_TESTING.md`   | Local setup, commands, tests, troubleshooting                     |
| `08_DEPLOYMENT_AND_OPERATIONS.md` | Environments, deployment, health, backup, incident response       |
| `09_ROADMAP_AND_DECISIONS.md`     | Priorities, risks, technical debt, accepted ADRs                  |
| `10_IMPLEMENTATION_MAP.md`        | Current source map, route/API/DB inventory, env and worker matrix |
| `11_SCALABILITY_BASELINE.md`      | Runtime scale audit, measured baseline, SLOs, target architecture |

Historical files under `docs/archive` are evidence of earlier plans, not current product truth.

The implementation map is the fastest maintenance entry point. It records the source paths and
verification commands that must be checked when a route, migration, role boundary, environment
variable, worker, or customer flow changes. It does not replace the domain, API, database, or
deployment documents; those remain authoritative for their own contracts.

Production release evidence is tracked with `docs/checklists/PRODUCTION_READINESS.md`. LINE Login has
been exercised on the deployed HTTPS environment. Messaging, Rich Menu, preferences, and deeplink
acceptance still use the independent `docs/checklists/LINE_REAL_DEVICE_E2E.md` and must be completed
against the intended Official Account configuration.

API/Web release artifacts use the full reviewed Git SHA. After the merged `main` revision passes
CI, GitHub CD waits for the protected `production` environment approval, then builds and pushes
`git-<40-character-sha>` plus the mutable discovery tag `latest`. The VPS deploy gate accepts only
the immutable tag and persists the selected full image references in its existing `deploy/.env`.
A failed post-mutation release automatically attempts application-only rollback from verified
snapshot metadata; database/media restore remains separate. The local PowerShell publisher is an
emergency/manual alternative, not the normal production path.
