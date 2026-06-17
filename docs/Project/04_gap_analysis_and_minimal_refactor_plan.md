# 04 - Gap Analysis and Minimal Refactor Plan

## 1. What Is Working Well

1. Queue lifecycle operations are implemented and mostly test-backed.
2. Staff operational flows exist: call-next, serve, complete, no-show, cancel.
3. Product and order domains are implemented.
4. Dashboard analytics baseline exists.
5. LINE integration is mostly channel-oriented, not data-owner oriented.

## 2. Confirmed Gaps

### 2.1 Data model gaps
- products missing product_type.
- orders missing customer_user_id and customer_phone.
- organizations missing public_qr_token.

### 2.2 ETA gap
- ETA currently average-only.
- Needs workload-aware computation from order_items.service_time_minutes.

### 2.3 Authorization gaps
- queue management routes are not fully role-guarded consistently.
- staff route role policy should include manager if manager is operational actor.

### 2.4 API completeness gaps
- ManagerUsersPage expects list-by-org/role users API not fully implemented.
- ManagerSettingsPage expects users/me update API not implemented.
- Admin pages call admin endpoints not implemented.

### 2.5 Contract mismatch gaps
- At least one customer order creation response expectation differs between UI and API shape.

### 2.6 Transaction integrity gap
- Order service opens transaction but repository writes may use global pool path.

## 3. Minimal Refactor Principles

1. No rewrite.
2. Preserve module boundaries.
3. Additive schema evolution only.
4. Keep backward compatibility where possible.
5. Fix correctness and contract first, optimize second.

## 4. Refactor Workstreams

### Workstream A: Data model completion
- Implement Migration 010 fields.

### Workstream B: Contract and endpoint completion
- Add missing manager-facing users endpoints.
- Resolve order response shape mismatch.
- Decide admin endpoint implementation vs temporary frontend hide.

### Workstream C: Authorization hardening
- Apply requireAuth + requireRole to queue management routes.
- Harmonize staff/manager operational role policy.

### Workstream D: ETA modernization
- Introduce hybrid ETA:
  - primary workload-based
  - fallback avg_service_seconds

### Workstream E: Transaction safety
- Pass transaction client into order repository methods in create flow.

## 5. Expected Outcomes

1. Product model supports both tangible products and services.
2. Order-customer linkage becomes explicit and audit-friendly.
3. Organization QR routing becomes stable and secure.
4. ETA quality becomes realistic for mixed workloads.
5. Manager and staff operational paths become reliable end-to-end.
6. Existing code investment is preserved.
