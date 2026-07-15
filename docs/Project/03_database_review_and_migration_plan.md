# 03 - Database Review and Migration Plan

## 1. Current Schema Baseline

Core entities are already present:
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

This is a strong production-ready foundation for multi-role operations.

## 2. Non-Destructive Constraint

Do not remove:
- users
- organizations
- organization_members
- line_accounts
- products
- orders
- order_items
- queues
- queue_entries

All planned changes are additive.

## 3. Gap Review vs Target Data Model

Missing fields:
1. products.product_type
2. orders.customer_user_id
3. orders.customer_phone
4. organizations.public_qr_token

ETA requirement gap:
- Current ETA uses queues.avg_service_seconds.
- Target ETA should support workload composition from order_items.service_time_minutes.

## 4. Migration 010 (Required)

### 4.1 products
- Create enum product_type with values: product, service.
- Add column product_type to products.
- Default existing rows to product.

### 4.2 orders
- Add customer_user_id UUID NULL references users(id).
- Add customer_phone TEXT NULL.

### 4.3 organizations
- Add public_qr_token TEXT with unique index/constraint.

## 5. Backfill Strategy

1. products.product_type backfill to product for existing data.
2. organizations.public_qr_token generated for all existing organizations.
3. orders.customer_user_id backfilled where queue_entry_id can map to queue_entries.user_id.

## 6. ETA Data Strategy

Option A (quick start):
- Compute ahead workload directly from joined queue_entries + orders + order_items.

Option B (scale-ready):
- Cache workload_seconds on queue_entries and recompute on write/update.

Recommended path:
- Start Option A for correctness and speed-to-delivery.
- Move to Option B if performance profiling requires.

## 7. Deployment-Safe Migration Sequence

1. Apply Migration 010.
2. Deploy code that is backward-compatible with old and new columns.
3. Run backfill scripts.
4. Enable workload ETA logic with fallback.
5. Observe and tune.

## 8. Data Integrity Risks and Controls

Risk:
- Partial writes during order creation.

Control:
- Ensure repository methods accept and use provided transaction client in order creation path.

Risk:
- QR links inconsistent if token strategy not enforced.

Control:
- Introduce public_qr_token as stable lookup key and keep legacy paths for compatibility window.
