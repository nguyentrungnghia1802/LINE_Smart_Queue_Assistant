<!-- cspell:ignore KOMOJU -->

# Roadmap and Decisions

Last reviewed: 2026-07-16. This file records current priorities and accepted architectural decisions. Completed behavior belongs in `CHANGELOG.md` and current-state docs.

## 1. Prioritized roadmap

### P0: Production correctness and security

1. Rotate any previously exposed LINE/JWT/provider credential and enable secret scanning.
2. Select and integrate a real Japan PSP adapter, including merchant secrets, refund execution, settlement reconciliation, and provider operations.
3. Build a dashboard over the implemented notification operations API and delivery metrics.
4. Add all automated tests and clean migration smoke tests to CI.
5. Complete native Japanese and legal/payment copy review.

### P1: Complete requested product capabilities

1. Add LINE consent/preferences, richer post-follow experience, production Rich Menu asset/E2E verification, and organization channel configuration strategy.
2. Complete legal review and connect an approved travel-time provider to the implemented privacy-aware location worker boundary.
3. Connect the implemented audited reconciliation/refund boundary to a real PSP and settlement process.
4. Calibrate the measured forecast/staffing heuristic with production history and accuracy reporting.
5. Expand detailed OpenAPI component schemas as new integrations require generated clients; full runtime operation coverage and drift tests are implemented.
6. Connect the implemented media boundary to object storage with signed upload, scanning, CDN policy, and orphan reconciliation.

### P2: Reliability, UX, and scale

1. Add browser E2E tests for QR booking, payment return, staff flow, admin registration, QR print, and mobile layouts.
2. Add realtime queue updates through SSE or WebSocket only after measuring polling limitations.
3. Consider a separate scheduler worker after measuring the implemented PostgreSQL advisory-lock design.
4. Add observability dashboards, SLOs, tracing, centralized logs, and provider/webhook alerts.
5. Run staged load tests and optimize indexes/queries from measured bottlenecks.
6. Expand accessibility and Japanese copy review with native-user testing.

## 2. Technical debt and risks

| ID     | Issue                                                          | Impact                                 | Planned control                                 |
| ------ | -------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| TD-001 | Shared TypeScript enum values differ from PostgreSQL in places | Incorrect assumptions/contracts        | Align shared types and add serialization tests  |
| TD-002 | Notification operations have API but no dashboard              | Support workflow remains technical     | Manager/admin operations dashboard              |
| TD-003 | Inventory lifecycle needs production load validation           | Rare race behavior may be undiscovered | Staged concurrent integration/load tests        |
| TD-004 | Real PSP settlement/refund execution is absent                 | Demo-only external payment operations  | Provider adapter and settlement runbook         |
| TD-007 | Forecast heuristic lacks production calibration                | Confidence may not reflect real error  | Measure prediction error before model upgrades  |
| TD-008 | Location uses a mock travel-time provider                      | Real travel estimates are unavailable  | Approved provider adapter and legal review      |
| TD-009 | Some OpenAPI operations use generic request/response schemas   | Generated clients have weaker typing   | Incrementally model detailed component schemas  |
| TD-010 | CI does not run tests/migrations                               | Regressions can merge                  | Add test DB and required checks                 |
| TD-011 | Metrics reset per process and `/metrics` is public in app      | Weak operations/security               | Scrape/protect endpoint and expand metrics      |
| TD-012 | Native Japanese/legal copy review is pending                   | Customer wording may be unsuitable     | Native review before external production launch |

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

**Status:** Superseded by Phase 6 foundation

**Context:** User flows must be demonstrable without paid provider accounts.

**Decision:** Keep demo auto-success only behind server-created intents and signed demo completion. Browser storage may preserve transaction context, but order creation accepts only verified transaction IDs. Real PSPs will implement the same adapter interface and signed webhook/reconciliation flow.

**Consequences:** Demo remains usable without paid accounts, while browser-supplied amount/status/covered IDs are no longer settlement proof.

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

**Consequences:** Customer-visible LINE content remains centralized and Japanese. A Flex send failure retries as text; final delivery failure is logged/metriced and never rolls back queue/order state.

## ADR-013: Rich Menu sync is explicit and idempotent

**Status:** Accepted

**Context:** LINE Rich Menu setup is external account configuration. Creating menus during API startup would make deployments harder to reason about and could duplicate menus when processes restart or scale.

**Decision:** Keep Rich Menu definition, image loading, LINE transport, and synchronization service/script separate. Operators run `npm run line:rich-menu:sync` when configuring or replacing the Official Account menu. The sync command reuses the managed menu name, deletes uncontrolled duplicates, supports `--replace`, and falls back to a mock adapter for local/test mode.

**Consequences:** Runtime API startup stays side-effect free. Rich Menu changes require an explicit operations step and real-device LINE verification. Durable organization-specific menu variants remain a future decision.

## ADR-014: LINE notifications use a durable PostgreSQL outbox

**Status:** Accepted

**Context:** Process-local deduplication and retry are unsafe across API restarts, repeated scans, and multiple workers.

**Decision:** Queue/order services enqueue LINE notification intents into the `notifications` table inside the same database transaction as the business state change. Each lifecycle event uses a unique event key. A scheduled worker claims due rows with PostgreSQL row locking, sends through `LineNotificationService` and the messaging adapter, then marks rows `sent`, schedules exponential retry, or leaves them `failed` after the configured attempt limit.

**Consequences:** Queue/order transactions do not call LINE and are not rolled back by provider failures. Notification delivery survives API restarts and duplicate scans. The remaining production work is operator visibility, audited replay/cancel controls, and broader scheduler ownership decisions for non-notification jobs.

## 4. Open product decisions

- Which Japan PSP is primary: Stripe, KOMOJU, PayPay, or a provider mix?
- Is one LINE Official Account shared by the platform, or configured per organization?
- What legally approved location consent, retention period, and deletion UX apply?
- How should grouped repeat bookings appear in staff workload and customer history?
- Receipt printing requires a completed, fully paid order; stock consumption occurs when service is completed.
- What SLOs define acceptable booking latency, notification delay, and availability?
- Should platform admin metrics include staff/user counts only, and which aggregate tenant health fields are allowed?

Decide these before implementing the corresponding P0/P1 contracts; record each material choice as a new ADR.
