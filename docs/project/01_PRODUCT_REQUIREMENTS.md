# Product Requirements

## 1. Scope and terminology

The system manages tenant organizations, public reservations/orders, queue tickets, payment state, inventory, LINE communication, and operational dashboards. A reservation creates a distinct `order` and `queue_entry`. Related repeat reservations may share a `booking_group` while remaining independently auditable.

Status labels in this document mean:

- **Implemented**: reachable runtime behavior exists.
- **Partial**: a useful subset exists, but production requirements remain.
- **Planned**: schema or design may exist, but no complete runtime flow exists.

## 2. Actors and authorization

| Actor                       | Scope                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------- |
| Customer/guest              | Public fallback organization, catalog, booking, checkout, and ticket views              |
| Authenticated LINE customer | Primary LIFF booking, verified LINE identity, ticket view, and notification eligibility |
| Staff                       | Operational data and actions for their active organization membership                   |
| Manager                     | Staff capabilities plus configuration and management for their organization             |
| Platform admin              | Cross-tenant organization and manager administration only                               |
| Scheduler/system            | ETA updates, notification scans, and counter resets                                     |

The platform role does not replace tenant membership. Staff and manager operations must verify both role and organization ownership.

## 3. Functional requirements

### Authentication and profile

| ID          | Requirement                                                                 | Status      |
| ----------- | --------------------------------------------------------------------------- | ----------- |
| FR-AUTH-001 | Authenticate staff/manager/admin by email and password and issue JWT access | Implemented |
| FR-AUTH-002 | Authenticate a customer from a LINE LIFF ID token after server verification | Implemented |
| FR-AUTH-003 | Link one LINE account to one platform user and preserve the LINE user ID    | Implemented |
| FR-AUTH-004 | Allow the authenticated user to view/update supported profile fields        | Implemented |
| FR-AUTH-005 | Keep public QR booking available without mandatory account login            | Implemented |
| FR-AUTH-006 | Automatically initialize LIFF login and exchange ID token for system JWT    | Implemented |

### Organization administration

| ID         | Requirement                                                                             | Status          |
| ---------- | --------------------------------------------------------------------------------------- | --------------- |
| FR-ORG-001 | Admin sees an organization list, not an implicit single-organization editor             | Implemented     |
| FR-ORG-002 | Admin opens a separate detail view for full organization information                    | Implemented     |
| FR-ORG-003 | Admin registers an organization and initial Gmail manager atomically                    | Implemented     |
| FR-ORG-004 | Admin uploads/compresses a logo and never manually enters a QR token                    | Implemented     |
| FR-ORG-005 | The system generates a unique slug and public QR token                                  | Implemented     |
| FR-ORG-006 | Manager edits only their own organization settings                                      | Implemented     |
| FR-ORG-007 | Organization stores location, business hours, holiday rules, and provider configuration | Partial/Planned |

### Catalog and inventory

| ID         | Requirement                                                                                                   | Status                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| FR-CAT-001 | Manager creates, edits, deactivates, and deletes products/services                                            | Implemented                             |
| FR-CAT-002 | Catalog stores Japanese name/description, image, type, JPY price, duration, prepayment requirement, and stock | Implemented                             |
| FR-CAT-003 | `NULL` stock means unlimited; zero stock is unavailable                                                       | Implemented                             |
| FR-CAT-004 | Customer cannot choose inactive/out-of-stock products or quantity above stock                                 | Implemented in UI and transaction guard |
| FR-CAT-005 | Finite stock is changed atomically when the order succeeds                                                    | Implemented                             |
| FR-CAT-006 | Cancellation/expiry restores or releases finite stock exactly once                                            | Planned                                 |

### Booking, ordering, and payment

| ID          | Requirement                                                                                 | Status                                                  |
| ----------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| FR-BOOK-001 | Customer enters through organization slug or generated QR token                             | Implemented                                             |
| FR-BOOK-002 | Customer selects quantities and supplies name/phone where required                          | Implemented                                             |
| FR-BOOK-003 | An order can be placed without payment when no selected item requires prepayment            | Implemented                                             |
| FR-BOOK-004 | When required items exist, checkout is mandatory before order creation                      | Implemented                                             |
| FR-BOOK-005 | Inside checkout, customer chooses required-items-only or full-order payment                 | Implemented                                             |
| FR-BOOK-006 | Returning from checkout preserves form/cart/payment state                                   | Implemented with browser session storage                |
| FR-BOOK-007 | Successful order stores item-level payment and full-order payment accurately                | Implemented for creation; manual reconciliation partial |
| FR-BOOK-008 | Repeat bookings remain separate but can be grouped by customer/device                       | Partial; DB group and local browser history exist       |
| FR-BOOK-009 | LIFF booking uses the current authenticated LINE identity and redirects to LIFF ticket view | Implemented                                             |
| FR-PAY-001  | Demo mode completes automatically without paid third-party services                         | Implemented                                             |
| FR-PAY-002  | Production provider creates a server-side payment intent and redirects securely             | Planned                                                 |
| FR-PAY-003  | Webhook verification is authoritative for paid/refunded/failed status                       | Planned                                                 |
| FR-PAY-004  | Staff manually records final payment and prints receipt after success                       | Implemented/Partial                                     |

### Queue and staff operation

| ID           | Requirement                                                                          | Status                          |
| ------------ | ------------------------------------------------------------------------------------ | ------------------------------- |
| FR-QUEUE-001 | Successful booking creates a ticket in the organization's active queue               | Implemented                     |
| FR-QUEUE-002 | Customer sees ticket code, status, people ahead, ETA, order items, and payment       | Implemented                     |
| FR-QUEUE-003 | Staff sees a responsive queue list and a full-width selected booking workspace       | Implemented                     |
| FR-QUEUE-004 | Staff calls next, starts service, completes, marks no-show, or cancels valid tickets | Implemented                     |
| FR-QUEUE-005 | Queue ticket counter resets daily                                                    | Implemented with UTC limitation |
| FR-QUEUE-006 | Queue capacity remains strict under concurrent joins                                 | Partial                         |
| FR-QUEUE-007 | Manager configures queue status, prefix, capacity, timing, and operational rules     | Implemented                     |

### LINE and notifications

| ID          | Requirement                                                                                   | Status                                                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| FR-LINE-001 | Messaging API sends a LINE chat message when the turn approaches                              | Implemented for authenticated LINE-linked tickets; durable delivery remains planned                                               |
| FR-LINE-002 | Messaging API sends a LINE chat message when staff changes ticket state                       | Implemented for called/serving/completed/cancelled/no-show on authenticated LINE-linked tickets; durable delivery remains planned |
| FR-LINE-003 | Queue state remains successful even if LINE delivery fails                                    | Implemented                                                                                                                       |
| FR-LINE-004 | Delivery is durable and deduplicated across restarts/replicas                                 | Planned                                                                                                                           |
| FR-LINE-005 | Follow/unfollow link state is persisted                                                       | Implemented                                                                                                                       |
| FR-LINE-006 | Consent/preferences and opt-out controls are user-manageable                                  | Planned                                                                                                                           |
| FR-LINE-007 | LINE notification links open the correct LIFF ticket detail                                   | Implemented                                                                                                                       |
| FR-LINE-008 | Ticket lifecycle notifications use a common Flex Message with text fallback                   | Implemented                                                                                                                       |
| FR-LINE-009 | Booking success sends a LINE ticket notification when the entry has a verified LINE recipient | Implemented                                                                                                                       |
| FR-LINE-010 | LINE Rich Menu opens LIFF Home, booking start, current ticket resolution, and usage guidance  | Implemented in code; LINE Console/E2E sync pending                                                                                |
| FR-LINE-011 | Rich Menu synchronization is explicit, idempotent, mockable, and never runs on API startup    | Implemented                                                                                                                       |

### Location, prediction, and analytics

| ID         | Requirement                                                                                | Status                                     |
| ---------- | ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| FR-LOC-001 | With consent, capture customer and organization coordinates and calculate distance         | Partial                                    |
| FR-LOC-002 | Warn a distant customer shortly before their turn through LINE                             | Planned; pending alerts are stored only    |
| FR-AI-001  | Estimate wait from queue position/workload and configured service time                     | Implemented heuristic                      |
| FR-AI-002  | Persist forecast history with confidence/model metadata                                    | Schema only                                |
| FR-AI-003  | Analyze historical load and recommend staff by weekday/hour                                | Schema only                                |
| FR-AN-001  | Manager sees organization operational statistics                                           | Implemented in order stats/dashboard scope |
| FR-AN-002  | Admin sees platform organization/user health counts without tenant customer/revenue detail | Implemented/Partial                        |

## 4. Business rules

| Rule           | Definition                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| BR-TENANT-001  | Every tenant-owned read/write must be restricted to the actor's organization.                              |
| BR-ORG-001     | `slug` and generated `public_qr_token` are globally unique. QR token is not user-entered.                  |
| BR-ORG-002     | Organization registration and initial manager membership succeed or fail in one transaction.               |
| BR-USER-001    | A manager registered through the admin organization flow must use a Gmail address.                         |
| BR-QUEUE-001   | Only an open/active queue accepts new tickets.                                                             |
| BR-QUEUE-002   | A queue entry follows only allowed state transitions; terminal entries cannot return to waiting.           |
| BR-QUEUE-003   | Calling next selects the earliest eligible waiting ticket and must not call two tickets through one race.  |
| BR-QUEUE-004   | Notification failure must never roll back an already committed queue transition.                           |
| BR-ORDER-001   | Server prices and product ownership are authoritative; browser totals are advisory only.                   |
| BR-ORDER-002   | Order, queue entry, items, payment transaction, stock change, and reservation are atomic.                  |
| BR-ORDER-003   | Each new reservation is a separate order/ticket, even when it shares a booking group.                      |
| BR-STOCK-001   | `stock_quantity IS NULL` is unlimited; finite stock cannot become negative.                                |
| BR-STOCK-002   | A finite item is unavailable when requested quantity exceeds stock.                                        |
| BR-PAY-001     | Every selected `requires_prepayment` product ID must be in the paid coverage set before booking.           |
| BR-PAY-002     | Order is `paid` only when all selected items are covered; required-only payment leaves the order `unpaid`. |
| BR-PAY-003     | Production payment success comes from verified provider callback/webhook, not a browser flag.              |
| BR-LINE-001    | A LINE push requires a verified/linkable recipient LINE user ID and a configured Messaging API token.      |
| BR-LINE-002    | Login and Messaging API are separate LINE channels/capabilities and must be configured consistently.       |
| BR-LINE-003    | Public request bodies must not assert a LINE user ID; derive the recipient from a verified LINE account.   |
| BR-LINE-004    | LIFF booking must wait for the LINE-derived system JWT before creating order/queue records.                |
| BR-LINE-005    | Rich Menu areas must open LIFF routes that can resolve the current customer context, not fixed ticket IDs. |
| BR-PRIVACY-001 | Location is optional, consent-based, purpose-limited, and must have a retention/deletion policy.           |

## 5. Core acceptance criteria

1. A guest selecting only non-prepaid items can place a reservation without checkout and receives an order/ticket.
2. A guest selecting a prepaid item cannot create an order until all prepaid-required products are covered.
3. Required-only checkout marks covered order items paid but leaves uncovered items and order total unpaid.
4. Full checkout marks every item and the order paid and records one payment transaction.
5. Concurrent finite-stock orders cannot reduce stock below zero; a failed order leaves no partial ticket/order/item rows.
6. Staff actions cannot access an entry/order in another organization.
7. Staff state changes for a LINE-linked customer send Japanese queue messages without reverting queue state on delivery failure.
8. LINE ticket notifications contain the system name, ticket code, status, people ahead, ETA, next action, and a LIFF ticket button; text fallback remains available.
9. Rich Menu buttons open `/liff/home`, booking start, current ticket resolution, and usage guidance without hard-coded entry IDs.
10. Admin organization registration creates the organization, manager user, and active membership together.
11. All primary pages remain usable at mobile and desktop widths and all visible copy is Japanese.
12. Health/readiness clearly distinguish a live process from a usable database connection.

## 6. Non-functional requirements

- Security: OWASP-aligned headers, validation, rate limiting, secret separation, webhook signatures, least privilege.
- Reliability: transactional writes, idempotency on retried public writes/payment updates, durable LINE retry, and production operator visibility for failed deliveries.
- Performance: indexed tenant/queue/status paths; avoid N+1 catalog/order reads; define load SLOs before launch.
- Accessibility: semantic controls, keyboard operation, visible focus, sufficient contrast, reduced-motion support.
- Privacy: minimize LINE/location/payment payloads and define retention/deletion/audit rules.
- Observability: structured request logs, request IDs, health/readiness, metrics, notification/payment audit without secrets.
- Localization: Japanese application copy and Japan-oriented JPY formatting/timezone configuration.

## 7. Error behavior

- Validation errors return `422 VALIDATION_ERROR` with field details.
- Missing authentication returns `401`; insufficient role/tenant ownership returns `403`.
- Missing resources return `404`; state/stock/idempotency conflicts return `409` where applicable.
- Third-party delivery failure is logged and retried according to its workflow; it must not expose provider secrets.
- The UI preserves safe customer input after recoverable errors and shows Japanese recovery actions.
