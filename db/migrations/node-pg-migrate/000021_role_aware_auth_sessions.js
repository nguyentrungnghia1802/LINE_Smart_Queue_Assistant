/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE auth_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      family_id UUID NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      session_kind TEXT NOT NULL,
      idle_expires_at TIMESTAMPTZ NOT NULL,
      absolute_expires_at TIMESTAMPTZ NOT NULL,
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      revocation_reason TEXT,
      replaced_by_session_id UUID REFERENCES auth_sessions(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT auth_sessions_kind_valid
        CHECK (session_kind IN ('business', 'customer')),
      CONSTRAINT auth_sessions_absolute_expiry_valid
        CHECK (absolute_expires_at > created_at),
      CONSTRAINT auth_sessions_idle_expiry_valid
        CHECK (idle_expires_at <= absolute_expires_at),
      CONSTRAINT auth_sessions_revocation_consistent
        CHECK (
          (revoked_at IS NULL AND revocation_reason IS NULL)
          OR
          (revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
        )
    );

    CREATE INDEX idx_auth_sessions_user_active
      ON auth_sessions (user_id, absolute_expires_at)
      WHERE revoked_at IS NULL;
    CREATE INDEX idx_auth_sessions_family
      ON auth_sessions (family_id, created_at);
    CREATE INDEX idx_auth_sessions_expiry
      ON auth_sessions (LEAST(idle_expires_at, absolute_expires_at))
      WHERE revoked_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS auth_sessions;');
};
