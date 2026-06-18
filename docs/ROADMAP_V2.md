# Roadmap V2 — LINE Smart Queue Assistant

This document outlines planned improvements and features for the V2 release.

---

## 1. Real Payment Integration

**Current state:** Payment status is manually updated by staff.

**V2 plan:**

- Integrate PromptPay QR generation (Thai QR Payment standard)
- Integrate payment webhook from a payment gateway (Omise, Stripe, etc.)
- Automatically update `orders.payment_status` on confirmed payment
- Notify customer via LINE push on payment confirmation

---

## 2. Real LINE LIFF Deployment

**Current state:** LIFF login works when `VITE_LIFF_ID` is configured but requires a publicly accessible webhook URL for LINE to call.

**V2 plan:**

- Deploy to a public server (VPS or cloud)
- Configure LINE Developers Console with production channel
- Set up ngrok or Cloudflare Tunnel for local development testing
- Register LIFF app with the production domain
- Add LIFF SDK initialization with fallback for non-LINE browsers

---

## 3. Multi-Tenant Scaling

**Current state:** Single organization per user. Caches are process-local.

**V2 plan:**

- Allow a user to belong to multiple organizations (role-per-org)
- Cross-tenant analytics for platform operators
- Redis for shared rate limiting and cache invalidation across replicas
- Organization-level feature flags and configuration

---

## 4. Redis / Job Queue

**Current state:** Background jobs run on `setInterval` in the main process. Notification dedup is in-memory.

**V2 plan:**

- Replace `setInterval` jobs with BullMQ (Redis-backed)
- Move `notificationLogRepository` to a `notification_log` DB table or Redis
- Retry queues with exponential backoff for LINE API failures
- Dead letter queue for undeliverable notifications
- Horizontal scaling: multiple API instances share job state via Redis

---

## 5. Advanced Analytics

**Current state:** Basic dashboard with 7-day revenue, top products, queue depth.

**V2 plan:**

- Historical trends: 30-day, 90-day charts
- Peak hours heatmap (queue volume by hour of day)
- Average wait time over time (from `queue_histories.waited_seconds`)
- No-show rate and skip rate tracking
- Customer retention (repeat visits)
- Materialized view for expensive aggregations on large orgs
- CSV/Excel export for all analytics

---

## 6. Disaster Mode

**Current state:** Staff must manually open/close queues. No overflow handling.

**V2 plan:**

- Auto-close queue when `max_capacity` is reached (with notification)
- "Disaster mode" flag: freeze all joins, auto-notify waiting customers
- Queue pause with ETA freeze (display "Temporarily unavailable")
- Auto-resume when disaster mode is lifted

---

## 7. Production Monitoring

**Current state:** Prometheus-format `/metrics` endpoint exists but no scraping configured.

**V2 plan:**

- Prometheus + Grafana dashboard deployment (Docker Compose or cloud)
- Alerts: queue depth spike, notification failure rate, API error rate
- Uptime monitoring with external health checks (UptimeRobot, Betterstack)
- Error tracking with Sentry integration
- Structured log aggregation (Loki + Grafana or ELK stack)

---

## 8. Email / SMS Notifications

**Current state:** Only LINE push notifications. Other channels are in the schema but not implemented.

**V2 plan:**

- Email notifications for customers without LINE (using Resend or SendGrid)
- SMS fallback for urgent notifications (Twilio)
- Notification preference settings per customer (opt-in/out per channel)
- Weekly summary reports for managers

---

## 9. Mobile App (React Native / Flutter)

**Current state:** Responsive web app only.

**V2 plan:**

- Native mobile app for customers (barcode scanning, push notifications)
- Staff app with offline-capable queue board
- Shared API contracts via `@line-queue/shared`

---

## 10. Additional Queue Types

**Current state:** Standard FIFO queue with priority support.

**V2 plan:**

- Appointment-based queue (pre-booked time slots)
- Round-robin multi-counter (assign customer to specific counter)
- Estimated call time scheduling (notify customer when to arrive)
- Virtual queue with check-in window

---

## Technical Debt Items

| Item                                                   | Priority | Notes                                  |
| ------------------------------------------------------ | -------- | -------------------------------------- |
| Migrate `customers` fully to LINE-linked accounts      | Medium   | Currently allows anonymous queue joins |
| Add `notification_log` table in DB                     | High     | Replace in-memory dedup Map            |
| Add composite index on `queue_histories` for analytics | Medium   | Performance at scale                   |
| Formalize API versioning (`/api/v2`)                   | Low      | Current v1 is stable                   |
| Add OpenAPI spec to CI validation                      | Medium   | Ensure API contract doesn't break      |
| Web E2E tests (Playwright)                             | High     | Currently only unit/integration tests  |
