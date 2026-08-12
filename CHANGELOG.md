# Changelog

All notable project changes should be recorded here. This file tracks delivered behavior; future work belongs in `docs/project/09_ROADMAP_AND_DECISIONS.md`.

## Unreleased

### Production hardening

- Added a reviewed manual immutable release path under `deploy/scripts`: the local shell
  publisher requires the checked-out full Git SHA, builds/pushes API and Web with one tag and no
  `latest`, while the VPS wrapper delegates backup, verification, migration, recreation, health,
  and image-metadata rollback to `deploy/backup/deploy-safe.sh`. Web nginx now resolves the API
  service through Docker DNS at request time so API recreation does not retain a stale upstream IP.

- Standardized immutable API/Web releases around the full Git SHA. A local PowerShell publisher
  builds and pushes both `git-<40-character-sha>` and `latest`; production deployment accepts only
  the immutable tag, verifies a pre-deployment backup before atomically updating image references
  in `deploy/.env`, then pulls, migrates, recreates, and probes health. Rollback now persists the
  exact prior image references from verified snapshot metadata instead of relying on a moving tag.

- Added versioned VPS tooling for matched PostgreSQL/local-media snapshots, checksum and dump/archive
  verification, conservative retention, guarded restore, backup-gated immutable-image deployment,
  and application-only rollback. CI now rehearses representative database/media recovery and
  rejects corrupt, missing, incomplete, unconfirmed, and backup-gate failure cases.

- Made persistent VPS-local media the official production-oriented demo configuration. Production
  Compose mounts `media_data` at `/app/var/media`, configuration/tests keep S3 optional, and CI
  verifies a recreated non-root API container can read data written through the same volume.

- Added a Storybook 10.5.7 React/Vite component-review environment with shared CSS/design tokens,
  Japanese/Vietnamese/English locale controls, phone/desktop viewports, TanStack Query/MemoryRouter
  providers, deterministic fixtures, and isolated stories for queue, ticket, status, product-picker,
  and LINE friendship components. The static build does not call production integrations.

- Added optional OpenTelemetry tracing and sanitized Sentry error reporting across the browser,
  API, PostgreSQL/Redis clients, BullMQ notification delivery, and outbound HTTP providers while
  preserving Pino, health endpoints, Prometheus metrics, and fail-open business behavior.

- Replaced admin-driven organization registration with a public product site, three-step business
  application, server-calculated demo subscription payment, and an admin approval inbox. Approval
  atomically provisions the organization, generated slug/QR token, work-email manager, and
  membership; rejection clears the pending credential hash and demo-refunds the application.

- Standardized Admin, Manager, Staff, legacy app, Customer, and LIFF responsive navigation with
  desktop role tabs, safe-area-aware mobile bottom tabs, and Lucide icons.
- Reflowed the Staff queue selector for phone screens and added mobile card/form/modal treatments
  for dense manager product, user, queue, and settings workflows.
- Confirmed `/liff` as the recommended LINE Console endpoint and documented its required
  frontend/backend endpoint-path pairing.
- Replaced customer email registration/login with verified LINE-only authentication, required the
  LINE-derived customer JWT for payment intents and bookings, and kept email/password access for
  staff, managers, and admins.
- Added a paired local-only LIFF mock login that uses the same ID-token-to-system-JWT contract even
  when a real LIFF ID is present in the developer environment.
- Replaced `liff.state` QR/deeplink construction with endpoint-relative LIFF permanent links so a
  `/liff` endpoint cannot resolve to `/liff/liff/...`.
- Replaced customer email in the staff order workspace with the linked LINE display name while
  retaining the separately entered booking name and telephone number.
- Fixed manager product create/update/delete by accepting trusted same-origin media paths, aligning authenticated audit actors with the database enum, invalidating locale-aware catalog caches, preserving prepayment selections, returning to the product list after creation, and showing field/delete diagnostics.
- Restricted QR booking and direct queue admission to guests or customer accounts, added an explicit LIFF customer entry for authenticated business roles, and preserved their existing dashboard session.
- Fixed manager booking fallback URLs to use configured `WEB_ORIGIN` instead of a legacy localhost default, made legacy queue QR displays LIFF-first, and documented the required production web-image LIFF build arguments.
- Added a project-specific Docker build, publication, inspection, Compose, health-check, and cleanup runbook for the API and web images.
- Fixed staff refunds for legacy paid orders by backfilling an audited manual transaction, limited the staff queue preview to the next eight active customers while preserving total counts, and changed default seeds to organization/account-only with an explicit demo profile.
- Fixed staff completion/no-show history writes to use the canonical `queue_histories.actor_id` column, normalized inconsistent legacy timing data, corrected demo seed timestamps, and removed the unnecessary Complete request body.
- Completed atomic inventory reservation lifecycle and queue/counter concurrency controls.
- Added audited payment reconciliation, replay/out-of-order webhook guards, partial/full refund accounting, and receipt eligibility checks.
- Added tenant-scoped notification operations, LINE preferences, privacy-aware location alerts, and retention cleanup.
- Added authenticated cross-device booking history, tenant staff related-booking views, Japan address fields, weekly hours, exception days, and Japan-localized seed data.
- Added measured heuristic wait forecasts and staffing recommendations with hourly aggregates, confidence, explanations, retention, manager APIs, dashboard output, and a PostgreSQL-locked scheduler job.
- Added a media storage boundary with validated/compressed image uploads, local and mock providers, an object-storage-compatible interface, metadata tracking, deletion, and URL-based organization/product forms.
- Added the optional S3/R2-compatible media adapter with server-generated keys, cache headers,
  stable public/CDN URLs, provider configuration, collision-safe upload retries, recoverable
  database/provider failure semantics, while retaining persistent local media volumes for the
  development and current VPS production-demo Compose stacks.
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

- Made LIFF the only customer authentication path, redirected QR/web entries through LINE, and
  synchronized Official Account friendship after login without overriding explicit notification
  preferences.
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
