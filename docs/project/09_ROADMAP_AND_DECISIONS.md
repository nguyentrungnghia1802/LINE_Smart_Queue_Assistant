<!-- cspell:ignore KOMOJU -->

# Roadmap and Decisions

Last reviewed: 2026-07-15. This file records current priorities and accepted architectural decisions. Completed behavior belongs in `CHANGELOG.md` and current-state docs.

## 1. Prioritized roadmap

### P0: Production correctness and security

1. Rotate any previously exposed LINE/JWT/provider credential and enable secret scanning.
2. Implement server-created payment intents, signed webhooks, durable idempotency, refund, and reconciliation for the selected Japan PSP.
3. Complete inventory lifecycle: reserve, consume, release on cancellation, expire, and reconcile exactly once.
4. Replace in-memory notification deduplication with a PostgreSQL outbox/delivery log, retry schedule, and dead-letter visibility.
5. Enforce strict queue capacity and order number uniqueness under concurrency.
6. Add all automated tests and clean migration smoke tests to CI.
7. Correct Japan production configuration: timezone, JPY seed/demo data, addresses, legal/payment copy.

### P1: Complete requested product capabilities

1. Add LINE consent/preferences, Official Account follow-state handling, rich messages/menu, and organization channel configuration strategy.
2. Implement the location-alert worker with queue timing, travel-time provider boundary, consent, retention, and deletion controls.
3. Build booking-group retrieval and staff/customer views while keeping each order/ticket independent.
4. Reconcile manual order payment with item/transaction records and restrict receipt printing to valid states.
5. Persist wait forecasts and build a measured heuristic baseline from service history.
6. Aggregate demand/service history and expose staffing recommendations by weekday/hour with confidence/explanation.
7. Complete Swagger/OpenAPI coverage and API contract tests.
8. Move logo/product image uploads to object storage with signed upload, compression, scanning, and lifecycle rules.

### P2: Reliability, UX, and scale

1. Add browser E2E tests for QR booking, payment return, staff flow, admin registration, QR print, and mobile layouts.
2. Add realtime queue updates through SSE or WebSocket only after measuring polling limitations.
3. Separate scheduler worker or add distributed locks before multiple API replicas.
4. Add observability dashboards, SLOs, tracing, centralized logs, and provider/webhook alerts.
5. Run staged load tests and optimize indexes/queries from measured bottlenecks.
6. Add organization business hours, holidays, exception days, and local-time counter resets.
7. Expand accessibility and Japanese copy review with native-user testing.

## 2. Technical debt and risks

| ID     | Issue                                                          | Impact                                     | Planned control                                 |
| ------ | -------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| TD-001 | Shared TypeScript enum values differ from PostgreSQL in places | Incorrect assumptions/contracts            | Align shared types and add serialization tests  |
| TD-002 | Notification sent registry is process-local                    | Duplicate/missed sends after restart/scale | DB outbox + unique event key                    |
| TD-003 | Cancellation does not restore stock                            | Inventory leakage                          | Transactional release service and tests         |
| TD-004 | Manual payment patch updates summary only                      | Order/item/transaction mismatch            | Reconciliation state machine                    |
| TD-005 | Queue capacity check is optimistic                             | Over-capacity under race                   | Lock queue/capacity row in transaction          |
| TD-006 | Order number derived from count                                | Collision under concurrency                | Per-org sequence/counter plus unique constraint |
| TD-007 | Forecast/staffing tables have no producers                     | Feature can be overstated                  | Label schema-only until pipeline/API/UI exist   |
| TD-008 | Location alerts are inserted but never sent                    | False product expectation                  | Worker, consent, delivery status, tests         |
| TD-009 | Swagger is partial                                             | Client/agent contract drift                | Complete generated OpenAPI and CI diff          |
| TD-010 | CI does not run tests/migrations                               | Regressions can merge                      | Add test DB and required checks                 |
| TD-011 | Metrics reset per process and `/metrics` is public in app      | Weak operations/security                   | Scrape/protect endpoint and expand metrics      |
| TD-012 | Daily counter uses UTC                                         | Wrong local business day                   | Organization timezone-aware reset               |

## 3. Decision record format

New major decisions use an `ADR-###` section with Status, Context, Decision, and Consequences. Do not silently reverse an accepted decision; supersede it with a new ADR.

## ADR-001: PostgreSQL as primary source of truth

**Status:** Accepted

**Context:** Queue transitions, tenant relations, payment/item state, and stock require constraints and transactions.

**Decision:** Use PostgreSQL 16 as the authoritative operational store. Ordered migrations are the executable schema truth.

**Consequences:** Strong consistency and rich indexing; migrations, pooling, backup, and concurrency design are operational responsibilities.

## ADR-002: Modular monolith before microservices

**Status:** Accepted

**Context:** The current team/product stage benefits from one deployable API while domain boundaries still matter.

**Decision:** Keep one Express API with route/controller/service/repository/integration boundaries. Extract workers/services only for measured scaling or isolation needs.

**Consequences:** Simple local/deployment model; process-local jobs/deduplication must be replaced before horizontal scale.

## ADR-003: LINE Login and Messaging API are separate capabilities

**Status:** Accepted

**Context:** LIFF/Login authenticates customers, while Messaging API sends chat messages. Neither substitutes for the other.

**Decision:** Verify LINE ID tokens against the Login channel and send notifications through a Messaging API channel/Official Account. Link the verified LINE user ID to the platform user.

**Consequences:** Full notification experience needs both configurations and user eligibility. The customer path is LIFF-first for LINE identity and push eligibility, while public booking remains a fallback without LINE push.

## ADR-004: REST `/api/v1` with polling at current scale

**Status:** Accepted

**Context:** The current application needs predictable HTTP contracts and does not yet require realtime infrastructure.

**Decision:** Use versioned REST and periodic client/job polling. Evaluate SSE before WebSocket when measured update latency becomes unacceptable.

**Consequences:** Simpler clients and operations; extra reads and up-to-interval update latency.

## ADR-005: In-process scheduler for single-instance baseline

**Status:** Accepted with exit criteria

**Context:** ETA scans and reminders are modest and Redis is not currently required.

**Decision:** Run overlap-protected interval jobs in the API process for one-instance deployments.

**Consequences:** No separate worker dependency; before multiple replicas, introduce one scheduler owner, distributed locks, or a durable job queue.

## ADR-006: Demo-first payment behind a provider boundary

**Status:** Accepted for demo, not production

**Context:** User flows must be demonstrable without paid provider accounts.

**Decision:** Keep demo auto-success and a redirect adapter boundary. Production success must move to server-created intents and verified webhooks.

**Consequences:** UI/order schema can evolve now; current browser demo payload must never be mistaken for settlement proof.

## ADR-007: Stable generated organization QR token

**Status:** Accepted

**Context:** Managers need printable public entry without manually registering arbitrary tokens.

**Decision:** Generate a unique stable `public_qr_token` server-side and route `/qr/:token`; keep slug routes for readable links.

**Consequences:** Token rotation/revocation may invalidate printed QR and must be an explicit future operation.

## ADR-008: Japanese product UI, English engineering artifacts

**Status:** Accepted

**Context:** The product serves Japanese users while the codebase and tooling use international engineering conventions.

**Decision:** All visible UI/messages are Japanese. Identifiers, code comments, logs, and canonical technical docs are English.

**Consequences:** UI changes require Japanese copy review; seed/demo data must be localized before external demos.

## ADR-009: Browser storage is draft state, never authority

**Status:** Accepted

**Context:** Checkout must survive navigation and repeat bookings should be convenient on one device.

**Decision:** Use session/local storage for drafts, payment return context, local device key, and booking history only. The API revalidates prices, stock, prepayment, identity, and tenant ownership.

**Consequences:** Drafts may be lost/edited by users and cannot prove payment or ownership; server APIs are needed for cross-device history.

## ADR-010: Keep payment/order/ticket/stock creation atomic

**Status:** Accepted

**Context:** A partial booking would create orphaned tickets, incorrect stock, or mismatched payment.

**Decision:** Create the coupled records and stock mutation in one PostgreSQL transaction, then perform noncritical external delivery after commit.

**Consequences:** Transaction code is more complex, but rollback preserves business consistency; third-party calls require separate durable workflows.

## ADR-011: Customer booking is LIFF-first

**Status:** Accepted

**Context:** Customer notifications, ticket deeplinks, and queue ownership need a verified LINE identity. A browser-supplied LINE profile or `lineUserId` cannot be trusted.

**Decision:** Use `/liff/qr/:token` and `/liff/q/:orgSlug` as the primary customer booking routes. LIFF initializes LINE Login, exchanges the ID token for the system JWT, and blocks LIFF booking until that authenticated identity is ready. Public `/qr`, `/q`, and `/ticket` routes remain for fallback/demo access.

**Consequences:** LINE Console and real-device E2E configuration are required before production acceptance. Local mock mode remains available, but bookings in LIFF must be tested with the authenticated system JWT path.

## ADR-012: LINE ticket notifications are Flex-first with text fallback

**Status:** Accepted

**Context:** Customers need a consistent, tappable LINE message for every queue lifecycle event, but Flex delivery can fail because of payload/provider constraints.

**Decision:** Build ticket notification copy, Flex payloads, text fallback, and LIFF deeplinks in the notification templates/service layer. Queue/order services trigger notification intents only after successful state changes and never call the LINE SDK directly.

**Consequences:** Customer-visible LINE content remains centralized and Japanese. A Flex send failure retries as text; final delivery failure is logged/metriced and never rolls back queue/order state. Durable outbox and distributed retry remain future work.

## 4. Open product decisions

- Which Japan PSP is primary: Stripe, KOMOJU, PayPay, or a provider mix?
- Is one LINE Official Account shared by the platform, or configured per organization?
- What legally approved location consent, retention period, and deletion UX apply?
- How should grouped repeat bookings appear in staff workload and customer history?
- What queue/order status combination permits receipt printing and stock consumption?
- What SLOs define acceptable booking latency, notification delay, and availability?
- Should platform admin metrics include staff/user counts only, and which aggregate tenant health fields are allowed?

Decide these before implementing the corresponding P0/P1 contracts; record each material choice as a new ADR.
