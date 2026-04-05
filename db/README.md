# Database — Workflow Guide

This document explains how to work with the database layer in LINE Smart Queue Assistant.

---

## File Structure

```
db/
├── migrations/
│   ├── *.sql                      # Schema design documents (reference only — not run)
│   └── node-pg-migrate/           # Runnable TypeScript migrations
│       ├── 000001_create_enums.ts
│       ├── 000002_create_identity_tables.ts
│       ├── 000003_create_queue_tables.ts
│       ├── 000004_create_support_tables.ts
│       └── 000005_create_audit_and_indexes.ts
└── seeds/
    ├── _ids.ts                    # Shared stable UUIDs for idempotent seeds
    ├── index.ts                   # Seed runner (entry point)
    ├── 001_organization.ts        # 1 venue + 2 staff users
    ├── 002_queues.ts              # 2 sample queues (Counter A, VIP Lane)
    └── 003_test_data.ts           # 5 LINE customers + queue entries + history

apps/api/src/db/
├── client.ts                      # pg Pool singleton + typed query helpers
├── transaction.ts                 # withTransaction / withSavepoint helpers
└── repositories/
    ├── index.ts                   # Barrel export
    ├── base.repository.ts         # Abstract base with shared query helpers
    ├── users.repository.ts
    ├── organizations.repository.ts
    ├── queues.repository.ts
    └── queue-entries.repository.ts
```

---

## Prerequisites

1. Start the PostgreSQL container:
   ```bash
   docker compose up -d postgres
   ```
2. Copy `.env.example` to `.env` at the repo root and set `DATABASE_URL` (it is pre-filled for local Docker).

---

## Migration Workflow

All commands run from the **repo root** and are proxied to `apps/api`.

| Command                     | Effect                                       |
| --------------------------- | -------------------------------------------- |
| `npm run db:migrate`        | Apply all pending migrations (up)            |
| `npm run db:migrate:down`   | Roll back the latest migration (down)        |
| `npm run db:migrate:redo`   | Roll back then re-apply the latest migration |
| `npm run db:migrate:status` | List applied vs. pending migrations          |

### First-time setup

```bash
npm run db:migrate
npm run db:seed
```

### Roll back everything (dev only)

```bash
npm run db:migrate:down   # repeat until "No more migrations to revert"
```

---

## Seed Workflow

| Command                 | Effect                                                     |
| ----------------------- | ---------------------------------------------------------- |
| `npm run db:seed`       | Insert seed data (idempotent — safe to run multiple times) |
| `npm run db:seed:reset` | Truncate all tables, then re-seed from scratch             |

### What gets seeded

**001 — Organization & staff**

- Organization: _The Queue Lab_ (`slug: the-queue-lab`, `timezone: Asia/Bangkok`)
- Manager user: `alice@queue-lab.test`
- Staff user: `bob@queue-lab.test`

**002 — Queues**

- _Walk-in Counter A_ — prefix `A`, avg service 5 min, 3 notify-ahead, unlimited capacity
- _VIP Lane_ — prefix `VIP`, avg service 3 min, 2 notify-ahead, max 10

**003 — Test data (for UI/API development)**

- 5 customer users each linked to a fake LINE account (`U000…001` — `U000…005`)
- Counter A: tickets A-001–A-005 `waiting`, A-006 `called`, A-007 `serving`
- VIP Lane: VIP-001, VIP-002 `waiting`
- 3 completed `queue_histories` entries (analytics)
- 1 `sent` notification entry

---

## Writing a New Migration

1. Create a file in `db/migrations/node-pg-migrate/` named `<sequential_number>_<snake_case_description>.ts`.  
   Example: `000006_add_queue_settings_column.ts`

2. Use the `MigrationBuilder` API:

   ```typescript
   import { MigrationBuilder } from 'node-pg-migrate';

   export const shorthands = undefined;

   export async function up(pgm: MigrationBuilder): Promise<void> {
     pgm.addColumn('queues', {
       extra_settings: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
     });
   }

   export async function down(pgm: MigrationBuilder): Promise<void> {
     pgm.dropColumn('queues', 'extra_settings');
   }
   ```

3. Apply and verify:
   ```bash
   npm run db:migrate          # applies up()
   npm run db:migrate:status   # confirm it shows as applied
   npm run db:migrate:redo     # optional: test the down() + up() round-trip
   ```

> **Rule:** every migration must have a working `down()` that fully reverses `up()`.

---

## Repository Pattern

Service-layer code should import from `@/db/repositories`:

```typescript
import { queuesRepository, queueEntriesRepository } from '@/db/repositories';
import { withTransaction } from '@/db/transaction';

// Read (pool)
const queue = await queuesRepository.findById(id);

// Write inside a transaction
await withTransaction(async (client) => {
  const ticketNo = await queuesRepository.incrementAndGetCounter(queueId);
  await queueEntriesRepository.create({ queueId, ticketNumber: ticketNo, … }, client);
});
```

> Never write raw `pg` queries outside the `db/` folder.
