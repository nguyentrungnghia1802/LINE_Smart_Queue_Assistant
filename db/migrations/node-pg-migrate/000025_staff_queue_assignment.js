/* eslint-disable no-undef */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(String.raw`
    ALTER TABLE branch_memberships
      ADD COLUMN queue_id UUID;

    UPDATE branch_memberships membership
    SET queue_id = (
      SELECT queue.id
      FROM queues queue
      WHERE queue.organization_id = membership.organization_id
        AND queue.branch_id = membership.branch_id
        AND queue.is_active = TRUE
      ORDER BY queue.created_at, queue.id
      LIMIT 1
    )
    WHERE membership.role = 'staff'
      AND membership.queue_id IS NULL;

    UPDATE branch_memberships
    SET is_active = FALSE,
        deactivated_at = COALESCE(deactivated_at, NOW())
    WHERE role = 'staff'
      AND queue_id IS NULL
      AND is_active = TRUE;

    WITH ranked_staff_assignments AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY user_id
               ORDER BY is_active DESC, assigned_at DESC, id
             ) AS assignment_rank
      FROM branch_memberships
      WHERE role = 'staff'
        AND deactivated_at IS NULL
    )
    UPDATE branch_memberships membership
    SET is_active = FALSE,
        deactivated_at = NOW()
    FROM ranked_staff_assignments ranked
    WHERE membership.id = ranked.id
      AND ranked.assignment_rank > 1;

    ALTER TABLE branch_memberships
      ADD CONSTRAINT branch_memberships_queue_scope_fk
        FOREIGN KEY (queue_id, organization_id, branch_id)
        REFERENCES queues(id, organization_id, branch_id)
        ON DELETE RESTRICT,
      ADD CONSTRAINT branch_memberships_staff_queue_required
        CHECK (role <> 'staff' OR is_active = FALSE OR queue_id IS NOT NULL);

    CREATE INDEX idx_branch_memberships_queue_staff_active
      ON branch_memberships(queue_id, user_id)
      WHERE role = 'staff' AND is_active = TRUE AND deactivated_at IS NULL;

    CREATE UNIQUE INDEX uq_branch_memberships_staff_assignment
      ON branch_memberships(user_id)
      WHERE role = 'staff' AND deactivated_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(String.raw`
    DROP INDEX IF EXISTS uq_branch_memberships_staff_assignment;
    DROP INDEX IF EXISTS idx_branch_memberships_queue_staff_active;
    ALTER TABLE branch_memberships
      DROP CONSTRAINT IF EXISTS branch_memberships_staff_queue_required,
      DROP CONSTRAINT IF EXISTS branch_memberships_queue_scope_fk,
      DROP COLUMN IF EXISTS queue_id;
  `);
};
