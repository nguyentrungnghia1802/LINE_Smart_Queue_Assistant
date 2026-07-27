import { InviteStaffSchema, UpdateStaffSchema } from './users.validator';

const validStaff = {
  displayName: 'Yuki Tanaka',
  email: 'staff@example.jp',
  phone: '09012345678',
  currentAddress: 'Tokyo',
  jobTitle: 'Reception staff',
  employeeCode: 'ST-001',
};

describe('staff invitation validation', () => {
  it('derives branch scope server-side and requires an employee code', () => {
    expect(InviteStaffSchema.safeParse(validStaff).success).toBe(true);
    expect(InviteStaffSchema.safeParse({ ...validStaff, employeeCode: '' }).success).toBe(false);
    expect(
      InviteStaffSchema.parse({
        ...validStaff,
        branchId: '11111111-1111-4111-8111-111111111111',
      })
    ).not.toHaveProperty('branchId');
  });

  it('does not allow an existing employee code to be cleared', () => {
    expect(UpdateStaffSchema.safeParse({ employeeCode: '' }).success).toBe(false);
    expect(UpdateStaffSchema.safeParse({ employeeCode: 'ST-002' }).success).toBe(true);
  });
});
