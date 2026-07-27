<!-- cspell:ignore KOMOJU -->

# Roadmap and Decisions

Last reviewed: 2026-07-27. This file records current priorities and accepted architectural decisions. Completed behavior belongs in `CHANGELOG.md` and current-state docs.

## 1. Prioritized roadmap

### P0: Production correctness and security

1. Rotate any previously exposed LINE/JWT/provider credential and enable secret scanning.
2. Select and integrate a real Japan PSP adapter, including merchant secrets, refund execution, settlement reconciliation, and provider operations.
3. Build a dashboard over the implemented notification operations API and delivery metrics.
4. Complete native Japanese and legal/payment copy review.

### P1: Complete requested product capabilities

1. Add LINE consent/preferences, richer post-follow experience, production Rich Menu asset/E2E verification, and organization channel configuration strategy.
2. Complete legal review and connect an approved travel-time provider to the implemented privacy-aware location worker boundary.
3. Connect the implemented audited reconciliation/refund boundary to a real PSP and settlement process.
4. Calibrate the measured forecast/staffing heuristic with production history and accuracy reporting.
5. Expand detailed OpenAPI component schemas as new integrations require generated clients; full runtime operation coverage and drift tests are implemented.
6. Connect the implemented media boundary to object storage with signed upload, scanning, CDN policy, and orphan reconciliation.

### P2: Reliability, UX, and scale

1. Expand browser E2E from the implemented critical-flow baseline to visual regression, accessibility, QR print-dialog, and failure-injection coverage.
2. Add realtime queue updates through SSE or WebSocket only after measuring polling limitations.
3. Consider a separate scheduler worker after measuring the implemented PostgreSQL advisory-lock design.
4. Add observability dashboards, SLOs, tracing, centralized logs, and provider/webhook alerts.
5. Run staged load tests and optimize indexes/queries from measured bottlenecks.
6. Expand accessibility and Japanese copy review with native-user testing.

## 2. Technical debt and risks

| ID     | Issue                                                          | Impact                                 | Planned control                                 |
| ------ | -------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| TD-001 | Shared TypeScript enum values differ from PostgreSQL in places | Incorrect assumptions/contracts        | Align shared types and add serialization tests  |
| TD-002 | Notification operations have API but no dashboard              | Support workflow remains technical     | Owner/admin operations dashboard                |
| TD-003 | Inventory lifecycle needs production load validation           | Rare race behavior may be undiscovered | Staged concurrent integration/load tests        |
| TD-004 | Real PSP settlement/refund execution is absent                 | Demo-only external payment operations  | Provider adapter and settlement runbook         |
| TD-007 | Forecast heuristic lacks production calibration                | Confidence may not reflect real error  | Measure prediction error before model upgrades  |
| TD-008 | Location uses a mock travel-time provider                      | Real travel estimates are unavailable  | Approved provider adapter and legal review      |
| TD-009 | Some OpenAPI operations use generic request/response schemas   | Generated clients have weaker typing   | Incrementally model detailed component schemas  |
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

**Decision:** Run interval jobs in the API process. Notification delivery uses row claims; other logical jobs use session-level PostgreSQL advisory locks and durable `scheduler_job_runs` health records.

**Consequences:** Multiple API replicas do not execute the same logical job concurrently, and PostgreSQL releases session locks when a worker disconnects. A dedicated worker remains an operational scaling option, not a correctness prerequisite for the current jobs.

## ADR-006: Demo-first payment behind a provider boundary

**Status:** Superseded by Phase 6 foundation

**Context:** User flows must be demonstrable without paid provider accounts.

**Decision:** Keep demo auto-success only behind server-created intents and signed demo completion. Browser storage may preserve transaction context, but order creation accepts only verified transaction IDs. Real PSPs will implement the same adapter interface and signed webhook/reconciliation flow.

**Consequences:** Demo remains usable without paid accounts, while browser-supplied amount/status/covered IDs are no longer settlement proof.

## ADR-007: Stable generated public QR token

**Status:** Superseded in scope by ADR-018

**Context:** Managers need printable public entry without manually registering arbitrary tokens.

**Decision:** Generate a unique stable `public_qr_token` server-side and route `/qr/:token`; keep slug routes for readable links. ADR-018 moves the operational QR identity from organization to branch.

**Consequences:** Token rotation/revocation may invalidate printed QR and must be an explicit future operation.

## ADR-008: Japanese product UI, English engineering artifacts

**Status:** Superseded by ADR-015

**Context:** The product serves Japanese users while the codebase and tooling use international engineering conventions.

**Decision:** All visible UI/messages are Japanese. Identifiers, code comments, logs, and canonical technical docs are English.

**Consequences:** UI changes require Japanese copy review; seed/demo data must be localized before external demos.

## ADR-015: Three-locale product UI with Japanese fallback

**Status:** Superseded in credential lifecycle by ADR-017

**Context:** The product now serves Japanese, Vietnamese, and English users while retaining Japan as the default market.

**Decision:** Use i18next resources split by locale/domain on the frontend and separate locale templates for LINE messages. Resolve locale in this order: user preference, organization default, browser/LIFF language, Japanese. Persist locale on the durable notification row. Store tenant content translations in relational translation tables, not language-suffixed columns. Engineering artifacts remain English.

**Consequences:** Every visible-copy change must update all three resources. API clients translate stable error codes. Japanese remains the deterministic fallback when a resource or locale is unavailable.

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

**Decision:** Use `/liff/qr/:token` and `/liff/q/:orgSlug` as the customer booking routes. Public `/qr` and `/q` entries redirect to permanent LIFF links. With the default `/liff` endpoint, links append only endpoint-relative paths such as `/qr/:token`, preventing duplicated `/liff/liff/...` navigation. LIFF initializes LINE Login, exchanges the ID token for the system JWT, synchronizes friendship state, and blocks payment/booking until that authenticated identity is ready. Customer email registration is removed and email/password login is restricted to staff, manager, and admin roles.

**Consequences:** Production QR output requires a real LIFF ID and matching frontend/backend endpoint-path configuration. Local development uses paired frontend/backend LIFF mock values and the same ID-token-to-system-JWT path; it does not introduce a separate customer identity model. Business-role sessions remain active when redirected to the customer LINE entry. LINE Login has been exercised on the deployed HTTPS environment, while complete Messaging API/Rich Menu physical-device acceptance remains an operations gate.

## ADR-012: LINE ticket notifications are Flex-first with text fallback

**Status:** Accepted

**Context:** Customers need a consistent, tappable LINE message for every queue lifecycle event, but Flex delivery can fail because of payload/provider constraints.

**Decision:** Build ticket notification copy, Flex payloads, text fallback, and LIFF deeplinks in the notification templates/service layer. Queue/order services trigger notification intents only after successful state changes and never call the LINE SDK directly.

**Consequences:** Customer-visible LINE content remains centralized in Japanese, Vietnamese, and English templates with Japanese fallback. A Flex send failure retries as text; final delivery failure is logged/metriced and never rolls back queue/order state.

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
- Receipt printing requires a completed, fully paid order; stock consumption occurs when service is completed.
- What SLOs define acceptable booking latency, notification delay, and availability?
- Should platform admin metrics include staff/user counts only, and which aggregate tenant health fields are allowed?

## ADR-016: Public business onboarding with admin approval

**Status:** Accepted

**Context:** Letting a platform admin invent organization details, manager email, and password is
not a professional SaaS acquisition flow and makes data ownership unclear.

**Decision:** Use `/` as the public product site and `/business/register` as a three-step service
application. Applicants provide organization details, work email, expected usage, and plan. The
server calculates and records demo payment. Admins only approve or reject. Credential activation
and branch provisioning are defined by ADR-017 and ADR-018.

**Consequences:** Pending applications contain commercially sensitive contact data, so their API is
admin-only. They never contain a manager password. Demo subscription payment is not a real
settlement claim; a production subscription PSP and terms versioning remain future work.

Decide these before implementing the corresponding P0/P1 contracts; record each material choice as a new ADR.

# ADR-017: Invitation-based business identities and branch scope

**Status:** accepted (2026-07-27)

Business applicants do not choose credentials in the public form. Approval creates an invited owner manager, and a single-use email action activates the organization after the owner chooses a password. Admin/manager/staff share one business login UI; customers remain LINE-only. Account deletion is soft deactivation with an audit actor.

This supersedes the credential-storage portion of ADR-016. Production email requires an external SMTP account, but local mock delivery remains available without a paid provider.

## ADR-018: Owner capability and branch-scoped multi-queue operations

**Status:** accepted (2026-07-27)

**Context:** An organization owner manages the business as a whole, while each branch manager must
operate only one physical branch. A branch can expose multiple service/product queues but should
keep one durable customer QR.

**Decision:** Keep one global `manager` role and distinguish the organization owner through
`organization_members.is_owner`. The owner may retain a compatibility branch membership from
organization activation, but it grants no operational capability. The owner receives only the
aggregate dashboard, branch/manager administration, audit, and organization settings. A non-owner
manager must have exactly one active branch membership and receives branch-only product, queue,
staff, QR, hours, order, payment, and forecast access. Each branch has one stable QR, at least one
active named queue, and queue-specific product mappings. Customers select a queue before building a
cart.

**Consequences:** The JWT-derived current-user context must carry owner and branch scope, but every
service still validates database ownership. Organization-owner dashboards use aggregate branch
metrics and do not expose customer-level operational records. Existing organization QR/calendar
fields remain compatibility data while branch QR/calendar are authoritative for new booking flows.

## ADR-019: Active LINE booking groups and immutable fulfillment receipts

**Status:** accepted (2026-07-27)

**Context:** A LINE customer may add reservations while earlier tickets are still active. Staff
needs one coherent working view without mixing completed history, and receipts must retain the
business/operator meaning even after branch or user profiles change.

**Decision:** Keep every reservation as an independent order and ticket. The server, not the
browser, reuses a booking group only for the same verified LINE identity and branch while the group
contains active queue work. Staff presents those active orders together and excludes terminal
history. Orders directly store branch/queue scope, immutable organization/branch/queue labels, and
the staff identity captured at completion. Gross total, collected prepayment, refunds, and remaining
balance remain separate receipt values.

**Consequences:** Concurrent repeat booking uses a PostgreSQL advisory lock to avoid split groups.
Historical commercial rows remain independently auditable. Snapshot columns intentionally duplicate
display data so later profile edits do not rewrite old receipts.

## ADR-020: Subscription branch limits and queue milestone notifications

**Status:** accepted (2026-07-27)

**Decision:** Define subscription limits in the shared package and enforce them inside the
organization-locked branch creation transaction. Starter permits one branch, Standard permits three,
and Scale is currently unlimited. Queue approach notifications use distinct durable event keys at
exactly five and three people ahead. Auto-call runs through one queue-locked service and never calls
a second customer while another ticket is called or serving.

**Consequences:** UI limits are guidance only; backend enforcement is authoritative and safe under
concurrent branch creation. Both ETA milestones survive retries without deduplicating each other.
