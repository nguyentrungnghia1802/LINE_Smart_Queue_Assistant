# Product Requirements

## 1. Scope and terminology

The system manages tenant organizations, LINE-authenticated customer reservations/orders, queue tickets, payment state, inventory, LINE communication, and operational dashboards. A first reservation creates an `order` and `queue_entry`. Additional items from the same verified LINE customer in the same queue extend that active order/ticket until it becomes terminal; reservations in another queue or after completion remain independently auditable.

Status labels in this document mean:

- **Implemented**: reachable runtime behavior exists.
- **Partial**: a useful subset exists, but production requirements remain.
- **Planned**: schema or design may exist, but no complete runtime flow exists.

## 2. Actors and authorization

| Actor                       | Scope                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------- |
| Customer entry              | Public branch QR/catalog resolution followed by automatic LINE/LIFF authentication    |
| Authenticated LINE customer | LIFF booking, verified LINE identity, ticket view, and notification eligibility       |
| Staff                       | Operational data and actions for exactly one assigned queue in one active branch      |
| Branch manager              | Queues, staff, QR, hours, payments, and operations for exactly one assigned branch    |
| Organization owner manager  | Organization catalog, branch/manager lifecycle, audit, and aggregate performance      |
| Platform admin              | Application review, tenant deactivation, and organization-owner account recovery only |
| Business applicant          | Public product discovery and organization service application                         |
| Scheduler/system            | ETA updates, notification scans, and counter resets                                   |

The platform role does not replace tenant membership. Staff and branch-manager operations must
verify the organization and the exact active branch assignment. The immutable organization owner
is represented by an active manager membership with `is_owner = TRUE`; it is not a second global
role and does not use branch-operation endpoints.

## 3. Functional requirements

### Authentication and profile

| ID          | Requirement                                                                                                   | Status      |
| ----------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-AUTH-001 | Authenticate staff/manager/admin by email and password and issue JWT access                                   | Implemented |
| FR-AUTH-002 | Authenticate a customer from a LINE LIFF ID token after server verification                                   | Implemented |
| FR-AUTH-003 | Link one LINE account to one platform user and preserve the LINE user ID                                      | Implemented |
| FR-AUTH-004 | Allow the authenticated user to view/update supported profile fields                                          | Implemented |
| FR-AUTH-005 | Persist preferred locale with organization/client/Japanese fallback                                           | Implemented |
| FR-AUTH-006 | Automatically initialize LIFF login and exchange ID token for system JWT                                      | Implemented |
| FR-AUTH-007 | Store LINE-verified customer email when the optional email claim is available                                 | Implemented |
| FR-AUTH-008 | Use LINE-only customer login and email/password only for business roles                                       | Implemented |
| FR-AUTH-009 | Provide a paired frontend/backend LIFF mock identity only in local development                                | Implemented |
| FR-AUTH-010 | Keep the login entry responsive and visually balanced across access paths                                     | Implemented |
| FR-AUTH-011 | Block authenticated business roles from QR booking and direct queue admission                                 | Implemented |
| FR-AUTH-012 | Require a verified LINE-derived customer JWT for payment intent and booking                                   | Implemented |
| FR-AUTH-013 | Use 15-minute access tokens with revocable rotating server-side sessions                                      | Implemented |
| FR-AUTH-014 | Expire business sessions after 15 idle minutes or 12 total hours                                              | Implemented |
| FR-AUTH-015 | Allow LINE customer sessions to resume for at most 30 days                                                    | Implemented |
| FR-AUTH-016 | Allow active admin, manager, and staff accounts to change their password after verifying the current password | Implemented |
| FR-AUTH-017 | Refresh an expired access token once, retry the request, and end an invalid session without redirect loops    | Implemented |

### Organization administration

| ID         | Requirement                                                                                                                                                                                  | Status                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| FR-ORG-001 | Admin sees an organization list, not an implicit single-organization editor                                                                                                                  | Implemented                                |
| FR-ORG-002 | Admin opens a separate detail view for full organization information                                                                                                                         | Implemented                                |
| FR-ORG-003 | A business submits a public service application with work email, plan, demo payment, plan-fit guidance, and receipt email                                                                    | Implemented                                |
| FR-ORG-004 | Admin approves or rejects applications but does not manually register new organizations; rejection sends an applicant email                                                                  | Implemented                                |
| FR-ORG-005 | The system generates a unique organization slug and one public QR token per branch                                                                                                           | Implemented                                |
| FR-ORG-006 | Branch manager edits only their assigned branch settings and business calendar                                                                                                               | Implemented                                |
| FR-ORG-007 | Branch stores location, business hours, holiday rules, and provider configuration                                                                                                            | Implemented; real provider secrets pending |
| FR-ORG-008 | Branch-manager print/copy actions prefer LIFF QR and expose public web booking as fallback                                                                                                   | Implemented                                |
| FR-ORG-009 | Approval atomically creates an inactive organization, invited owner, activation action, and email outbox row; it creates no branch/queue                                                     | Implemented                                |
| FR-ORG-010 | Public organization applications never accept or store account credentials                                                                                                                   | Implemented                                |
| FR-ORG-011 | Owner creates/edits branches with at least one active or invited branch manager; pending invites may be revoked while one retained assignment remains; assigned managers create queues later | Implemented                                |
| FR-ORG-012 | Owner dashboard shows organization revenue, branch count, best/worst branch, trend, and branch detail                                                                                        | Implemented                                |
| FR-ORG-013 | Owner navigation excludes branch product, queue, staff, and QR operations                                                                                                                    | Implemented                                |
| FR-ORG-014 | Branch creation enforces the selected subscription plan; Standard permits at most three active branches                                                                                      | Implemented                                |
| FR-ORG-015 | Management lists provide localized search and stable visible row numbers                                                                                                                     | Implemented                                |
| FR-ORG-016 | Branch settings store non-secret payment acceptance details separately from organization settings                                                                                            | Implemented; real PSP pending              |
| FR-ORG-017 | Owner manager can permanently delete a branch and all branch-owned operational data atomically while retaining audit evidence                                                                | Implemented                                |
| FR-ORG-017 | The public product site presents the service, solutions, and plans through a responsive editorial layout with a muted video hero, service imagery, and smooth section navigation             | Implemented                                |
| FR-ORG-018 | Platform admin may change only the owner manager sign-in email for account recovery; display name, password, status, and other tenant accounts remain outside admin scope                    | Implemented                                |
| FR-ORG-019 | The public product footer exposes the dedicated `support@smartqueue.io.vn` address as a working email link                                                                                   | Implemented                                |

### Catalog and inventory

| ID         | Requirement                                                                                            | Status                                  |
| ---------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| FR-CAT-001 | Organization owner creates, edits, and deactivates the shared organization product/service catalog     | Implemented                             |
| FR-CAT-002 | Catalog stores translatable name/description, image, type, price, duration, and prepayment requirement | Implemented                             |
| FR-CAT-003 | Each branch stores nullable stock and a low-stock threshold; `NULL` means unlimited                    | Implemented                             |
| FR-CAT-004 | Customer cannot choose inactive/out-of-stock products or quantity above selected-branch stock          | Implemented in UI and transaction guard |
| FR-CAT-005 | Selected-branch finite stock is changed atomically when the order succeeds                             | Implemented                             |
| FR-CAT-006 | Cancellation/expiry restores finite stock to the same branch exactly once                              | Implemented                             |
| FR-CAT-007 | Branch managers select organization-catalog products for each assigned-branch queue                    | Implemented                             |
| FR-CAT-008 | Product/service codes are unique per organization and generated as `SPn`/`DVn`                         | Implemented                             |

### Booking, ordering, and payment

| ID          | Requirement                                                                                                                                      | Status                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| FR-BOOK-001 | Customer enters through a branch QR token or organization fallback route                                                                         | Implemented                                             |
| FR-BOOK-002 | Customer selects quantities and supplies name/phone where required                                                                               | Implemented                                             |
| FR-BOOK-003 | An order can be placed without payment when no selected item requires prepayment                                                                 | Implemented                                             |
| FR-BOOK-004 | When required items exist, checkout is mandatory before order creation                                                                           | Implemented                                             |
| FR-BOOK-005 | Inside checkout, customer chooses required-items-only or full-order payment                                                                      | Implemented                                             |
| FR-BOOK-006 | Returning from checkout preserves form/cart/payment state                                                                                        | Implemented with browser draft plus server transaction  |
| FR-BOOK-007 | Successful order stores item-level payment and full-order payment accurately                                                                     | Implemented for server-verified transactions            |
| FR-BOOK-008 | A repeat booking from the same verified LINE user in the same active queue extends the existing order/ticket atomically                          | Implemented                                             |
| FR-BOOK-009 | LIFF booking uses the current authenticated LINE identity and redirects to LIFF ticket view                                                      | Implemented                                             |
| FR-BOOK-010 | A branch QR resolves all active branch queues; customer selects one through a compact dropdown before its catalog                                | Implemented                                             |
| FR-BOOK-011 | Customer product cards expose a full localized detail view before quantity selection                                                             | Implemented                                             |
| FR-BOOK-012 | LIFF Home uses LINE `scanCodeV2` first, validates the decoded branch route, and retains a browser-camera fallback                                | Implemented                                             |
| FR-PAY-001  | Demo mode completes through a server-verified provider without real money, real PSP credentials, or real PSP calls                               | Implemented; current deployment                         |
| FR-PAY-002  | An explicitly enabled production provider creates a server-side payment intent and redirects securely; missing required credentials fail startup | payOS VND adapter retained; external acceptance pending |
| FR-PAY-003  | Webhook verification is authoritative for paid/refunded/failed status                                                                            | Implemented for demo and signed payOS callbacks         |
| FR-PAY-004  | Staff records final payment and prints a scoped receipt with subtotal, prepaid amount, balance, operator, branch, queue, and time                | Implemented                                             |
| FR-PAY-005  | Cancelling a paid order/ticket automatically refunds every collected transaction                                                                 | Implemented for demo/manual providers; real PSP pending |
| FR-PAY-006  | Staff payment summaries and receipts show every net amount already collected, including full-cart checkout on items without mandatory prepayment | Implemented                                             |
| FR-PAY-007  | Provider selection is server-configured; browser callback or local state can never declare a payment paid/refunded                               | Implemented                                             |

### Queue and staff operation

| ID           | Requirement                                                                                                                   | Status                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| FR-QUEUE-001 | Successful booking creates a ticket in the selected active queue of the resolved branch                                       | Implemented                     |
| FR-QUEUE-002 | Customer sees ticket code, stable order number, status, people ahead, ETA, order items, and payment                           | Implemented                     |
| FR-QUEUE-003 | Staff sees the next eight active customers, stable order number, total active count, contact data, and a responsive workspace | Implemented                     |
| FR-QUEUE-004 | Completion automatically calls the next eligible customer when no ticket is already called                                    | Implemented                     |
| FR-QUEUE-005 | Queue ticket counter resets daily                                                                                             | Implemented with UTC limitation |
| FR-QUEUE-006 | Queue capacity remains strict under concurrent joins                                                                          | Partial                         |
| FR-QUEUE-007 | Branch manager creates and configures multiple named queues, status, prefix, capacity, timing, and rules                      | Implemented                     |
| FR-QUEUE-008 | Staff can move a called absent customer back three slots; the third absence cancels and refunds the booking                   | Implemented                     |
| FR-QUEUE-009 | Staff related-booking context includes only active queue tickets and excludes completed history                               | Implemented                     |
| FR-QUEUE-010 | A branch may temporarily have no queue during setup or reconfiguration                                                        | Implemented                     |
| FR-QUEUE-011 | Booking is accepted only while both the branch calendar and selected queue status are open                                    | Implemented                     |
| FR-QUEUE-012 | An idle queue automatically calls its earliest waiting ticket after booking or a transition frees the active slot             | Implemented                     |
| FR-QUEUE-013 | Branch-manager queue cards and detail show live active customer depth separately from the daily ticket sequence counter       | Implemented                     |
| FR-QUEUE-014 | Each active Staff member is assigned to exactly one active queue; a queue may be assigned to multiple Staff members           | Implemented                     |

### LINE and notifications

| ID          | Requirement                                                                                                         | Status                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| FR-LINE-001 | Messaging API sends a LINE chat message when the turn approaches                                                    | Implemented for authenticated LINE-linked tickets with durable delivery |
| FR-LINE-002 | Messaging API sends called/completed and exceptional deferred/cancelled/no-show messages                            | Implemented on authenticated LINE-linked tickets with durable delivery  |
| FR-LINE-003 | Queue state remains successful even if LINE delivery fails                                                          | Implemented                                                             |
| FR-LINE-004 | Delivery is durable and deduplicated across restarts/replicas                                                       | Implemented                                                             |
| FR-LINE-005 | Follow/unfollow link state is persisted                                                                             | Implemented                                                             |
| FR-LINE-006 | Consent/preferences and opt-out controls are user-manageable                                                        | Implemented                                                             |
| FR-LINE-007 | LINE notification links open the correct LIFF ticket detail                                                         | Implemented                                                             |
| FR-LINE-008 | Ticket lifecycle notifications use a common Flex Message with text fallback                                         | Implemented                                                             |
| FR-LINE-009 | Booking success sends a LINE ticket notification when the entry has a verified LINE recipient                       | Implemented                                                             |
| FR-LINE-010 | LINE Rich Menu opens LIFF Home, booking start, current ticket resolution, and usage guidance                        | Implemented in code; LINE Console/E2E sync pending                      |
| FR-LINE-011 | Rich Menu synchronization is explicit, idempotent, mockable, and never runs on API startup                          | Implemented                                                             |
| FR-LINE-012 | The standard approaching-turn notification is durably enqueued at exactly five people ahead                         | Implemented                                                             |
| FR-LINE-013 | LIFF detects a missing Official Account friendship and offers an in-app Add/Unblock action                          | Implemented; real-device acceptance pending                             |
| FR-LINE-014 | Authorized operators can diagnose scoped delivery failures and safely retry/cancel eligible rows without SQL access | Implemented                                                             |

Notification operations authorization is server-derived: platform Admin and Organization Owner do not have access. A Branch Manager can manage notifications for all queues in their single active branch and can cancel obsolete notifications. Staff can manage notifications only for their assigned queue and cannot cancel them. The UI never receives raw notification payloads, unmasked LINE IDs, provider headers, or credentials. Retry is limited to retryable `failed` deliveries; cancellation is limited to `pending` deliveries whose related ticket is already terminal. Both actions require a reason and are audited.

### Location, prediction, and analytics

| ID         | Requirement                                                                                | Status                                      |
| ---------- | ------------------------------------------------------------------------------------------ | ------------------------------------------- |
| FR-LOC-001 | With consent, capture active-ticket customer coordinates and calculate walking travel time | Implemented; Google credentials/E2E pending |
| FR-LOC-002 | Warn when longest walking route plus eight minutes exceeds the current queue ETA           | Implemented through durable LINE delivery   |
| FR-AI-001  | Estimate wait from queue position/workload and configured service time                     | Implemented heuristic                       |
| FR-AI-002  | Persist forecast history with confidence/model metadata                                    | Implemented as measured heuristic           |
| FR-AI-003  | Analyze historical load and recommend staff by weekday/hour                                | Implemented measured heuristic              |
| FR-AN-001  | Branch manager sees assigned-branch revenue trend, top-three catalog items, and top staff  | Implemented                                 |
| FR-AN-003  | Owner manager sees organization aggregates and per-branch revenue/cancellation performance | Implemented                                 |
| FR-AN-002  | Admin sees plan adoption and platform subscription revenue without tenant customer revenue | Implemented                                 |

## 4. Business rules

| Rule            | Definition                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-TENANT-001   | Every tenant-owned read/write must be restricted to the actor's organization.                                                                                                      |
| BR-TENANT-002   | A branch manager command is restricted to its active branch; a Staff command is additionally restricted to its single assigned queue. Request-body tenant IDs are never authority. |
| BR-ORG-001      | `slug` and generated `public_qr_token` are globally unique. QR token is not user-entered.                                                                                          |
| BR-ORG-002      | Application approval and initial manager membership succeed or fail in one transaction.                                                                                            |
| BR-ORG-003      | Public applicants do not choose tenant slug or QR token; both are generated only after approval.                                                                                   |
| BR-ORG-004      | Application location count and active branch count cannot exceed the subscribed plan; Starter is limited to one branch and Standard to three branches.                             |
| BR-USER-001     | The applicant supplies a valid work email; the system never invents the manager email address.                                                                                     |
| BR-USER-002     | Approval issues a single-use owner activation action; the invited owner chooses a password only on the activation endpoint.                                                        |
| BR-USER-003     | One normalized email identifies only one platform account and cannot be assigned multiple roles.                                                                                   |
| BR-QUEUE-001    | Only an open/active queue accepts new tickets.                                                                                                                                     |
| BR-QUEUE-002    | A queue entry follows only allowed state transitions; terminal entries cannot return to waiting.                                                                                   |
| BR-QUEUE-003    | Calling next selects the earliest eligible waiting ticket and must not call two tickets through one race.                                                                          |
| BR-QUEUE-004    | Notification failure must never roll back an already committed queue transition.                                                                                                   |
| BR-QUEUE-005    | Auto-call selects at most one next waiting ticket and does not call another while a ticket is called or serving.                                                                   |
| BR-QUEUE-006    | Deferring a called ticket preserves its ticket code and moves it back three waiting slots; the third absence cancels and refunds it.                                               |
| BR-QUEUE-007    | A branch may have zero active queues during setup, and active queue names are unique within that branch.                                                                           |
| BR-QUEUE-008    | Products selected for an order/payment must be active and assigned to the selected queue and branch.                                                                               |
| BR-QUEUE-009    | Branch weekly hours and exception dates gate customer payment and booking independently of queue status.                                                                           |
| BR-ORDER-001    | Server prices and product ownership are authoritative; browser totals are advisory only.                                                                                           |
| BR-ORDER-002    | Order, queue entry, items, payment transaction, stock change, and reservation are atomic.                                                                                          |
| BR-ORDER-003    | The same verified LINE customer has one active order/ticket per queue; additional items extend it without consuming queue capacity or another ticket number.                       |
| BR-ORDER-004    | Different queues and terminal historical orders remain separate; completed/cancelled/no-show records are excluded from active Staff and customer summaries.                        |
| BR-ORDER-005    | Receipt scope and fulfillment identity are stored as immutable order snapshots.                                                                                                    |
| BR-STOCK-001    | Branch inventory `stock_quantity IS NULL` is unlimited; finite branch stock cannot become negative.                                                                                |
| BR-STOCK-002    | A finite item is unavailable when requested quantity exceeds stock in the selected branch.                                                                                         |
| BR-PAY-001      | Every selected `requires_prepayment` product ID must be in the paid coverage set before booking.                                                                                   |
| BR-PAY-002      | Order is `paid` only when all selected items are covered; required-only payment leaves the order `unpaid`.                                                                         |
| BR-PAY-003      | Payment success comes from verified provider callback or server-side provider verification, never a browser flag.                                                                  |
| BR-PAY-004      | Customer or operator cancellation refunds every collected transaction idempotently before the cancellation transaction commits.                                                    |
| BR-CUSTOMER-001 | Customer name and a valid Japanese telephone number are required for order creation.                                                                                               |
| BR-LINE-001     | A LINE push requires a verified/linkable recipient LINE user ID and a configured Messaging API token.                                                                              |
| BR-LINE-002     | Login and Messaging API are separate LINE channels/capabilities and must be configured consistently.                                                                               |
| BR-LINE-003     | Public request bodies must not assert a LINE user ID; derive the recipient from a verified LINE account.                                                                           |
| BR-LINE-004     | LIFF booking must wait for the LINE-derived system JWT before creating order/queue records.                                                                                        |
| BR-LINE-005     | Rich Menu areas must open LIFF routes that can resolve the current customer context, not fixed ticket IDs.                                                                         |
| BR-LINE-006     | The application may prompt for Official Account friendship but must not claim or simulate consent; booking remains available when the customer declines.                           |
| BR-AUTH-001     | Public QR and slug routes are discovery/redirect entries; payment intent and booking require a verified LINE customer JWT.                                                         |
| BR-AUTH-002     | A blocked business session remains active; opening customer LIFF is an explicit action that establishes a separate customer session.                                               |
| BR-AUTH-003     | Email/password login cannot issue a customer session; local customer testing uses the mock ID-token exchange.                                                                      |
| BR-AUTH-004     | Admin, manager, and staff activity refreshes the server session; 15 idle minutes ends it even when a browser still has UI state.                                                   |
| BR-AUTH-005     | Customer refresh sessions have a 30-day absolute limit and never bypass fresh LINE-link verification performed by authenticated requests.                                          |
| BR-AUTH-006     | A successful business-account password change revokes every active session for that user and requires sign-in with the new credential.                                             |
| BR-AUTH-007     | An unrecoverable browser session clears in-memory credentials, user state, and private query cache, then redirects once with a localized sign-in notice.                           |
| BR-PRIVACY-001  | Location is optional, consent-based, purpose-limited, and must have a retention/deletion policy.                                                                                   |

## 5. Core acceptance criteria

1. A LINE-authenticated customer selecting only non-prepaid items can place a reservation without checkout and receives an order/ticket.
2. A LINE-authenticated customer selecting a prepaid item cannot create an order until all prepaid-required products are covered.
3. Required-only checkout marks covered order items paid; the order remains unpaid only when
   uncovered items remain in the cart.
4. Full checkout marks every item and the order paid from one verified payment transaction.
5. Concurrent finite-stock orders cannot reduce stock below zero; a failed order leaves no partial ticket/order/item rows.
6. Staff actions cannot access an entry/order in another organization.
7. Staff state changes for a LINE-linked customer send locale-aware queue messages without reverting queue state on delivery failure.
8. LINE ticket notifications contain the system name, ticket code, status, people ahead, ETA, next action, and a LIFF ticket button; text fallback remains available.
9. Rich Menu buttons open `/liff/home`, booking start, current ticket resolution, and usage guidance without hard-coded entry IDs.
10. Admin approval of a paid pending application creates the inactive organization, invited owner,
    inactive membership, activation action, and email outbox together without creating a branch or queue.
11. All primary pages remain usable at mobile and desktop widths. Business-role destinations stay
    visible in the desktop header and in an icon-labelled mobile bottom navigation; dense queue,
    product, user, form, and modal surfaces reflow without page-level horizontal overflow. Copy
    uses `ja`, `vi`, or `en` resources with Japanese fallback.
12. Health/readiness clearly distinguish a live process from a usable database connection.
13. A staff, manager, or admin opening a QR booking page cannot create a booking or direct queue ticket with that business JWT, can return to their own dashboard, and is offered the current QR route in LINE LIFF.
14. After a successful booking, reopening the same QR/LIFF entry starts a clean booking attempt.
    Booking history remains available, but the consumed payment reference, cart, and customer-input
    draft are not reused.
15. A prepaid checkout launched from the booking button automatically creates the booking after
    verified payment succeeds; the customer does not need to press the booking button twice.
16. Staff completion advances the queue automatically. The completed receipt remains in a modal
    until Staff prints it or confirms moving on, while terminal history does not appear in the
    active working context.
17. Cancelling a paid booking from either the customer or staff path records an idempotent automatic
    refund in the same database transaction as the cancellation.

## 6. Non-functional requirements

- Security: OWASP-aligned headers, validation, rate limiting, secret separation, webhook signatures, least privilege.
- Reliability: transactional writes, idempotency on retried public writes/payment updates, durable LINE retry, and production operator visibility for failed deliveries.
- Performance: indexed tenant/queue/status paths; avoid N+1 catalog/order reads; define load SLOs before launch.
- Accessibility: semantic controls, keyboard operation, visible focus, sufficient contrast, reduced-motion support.
- Privacy: minimize LINE/location/payment payloads and define retention/deletion/audit rules.
- Observability: structured request logs, request IDs, health/readiness, metrics, notification/payment audit without secrets.
- Localization: Japanese default plus Vietnamese/English copy and locale-aware Intl formatting with Japan-oriented defaults.

## 7. Error behavior

- Validation errors return `422 VALIDATION_ERROR` with field details.
- Every editable form applies field-appropriate browser limits and API validation. Invalid values
  are reported beside the exact input, including nested collection paths such as
  `managers.0.email`. A field displays only its first actionable error at a time to preserve a
  compact layout; browser limits improve usability but never replace server validation.
- Missing authentication returns `401`; insufficient role/tenant ownership returns `403`.
- Missing resources return `404`; state/stock/idempotency conflicts return `409` where applicable.
- Third-party delivery failure is logged and retried according to its workflow; it must not expose provider secrets.
- The UI preserves safe customer input after recoverable errors and shows localized recovery actions with Japanese fallback.
- The login UI prefers a backend-supplied safe error message when available; otherwise it falls back to localized network/auth/validation/server messaging.

## 8. Management usability

- Long organization, application, product, and staff lists paginate at 15 rows per page. Sequence
  numbers remain stable across pages and are left-aligned for fast scanning.
- Management tables keep sequence, code, price, status, and action columns at stable widths without
  wrapping. Descriptive columns may use the remaining space and truncate oversized values with the
  complete value available on hover. Narrow screens use the corresponding card layout instead of
  compressing desktop actions into unreadable rows.
- Authenticated navigation keeps the account name readable without an avatar: long names use a
  smaller label, wrap to at most two lines, and only then truncate. The account trigger and chevron
  retain stable dimensions across supported viewport sizes.
- Organization applications are presented as compact rows containing sequence, organization,
  submission time, plan, and status only; selecting a row opens the full review and approval
  workspace.
- Branch managers can maintain weekly business hours and persisted full-day exception closures. A
  selected closure is visibly marked and applies in the branch timezone (Asia/Tokyo by default).
  The compact holiday calendar follows business hours, supports multiple dates, exact one-month
  navigation, and month focus from date search.
- Customer preferences provide an explicit logout action that revokes both the backend refresh
  session and local LIFF session. Logo uploads expose a clear selected/uploaded state instead of
  relying on browser file-input text. The native logo picker opens only from its explicit button,
  accepts PNG/JPEG/WebP up to 5 MB, and reports validation or upload failure in the settings form.
  Organization settings persist the safe media URL returned by the upload API; an oversized legacy
  data URL may remain readable for preview but is never resubmitted as an organization setting.
