# LINE Smart Queue Assistant - A-Z Architecture and Development Handover

Version: 1.0  
Date: 2026-06-07  
Audience: Product Owner, Tech Lead, Backend Engineer, Frontend Engineer, QA, DevOps, New Team Members

## Split Documentation Set

For role-based reading, use the split documentation index:

- [A2Z_INDEX.md](A2Z_INDEX.md)

---

## 1. Document Purpose

This document is the complete handover and technical analysis of the current codebase for LINE Smart Queue Assistant.

Goal:

- Help any engineer understand the full product and codebase quickly.
- Provide enough context to continue development immediately.
- Preserve current architecture and maximize code reuse.
- Define a safe path from current implementation to target business model.

This is a no-rewrite strategy document.

---

## 2. Product Evolution and Problem Discovery

### 2.1 Initial product shape

The project started as a Queue Management system integrated with:

- LINE LIFF
- LINE Messaging API

Main value at that stage:

- Join queue
- Track queue position
- Notify when called

### 2.2 Current product reality

The codebase has evolved into a broader operational platform with many business modules:

- Customer Portal
- Staff Portal
- Manager Portal
- Product and Service Catalog
- Order Management
- Queue Management
- Organization Management
- LINE Integration
- Dashboard Analytics

### 2.3 Core product problem to solve now

Businesses need one system that can:

- Capture customer demand (order + queue)
- Execute operations (staff workflow)
- Manage organization and catalog (manager workflow)
- Keep analytics and operational visibility

Important business principle:

- LINE is integration channel only.
- LINE is not the source of truth of business data.
- Internal database is the source of truth.

---

## 3. Requirement Analysis

### 3.1 Roles and required capabilities

#### Customer

Required:

- Scan QR
- Choose products/services
- See total amount
- Payment (can be mock)
- Join queue
- View ETA
- View number of people ahead
- Cancel order

Current support status:

- Public and LIFF join flows exist.
- Product selection + order creation exists.
- Ticket status and people ahead exists.
- ETA exists but currently average-based.
- Cancel ticket exists.

#### Staff

Required:

- Login
- View order list in queue
- Call next
- Skip customer
- Complete order
- View order detail
- Adjust product processing time

Current support status:

- Login exists.
- Call next, serve, no-show, cancel, complete exist.
- Staff dashboard order list and detail exists.
- Product processing time configurable at product level by manager; staff adjustment as dedicated workflow is not yet explicit.

#### Manager

Required:

- Dashboard
- CRUD Product/Service
- CRUD Staff
- Organization information management
- QR export
- Revenue tracking
- Queue KPI tracking

Current support status:

- Dashboard and product CRUD exist.
- Organization details endpoint exists but full manager CRUD flow incomplete.
- QR export UI exists but currently token strategy is incomplete.
- Revenue and top-products analytics exist.
- Queue KPI exists at basic level, not full KPI suite.
- Staff management UI calls APIs not fully implemented.

### 3.2 Target business architecture

Organization

- Products and Services
- Staff
- Queues

Customer

- Order
- Order Items
- Queue Entry

This structure is already mostly reflected in the data model and modules.

---

## 4. Current System Design (As-Is)

### 4.1 Repository and workspace structure

Monorepo with npm workspaces:

- apps/api
- apps/web
- packages/shared
- packages/config
- db/migrations
- db/seeds
- scripts

### 4.2 Backend architecture

Style:

- Modular REST API (Express + TypeScript)
- Layered per module: routes -> controller -> service -> repository
- Shared middleware, validators, utility layer

Core backend components:

- App bootstrap and middleware orchestration
- V1 route composition
- Domain modules for auth, queue, staff, products, orders, orgs, users, notifications, line, eta, skip-penalty
- Repositories in db/repositories
- Background scheduler and jobs

### 4.3 Frontend architecture

Style:

- React + Vite + TypeScript
- Route-based portals and flows
- React Query for server state
- Zustand for auth state

Major route domains:

- Public customer flow
- LIFF customer flow
- Staff portal
- Manager portal
- Admin portal scaffold

### 4.4 Shared package role

packages/shared contains:

- Domain enums and types
- API envelope types
- Constants

Note:
Some shared entity models diverge from actual backend payload shape and naming. This is a known drift to fix incrementally.

### 4.5 Runtime and deployment

- Local: npm workspaces, PostgreSQL local
- Docker dev: hot reload stack
- Docker prod: multi-container stack (postgres + api + web)

---

## 5. Module Inventory (Backend)

### 5.1 Auth module

Responsibilities:

- LINE token login
- Email/password login for staff/manager/admin
- Issue internal JWT

Strengths:

- Clear separation of line verification and auth service
- Internal JWT as app session token

Gap:

- One API test suite fails due to type evolution in test data shape (password_hash field missing in mocked test row).

### 5.2 Queue Entry module (customer ticket operations)

Responsibilities:

- Join queue
- Current queue status
- My tickets
- Ticket status by entry
- Cancel and skip
- Staff actions from same module (call next, serve, complete)

Strengths:

- Idempotent join behavior
- Ownership validation
- Priority + skip handling

Gap:

- ETA formula is still average-only, not workload-aware from order items.

### 5.3 Queues module (admin queue management)

Responsibilities:

- CRUD queue
- Update queue status

Strengths:

- Basic queue lifecycle management implemented

Gap:

- Access control not consistently enforced at route layer.

### 5.4 Staff module

Responsibilities:

- Queue board overview
- Call next
- Serve
- Complete
- No-show
- Cancel entry

Strengths:

- Operational flow is solid and test-backed

Gap:

- Role policy currently staff/admin in route guard, manager should be explicitly included if manager is operationally allowed.

### 5.5 Products module

Responsibilities:

- List by org or orgSlug
- Get by id
- Create/update/delete by manager/admin

Strengths:

- Product catalog flow ready

Gap:

- Missing product_type field (product vs service).

### 5.6 Orders module

Responsibilities:

- Create order from customer product selection
- List/get/update status/payment
- Aggregate stats

Strengths:

- Order + order_items snapshot model is already implemented
- Revenue and top-product analytics available

Critical gap:

- Transaction boundary bug risk: service opens SQL transaction with one client, while repository create methods use global pool (non-atomic behavior risk).

### 5.7 Orgs module

Responsibilities:

- Public org page by slug with products and queue summary

Strengths:

- Good base for customer QR landing

Gap:

- Missing public_qr_token strategy for secure stable QR routing.

### 5.8 Users module

Responsibilities:

- Get by id
- Create
- Deactivate

Gap:

- Missing manager-needed endpoints:
  - List users by org and role
  - Update current profile endpoint

### 5.9 LINE module

Responsibilities:

- Webhook handling
- Signature verification
- Message/postback behavior

Current role in architecture:

- Identity and communication channel
- Not source of truth

This aligns with target principle.

### 5.10 Notifications module

Responsibilities:

- Called and warning notifications
- Anti-duplicate sending guard in current implementation

Strengths:

- Decoupled from domain transitions
- Failure does not rollback queue state

### 5.11 ETA module

Responsibilities:

- ETA calculation based on aheadCount and avg service seconds

Gap:

- Needs workload-aware extension from order_items service_time_minutes.

### 5.12 Skip penalty module

Responsibilities:

- Penalty rules for skip/no-show fairness

Strengths:

- Exists and tested

---

## 6. Module Inventory (Frontend)

### 6.1 Customer and Public flows

- PublicJoinPage
- PublicTicketPage
- CustomerJoinPage

Strengths:

- Customer can choose items and join queue from org slug page

Gap:

- One response contract mismatch in order creation navigation payload expectation.

### 6.2 LIFF flows

- LiffLayout
- LiffInitPage
- HomePage
- QueueJoinPage
- MyTicketsPage
- TicketStatusPage
- HistoryPage placeholder

Strengths:

- LIFF shell and state management are in place

Gap:

- LIFF token exchange to app JWT is not fully wired through full customer session strategy.
- History endpoint integration is placeholder.

### 6.3 Staff portal

- StaffLayout
- StaffDashboardPage
- StaffProductsPage
- StaffQueuePage

Strengths:

- Practical daily operation screen is implemented

Gap:

- Separation between queue operation and order operation can be made clearer for future maintenance.

### 6.4 Manager portal

- ManagerLayout
- ManagerDashboardPage
- ManagerProductsPage + forms/detail
- ManagerUsersPage
- ManagerQRPage
- ManagerSettingsPage

Strengths:

- Product and analytics surface are present

Gaps:

- Users page calls unsupported backend list API.
- Settings page calls unsupported users/me API.
- QR page depends on incomplete slug/token sourcing.

### 6.5 Admin portal

- AdminDashboardPage
- AdminOrgsPage

Gap:

- Frontend calls admin endpoints that are not implemented in API routing.

---

## 7. Current Database Review

### 7.1 Existing schema quality

The schema is mature and covers core business entities.

Key entities present:

- users
- line_accounts
- organizations
- organization_members
- queues
- queue_entries
- products
- orders
- order_items
- notifications
- penalty_records
- queue_histories
- audit_logs

This already supports multi-role and multi-organization business logic.

### 7.2 Required immutable constraint from business

Do not remove tables:

- users
- organizations
- organization_members
- line_accounts
- products
- orders
- order_items
- queues
- queue_entries

This is fully respected by proposed plan.

### 7.3 Missing columns for target model

Required additions:

- products.product_type enum(product, service)
- orders.customer_user_id
- orders.customer_phone
- organizations.public_qr_token

### 7.4 ETA data model observation

order_items already has service_time_minutes snapshot.
This is sufficient to build workload-based ETA without redesigning core tables.

---

## 8. Current Working Components (Validated)

### 8.1 Backend test state

API test run result summary:

- 16 test suites total
- 15 passed
- 1 failed

Failing suite reason:

- Type mismatch in auth test mock row due to password_hash now required in UserRow type.

This is a test maintenance issue, not a production feature break.

### 8.2 Frontend test state

Web test suites are passing.

### 8.3 Business flows with strong confidence

- Queue join and status
- Staff queue operations
- Notification triggers
- Product CRUD baseline
- Order creation baseline
- Dashboard stats baseline

---

## 9. Gap Analysis Against Target Product

### 9.1 Product and service catalog

Gap:

- No product_type to distinguish goods vs services.

Impact:

- Hard to model mixed catalog and future business rules.

### 9.2 Customer identity and order linkage

Gap:

- Orders missing explicit customer_user_id and customer_phone.

Impact:

- Weak CRM linkage and limited traceability.

### 9.3 Organization QR strategy

Gap:

- Missing public_qr_token in organizations.

Impact:

- QR routing is less stable and not organization-token centric.

### 9.4 ETA realism

Gap:

- ETA based only on queue avg_service_seconds.

Impact:

- Inaccurate ETA for heterogeneous services.

### 9.5 Access control consistency

Gaps:

- queues routes are not consistently role-protected.
- staff routes exclude manager role currently.

Impact:

- Security and policy inconsistency.

### 9.6 API-UI contract gaps

Gaps:

- ManagerUsersPage and ManagerSettingsPage call APIs not implemented.
- Admin pages call APIs not implemented.
- One order creation response expectation mismatch in customer flow.

Impact:

- Runtime failures in UI paths.

### 9.7 Transaction integrity

Gap:

- Order creation transaction is not fully atomic due to repository pool usage pattern.

Impact:

- Potential partial writes under failure scenarios.

---

## 10. Minimal Refactor Strategy (No Rewrite)

### 10.1 Principles

- Preserve architecture and module boundaries.
- Additive database evolution only.
- Keep current APIs where possible, extend carefully.
- Fix only what blocks target business outcomes.

### 10.2 Refactor workstreams

Workstream A: Database extension

- Add required columns and enums.
- Backfill safely.

Workstream B: Contract and endpoint completion

- Implement missing users endpoints used by manager pages.
- Either implement admin endpoints or hide admin pages behind feature flag until ready.
- Align order creation response contract between frontend and backend.

Workstream C: Authorization hardening

- Enforce auth and role checks on queue admin routes.
- Include manager role in staff operations where business policy allows.

Workstream D: ETA evolution

- Introduce hybrid ETA:
  - Primary from workload sum based on order_items.service_time_minutes for entries ahead.
  - Fallback to queue avg_service_seconds when workload data is absent.

Workstream E: Transaction correctness

- Ensure order create, item create, and linked queue entry writes share the same SQL transaction client.

---

## 11. Migration Plan

### 11.1 Migration 010 - target columns and enum

Add:

- Enum product_type with values product, service
- products.product_type not null default product
- orders.customer_user_id UUID references users(id)
- orders.customer_phone text
- organizations.public_qr_token text unique

### 11.2 Backfill plan

- Set products.product_type = product for existing rows.
- Generate organizations.public_qr_token for all existing organizations.
- Backfill orders.customer_user_id from queue_entries.user_id where queue_entry_id exists and maps.

### 11.3 Migration 011 - ETA support enhancement (recommended)

Option A (lightweight):

- Compute workload dynamically via SQL join/order_items aggregation in ETA query path.

Option B (scalable):

- Add cached workload_seconds column in queue_entries and keep updated on order create/update.

Recommended:

- Start with Option A if traffic is low.
- Move to Option B if performance pressure grows.

### 11.4 Deployment sequence

1. Deploy schema migration first.
2. Deploy backward-compatible code reading both old and new patterns.
3. Run backfill scripts.
4. Enable new ETA mode behind feature flag.
5. Monitor metrics and errors.

---

## 12. System Design for Target State (To-Be)

### 12.1 Domain boundaries

- Organization domain
- Catalog domain
- Identity and membership domain
- Order domain
- Queue engine domain
- Notification domain
- Integration domain (LINE)

### 12.2 Data ownership

- All business entities owned by internal database.
- LINE stores no authoritative business state.
- LINE only provides identity context and outbound communication channel.

### 12.3 Queue engine with workload ETA

ETA formula target:

- ETA_seconds = sum(workload_seconds of all active entries ahead)

Fallback:

- If workload unavailable for some entries, use avg_service_seconds fallback component.

### 12.4 Role model

- Customer: self-service queue and order journey
- Staff: execution workflow
- Manager: operational governance and analytics
- Admin: platform governance only

---

## 13. Development Plan and Delivery Phases

### Phase 1 - Foundation fixes (highest priority)

- Add DB columns and enum
- Fix order transaction atomicity
- Fix contract mismatch in customer order flow
- Harden queue and staff route authorization

### Phase 2 - Manager workflow completion

- Implement users list by org/role endpoint
- Implement users/me profile update endpoint
- Ensure ManagerUsersPage and ManagerSettingsPage run end-to-end

### Phase 3 - ETA modernization

- Implement hybrid ETA strategy
- Add tests for mixed service durations
- Validate ETA behavior in queue status, my ticket, and public status endpoints

### Phase 4 - QR and org public entry strategy

- Introduce public_qr_token based join route
- Update manager QR export flow
- Keep backward compatibility for old slug links if needed

### Phase 5 - Admin workflow decision

- Option 1: implement admin endpoints currently called by frontend
- Option 2: remove admin routes from UI until backend implementation is ready

---

## 14. QA Strategy

### 14.1 Test layers

- Unit tests for services and validators
- Integration tests for key API workflows
- Frontend component tests and route-level interaction tests

### 14.2 Critical regression suites

- Join queue idempotency
- Staff call-next and state transitions
- Order create with queue entry linkage
- ETA calculation for mixed product/service durations
- Role-based access control for manager and staff paths

### 14.3 Immediate test maintenance

Fix auth test type mock to include password_hash so suite is green.

---

## 15. DevOps and Runtime Notes

### 15.1 Local run baseline

- Install dependencies
- Configure environment
- Run DB migrations and seed
- Run API and web apps

### 15.2 Docker

- Development compose for hot reload and local debugging
- Production compose for packaged runtime

### 15.3 Observability

- Request logging exists
- Notification failures logged without state rollback
- Need future dashboards for queue and order operational metrics

---

## 16. Security and Governance

### 16.1 Security posture observations

- JWT-based auth in place
- Middleware chain is structured
- Some route-level authorization remains incomplete and must be fixed first

### 16.2 Data governance

- Business data centralized in PostgreSQL
- Audit and history tables exist
- Keep soft-delete patterns and immutable histories where already designed

---

## 17. Risks and Mitigations

### Risk 1: Partial order writes

Mitigation:

- Transaction client propagation through repository methods.

### Risk 2: Permission bypass on queue admin

Mitigation:

- Enforce requireAuth + requireRole at routes.

### Risk 3: ETA inaccuracy for mixed service times

Mitigation:

- Hybrid workload-based ETA with fallback.

### Risk 4: Frontend runtime failures from missing APIs

Mitigation:

- Implement missing endpoints or feature-flag/hide incomplete screens.

### Risk 5: Backward compatibility of existing links

Mitigation:

- Keep existing slug routes while introducing token-based QR routes.

---

## 18. Technical Debt Register

1. Shared entity model drift from API payload shape.
2. Admin frontend exists without backend support.
3. Placeholder LIFF history feature.
4. Some duplicated queue operation paths between queue module and staff module surfaces.
5. Missing explicit architectural decision records for role-policy decisions.

---

## 19. Handover Checklist for New Engineers

Day 1 checklist:

1. Read this document fully.
2. Run project locally and execute tests.
3. Verify role flows manually:
   - Customer join and ticket status
   - Staff queue operations
   - Manager product CRUD and dashboard
4. Review pending gaps in Section 9.
5. Start Phase 1 workstream before feature expansion.

Coding continuation checklist:

1. Do additive migrations only for current milestone.
2. Keep module boundaries unchanged.
3. Add tests for every API contract change.
4. Avoid introducing LINE as business source of truth.
5. Keep backward compatibility unless explicitly deprecating with migration notice.

---

## 20. Definition of Done for Current Modernization Goal

Done when all are true:

1. Products support product_type and UI/API use it.
2. Orders store customer_user_id and customer_phone where available.
3. Organizations have public_qr_token and QR export uses it.
4. ETA reflects workload from order items with tested fallback.
5. Manager and staff workflows execute end-to-end without missing API.
6. Queue admin routes are fully role-protected.
7. No forbidden table deletions or architecture rewrites are introduced.

---

## 21. Open Questions for Product and Architecture Alignment

1. Should manager always have all staff operational permissions in every organization?
2. Should customer_phone be mandatory for guest orders in some business modes?
3. Should payment mock remain order-level only, or support item-level or split payment in roadmap?
4. What is retention policy for queue_entries vs queue_histories?
5. Should admin portal be in immediate scope or postponed to platform phase?

---

## 22. Recommended Next Action Sequence

1. Implement Migration 010.
2. Fix transaction integrity in order create flow.
3. Complete missing manager user APIs.
4. Harden route authorization.
5. Implement hybrid ETA and test coverage.
6. Introduce token-based QR flow with compatibility path.

---

## 23. Appendix A - Current API Surface Summary

Primary API groups:

- /api/v1/auth
- /api/v1/queue
- /api/v1/queues
- /api/v1/staff
- /api/v1/products
- /api/v1/orders
- /api/v1/orgs
- /api/v1/users
- /api/v1/line
- /api/v1/notifications

---

## 24. Appendix B - Current Portal Surface Summary

Web route groups:

- Public: join and ticket pages
- LIFF: home, join, my tickets, ticket status, history
- Staff portal
- Manager portal
- Admin portal scaffold

---

## 25. Appendix C - Non-Functional Quality Goals

Target qualities:

- Reliability in queue state transitions
- Predictable ETA quality
- Clear role-based security
- Backward compatibility during migration
- Maintainable modular codebase

---

## 26. Final Conclusion

The project is already a strong operational platform foundation, not just a basic LINE queue demo.

Most required business capabilities are present in architecture and code.
The fastest and safest path is not rewrite, but focused completion:

- additive schema updates,
- endpoint completion,
- authorization consistency,
- ETA realism upgrade,
- contract alignment.

With this plan, the team can continue development immediately while preserving existing investments and minimizing delivery risk.
