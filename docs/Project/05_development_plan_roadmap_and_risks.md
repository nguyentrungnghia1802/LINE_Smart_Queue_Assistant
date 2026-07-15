# 05 - Development Plan, Roadmap, QA, and Risks

## 1. Delivery Phases

### Phase 1 - Foundation and correctness
- Migration 010 fields and enum.
- Fix transaction integrity in order create flow.
- Fix high-impact API contract mismatches.
- Harden authorization on queue and staff boundaries.

### Phase 2 - Manager workflow completion
- Implement users list by org/role endpoint.
- Implement users/me update endpoint.
- Validate ManagerUsers and ManagerSettings pages end-to-end.

### Phase 3 - ETA modernization
- Implement workload-aware ETA with fallback.
- Add tests for mixed service durations.
- Validate ETA across public status, my tickets, and staff board views.

### Phase 4 - QR modernization
- Introduce public_qr_token usage in manager QR export and customer entry.
- Keep compatibility routes during transition.

### Phase 5 - Admin scope closure
- Either implement /api/v1/admin endpoints used by UI, or disable/hide admin pages until backend is ready.

## 2. QA Strategy

### 2.1 Test pyramid
- Unit tests for services, validators, utility logic.
- Integration tests for API role flows and transaction-sensitive paths.
- Frontend tests for route-level and component-level behavior.

### 2.2 Critical regression scenarios
1. Queue join idempotency.
2. Staff transition correctness.
3. Order + queue entry consistency under failure.
4. Role-based access matrix.
5. ETA with heterogeneous service workloads.

### 2.3 Immediate maintenance item
- Fix failing auth test suite caused by UserRow type update requiring password_hash in mock.

## 3. Release and Rollout Strategy

1. Schema migration first.
2. Backward-compatible code deployment.
3. Backfill execution.
4. Feature flag controlled rollout for new ETA mode.
5. Monitoring and rollback plan prepared.

## 4. Risk Register

### Risk R1 - Partial order writes
Impact: high  
Mitigation: strict transaction-client propagation.

### Risk R2 - Permission inconsistencies
Impact: high  
Mitigation: route-level role enforcement and role matrix tests.

### Risk R3 - ETA trust issues
Impact: medium/high  
Mitigation: hybrid ETA, fallback, and confidence labeling.

### Risk R4 - Frontend runtime errors from missing APIs
Impact: medium  
Mitigation: endpoint completion or feature gating.

### Risk R5 - Migration regressions
Impact: medium  
Mitigation: additive migration, backfill script validation, pre-prod checks.

## 5. Definition of Done for Modernization Sprint

Done when:
1. product_type is live and used.
2. customer_user_id and customer_phone are persisted as applicable.
3. public_qr_token is generated and consumed in QR flow.
4. ETA reflects workload with tested fallback.
5. Manager and Staff core flows pass integration checks.
6. Role protections are consistent and tested.
7. No forbidden table removal and no unnecessary architecture rewrite.
