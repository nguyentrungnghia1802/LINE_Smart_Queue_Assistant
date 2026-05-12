/**
 * Skip & Penalty Policy — MVP Configuration
 *
 * NOTE: MVP Policy. All skip/penalty business rules are centralized here so
 * the entire policy can be adjusted by editing a single file.
 *
 * Future evolution:
 *   - Move per-organization overrides to a `queue_policies` table.
 *   - Keep this file as the system-wide fallback defaults.
 */
export const SKIP_PENALTY_POLICY = {
  // ── Self-skip rules ─────────────────────────────────────────────────────────

  /**
   * Default maximum number of allowed self-skips per queue entry before a
   * 'skip' penalty record is created for the user.
   *
   * Queue-level override (`queues.max_skips_before_penalty`) takes precedence
   * when provided.
   */
  DEFAULT_MAX_SKIPS_BEFORE_PENALTY: 3,

  // ── Skip penalty rules ───────────────────────────────────────────────────────

  /**
   * Severity assigned to the penalty record when a user exhausts their skip
   * allowance. 'warning' = informational; no hard restriction on re-entry.
   */
  SKIP_PENALTY_SEVERITY: 'warning' as const,

  /**
   * Hours before a skip penalty expires and is no longer factored into
   * join-time priority.
   */
  SKIP_PENALTY_EXPIRY_HOURS: 24,

  // ── No-show penalty rules ────────────────────────────────────────────────────

  /**
   * Severity assigned to the penalty record when a ticket is marked no-show
   * by staff. 'minor' = short cooldown applied at next join.
   */
  NO_SHOW_PENALTY_SEVERITY: 'minor' as const,

  /**
   * Hours before a no-show penalty expires.
   */
  NO_SHOW_PENALTY_EXPIRY_HOURS: 24,

  // ── Join-time priority adjustment ─────────────────────────────────────────────

  /**
   * Priority value applied to a new queue entry when the joining user has one
   * or more active penalties in the same organization.
   *
   * Negative = lower initial priority = the entry sits behind penalty-free
   * entries (which default to priority 0).
   */
  PENALTY_PRIORITY_DEDUCTION: -3,
} as const;
