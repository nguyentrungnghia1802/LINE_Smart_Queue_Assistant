# 06 - Handover Runbook and Checklists

## 1. Handover Objective

Enable any new engineer to continue project development without re-discovery overhead.

## 2. Day-1 Onboarding Checklist

1. Read documents in this order:
   - 01_problem_discovery_and_requirement_analysis.md
   - 02_current_system_architecture.md
   - 03_database_review_and_migration_plan.md
   - 04_gap_analysis_and_minimal_refactor_plan.md
2. Run project locally (API + Web + DB).
3. Run tests and record baseline.
4. Validate core role flows manually:
   - Customer join and ticket tracking
   - Staff queue operation
   - Manager product and dashboard
5. Review current gaps before implementing new features.

## 3. Local Development Runbook

Reference operational guide:
- huongdan_chay_local.md

Standard flow:
1. Install dependencies.
2. Configure environment.
3. Run DB migrations and seeds.
4. Start API and Web apps.

## 4. Coding Continuation Rules

1. Preserve modular boundaries.
2. Prefer additive change over replacement.
3. Add tests for behavior changes.
4. Keep business source of truth in PostgreSQL.
5. Treat LINE as identity and notification channel only.

## 5. PR Checklist for This Modernization Track

1. No forbidden table removal.
2. Migrations are additive and reversible where possible.
3. API contracts are documented and aligned with frontend.
4. Role authorization updated and verified.
5. New ETA behavior has unit/integration tests.
6. Existing behavior remains backward compatible unless explicitly versioned.

## 6. Operational Runbook Notes

### 6.1 If migrations fail
- Stop deployment.
- Inspect migration logs.
- Fix migration SQL and re-run in controlled environment.

### 6.2 If role access is broken
- Verify JWT payload role and org context.
- Verify requireAuth/requireRole application at route level.
- Validate role matrix with test fixtures.

### 6.3 If ETA appears unrealistic
- Check fallback usage frequency.
- Verify order_items service_time_minutes data quality.
- Inspect queue ahead workload query path.

### 6.4 If manager pages fail
- Check backend endpoint availability:
  - users list by org/role
  - users me update
- Verify response schema compatibility.

## 7. Open Product Decisions to Finalize

1. Manager permission scope for staff-like operations.
2. Mandatory vs optional customer_phone policy.
3. Admin portal immediate scope vs deferred scope.
4. KPI definitions for queue analytics phase 2.

## 8. Recommended Next Engineering Actions

1. Execute Phase 1 first (correctness and safety).
2. Lock contract alignment before UI polish.
3. Deliver ETA modernization with feature flag.
4. Finalize QR token strategy and compatibility support.

## 9. Completion Signal

Project is handover-ready when:
- A new engineer can run, test, and modify one feature end-to-end in first working day.
- No unresolved blocker exists in auth, queue lifecycle, or order write consistency.
- Documentation and code behavior remain aligned.
