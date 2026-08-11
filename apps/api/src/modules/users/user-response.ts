import type { UserRow } from '../../db/repositories/users.repository';

/**
 * Public API projection for a user record.
 *
 * Keep this as an explicit allowlist: repository rows include password and audit
 * metadata that must never cross an HTTP response boundary.
 */
export function toUserResponse(user: UserRow) {
  return {
    id: user.id,
    display_name: user.display_name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    account_status: user.account_status,
    phone: user.phone,
    postal_code: user.postal_code,
    prefecture: user.prefecture,
    city: user.city,
    address_line1: user.address_line1,
    address_line2: user.address_line2,
    job_title: user.job_title,
    employee_code: user.employee_code,
    activated_at: user.activated_at,
    deactivated_at: user.deactivated_at,
    preferred_locale: user.preferred_locale,
    assigned_queue_id: user.assigned_queue_id,
    assigned_queue_name: user.assigned_queue_name,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export function toUserResponses(users: UserRow[]) {
  return users.map(toUserResponse);
}
