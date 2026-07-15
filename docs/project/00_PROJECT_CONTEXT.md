# Project Context

Last verified against the repository on 2026-07-15.

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

| Area                      | Status                        | Meaning                                                                                                                 |
| ------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Organization/admin        | Implemented                   | Admin list, detail, registration, manager assignment, update, soft deactivation                                         |
| Catalog and QR booking    | Implemented                   | Products/services, stock display, quantity selection, organization slug/token entry                                     |
| Queue and staff operation | Implemented                   | Ticket lifecycle, staff board, call/serve/complete/no-show/cancel                                                       |
| Orders and inventory      | Implemented with gaps         | Atomic creation and finite stock decrement; cancellation does not yet restore stock                                     |
| Payment                   | Demo/adapter-ready            | Demo auto-success and transaction records exist; no real provider webhook verification                                  |
| LINE                      | Partial with booking-path gap | Real push adapter exists, but order-created tickets do not copy the linked LINE user ID; durable delivery is incomplete |
| Location alerts           | Data path only                | Location and pending alerts can be stored; no job sends those alerts                                                    |
| ETA                       | Heuristic implemented         | Position/workload calculation and 30-second updater; forecast history is not populated                                  |
| Staffing recommendation   | Schema only                   | Table exists; no analyzer, API, scheduler, or dashboard producer                                                        |
| Deployment                | Local/Compose ready           | Docker and health checks exist; production infrastructure and secret management are environment-specific                |

## 5. Implemented features

- Email/password authentication for admin, manager, staff, and customer roles.
- LINE LIFF login with server-side ID-token verification and linked `line_accounts` records.
- Public QR entry by organization slug or stable generated token.
- Separate Japanese portals for customer, staff, manager, and admin workflows.
- Organization registration with a Gmail manager and compressed logo data URL/URL support.
- Product/service CRUD, prepayment flag, service duration, finite or unlimited stock, and active state.
- Queue CRUD, opening state, capacity configuration, ticket prefix/counter, skip/no-show controls, and ETA configuration.
- Atomic order, queue-entry, order-item, payment-transaction, inventory-reservation, and optional location writes.
- Per-item payment status and full-order payment status for required-only or all-item checkout.
- Demo payment gateway boundary with Japanese payment methods and external redirect placeholder.
- Staff order details, item images, manual payment/status controls, queue actions, and receipt printing.
- LINE push for approaching, called, cancelled, and completed ticket events on queue entries that contain a LINE user ID.
- Scheduled ETA refresh, approaching-turn scan, called-message retry scan, and daily counter reset.
- Rate limits, request IDs, structured logging, basic Prometheus text metrics, health/readiness endpoints, and audit logs.
- Database structures for booking groups, location snapshots/alerts, forecast history, and staffing recommendations.

## 6. Incomplete features

- Real PSP integration: signed provider requests, hosted checkout, callback verification, webhook processing, refund, reconciliation, and secrets.
- Durable notification delivery: the queue notification deduplication registry is currently in memory and resets with the API process.
- LINE production controls: follow/opt-in state, preferences, rich menu, durable retries/dead-letter handling, delivery reporting, and multi-organization channel configuration.
- Location alert execution: no scheduler consumes `location_alerts`; no retention/deletion workflow is implemented.
- Forecasting and staffing analysis: schema exists, but no data pipeline or user-facing API populates it.
- Inventory lifecycle: cancellation and expiry do not release reservations or restore `stock_quantity`.
- Payment consistency: manual order payment updates do not yet reconcile item-level payment and transaction status.
- Full OpenAPI coverage and contract tests; the current Swagger source covers only part of the API.
- Browser end-to-end tests and production-scale concurrency tests.
- Multi-instance coordination for scheduler locks, notification idempotency, and strict queue-capacity enforcement.
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
- Queue capacity is checked optimistically before the join transaction and can be exceeded under concurrent load.
- Order numbering uses an organization order count and can collide under concurrent creation unless protected by a stronger sequence/constraint strategy.
- Anonymous public booking cannot receive LINE notifications unless the session is linked to LINE and the queue entry stores `line_user_id`.
- The current order-creation path passes `user_id` but not the authenticated user's `line_user_id` to the new queue entry, so the main order/QR flow must be fixed before LINE reminders work end to end.
- Direct public queue join currently accepts a body `lineUserId` fallback; production must derive it only from a verified LINE token/account link.
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
