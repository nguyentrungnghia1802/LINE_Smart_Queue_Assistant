# Future Product Ideas

This document proposes practical next capabilities for LINE Smart Queue Assistant. The order
prioritizes operational value, production readiness, and compatibility with the current modular
monolith before more experimental product expansion.

## 1. Notification Operations Center

- Build an operations dashboard over the existing durable LINE notification outbox.
- Show pending, processing, sent, failed, and cancelled deliveries without exposing message secrets.
- Allow authorized operators to filter by organization, branch, event type, status, and time range.
- Display safe failure categories such as blocked user, invalid recipient, timeout, rate limit, and provider outage.
- Keep raw access tokens, authorization headers, and sensitive provider payloads out of the UI.
- Add a detail view with event key, template locale, attempt count, timestamps, and ticket reference.
- Provide a guarded retry action only for retryable failed deliveries.
- Prevent manual retries from bypassing the existing idempotency event key.
- Add a cancel action for obsolete pending notifications when the related ticket is terminal.
- Surface delivery latency percentiles and failure-rate trends by notification type.
- Add alerts when the failed backlog or oldest pending age exceeds an operational threshold.
- Expose queue depth and worker heartbeat using the existing metrics and health boundaries.
- Restrict tenant managers to their own organization and platform admins to safe aggregate views.
- Record every retry and cancellation action in the audit log with the acting user.
- Use cursor or page-based pagination because the delivery table can grow quickly.
- Add retention and archival rules that preserve business evidence without retaining unnecessary PII.
- Start with read-only visibility, then enable manual recovery after audit and authorization tests pass.
- Add API, repository, UI, localization, and browser tests for empty, degraded, and large-backlog states.
- Define an operator runbook for LINE outages, invalid credentials, and exhausted retries.
- Acceptance target: support staff can diagnose a missed customer message without database access.

## 2. Production Payment, Refund, and Settlement Operations

- Complete one production payment provider through the existing payment gateway abstraction.
- Select the provider per launch market instead of embedding provider rules in order services.
- Support hosted checkout or provider QR while keeping payment success server-authoritative.
- Verify webhook signatures and timestamps before applying any payment transition.
- Preserve replay-safe provider event IDs and transaction state-machine rules.
- Implement provider-side full and partial refunds rather than only recording local refund state.
- Reconcile payment transactions against provider settlement reports on a scheduled basis.
- Add a branch-level payment operations screen for paid, pending, failed, refunded, and mismatched transactions.
- Show collected, refunded, fee, and expected-settlement amounts separately.
- Keep staff receipt totals aligned with verified net collected amounts.
- Add a guarded manual reconciliation action with mandatory reason and audit entry.
- Model permanent provider rejection separately from retryable network or rate-limit failures.
- Add idempotency keys for intent creation, webhook application, refund requests, and reconciliation.
- Encrypt provider credentials outside browser-visible configuration and rotate them operationally.
- Add sandbox end-to-end tests before enabling a provider for a production organization.
- Keep demo payment available only in explicit development or approved demonstration environments.
- Add settlement date, provider account, currency, and external reference fields where required.
- Document refund timing, provider fees, chargeback handling, and customer-facing support expectations.
- Roll out behind an organization capability flag with a safe fallback to manual collection.
- Acceptance target: accounting can explain every receipt and settlement from audited system records.

## 3. Service-Level Objectives and Operations Console

- Define measurable SLOs for booking latency, API availability, notification delay, and worker backlog.
- Build dashboards from existing metrics, OpenTelemetry traces, structured logs, and health endpoints.
- Separate platform-wide health from organization-specific operational indicators.
- Track p50, p95, and p99 latency for booking, queue transition, payment webhook, and LINE dispatch paths.
- Alert on sustained error-budget burn instead of isolated transient errors.
- Protect metrics endpoints and ensure observability data does not expose PII or credentials.
- Add release identifiers so regressions can be correlated with deployed API and web images.
- Show PostgreSQL pool pressure, Redis degradation, BullMQ heartbeat, and outbox backlog together.
- Add synthetic checks for public booking discovery, authenticated API health, and worker readiness.
- Include provider-specific availability for LINE, payment, email, maps, and object storage.
- Provide an incident timeline linked to safe request correlation IDs and deployment events.
- Define degraded behavior for Redis, telemetry, provider, and worker outages.
- Add an operator-facing status summary without exposing infrastructure details publicly.
- Document alert ownership, escalation paths, and recovery commands.
- Establish production baselines before changing capacity limits or removing polling fallbacks.
- Add load-test evidence for queue joins, call-next contention, and notification bursts.
- Validate dashboard accuracy against controlled failure-injection scenarios in staging.
- Retain audit and incident evidence according to an explicit operational retention policy.
- Review SLOs quarterly using real traffic rather than fixed assumptions.
- Acceptance target: an operator can detect, scope, and triage a customer-impacting incident quickly.

## 4. Calibrated Demand Forecasting and Staff Planning

- Evolve the current heuristic forecast using measured historical arrival and service-duration data.
- Keep the existing heuristic as a transparent fallback when confidence or data volume is insufficient.
- Measure forecast error by branch, queue, weekday, hour, season, and service category.
- Display confidence bands and sample size so managers understand prediction quality.
- Recommend staffing ranges rather than presenting a single false-precision number.
- Account for business hours, holidays, campaigns, cancellations, no-shows, and service mix.
- Separate walk-in queue demand from future appointment demand if appointments are introduced.
- Let managers record actual staffing so recommendations can be evaluated against outcomes.
- Add a weekly planning view with expected arrivals, workload minutes, and risk periods.
- Explain the main factors behind each recommendation in localized nontechnical language.
- Avoid sending customer identifiers or contact data to an external AI provider.
- Introduce a provider/model adapter only after an approved use case beats the heuristic baseline.
- Version every forecast model and store the version with generated recommendations.
- Add drift monitoring when actual wait times repeatedly exceed predicted ranges.
- Permit managers to acknowledge or override recommendations with an optional reason.
- Evaluate fairness so small branches are not penalized by sparse-data models.
- Run shadow predictions before any recommendation affects staffing decisions.
- Add tests for missing history, holiday closures, extreme spikes, and fallback behavior.
- Publish a monthly accuracy report for organization owners and product operators.
- Acceptance target: recommendations measurably reduce excessive waits without unnecessary staffing.

## 5. Organization-Specific LINE Channels and Branded Messaging

- Support an optional LINE Login and Messaging API configuration per organization.
- Preserve the current shared platform channel as a controlled fallback for smaller tenants.
- Route authentication, friendship state, notifications, Rich Menu, and deeplinks through one resolved channel context.
- Never select tenant credentials from browser-supplied organization identifiers alone.
- Encrypt channel credentials using a managed secret boundary rather than plain database fields.
- Add credential verification before an organization can activate its channel.
- Validate that LINE Login, LIFF, Messaging API, and Official Account belong to the intended setup.
- Provide a setup wizard with webhook, endpoint, Rich Menu, and friendship verification steps.
- Generate channel-specific LIFF links without reintroducing duplicated endpoint paths.
- Allow branded Flex colors, organization name, support details, and approved logo assets.
- Keep lifecycle wording and legal notices under platform-controlled templates.
- Add explicit channel status such as draft, verified, active, degraded, and revoked.
- Prevent one tenant from sending with or inspecting another tenant's channel.
- Add per-channel delivery metrics, quota visibility, and credential-expiry alerts.
- Make Rich Menu synchronization explicit and idempotent for each managed channel.
- Define migration behavior for active tickets when a tenant changes channels.
- Add mock adapters and contract tests so local development never contacts real LINE APIs.
- Record setup and credential-state changes in the tenant audit log without storing secret values.
- Roll out first to a small set of enterprise tenants with an operational support runbook.
- Acceptance target: each enabled organization owns its customer identity without weakening isolation.

## 6. Inventory Replenishment and Branch Transfer Workflow

- Extend branch inventory from quantity tracking into an auditable replenishment workflow.
- Add supplier references, reorder points, target stock, lead time, and package quantity per branch product.
- Generate low-stock suggestions from consumption velocity and configured lead time.
- Let branch managers create draft purchase requests for organization-owner approval.
- Track requested, approved, ordered, partially received, received, cancelled, and closed states.
- Record every receipt as a stock movement rather than directly overwriting quantity.
- Support branch-to-branch transfers with source reservation and destination receipt confirmation.
- Prevent transfers from consuming stock already reserved by active customer orders.
- Store movement reason, actor, branch, product, quantity, timestamp, and related document reference.
- Provide discrepancy handling for damaged, missing, expired, or incorrectly delivered inventory.
- Add cycle-count sessions with expected, counted, and adjusted quantities.
- Require an audit reason and appropriate permission for manual stock adjustments.
- Show projected stockout date and urgent items in the branch product workspace.
- Keep organization owners able to compare stock health without editing branch quantities directly.
- Add CSV export/import only through validated templates and staged preview.
- Preserve nullable unlimited inventory for services and non-stock catalog entries.
- Add transaction and concurrency tests for receipts, transfers, reservations, and cancellations.
- Add reconciliation reports linking completed orders to inventory consumption.
- Start without supplier API integration; add adapters only after the internal workflow is stable.
- Acceptance target: every finite-stock change can be explained from a business movement record.

## 7. Appointment and Walk-In Queue Orchestration

- Add optional future appointment slots alongside the existing same-day queue workflow.
- Let each queue choose walk-in only, appointment only, or a controlled hybrid policy.
- Reuse branch calendars, queue products, service durations, verified LINE identity, and payment rules.
- Calculate slot capacity from configured service time, staff availability, and branch hours.
- Keep appointments distinct from active queue tickets until the configured check-in window.
- Send reminder and check-in notifications through the existing durable LINE outbox.
- Allow customers to reschedule or cancel within organization-defined policy windows.
- Verify payment and refund rules server-side when a paid appointment changes.
- Add an arrival check-in action through LIFF, branch QR, or staff confirmation.
- Convert checked-in appointments into queue entries using an explicit priority policy.
- Prevent double booking under concurrent slot reservations with transactional capacity checks.
- Release abandoned draft slots after a short reservation timeout.
- Show staff one operational timeline for appointments, checked-in customers, and walk-ins.
- Explain expected service time and arrival instructions clearly in all three locales.
- Record no-show outcomes separately from ordinary queue absence penalties.
- Add organization and branch analytics for utilization, lateness, no-show, and reschedule rates.
- Preserve one stable branch QR; route customers to queue and appointment choices after discovery.
- Add accessibility and mobile E2E coverage for selecting dates, times, services, and payment.
- Pilot with service businesses where appointment demand is already operationally significant.
- Acceptance target: hybrid scheduling improves capacity use without delaying committed walk-ins unfairly.

## 8. Customer Feedback and Service Recovery

- Ask for lightweight feedback through LINE after a ticket reaches completed status.
- Use a short rating flow first, with optional categorized comments rather than a long survey.
- Link feedback to organization, branch, queue, completed order, and service period without exposing staff PII.
- Permit one response per completed booking group and make submission idempotent.
- Offer localized categories such as wait time, service quality, product quality, payment, and accessibility.
- Let customers opt out and respect existing notification preferences.
- Create a branch dashboard for rating trends, response rate, and recurring issue categories.
- Show organization owners comparative trends while protecting individual customer identity.
- Add a service-recovery workflow for low ratings with owner assignment, status, and resolution notes.
- Never send automated compensation without explicit policy and authorized approval.
- Allow a customer to request contact while clearly explaining what contact data will be shared.
- Add configurable escalation thresholds for repeated low ratings or severe categories.
- Record every internal status change in the audit log.
- Exclude free-text feedback from high-cardinality metrics and sanitize it before logging.
- Define retention, deletion, and moderation policies before collecting long-form comments.
- Add rate limiting and abuse protection for public feedback endpoints.
- Separate operational feedback from public reviews; do not publish customer content automatically.
- Correlate aggregate ratings with wait-time accuracy and cancellation metrics for improvement analysis.
- Add tests for authorization, duplicate submissions, locale fallback, opt-out, and terminal-ticket checks.
- Acceptance target: managers can identify recurring service problems and document a timely response.
