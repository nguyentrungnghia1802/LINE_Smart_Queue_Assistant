# 02 - Current System Architecture (As-Is)

## 1. Monorepo Structure

Main workspaces:
- apps/api
- apps/web
- packages/shared
- packages/config
- db/migrations
- db/seeds
- scripts

## 2. Backend Architecture

Style:
- Express REST API
- Domain modules with layered structure:
  - routes
  - controller
  - service
  - repository

Entry composition:
- App setup and middleware chain in apps/api/src/app.ts
- API v1 route aggregation in apps/api/src/routes/v1.routes.ts

### 2.1 Domain module inventory
- auth
- queue (customer ticket operations)
- queues (queue management)
- staff
- users
- orgs
- products
- orders
- line
- notifications
- eta
- skip-penalty

### 2.2 Middleware and security model
- request ID
- HTTP logging
- global error handler
- JWT-based current user resolution
- requireAuth and requireRole middleware

### 2.3 Background jobs
Scheduler-driven jobs include:
- ETA updater
- notification scans
- daily counter reset

## 3. Frontend Architecture

Style:
- React + TypeScript + Vite
- React Router for route domains
- React Query for async state
- Zustand for auth state

### 3.1 Route domains
- Public customer flow
- LIFF customer flow
- Staff portal
- Manager portal
- Admin portal scaffold

### 3.2 Frontend service layer
- apiClient wrapper
- queueEntry API module
- queues API module
- staff API module

## 4. Shared Package Role

packages/shared provides:
- enums
- API response envelope types
- constants
- cross-workspace utility types

Important note:
- Some shared entity models are conceptually richer than current API payload shape.
- Incremental alignment is required to reduce contract drift.

## 5. Integration Architecture

LINE responsibilities in current design:
- Identity and LIFF context
- Notification transport (push/webhook)

Business state ownership remains in internal PostgreSQL, which is correct for target architecture.

## 6. Architecture Strengths

1. Clear module boundaries.
2. Domain-focused backend organization.
3. Existing role-aware foundations.
4. Working queue engine core.
5. Existing order and product domains.
6. Existing analytics baseline.

## 7. Architecture Weaknesses

1. Some route authorization is inconsistent.
2. Frontend-to-backend contract drift in selected paths.
3. Admin frontend surface exists without complete backend implementation.
4. ETA strategy is still average-based and not workload-aware.
5. Order creation transaction boundary is not fully robust yet.
