<!-- cspell:ignore KOMOJU -->

# Roadmap and Decisions

Last reviewed: 2026-08-12 after adding verified VPS backup/recovery and backup-gated deployment. This file records current priorities and accepted architectural decisions. Completed behavior belongs in `CHANGELOG.md` and current-state docs.

## 1. Prioritized roadmap

### P0: Production correctness and security

1. Rotate any previously exposed LINE/JWT/provider credential and enable secret scanning.
2. Select and integrate a real Japan PSP adapter, including merchant secrets, refund execution, settlement reconciliation, and provider operations.
3. Complete native Japanese and legal/payment copy review.

### P1: Complete requested product capabilities

1. Add LINE consent/preferences, richer post-follow experience, production Rich Menu asset/E2E verification, and organization channel configuration strategy.
2. Complete legal review and connect an approved travel-time provider to the implemented privacy-aware location worker boundary.
3. Connect the implemented audited reconciliation/refund boundary to a real PSP and settlement process.
4. Calibrate the measured forecast/staffing heuristic with production history and accuracy reporting.
5. Expand detailed OpenAPI component schemas as new integrations require generated clients; full runtime operation coverage and drift tests are implemented.
6. Extend the implemented object-storage media boundary with signed delivery/upload only after
   measured API bandwidth need; add provider-specific scanning and an audited orphan-reconciliation
   operation before enabling automated cleanup.

### P2: Reliability, UX, and scale

1. Expand browser E2E from the implemented critical-flow baseline to visual regression, accessibility, QR print-dialog, and failure-injection coverage.
2. Complete production browser/device acceptance and capacity measurement for the implemented SSE
   queue/ticket updates before reducing the retained polling safety net further.
3. Consider a separate scheduler worker after measuring the implemented PostgreSQL advisory-lock design.
4. Add observability dashboards, SLOs, tracing, centralized logs, and provider/webhook alerts.
5. Run staged load tests and optimize indexes/queries from measured bottlenecks.
6. Expand accessibility and Japanese copy review with native-user testing.

## 2. Technical debt and risks

| ID     | Issue                                                               | Impact                                  | Planned control                                                      |
| ------ | ------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| TD-001 | Shared TypeScript enum values differ from PostgreSQL in places      | Incorrect assumptions/contracts         | Align shared types and add serialization tests                       |
| TD-002 | Notification operations retention is policy-driven, not automated   | Old terminal delivery rows require care | Add reviewed archival after legal and operational retention approval |
| TD-003 | Inventory lifecycle needs production load validation                | Rare race behavior may be undiscovered  | Staged concurrent integration/load tests                             |
| TD-004 | payOS collection exists but settlement/refund E2E is incomplete     | Production refund/operations risk       | Merchant E2E, refund adapter, settlement runbook                     |
| TD-007 | Forecast heuristic lacks production calibration                     | Confidence may not reflect real error   | Measure prediction error before model upgrades                       |
| TD-008 | Google travel adapter needs production privacy/quota acceptance     | Cost, consent, and estimate risk        | Legal review, restricted key, staged calibration                     |
| TD-009 | Some OpenAPI operations use generic request/response schemas        | Generated clients have weaker typing    | Incrementally model detailed component schemas                       |
| TD-011 | Metrics reset per process and `/metrics` is public in app           | Weak operations/security                | Scrape/protect endpoint and expand metrics                           |
| TD-012 | Native Japanese/legal copy review is pending                        | Customer wording may be unsuitable      | Native review before external production launch                      |
| TD-013 | Media object inventory/reconciliation is operational, not automated | Orphans can consume storage             | Review provider inventory against `media_assets` with a grace period |

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

**Consequences:** Full notification experience needs both configurations and user eligibility. The
customer path is LIFF-first for LINE identity and push eligibility. Public branch URLs are discovery
redirects into LIFF, not a second guest-booking application.

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

**Decision:** Use `/liff/qr/:token` and `/liff/q/:orgSlug` as the customer booking routes. Public `/qr` and `/q` entries redirect to permanent LIFF links. With the default `/liff` endpoint, links append only endpoint-relative paths such as `/qr/:token`, preventing duplicated `/liff/liff/...` navigation. LIFF initializes LINE Login, exchanges the ID token for the system JWT, synchronizes friendship state, and blocks payment/booking until that authenticated identity is ready. Customers who are not friends with the linked Official Account receive a non-blocking native Add/Unblock prompt; declining it does not block booking but prevents notification eligibility. Customer email registration is removed and email/password login is restricted to staff, manager, and admin roles.

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

**Decision:** The first reservation creates an order and ticket. A later reservation from the same
verified LINE identity in the same queue extends that order while its ticket remains active; the
server locks the active order, appends item/payment snapshots, and preserves its persisted
`order_number` and `ticket_code`. Different queues remain independent orders/tickets under the
active booking group, and terminal history is never merged back into current work. Orders directly
store branch/queue scope, immutable organization/branch/queue labels, and the staff identity captured
at completion. Gross total, collected prepayment, refunds, and remaining balance remain separate
receipt values.

**Consequences:** Concurrent repeat booking uses PostgreSQL advisory and row locks to avoid split
groups or duplicate active orders. `orders.order_number` is the durable commercial/receipt
identifier, while `queue_entries.ticket_code` identifies queue position. Historical commercial rows
remain independently auditable. Snapshot columns intentionally duplicate display data so later
profile edits do not rewrite old receipts.

## ADR-020: Subscription branch limits and queue milestone notifications

**Status:** accepted (2026-07-27)

**Decision:** Define subscription limits in the shared package and enforce them inside the
organization-locked branch creation transaction. Starter permits one branch, Standard permits three,
and Scale is currently unlimited. The standard queue approach notification uses a durable event key
at exactly five people ahead. Auto-call runs through one queue-locked service and never calls
a second customer while another ticket is called or serving.

**Consequences:** UI limits are guidance only; backend enforcement is authoritative and safe under
concurrent branch creation. The five-ahead milestone survives retries without duplicate delivery.

## ADR-021: Owner-led branch setup and repeated-absence policy

**Status:** accepted (2026-07-27)

**Decision:** Application approval provisions only the inactive tenant and invited owner account.
Owners create branches without automatic queues; assigned branch managers create queue catalogs.
A staff-recorded absence moves a called ticket back three slots, preserves its ticket code, and
increments an absence counter. The third absence cancels the order and performs the normal
idempotent refund and inventory-release workflow.

**Consequences:** Tenant setup no longer creates placeholder operational data. Branches can
temporarily have no queues, and customer booking remains unavailable until a manager creates and
opens one. Absence handling is auditable and uses the same transaction and durable LINE outbox
boundaries as other queue transitions.

## ADR-022: Organization-owned catalog and branch queue assignment

**Status:** accepted (2026-07-28)

**Context:** Product identifiers and commercial definitions must remain consistent across an
organization, while each branch may expose a different subset through multiple queues. Letting each
branch manager create duplicate products makes reporting, search, pricing governance, and receipt
interpretation ambiguous.

**Decision:** Organization owners exclusively manage one organization catalog. The server generates
organization-unique sequential codes by type (`DVn` for services and `SPn` for products) through
atomic tenant counters. Non-owner branch managers can read the catalog and select products only
through their assigned-branch queue configuration. `queue_products` is the authoritative
branch/queue availability relation, and `branch_product_inventories` is the authoritative branch
stock relation. Staff sees only products assigned to queues in the staff member's branch.

**Consequences:** Product writes require owner capability and queue writes require branch-manager
capability. Orders, payment coverage, inventory, and public booking validate products against the
selected queue assignment. Migration `000024` removes the former `products.branch_id` and global
stock compatibility columns, so no duplicate authorization or inventory source remains.

## ADR-023: Role-aware revocable browser sessions

**Status:** accepted (2026-07-28)

**Context:** A single seven-day bearer token stored in local storage cannot support business idle
timeouts, customer convenience, reliable logout, or server-side revocation without exposing a
long-lived credential to browser JavaScript.

**Decision:** Issue 15-minute access JWTs and keep them only in frontend memory. Store rotating
refresh-token hashes in PostgreSQL session families and deliver the raw token only through a
path-scoped `HttpOnly`, `SameSite=Strict`, production-`Secure` cookie. Business sessions refresh
while the browser observes activity, expire after 15 idle minutes, and have a 12-hour absolute
limit. LINE customer sessions have a 30-day absolute limit and remain subject to active LINE-link
verification. Logout and credential/account lifecycle changes revoke sessions.

**Consequences:** API requests can perform one transparent refresh and retry. Deployment of the
session migration invalidates legacy JWTs once, requiring reauthentication. PostgreSQL becomes the
revocation source of truth and an hourly advisory-locked cleanup removes old revoked/expired rows.

## ADR-024: Branch inventory, payOS counter collection, and active-ticket travel alerts

**Status:** accepted (2026-07-30)

**Context:** Organization owners define shared products and prices, but physical stock differs by
branch. Vietnamese branches need a production-oriented QR collection path, and customer location
must be collected only for an active queue purpose.

**Decision:** Store finite or unlimited stock in `branch_product_inventories`, reserve it against
the selected branch, and let branch managers edit only stock and the low-stock threshold. Keep
payment state behind `ExternalPaymentProvider`; the payOS adapter creates VND checkout/QR data and
accepts signed webhook state, while demo remains available for development. Collect consented
location snapshots only while a verified LINE customer has an active ticket. The Google Routes
adapter requests walking alternatives, selects the longest returned duration, adds an eight-minute
buffer, and sends a durable LINE warning only when travel time exceeds queue ETA.

**Consequences:** Catalog pricing and stock ownership no longer conflict across branches. payOS and
Google integrations require restricted backend credentials, provider configuration, cost/privacy
review, and real-environment acceptance before production claims. Browser payment returns and map
coordinates remain non-authoritative; the API verifies payment callbacks, tenant/branch scope, and
active-ticket consent.

## ADR-025: Do not add an unused generative-AI credential

**Status:** accepted (2026-07-30)

**Context:** The product describes ETA and staffing guidance as AI-assisted, but the implemented
forecasting path is a deterministic measured heuristic over PostgreSQL history. The repository has
no OpenAI or Gemini adapter or runtime call.

**Decision:** Do not add an OpenAI or Gemini API key to the configuration contract merely to rename
the provider. Keep forecast inputs, outputs, and explanations deterministic. A future
generative-AI feature must start with an explicit backend provider interface, data/privacy review,
usage limits, failure fallback, and tests; provider secrets must remain server-side.

**Consequences:** Current deployments need no model-provider account and cannot accidentally spend
against an unused AI API. Gemini can still be adopted later without exposing its key through
`VITE_*` or coupling queue correctness to an external model.

## ADR-026: One operational queue assignment per Staff member

**Status:** accepted (2026-08-08)

**Context:** Branch-level Staff access allowed an operator to switch among every queue in the
branch, which made day-to-day responsibility ambiguous and expanded the operational authorization
surface beyond the assigned work area.

**Decision:** Store a Staff queue assignment on `branch_memberships`. Every active Staff membership
must reference exactly one active queue in the same organization and branch. Managers select that
queue during invitation and may replace it later. A queue may be shared by multiple Staff members.
Staff APIs derive the queue from authenticated server-side membership and ignore client attempts to
select another queue.

**Consequences:** Staff navigation no longer exposes a queue selector. Queue reassignment is an
audited manager operation. A queue referenced by Staff cannot be physically deleted until those
assignments are moved or deactivated; ordinary queue removal remains soft deletion.

Migration `000025_staff_queue_assignment` is the database enforcement for this decision. It adds
`branch_memberships.queue_id`, backfills safe existing Staff assignments, deactivates unresolved
active Staff memberships, and enforces same-organization/same-branch queue references.

## ADR-027: Scale from measured boundaries while PostgreSQL remains authoritative

**Status:** accepted (2026-08-08)

**Context:** The current API combines HTTP handling, interval scheduling, provider delivery, and
process-local cache/rate-limit/idempotency/metrics state. Durable PostgreSQL locks, outboxes, and
constraints already protect many domain transitions, but unconstrained API replicas would multiply
database connections and make process-local behavior inconsistent. Only a small warm public-read
development baseline has been measured; production capacity is not yet established.

**Decision:** Use [`11_SCALABILITY_BASELINE.md`](11_SCALABILITY_BASELINE.md) as the evidence and SLO
baseline. Keep PostgreSQL authoritative. Introduce Redis for documented shared ephemeral behavior,
BullMQ and dedicated workers for isolated asynchronous execution, SSE plus Redis Pub/Sub for queue
state invalidation, OpenTelemetry and Sentry for durable observability, and S3/R2-compatible storage
for shared media only through later scoped tasks. Do not describe scenario sizes or code-review
candidates as measured production limits.

**Consequences:** The modular monolith remains the source boundary while runtime roles may separate.
Later infrastructure changes must preserve transactions, row claims, event-key idempotency, tenant
isolation, provider fallback behavior, and REST snapshot recovery. Capacity claims require isolated
staging measurements against the documented scenarios and SLOs.

## ADR-028: Redis is shared ephemeral infrastructure with bounded rate-limit fallback

**Status:** accepted (2026-08-08)

**Context:** Authentication, webhook, public-write, and authenticated-action limits were stored in
each Express process. Adding replicas multiplied their effective thresholds. Redis is also the
planned connection boundary for later cache, BullMQ, and Pub/Sub tasks, while PostgreSQL already
protects durable business state.

**Decision:** Use one centralized ioredis 5.x lifecycle compatible with the planned BullMQ 5.x
phase. Redis stores only shared ephemeral counters in this task. Strict/auth-related, public-write,
and authenticated-action policies use atomic Redis windows. Coarse global API and public-read
limits remain local. If Redis is disabled or unavailable, every protected policy uses its existing
threshold with a bounded local store and emits throttled safe logs plus metrics. `/ready` remains a
PostgreSQL gate; health reports Redis status without credentials.

**Consequences:** Multiple healthy API processes enforce one counter namespace. A Redis outage can
temporarily multiply the bounded limit by replica count, but never removes authentication
protection or blocks durable queue/order correctness. Redis must remain private, monitored, and
restored promptly. Public read-model caching is handled separately by ADR-029 and the BullMQ
worker foundation by ADR-030; Pub/Sub and remaining process-local idempotency are later tasks.

## ADR-029: Redis caches only bounded public read models

**Status:** accepted (2026-08-08)

**Context:** TASK-01 measured the public branch QR catalog as a high-frequency read path and found
per-queue waiting/product query fan-out. Public queue summaries also repeat a waiting-count query.
These display snapshots tolerate a few seconds of staleness, while booking, inventory, payment,
authorization, and queue transitions do not.

**Decision:** Cache the complete public branch booking read model for five seconds and the public
queue count/ETA summary for three seconds. Use cache-aside Redis JSON envelopes, versioned keys that
contain organization and branch scope, exact-key invalidation after successful database commit,
and safe PostgreSQL fallback for misses, outages, timeouts, and malformed values. Invalidation is
best-effort; TTL bounds any remaining display staleness. PostgreSQL remains authoritative for every
write and correctness-sensitive read.

**Consequences:** Warm public QR reads avoid localized catalog and per-queue fan-out, and warm queue
summary reads avoid repeated count queries across API replicas. Redis loss increases PostgreSQL
load but does not change behavior or availability. Cache hit/miss/error, hit ratio, and command
latency metrics are process-local and must be aggregated by the monitoring system. Cache keys may
be discarded during deployment or schema evolution because version `v1` is explicit.

## ADR-030: BullMQ isolates LINE delivery without replacing the PostgreSQL outbox

**Status:** accepted (2026-08-08)

**Context:** LINE notification delivery performs external I/O and should not share the HTTP process
lifecycle. The existing PostgreSQL outbox already provides transactional enqueue, event-key
deduplication, safe row claims, retry state, and restart durability. Moving every scheduler or
dual-writing business transactions to Redis would add risk without evidence.

**Decision:** Run only the recurring LINE notification delivery sweep in a dedicated BullMQ worker
process. Use the versioned `line.notification-delivery.sweep.v1` contract with a deterministic Job
Scheduler ID and no customer/provider data in Redis. The worker reuses `runNotificationDelivery`;
PostgreSQL remains the delivery authority. API scheduler ownership is disabled when BullMQ owns the
sweep. All other jobs remain under their current scheduler/advisory-lock ownership in this task.

**Consequences:** API transactions remain available while the worker or Redis is down, with pending
outbox backlog as the expected degraded mode. Multiple workers safely upsert one recurring
scheduler and PostgreSQL row claims prevent duplicate row ownership. BullMQ-level retries cover
sweep infrastructure failure, while row-level LINE retry/backoff remains in PostgreSQL. TASK-05
may later introduce per-notification dispatch without changing this authority boundary.

## ADR-031: Dispatch committed LINE outbox rows into deterministic BullMQ jobs

**Status:** accepted (2026-08-08)

**Context:** ADR-030 isolated the existing batch sweep from HTTP serving, but one BullMQ job still
claimed and delivered a PostgreSQL batch. Scaling workers independently requires a job per durable
notification without making Redis an alternative source of truth. Two crash windows must remain
safe: process loss before enqueue and process loss after enqueue but before database acknowledgement.

**Decision:** Keep domain-event enqueue transactional in PostgreSQL. A versioned dispatcher claims
only committed rows with `FOR UPDATE SKIP LOCKED`, persists a recoverable `dispatching` lease, and
adds a delivery job whose deterministic ID is derived from the notification UUID. The job payload
contains only contract version and notification UUID. The worker reloads recipient, locale,
preferences, template data, and status from PostgreSQL, sends through `LineNotificationService`,
and persists the actual provider outcome. The notification UUID is also the LINE
`X-Line-Retry-Key`. Timeouts, `429`, and `5xx` use bounded exponential retry with jitter and
`Retry-After`; provider validation `4xx` is permanent after Flex/text fallback.

**Consequences:** A Redis outage leaves durable rows undispatched and recoverable. A dispatcher
crash before enqueue is recovered after the dispatch-claim timeout; a crash after enqueue repeats
the same BullMQ job ID harmlessly. BullMQ waiting/active/delayed/failed state is operational, while
PostgreSQL dispatch and sent/retry/failed state remains authoritative. API queue/order transactions
never call LINE or Redis and therefore do not roll back when either service fails.

## ADR-032: SSE events are transient invalidation hints with Redis cross-replica fan-out

**Status:** accepted (2026-08-08)

**Context:** Polling remains authoritative but delays queue/ticket freshness and multiplies repeated
reads. Multiple API replicas cannot share process-local browser connections, while storing durable
queue truth or replay state in Redis would duplicate PostgreSQL authority.

**Decision:** Expose authenticated customer-ticket and branch-queue SSE endpoints backed by a
bounded in-process hub. Publish versioned minimal application events only after queue/order commits.
Use dedicated Redis Pub/Sub connections and tenant-scoped organization/branch/queue/ticket channel
names for cross-replica fan-out. Customer streams filter queue activity to their own ticket plus
queue-summary invalidations. Do not include customer contact, LINE identity, payment, or location
data. Streams use heartbeat, finite duration, disconnect cleanup, retry guidance, and global/per-user
limits. PostgreSQL-backed REST snapshots remain the only recovery and correctness source.

**Consequences:** Relevant events reach clients connected to another healthy API replica without
making Redis durable. Duplicate, reordered, and missed events are expected and harmless because the
centralized React client invalidates and refetches REST. It shares connections, uses bounded
reconnect/auth handling, closes private streams on lifecycle/session termination, and retains
polling as a degraded recovery path. Redis failure or SSE publication failure never rolls back a
business transaction; cross-replica freshness degrades until reconnect/recovery. Production proxy
hops must disable buffering and outlive the configured stream duration.

## ADR-033: OpenTelemetry and Sentry complement existing logs and metrics

**Status:** accepted (2026-08-09)

**Context:** Pino request IDs, health/readiness, process-local Prometheus metrics, PostgreSQL audit
logs, and durable outbox state already provide useful signals, but API/provider latency and
background notification work could not be correlated across process boundaries. Adding broad SDK
defaults could duplicate spans or export customer and credential data.

**Decision:** Keep Pino, health endpoints, audit logs, and existing metrics authoritative for their
current purposes. Enable optional OTLP/HTTP tracing for selected Node HTTP/Express, PostgreSQL,
ioredis, Undici, notification-dispatch, and notification-delivery boundaries. Propagate only W3C
trace headers in BullMQ jobs. Run Sentry in error-only mode beside the project-owned OTel provider,
with explicit browser/backend sanitizers and no default PII. Production browser source maps are not
served; any future upload must happen in trusted CI. Missing or failed exporters never affect
business execution.

**Consequences:** Operators can correlate request/worker logs by trace ID and follow dispatcher to
delivery spans while PostgreSQL remains the notification truth. Trace sampling is bounded and
configurable. Telemetry can be disabled in local/CI, and a collector or Sentry outage only reduces
visibility. Raw bodies, credentials, customer contact/LINE identity, exact coordinates, and
provider payloads are not observability data.

## ADR-034: S3-compatible media is server-mediated and production-default

**Status:** accepted (2026-08-09); production-default selection superseded by ADR-040

**Context:** The original media boundary validated and compressed uploads but stored production
objects on the API container filesystem. A container replacement could therefore lose uploaded
logos/product images, while adding direct browser uploads would introduce a second authorization
and validation path.

**Decision:** Keep the browser-to-API upload contract. `MediaService` validates bytes, pixels,
format, tenant ownership, and WebP compression before calling a storage adapter. Local and mock
providers remain available for development/tests; production selects the AWS SDK based
`S3CompatibleMediaStorage` with server-only credentials, generated keys, cache headers, and a
configured stable public/CDN base URL. `media_assets.storage_provider='object'` remains the
database contract, so no migration is required. Production Compose does not mount the API media
filesystem. Object deletion is attempted before metadata deletion, missing objects are idempotent,
and partial failures are recoverable through retry/reconciliation rather than silent metadata loss.

**Consequences:** API bandwidth remains the initial upload bottleneck, but validation and tenant
authorization stay centralized. Operators must configure bucket lifecycle/versioning, least
privilege, CDN/public access, scanning, backups, and a reviewed orphan grace-period process.
Signed direct upload and automated destructive orphan cleanup remain future work and are not part
of TASK-09.

ADR-040 supersedes only the production-provider selection and Compose-volume consequence. The
server-mediated adapter boundary and all S3 implementation, credential, key, failure, and cleanup
semantics remain accepted.

## ADR-035: Storybook is a development-only component review boundary

**Status:** accepted (2026-08-09)

**Context:** The multi-role SPA has reusable queue, ticket, status, product-picker, and LINE
friendship components with locale and responsive behavior that is expensive to review only through
full authenticated pages. The project already has Vitest, Testing Library, and Playwright; a
component environment should complement those layers rather than replace them.

**Decision:** Use Storybook 10.5.7 with the React/Vite framework in `apps/web/.storybook`. The
preview loads the existing Tailwind/global CSS and i18n resources, exposes Japanese/Vietnamese/
English locale controls and phone/desktop viewports, and provides deterministic Query and router
contexts. Stories are colocated beside real reusable components, while shared fixtures are kept in
`apps/web/src/storybook`. No story may call the production API, LINE, payment, Google Routes, or
object storage. `storybook:build` is the static review gate; the production SPA and Docker runtime
remain unchanged.

**Consequences:** Component state and Japanese long-copy layout can be reviewed quickly in
isolation, with existing unit/E2E tests retaining behavioral authority. Visual regression and
accessibility automation remain optional future work and are not introduced as a paid service.

## ADR-036: Horizontal readiness is proven with an isolated two-replica harness

**Status:** accepted (2026-08-09)

**Context:** Redis, BullMQ, SSE, observability, and object storage had deterministic component tests,
but package presence did not prove that two API replicas shared transient coordination correctly or
that dependency interruption preserved PostgreSQL business truth. Per-process PostgreSQL pool size
was also hard-coded, making aggregate connection budgeting implicit.

**Decision:** Keep production deployment separate and add a destructive, local-only validation
Compose topology: nginx balances two API replicas over shared PostgreSQL/Redis and a dedicated LINE
worker. A dependency-free Node runner measures the public read path and injects cache loss, Redis,
worker, API, and database interruption while checking shared authentication, rate limits,
cross-instance SSE, durable outbox recovery, readiness, metrics, and resource snapshots. External
LINE/S3/telemetry failures remain deterministic adapter tests so validation never contacts real
providers. PostgreSQL pool maximum and timeouts are explicit per-process environment values.

**Consequences:** The repository now has repeatable workstation evidence of horizontal behavior and
safe degradation, not a production capacity claim. Production replica counts must use an aggregate
database connection budget and staging soak/load evidence. The validation stack must never receive
production credentials or data, and it remains a manual engineering gate rather than a mandatory
Docker failure-injection step on every CI run.

## ADR-037: Production-oriented payment architecture uses an explicit demo runtime

**Status:** accepted (2026-08-11)

**Context:** TASK-PROD-002 established a server-authoritative PSP adapter, webhook, reconciliation,
and refund architecture. The current deployment is a production-oriented demonstration and has no
merchant account or approved real-money provider environment. Treating missing payOS credentials as
a fault in demo mode would misrepresent the intended deployment and encourage unsafe placeholder
secrets.

**Decision:** Keep `PAYMENT_MODE` as the single backend activation boundary. `demo` always selects
`DemoPaymentProvider`, performs no real PSP call, and is healthy without `PAYOS_*`. `external`
disables demo completion and requires the complete payOS credential set during configuration load.
Payment status remains derived only from signed server/provider evidence; the browser return path
cannot declare `paid` or `refunded`. Preserve the payOS adapter and provider-neutral refund,
idempotency, audit, and reconciliation boundaries for future activation.

**Consequences:** The current deployment processes no real money and needs no merchant credentials.
Real merchant onboarding, commercial/legal approval, production credentials, provider-side
real-money payment/refund acceptance, settlement, and operational reconciliation remain deferred
external gates. Enabling external mode is an explicit release action and fails safely when
configuration is incomplete.

## ADR-038: Platform operations health is a sanitized Admin read model

**Status:** accepted (2026-08-11)

**Context:** Public liveness/readiness and Prometheus metrics support infrastructure, but Platform
Admin lacked one approved UI for diagnosing database, Redis, worker, realtime, LINE, notification,
and payment runtime state. Directly exposing provider records or tenant rows would violate the
platform/tenant boundary.

**Decision:** Add an Admin-only `/admin/operations` surface backed by
`GET /api/v1/admin/operations/health`. Reuse PostgreSQL probes, Redis health, process metrics,
notification outbox aggregates, scheduler state, and the payment activation boundary. A dedicated
worker publishes only status and timestamp to a short-lived Redis heartbeat key. Responses use
stable status/reason codes and contain no tenant, customer, transaction, payload, or credential
data. Optional unconfigured integrations and the explicit demo payment runtime are not failures.

**Consequences:** Operators gain a lightweight deployment diagnostic without introducing a second
monitoring stack. Values are current-process or safe aggregate indicators, not enterprise SLOs.
Prometheus/logs/traces remain authoritative for detailed incident investigation; dashboard failure
cannot affect queue, order, notification, or payment business transactions.

## ADR-039: Manual environment-gated immutable-image CD

**Status:** superseded by ADR-043 (2026-08-12)

**Context:** The repository had a documented production Compose stack but its GitHub Actions CD
workflow was only a disabled placeholder. A release needs reproducible API/Web artifacts without
moving runtime credentials into CI or silently deploying every branch push.

**Decision:** Keep CD manual. The workflow requires an explicit `DEPLOY` confirmation, builds the
API and Web `runner` images from the selected commit, publishes immutable Docker Hub tags (the
tag is the full `git-<commit SHA>`), and pauses at the GitHub `production` environment approval. The
server connection uses a restricted SSH key and pinned known-hosts value, validates
`deploy/docker-compose.yml`, pulls the selected images, runs canonical migrations, waits for healthy
services, and probes Web health. Database, JWT, LINE, SMTP, payment, and storage values remain in
the server-side `deploy/.env`; the workflow never copies or logs them. Production is not triggered
by a normal push.

**Consequences:** This manual design established the environment gate and immutable artifact
boundary. ADR-043 later replaced manual dispatch as the normal trigger while retaining those
controls. Releases are auditable and rollback can select a previous immutable tag, while an
operator must supply Docker Hub/SSH configuration and approve each production deployment. Image
scanning, signed provenance, and staged sandbox deployment remain follow-up hardening rather than
hidden guarantees; ADR-041 and ADR-042 define the implemented backup and tag/rollback mechanics.

## ADR-040: Persistent VPS-local media for the production-oriented demo

**Status:** accepted (2026-08-11)

**Context:** The current deployment is a single-VPS production-oriented demo. Requiring an external
S3 account adds credentials, provider operations, and cost that are not necessary for this bounded
topology. Container-local writable storage is still unsafe because recreating the API container
would lose uploaded organization and product images.

**Decision:** Select `MEDIA_STORAGE_PROVIDER=local` in `deploy/.env.example`. Mount the production
Compose named volume `media_data` at the fixed API path `/app/var/media`, serve it through the
existing same-origin `/media/*` proxy, and require `MEDIA_LOCAL_DIR` when local storage runs in
production. Normal CD recreates services without deleting volumes. Validate the mount contract in
configuration tests and prove that a second non-root API container can read data written through
the same named volume. Retain `S3CompatibleMediaStorage` and its fail-fast credential validation as
an optional future/external provider; `S3_*` is required only when `s3` is explicitly selected.

**Consequences:** Uploaded media survives API container recreation and normal single-VPS redeploys
without an external object-storage dependency. Operators must monitor disk capacity, back up the
volume off-host, test media restore together with database metadata, preserve the Compose project
and volume name, and never use `docker compose down -v` during rollout. The volume is not shared
multi-host or high-availability storage; moving to S3/R2 later requires a reviewed data migration,
URL/rollback plan, provider security policy, and acceptance testing.

## ADR-041: Matched VPS snapshots and backup-gated deployment

**Status:** accepted (2026-08-12)

**Context:** PostgreSQL is the authoritative business store and the current production-oriented VPS
demo keeps uploaded media in a persistent local Docker volume. Manual database commands and an
independent media copy could create mismatched restore points, and the prior CD path could migrate
or recreate application services without first proving that recoverable data existed. Redis state
is disposable and does not justify backup complexity.

**Decision:** Keep versioned Bash tooling in `deploy/backup` and runtime snapshots in a restricted
absolute directory outside Git, defaulting to `/var/backups/line-smart-queue`. Briefly quiesce API
and worker writes, create a PostgreSQL custom-format dump plus local-media archive, record only
non-secret version/image metadata, checksum every artifact, and publish a completion marker only
after structural verification. Reject partial, corrupt, missing, or unsafe snapshots. Require exact
operator confirmation for destructive restore, keep Redis out of backup/restore, and keep image
rollback separate from data recovery. Release CD must run a verified pre-deployment backup before
pulling images or applying migrations and must never remove persistent volumes. ADR-043 later made
that CD path automatic after validated `main`; the backup gate itself is unchanged.

**Consequences:** Operators get repeatable backup, verify, list, restore, deploy, and rollback
commands with an isolated CI rehearsal and an auditable pre-deployment restore point. Deployment
briefly pauses writers during the matched snapshot. The VPS still needs disk monitoring,
business-approved RPO/RTO, encrypted off-host replication, scheduled production restore drills,
and separately protected/rotatable secrets. S3-compatible media remains optional and uses its own
provider backup/export controls when selected.

## ADR-042: Git-derived image publication and metadata-driven rollback

**Status:** accepted (2026-08-12)

**Context:** The deployment workflow could accept arbitrary image tags and transient shell exports,
so the server's `deploy/.env` could continue naming an old release after a successful recreate.
Local Windows publication also lacked one canonical command, and a moving `latest` tag cannot prove
which reviewed source produced a running or rollback image.

**Decision:** Derive every release identity from a lowercase Git SHA. GitHub CD uses `git-` plus
the full 40-character SHA and may also publish `latest` for discovery. The manual Windows
PowerShell publisher accepts no tag argument: it resolves `HEAD`, generates
`git-<12-character-sha>` for both API and Web, retains the full SHA in each OCI revision label,
pushes no `latest`, and prints the exact VPS handoff only after both pushes succeed. Its thin VPS
wrapper accepts exactly that 12-character form. The shared `deploy-safe.sh` backup gate accepts
only strict 12- or 40-character Git-derived tags so both publication paths remain compatible,
derives full references from untagged repository keys in the existing server environment, creates
and independently verifies a matched snapshot, then atomically persists only the two
image-reference keys before pull, canonical migration, recreate, and health checks.
Application rollback obtains both old references exclusively from verified snapshot metadata and
atomically persists them before recreation; data restore remains a separate confirmation.
The entry point rejects mixed-version deploy/backup tooling, selected values are parsed from the
server `.env` without sourcing it, and Compose ignores ambient release-image overrides. A legacy
running `latest` reference is converted to its matching registry digest during backup or the
release stops before mutation, preserving immutable rollback through the transition.

**Consequences:** Registry artifacts, live Compose configuration, and future operator commands
share one Git-derived immutable release identity, while OCI metadata preserves the full source SHA
for the shorter manual tag. A container recreate or host reboot no longer falls back to stale
`.env` refs, and rollback does not guess or follow `latest`. Repository namespace changes remain
explicit server configuration. Publication still needs registry access, the Web LIFF build value,
image retention, and future signing/scanning controls; the manual 12-character namespace has a
smaller collision margin than the full-SHA path, while automatic CD's mutable `latest` updates are
not atomic across both repositories. Neither can affect deployment selection.

## ADR-043: Automatic validated-main production release

**Status:** accepted (2026-08-12), amended (2026-08-13)

**Context:** Manual dispatch still required a developer to select and confirm a production source
revision, even though PR CI and immutable full-SHA artifacts already supplied the required release
identity. Triggering CD directly on a push could race CI or publish an unvalidated revision. The
initial split-job design placed image publication before approval and therefore required separate
repository-scoped Docker credentials.

**Decision:** Run PR CI only for pull requests targeting `main`, and run the same gates for the
resulting `main` revision. Trigger production CD through `workflow_run` only when the same
repository's `CI Quality Gates` succeeds on `main`. Check out `workflow_run.head_sha` for both image
builds and release tooling; derive API/Web `git-<full SHA>` tags from that value. Run image
publication and VPS deployment in one job protected by the `production` environment reviewer and
`main` deployment policy. Read Docker Hub and SSH credentials only after that approval, publish the
immutable images, then perform the backup-gated rollout in the same approved job. Serialize
releases with a non-canceling concurrency group. Protect `main` with PR, linear-history,
no-delete/no-force-push, up-to-date, and required-status-check rules. If a post-mutation deployment
step fails, automatically attempt application-only rollback from the just-verified snapshot while
leaving database/media restore separately confirmed. Keep the PowerShell publisher only for an
approved emergency/manual path.

**Consequences:** Merging a validated PR supplies the release SHA without operator tag entry,
local production builds, or step-by-step SSH deployment. PRs cannot deploy, failed main CI cannot
publish, and no Docker Hub or VPS mutation occurs before approval. One protected job avoids empty
environment secrets and repeated approval prompts, and one release cannot cancel another. GitHub
ruleset and environment policy remain external acceptance, and each actual merge/deploy still needs
retained CI, approval, backup, registry, and VPS health evidence. Automatic image rollback is not
database rollback; incompatible migrations still require a forward fix or explicitly approved data
restore.

**Amendment rationale (2026-08-13):** The operational environment already owned the Docker Hub PAT,
while repository secrets were intentionally empty. The earlier split job therefore received an empty
`DOCKERHUB_TOKEN`. Moving publication into the same protected job as deployment supersedes the
repository-scope credential choice without weakening validated-main, immutable-tag, backup, health,
rollback, or manual approval controls.

## OPT-001 cleanup audit (2026-08-11)

The audit compared source imports, package scripts/dependencies, executable migrations, the reset
schema, runtime notification event constraints, compatibility routes, tests, Docker references, and
canonical documentation before cleanup.

| Class    | Demonstrated finding                                                                                                                      | Decision                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `P0`     | Shared persisted enums omitted valid states or used values that PostgreSQL rejects.                                                       | Align queue, ticket, payment, penalty, and notification values; add an executable contract test. |
| `P1`     | Storybook required unsafe ticket-status casts because of the shared enum drift.                                                           | Use the aligned enum directly and expose the archived queue state in badge stories.              |
| `P1`     | `computeTotalPages`, unused operation-mode types, and two `callNextTicket` parameters had no remaining reference.                         | Remove them after repository-wide reference checks; preserve service boundaries and behavior.    |
| `P1`     | React Router v7 still installed the obsolete external React Router v5 type package.                                                       | Remove `@types/react-router-dom`; React Router v7 supplies its own declarations.                 |
| `P2`     | Several pages/services are large and contain multiple presentation/orchestration concerns.                                                | Defer measured decomposition to OPT-003 or a dedicated bounded task; no broad rewrite here.      |
| `Ignore` | LINE environment aliases, auth storage cleanup, compatibility redirects, migration history, and payment backfills contain legacy wording. | Retain them because they provide intentional deployment/data compatibility or historical truth.  |

This cleanup changes no route, authorization rule, transaction, tenant scope, payment authority,
notification delivery, session behavior, or production/demo configuration.

## OPT-002 backend performance audit (2026-08-11)

The audit reviewed public cached reads, booking/order transactions, customer tickets, Staff queue
overview, manager/owner aggregates, notification/ETA/location scans, existing indexes, cache
fallback, transaction duration, and per-process pool configuration. PostgreSQL remains authoritative;
no new dependency, infrastructure component, cache authority, or schema migration was justified.

| Finding                                                                                                                                                       | Evidence and decision                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff overview repeated complete queue reads and then issued one order query per preview entry.                                                               | Reuse `countLiveByQueueIds` to select the active queue, load only its bounded preview, and reuse `findByQueueEntries` for one order/item query. The maximum two-queue/eight-entry repository-read shape falls from 21 cold calls (19 with warm queue config) to six. |
| Location alerts held row locks and a transaction across sequential travel-provider calls.                                                                     | Claim up to the configured batch atomically with `SKIP LOCKED` and a recoverable timestamp lease; call the provider after commit; atomically enqueue/finalize each result in a short transaction.                                                                    |
| Existing indexes covered the measured bounded preview, order-item joins, and due-alert selection.                                                             | Representative rollback-only `EXPLAIN (ANALYZE, BUFFERS)` runs did not justify an additional index; preserve the current migration/schema.                                                                                                                           |
| Public read caches, correctness-critical booking locks, set-based analytics, outbox claims, and explicit pool limits had no demonstrated defect in this pass. | Retain them. Redis remains optional acceleration, every write and authorization decision remains PostgreSQL-backed, and production capacity still requires staging evidence.                                                                                         |

## OPT-003 frontend performance and UX audit (2026-08-11)

The audit reviewed the production Vite graph, route imports, TanStack Query defaults and explicit
polling, authenticated SSE reconciliation, repeated media, shared navigation, dialogs, responsive
browser coverage, localized labels, loading/error states, and keyboard/reduced-motion behavior.

| Finding                                                                                                                                                                         | Evidence and decision                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every page and role layout was synchronously imported from `router.tsx`.                                                                                                        | Split public, LIFF, Staff, Manager, and Admin modules with `React.lazy`; the eager page entry fell from 728.14 kB to 23.74 kB and uses one localized accessible loading state.                             |
| Vite forced every installed dependency into one 684.87 kB eager vendor chunk.                                                                                                   | Retain stable React/router/query/i18n/observability groups but allow route-only dependencies to follow their consumers. The 542.78 kB LIFF chunk is now loaded only for LIFF routes instead of every role. |
| Repeated catalog, order, and organization images decoded eagerly; the shared spinner ignored reduced-motion preference.                                                         | Use native lazy loading plus asynchronous decoding for repeated off-screen media, preserve eager identity imagery, and stop spinner animation under `prefers-reduced-motion`.                              |
| SSE-aware hooks already lower polling while connected and restore it when realtime degrades; navigation and dialog/browser coverage already exercises overflow and role access. | Preserve REST authority, current stale/refetch intervals, shared realtime lifecycle, navigation architecture, and workflow layout. No speculative query tuning or redesign was justified.                  |

Bundle sizes are local minified build evidence, not field-performance or capacity acceptance. No new
frontend framework, API behavior, authorization boundary, dependency, or database migration was
introduced.

## OPT-004 security boundary audit (2026-08-11)

The audit covered sessions and browser token storage; role, tenant, branch, queue, and customer
scope; LINE/payment webhooks; public writes and proxy-derived rate limits; media validation;
CORS/CSP/headers; secrets; and observability sanitization. Existing session replay, webhook
signature/idempotency, payment activation, upload, notification scope, and log/error sanitization
controls were retained and revalidated. No dependency vulnerability required remediation.

| Finding                                                                                                                              | Evidence and decision                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy generic user routes allowed Platform Admin to list tenant members, create/deactivate arbitrary users, and read any profile.   | Remove unused generic Admin user mutations/listing and enforce self-or-assigned-branch-Staff reads in the users service. Dedicated `/admin/*` organization and immutable-owner workflows remain the only approved Admin boundary. |
| User, owner recovery, and manager invitation services returned raw repository rows containing credential and internal actor columns. | Add one explicit safe user-response allowlist and apply it to every controller-visible path; regression tests reject `password_hash`, `invited_by`, and `deactivated_by`.                                                         |
| Rate-limit IP resolution independently trusted the left-most raw forwarded address.                                                  | Use only Express `req.ip`, which applies the configured trusted-proxy hop count, and test that a raw spoofed header cannot replace it.                                                                                            |

The hardening adds no WAF, SIEM, enterprise IAM, dependency, schema migration, or external runtime.

## OPT-005 final baseline audit (2026-08-11)

The closure audit compared README and canonical documents with routes, endpoint catalog,
migrations/reset schema, runtime configuration, Compose topology, CI gates, fixtures, browser
journeys, and the prior OPT-001 through OPT-004 evidence before changing the baseline.

| Class    | Demonstrated finding                                                                                                                                | Decision                                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P0`     | `deploy/.env.example` actively selected local media even though production Compose mounts no API media volume and canonical deployment requires S3. | Select S3 in the production template, expose required provider fields, remove misleading local paths, and make the config test match active lines rather than comments. |
| `P1`     | Project Context, Implementation Map, and Scalability headers stopped at OPT-002/003/004 despite later verified changes.                             | Consolidate their verification statements and production media topology at OPT-005 without rewriting historical measurements.                                           |
| `P2`     | README contained eighteen visible/hidden TODO markers for three optional illustrations repeated across three languages.                             | Keep visible placeholders but classify each asset as deferred and non-blocking; do not manufacture unapproved product imagery during closure.                           |
| `P2`     | Completed task plans remained beside the active task, and one referenced idea file was empty.                                                       | Mark completed plans explicitly historical and remove only the empty obsolete file; retain implementation evidence.                                                     |
| `Ignore` | Dependency review shows current-compatible patches and multiple major upgrades, but the audit reports no vulnerability requiring change.            | Freeze versions for the stable baseline; major framework/tool migrations require a separate evidence-backed task.                                                       |

The OPT-005 media row records the finding and decision made at that time. ADR-040 later supersedes
its S3-mandatory production selection after adding and validating the missing persistent API media
volume; the historical audit evidence is intentionally retained.

No source TODO/FIXME remains outside historical/task instructions after README classification.
Generated output, populated environment files, test reports, coverage, media, and local validation
artifacts are ignored and untracked. The final executable evidence map is maintained in
`docs/guide/DEMO_ACCEPTANCE.md`; external LINE, PSP, SMTP, maps, object-storage policy, legal,
backup/restore, staging soak, and release-operations acceptance remain intentionally deferred.
