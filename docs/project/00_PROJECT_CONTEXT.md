# Project Context

Last verified against the repository on 2026-07-16.

## 1. Problem

Physical queues make customers wait near a counter with little visibility. Businesses also need one place to manage reservations, products/services, prepayment, stock, staff workload, and customer communication. LINE Smart Queue Assistant moves the customer journey to QR/LINE while keeping operational control in a browser dashboard.

## 2. Target users

| Actor           | Need                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Customer        | Select products/services, satisfy required prepayment, reserve a place, track the ticket, and receive LINE reminders |
| Staff           | See the active queue and order, call/serve/complete customers, update payment, and print receipts                    |
| Manager         | Configure one organization, catalog, staff, queues, QR access, and operational analytics                             |
| Platform admin  | Register and manage organizations and their manager accounts without reading tenant customer or revenue data         |
| System operator | Deploy, monitor, back up, restore, and troubleshoot the platform                                                     |

## 3. Product goals

- Reduce time customers must physically wait at the business.
- Use the customer's LINE identity and LINE chat for high-visibility queue notifications.
- Keep queue, order, payment, inventory, and tenant data consistent.
- Give each role a focused, responsive Japanese interface.
- Support multiple organizations with strict tenant isolation.
- Provide an upgrade path from demo payment and heuristic ETA to production providers and forecasting.

## 4. Current system status

The project is a working local/demo modular monolith, not yet a production-complete payment or notification platform.

| Area                      | Status                                              | Meaning                                                                                                                                                                                                                                                                                                          |
| ------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization/admin        | Implemented                                         | Admin list, detail, registration, manager assignment, update, soft deactivation                                                                                                                                                                                                                                  |
| Catalog and QR booking    | Implemented                                         | Products/services, stock display, quantity selection, organization slug/token entry, and LIFF-first customer booking                                                                                                                                                                                             |
| Queue and staff operation | Implemented                                         | Ticket lifecycle, staff board, call/serve/complete/no-show/cancel                                                                                                                                                                                                                                                |
| Orders and inventory      | Operational lifecycle implemented                   | Atomic reserve/decrement, consume on fulfillment, release/restore on cancellation or no-show, expiry worker, transition history, and idempotent guarded transitions                                                                                                                                              |
| Payment                   | Phase 6 foundation implemented                      | Server-created payment intents, demo provider, signed demo completion, provider abstraction, payment state machine, webhook idempotency log, and reconciliation exist; no real PSP account is connected yet                                                                                                      |
| LINE                      | Phase 5 code implemented; real-device setup pending | LIFF login verifies ID tokens, LIFF booking stores linked LINE recipients, webhook events are signature-checked, lifecycle push uses durable PostgreSQL outbox delivery with Flex Messages, text fallback and ticket deeplinks, and Rich Menu sync/LIFF Home navigation exist; LINE Console/E2E is still pending |
| Location alerts           | Data path only                                      | Location and pending alerts can be stored; no job sends those alerts                                                                                                                                                                                                                                             |
| ETA                       | Heuristic implemented                               | Position/workload calculation and 30-second updater; forecast history is not populated                                                                                                                                                                                                                           |
| Staffing recommendation   | Schema only                                         | Table exists; no analyzer, API, scheduler, or dashboard producer                                                                                                                                                                                                                                                 |
| Deployment                | Local/Compose ready                                 | Docker and health checks exist; production infrastructure and secret management are environment-specific                                                                                                                                                                                                         |

## 5. Implemented features

- Email/password authentication for admin, manager, staff, and customer roles.
- LINE LIFF login with server-side ID-token verification and linked `line_accounts` records.
- LINE-first QR entry by organization slug or stable generated token, with public fallback routes.
- Separate Japanese portals for customer, staff, manager, and admin workflows.
- Organization registration with a Gmail manager and compressed logo data URL/URL support.
- Product/service CRUD, prepayment flag, service duration, finite or unlimited stock, and active state.
- Queue CRUD, opening state, capacity configuration, ticket prefix/counter, skip/no-show controls, and ETA configuration.
- Atomic order, queue-entry, order-item, payment-transaction, inventory-reservation, and optional location writes.
- Per-item payment status and full-order payment status for required-only or all-item checkout.
- Server-side payment intent boundary with demo provider, Japanese payment method UI, webhook callback, return status, and reconciliation hooks.
- Staff order details, item images, manual payment/status controls, queue actions, and receipt printing.
- LINE push for booking-created, approaching, called, serving, cancelled, completed, and no-show ticket events on queue entries that contain a verified linked LINE user ID.
- Centralized Japanese LINE Flex Message templates with text fallback for ticket lifecycle notifications.
- Durable LINE notification outbox/delivery log in PostgreSQL with unique event keys, worker claim, retry/backoff, sent/failed state, and mock-mode delivery.
- LINE notification ticket deeplinks that open `/liff/tickets/:entryId`.
- LIFF Home at `/liff/home` as the common customer entry point from Rich Menu, including active-ticket resolution, ticket opening, booking start, and Japanese empty states.
- Central Rich Menu definition for `ホーム`, `予約する`, `現在の受付`, and `利用案内`, plus an explicit idempotent `npm run line:rich-menu:sync` command with mock mode.
- LINE webhook signature verification and basic follow, unfollow, and message command handling.
- Scheduled ETA refresh, approaching-turn scan, called-message retry scan, durable notification delivery, and daily counter reset.
- Rate limits, request IDs, structured logging, basic Prometheus text metrics, health/readiness endpoints, and audit logs.
- Database structures for booking groups, location snapshots/alerts, forecast history, and staffing recommendations.

## 6. Incomplete features

- Real PSP integration: signed provider requests, hosted checkout, provider-specific callback verification, refund execution, and encrypted merchant secrets.
- LINE production controls: notification preferences, production Rich Menu asset/E2E verification, advanced notification replay/dead-letter operations UI, delivery reporting dashboard, and multi-organization channel configuration.
- Location alert execution: no scheduler consumes `location_alerts`; no retention/deletion workflow is implemented.
- Forecasting and staffing analysis: schema exists, but no data pipeline or user-facing API populates it.
- Inventory lifecycle is implemented; production load testing and operator reconciliation UI remain pending.
- Payment consistency: manual staff payment updates are still separate from provider refund/settlement lifecycle.
- Full OpenAPI coverage and contract tests; the current Swagger source covers only part of the API.
- Browser end-to-end tests and production-scale concurrency tests.
- Multi-instance coordination for non-notification scheduler ownership and strict queue-capacity enforcement.
- Production media storage; logos are currently saved as URLs or compressed data URLs.

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
- The API is a single Express process with in-process scheduled jobs.
- Public routes must work without authentication, but LINE push requires a verified linked identity.
- Database migrations are the executable schema source of truth.
- Japanese is required for all visible application copy; technical code and documentation are English.
- Vite environment variables are public at build time; secrets stay on the API side.

## 9. Known problems and risks

- `packages/shared` contains legacy enum/value descriptions that do not fully match PostgreSQL values; DB migrations and runtime mappers currently take precedence.
- The seed organization still uses Vietnamese sample address/currency data even though the product UI targets Japan.
- Queue capacity, call-next, daily ticket numbering, and organization order numbering use transactional row locks/counters; production stress testing remains pending.
- Anonymous public booking cannot receive LINE notifications unless the session is linked to LINE and the queue entry stores a verified linked `line_user_id`; production customer entry should therefore use the LIFF-first flow.
- LINE follow/unfollow currently toggles link state, but does not yet provide user-facing notification preferences or a full consent management UI.
- Location data is sensitive personal data and needs explicit consent, retention, and deletion policies before production use.
- The checked-in `.env.example` previously contained a secret-shaped value; credentials must be rotated if that value was ever real.

## 10. Documentation map

| Document                          | Canonical responsibility                                    |
| --------------------------------- | ----------------------------------------------------------- |
| `01_PRODUCT_REQUIREMENTS.md`      | Actors, requirements, rules, acceptance criteria            |
| `02_SYSTEM_ARCHITECTURE.md`       | Containers, modules, dependencies, integrations             |
| `03_DOMAIN_AND_FLOWS.md`          | Domain model, state machines, end-to-end behavior           |
| `04_DATABASE.md`                  | Tables, constraints, transactions, migration policy         |
| `05_API.md`                       | HTTP contract and endpoint inventory                        |
| `06_CODEBASE_GUIDE.md`            | Repository layout and placement conventions                 |
| `07_DEVELOPMENT_AND_TESTING.md`   | Local setup, commands, tests, troubleshooting               |
| `08_DEPLOYMENT_AND_OPERATIONS.md` | Environments, deployment, health, backup, incident response |
| `09_ROADMAP_AND_DECISIONS.md`     | Priorities, risks, technical debt, accepted ADRs            |

Historical files under `docs/archive` are evidence of earlier plans, not current product truth.
