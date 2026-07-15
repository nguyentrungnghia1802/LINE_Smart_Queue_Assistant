# 01 - Problem Discovery and Requirement Analysis

## 1. Purpose

This document defines the product problem, current business context, and role-level functional requirements.

## 2. Product Evolution

### 2.1 Initial stage
The project originally focused on queue management with LINE integration:
- LINE LIFF for customer interaction.
- LINE Messaging API for notifications.

### 2.2 Current stage
The product has evolved into a broader operational platform:
- Customer Portal
- Staff Portal
- Manager Portal
- Product and Service Catalog
- Order Management
- Queue Management
- Organization Management
- LINE Integration
- Dashboard Analytics

## 3. Problem Discovery

Businesses need one integrated operational system that can:
- Let customers place orders and join queues.
- Let staff execute day-to-day queue operations.
- Let managers control catalog, staff, organization settings, and metrics.
- Keep data integrity and history in an internal system database.

Critical product principle:
- LINE is an integration channel only.
- LINE must not become the business source of truth.
- Internal PostgreSQL data model is the authoritative source.

## 4. Role and Capability Requirements

### 4.1 Customer
Required capabilities:
- Scan QR
- Choose products/services
- See total amount
- Payment (can be mocked)
- Join queue
- View ETA
- View number of people ahead
- Cancel order/ticket

### 4.2 Staff
Required capabilities:
- Login
- View queue order list
- Call next
- Skip customer / mark no-show
- Complete order/service
- View order details
- Adjust processing time (at product/service level)

### 4.3 Manager
Required capabilities:
- Dashboard
- CRUD Product/Service
- CRUD Staff
- Manage organization profile
- Export QR
- Revenue tracking
- Queue KPI tracking

## 5. Target Business Architecture

Organization owns:
- Products/Services
- Staff
- Queues

Customer journey:
- Order
- Order Items
- Queue Entry

This aligns with current modular direction and should be preserved.

## 6. Architectural Guardrails

Mandatory rules:
- Do not delete these tables: users, organizations, organization_members, line_accounts, products, orders, order_items, queues, queue_entries.
- Do not redesign system into LINE-dependent data ownership.
- Do not rewrite architecture unless benefits are proven and migration-safe.

## 7. Success Criteria

Target state is reached when:
1. Product/service catalog supports both product and service semantics.
2. Customer identity linkage in orders is explicit and traceable.
3. Organization-level public QR token exists and is used.
4. ETA reflects actual workload (service-time composition), not only global average.
5. Customer/Staff/Manager paths run end-to-end with stable API contracts.
