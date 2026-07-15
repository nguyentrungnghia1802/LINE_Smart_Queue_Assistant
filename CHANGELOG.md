# Changelog

All notable project changes should be recorded here. This file tracks delivered behavior; future work belongs in `docs/project/09_ROADMAP_AND_DECISIONS.md`.

## Unreleased

### LINE Messaging

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

## 0.0.1 - Current baseline

- Multi-role React web application for customers, staff, managers, and platform admins.
- Express REST API with PostgreSQL persistence, JWT authentication, rate limiting, validation, audit logging, and scheduled jobs.
- Queue, order, product/service, organization, staff, QR, demo payment, inventory, and receipt workflows.
- LINE Login/LIFF and Messaging API adapters with mock development mode.
- Database structures for payment transactions, inventory reservations, booking groups, customer locations, location alerts, wait-time forecasts, and staffing recommendations.
