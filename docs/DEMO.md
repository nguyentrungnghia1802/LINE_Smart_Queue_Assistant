# Demo Guide — LINE Smart Queue Assistant

This guide walks through a full end-to-end demo of the system.

---

## Demo Accounts

| Role     | Email              | Password | Notes                                        |
| -------- | ------------------ | -------- | -------------------------------------------- |
| Admin    | admin@gmail.com    | 123456   | Platform admin baseline                      |
| Manager  | manager@gmail.com  | 123456   | Full access to settings, analytics, products |
| Staff    | staff@gmail.com    | 123456   | Queue board operations                       |
| Customer | customer@gmail.com | 123456   | Customer dashboard and ticket tracking       |

> **Seed first:** Run `npm run db:seed` (or `npm run db:seed:reset` for a fresh start) to create these accounts and populate demo data.

---

## Demo Organization

| Field           | Value                                                   |
| --------------- | ------------------------------------------------------- |
| Name            | Tiệm Cắt Tóc The Queue Lab                              |
| Slug            | `the-queue-lab`                                         |
| QR Token        | `demo_the_queue_lab_token_001`                          |
| Public Join URL | `http://localhost:5173/qr/demo_the_queue_lab_token_001` |

---

## Demo Flow (Step by Step)

### 1. Manager Login

1. Open `http://localhost:5173/login`
2. Enter `manager@gmail.com` / `123456`
3. Click Login → redirected to Manager Dashboard

---

### 2. Manager Dashboard

- View **Revenue Overview**: total revenue, orders breakdown, 7-day chart
- View **Top Services**: top 5 products by revenue
- View **Active Queue Depth**: current waiting customers
- View **Recent Orders**: latest 10 orders with status
- View **Recent Queue Activities**: live queue board snapshot

---

### 3. Product / Service Management

1. In the sidebar, click **Products**
2. You will see 4 demo products already seeded:
   - Cắt tóc nam (120,000 đ / 30 min service)
   - Nhuộm tóc (350,000 đ / 120 min service)
   - Dầu gội đầu (85,000 đ / product)
   - Dầu xả tóc (95,000 đ / product)
3. Click **Add Product** to create a new service
4. Click a product's edit icon to update name, price, or service time

---

### 4. Queue Management

1. Click **Queues** in the sidebar
2. You will see 2 queues:
   - **Counter A** (open) — prefix A, avg 30 min service
   - **VIP Lane** (open) — prefix VIP
3. Click the status toggle to **Open** or **Close** a queue
4. Click edit to change capacity, service time, or skip settings

---

### 5. Export QR Code

1. Click **Settings** in the sidebar
2. Navigate to **QR Code** section
3. View the public join URL and QR code for the organization
4. The QR encodes: `http://localhost:5173/qr/demo_the_queue_lab_token_001`

---

### 6. Customer Scans QR (New Order)

> Simulate this by opening the join URL directly in another browser/tab.

1. Open `http://localhost:5173/qr/demo_the_queue_lab_token_001`
2. The page shows:
   - Organization info (name, address, payment details)
   - Active queue status (waiting count, ETA)
   - Product catalog
3. Click **Join Queue** / **Create Order**
4. Select products (e.g., Cắt tóc nam)
5. Enter name and phone
6. Submit → Receive ticket number (e.g., A-008)
7. Page shows: ticket display, position in queue, estimated wait time

---

### 7. Customer Tracks Ticket

The confirmation page (or `/ticket/:entryId`) shows:

- Ticket number and current status
- Position ahead in queue
- Estimated wait time (updates every 30s via background job)
- Linked order details

---

### 8. Staff Dashboard — Call Next

1. Open `http://localhost:5173/login` in another tab
2. Log in as `staff@gmail.com` / `123456`
3. Click **Queue Board**
4. You see the live waiting list (A-001 through A-008)
5. Click **Call Next** → A-001 transitions from `waiting` → `called`
6. If the customer has a LINE account, a LINE push notification is sent:
   > "🔔 Ticket A-001 — It's your turn! Please proceed to the counter."

---

### 9. Notification Flow

When staff calls next:

- Customer A-001 receives a LINE push: "Your turn!"
- Customer A-002 (now 1st in line) receives an ETA warning: "You're almost up!"

The background scanner (`etaWarning` job, every 30s) also sends warnings to customers near the front.

---

### 10. Staff Mark as Serving & Complete

1. After A-001 arrives at the counter, click **Mark Serving**
2. A-001 transitions to `serving` status
3. After service is complete, click **Mark Complete**
4. A-001 is archived to `queue_histories`
5. Metrics update: `queue_served_total` incremented

---

### 11. Manager Sees Analytics Updated

1. Switch back to the manager tab
2. Refresh the dashboard
3. Observe:
   - **Queue depth** decreased by 1
   - **Completed orders** count increased
   - **Recent Queue Activities** shows the completed entry
   - **Average ETA** recalculated

---

## Quick API Smoke Test

```bash
# Health check
curl http://localhost:4000/health

# Get org by QR token (public)
curl "http://localhost:4000/api/v1/orgs/by-token/demo_the_queue_lab_token_001"

# Manager login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@gmail.com","password":"123456"}'

# List products (public)
curl "http://localhost:4000/api/v1/products?orgSlug=the-queue-lab"

# Queue status (public)
curl "http://localhost:4000/api/v1/queue/33333333-3333-4333-8333-333333333331/status"
```

---

## Resetting Demo Data

```bash
# Full reset (truncate + re-seed)
npm run db:seed:reset --workspace=apps/api

# Or with Docker
docker compose exec api npm run db:seed:reset
```
