# Changelog

All notable project changes should be recorded here. This file tracks delivered behavior; future work belongs in `docs/project/09_ROADMAP_AND_DECISIONS.md`.

## Unreleased

### Production hardening

- Fixed staff refunds for legacy paid orders by backfilling an audited manual transaction, limited the staff queue preview to the next eight active customers while preserving total counts, and changed default seeds to organization/account-only with an explicit demo profile.
- Fixed staff completion/no-show history writes to use the canonical `queue_histories.actor_id` column, normalized inconsistent legacy timing data, corrected demo seed timestamps, and removed the unnecessary Complete request body.
- Completed atomic inventory reservation lifecycle and queue/counter concurrency controls.
- Added audited payment reconciliation, replay/out-of-order webhook guards, partial/full refund accounting, and receipt eligibility checks.
- Added tenant-scoped notification operations, LINE preferences, privacy-aware location alerts, and retention cleanup.
- Added authenticated cross-device booking history, tenant staff related-booking views, Japan address fields, weekly hours, exception days, and Japan-localized seed data.
- Added measured heuristic wait forecasts and staffing recommendations with hourly aggregates, confidence, explanations, retention, manager APIs, dashboard output, and a PostgreSQL-locked scheduler job.
- Added a media storage boundary with validated/compressed image uploads, local and mock providers, an object-storage-compatible interface, metadata tracking, deletion, and URL-based organization/product forms.
- Added complete runtime OpenAPI operation coverage with auth, pagination, standard envelopes, validator metadata, specification validation, and route-drift contract tests.
- Added Playwright desktop/mobile coverage for LIFF mock login, demo payment, booking/ticket, staff/outbox, receipt, admin registration, manager QR/settings, and responsive layouts.
- Fixed demo payment enum updates, multi-queue staff selection, repeatable seed counters/business dates, and Japanese fallback errors/demo identities found by browser testing.
- Unified root database commands on canonical `node-pg-migrate`, added clean migration/idempotent seed CI smoke tests, critical coverage thresholds, dependency and secret scanning, and full mock E2E quality gates.
- Added advisory scheduler lock contention, reacquisition, failure sanitization, unlock, and session-release tests.
- Added Japanese-default internationalization with Vietnamese/English resources, persisted user/organization locales, localized LINE outbox templates, translation tables, and locale-aware Intl formatting.
- Rebalanced the login experience with centered brand content and icon-led reception, LINE notification, and JPY payment highlights.
- Packaged canonical migrations and compiled seed tooling in the production API image while excluding generated seed output from source control.
- Fixed production same-origin API configuration so existing `/api/v1` request paths are not prefixed as `/api/api/v1`.

### LINE Messaging

- Made LIFF the primary manager print/copy QR and customer login entry, enabled automatic external-browser LIFF login, and retained public/email customer flows as explicit development fallbacks.
- Added a safe token verification and optional direct test-message command.
- Propagated the server-verified LINE user ID into queue entries created by authenticated orders.
- Documented the separate LINE Login, Messaging API push, and webhook credential roles.
- Completed Phase 1 LINE identity handling by removing public `lineUserId` trust from direct queue join and rechecking JWT LINE claims against linked `line_accounts`.
- Centralized Japanese LINE notification copy and added LINE push attempts for called, serving, completed, cancelled, no-show, and ETA warning events.
- Hardened LINE webhook handling with explicit channel-secret configuration checks and test coverage for follow, unfollow, and message events.

### Documentation

- Consolidated overlapping project documents into ten canonical sources of truth.
- Added repository instructions for coding agents and contributors.
- Separated historical proposal, presentation, demo, load-test, and release artifacts from current documentation.
- Added workstream-level production readiness and physical LINE device E2E checklists that explicitly separate automated verification from external acceptance.

## 0.0.1 - Current baseline

- Multi-role React web application for customers, staff, managers, and platform admins.
- Express REST API with PostgreSQL persistence, JWT authentication, rate limiting, validation, audit logging, and scheduled jobs.
- Queue, order, product/service, organization, staff, QR, demo payment, inventory, and receipt workflows.
- LINE Login/LIFF and Messaging API adapters with mock development mode.
- Database structures for payment transactions, inventory reservations, booking groups, customer locations, location alerts, wait-time forecasts, and staffing recommendations.
