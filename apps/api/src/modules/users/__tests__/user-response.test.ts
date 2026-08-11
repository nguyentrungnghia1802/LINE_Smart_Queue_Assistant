import type { UserRow } from '../../../db/repositories/users.repository';
import { toUserResponse } from '../user-response';

describe('toUserResponse', () => {
  it('uses an allowlist and never exposes credentials or internal actor metadata', () => {
    const row: UserRow = {
      id: 'user-1',
      display_name: 'Queue Staff',
      email: 'staff@example.jp',
      password_hash: 'bcrypt-secret',
      role: 'staff',
      is_active: true,
      account_status: 'active',
      invited_by: 'manager-1',
      deactivated_by: 'manager-2',
      created_at: new Date('2026-08-11T00:00:00.000Z'),
      updated_at: new Date('2026-08-11T00:00:00.000Z'),
    };

    const response = toUserResponse(row);

    expect(response).toEqual(expect.objectContaining({ id: 'user-1', role: 'staff' }));
    expect(response).not.toHaveProperty('password_hash');
    expect(response).not.toHaveProperty('invited_by');
    expect(response).not.toHaveProperty('deactivated_by');
  });
});
