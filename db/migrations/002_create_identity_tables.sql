-- =============================================================================
-- Migration 002: Identity tables
-- =============================================================================
--
-- Tables created here:
--   users                — platform identity record (one per human)
--   line_accounts        — LINE profile linked to a user (1 user : 1 LINE account)
--   organizations        — venue / business that creates and operates queues
--   organization_members — M:N staff membership (users ↔ organizations)
--
-- Relationship overview:
--
--   users ──< line_accounts          1 user → 0..1 LINE account
--                                    (customer must have 1; staff may not)
--
--   organizations ──< organization_members >── users
--                                    A user can be staff at multiple orgs.
--                                    A customer (user_role='customer') has NO
--                                    organization_members row.
--
-- Schema conventions:
--   • All PKs are UUID (gen_random_uuid()) for safe distribution / merge.
--   • Every mutable table has created_at + updated_at.
--   • set_updated_at() trigger function defined here; reused by all later tables.
--   • Soft-delete via is_active flag (no physical DELETE on live records).
-- =============================================================================

BEGIN;

-- ── Utility trigger: auto-set updated_at ─────────────────────────────────────
-- Created once here; referenced by all subsequent BEFORE UPDATE triggers.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── users ─────────────────────────────────────────────────────────────────────
-- Central identity table. One row per human.
--
-- Customers:  role='customer', no organization_members row.
--             Their only login path is LINE (linked via line_accounts).
-- Staff:      role IN ('staff','manager','admin'), has organization_members row.
--             May authenticate via email/password (future) or LINE.
--
-- email is NULLABLE because LINE customers typically have no email in our system.
-- email UNIQUE constraint only fires on non-NULL values (PostgreSQL behaviour).

CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  TEXT        NOT NULL,
  email         TEXT        UNIQUE,                    -- nullable; staff may have email
  role          user_role   NOT NULL DEFAULT 'customer',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_email_format CHECK (
    email IS NULL
    OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── line_accounts ─────────────────────────────────────────────────────────────
-- Stores the LINE identity linked to a users row.
-- Populated on the first LINE webhook "follow" event or LIFF login.
--
-- line_user_id  — LINE's opaque global userId (e.g. "U4af4980629...").
--                 Immutable; never changes for the same LINE account.
--                 UNIQUE: one LINE account can only be linked to one platform user.
--
-- user_id UNIQUE: one platform user can only link one LINE account (1:1 enforced
--                 in both directions via two separate UNIQUE constraints).
--
-- display_name / picture_url — cached from LINE; refreshed on each webhook.
--
-- is_linked=FALSE means the user unfollowed the OA; we keep the row for history.

CREATE TABLE line_accounts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  line_user_id    TEXT        NOT NULL,
  display_name    TEXT        NOT NULL,
  picture_url     TEXT,
  status_message  TEXT,
  is_linked       BOOLEAN     NOT NULL DEFAULT TRUE,   -- FALSE after unfollow
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT line_accounts_line_user_id_unique UNIQUE (line_user_id),
  CONSTRAINT line_accounts_user_id_unique      UNIQUE (user_id)          -- 1 LINE per user
);

-- ── organizations ─────────────────────────────────────────────────────────────
-- A venue or business that creates and operates queues.
-- One LINE OA (Official Account) typically maps to one organization.
--
-- slug        — URL-safe identifier used in LIFF deep links, e.g. "central-world".
--               Immutable after creation (changing breaks existing URLs).
--
-- line_channel_id    — LINE Messaging API channel; used to send push messages.
-- line_oa_basic_id   — The @handle shown in LINE app, e.g. "@centralworld".
--
-- settings JSONB holds flexible org-level config:
--   {
--     "liff_id": "...",
--     "brand_color": "#FF6B35",
--     "max_advance_book_days": 7,
--     "service_categories": ["haircut", "colour"],
--     "require_check_in_distance_metres": 200
--   }
--
-- Multi-org support: platform super_admin can manage all orgs.
-- One org can have multiple queues (see migration 003).

CREATE TABLE organizations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  slug              TEXT        NOT NULL,
  line_channel_id   TEXT,
  line_oa_basic_id  TEXT,
  timezone          TEXT        NOT NULL DEFAULT 'Asia/Bangkok',
  settings          JSONB       NOT NULL DEFAULT '{}',
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT organizations_slug_unique  UNIQUE (slug),
  -- slug must be lowercase alphanumeric + hyphens, min 2 chars, no leading/trailing hyphen
  CONSTRAINT organizations_slug_format  CHECK  (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
);

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── organization_members ──────────────────────────────────────────────────────
-- Grants a user a staff role within a specific organization.
-- Customers never have rows here.
-- A single user may be staff at multiple orgs (composite UNIQUE prevents duplicates).
--
-- Role hierarchy (enforced at app layer):
--   owner   > manager > staff
--   owner   — can transfer ownership, delete org (future billing)
--   manager — configure queues, manage staff membership
--   staff   — call/serve/skip tickets; read-only analytics

CREATE TABLE organization_members (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID            NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  role             org_member_role NOT NULL DEFAULT 'staff',
  joined_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT org_members_unique UNIQUE (organization_id, user_id)
);

COMMIT;
