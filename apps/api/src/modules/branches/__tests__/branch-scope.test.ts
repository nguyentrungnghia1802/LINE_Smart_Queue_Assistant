import { UserRole } from '@line-queue/shared';

import type { AuthUser } from '../../../types/auth.types';
import {
  requireBranchManager,
  requireBranchOperator,
  requireOrganizationOwner,
} from '../branch-scope';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const BRANCH_ID = '22222222-2222-4222-8222-222222222222';

function actor(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    role: UserRole.MANAGER,
    organizationId: ORG_ID,
    isOrganizationOwner: false,
    branchIds: [BRANCH_ID],
    ...overrides,
  };
}

describe('branch role scopes', () => {
  it('resolves one assigned branch for a branch manager', () => {
    expect(requireBranchManager(actor())).toEqual({
      organizationId: ORG_ID,
      branchId: BRANCH_ID,
    });
  });

  it('rejects organization owners from branch operations', () => {
    const owner = actor({ isOrganizationOwner: true, branchIds: [] });

    expect(() => requireBranchManager(owner)).toThrow(
      'This action is available only to a branch manager'
    );
    expect(() => requireBranchOperator(owner)).toThrow(
      'This action is available only to branch operations staff'
    );
    expect(requireOrganizationOwner(owner)).toBe(ORG_ID);
  });

  it('rejects a branch manager with zero or multiple assignments', () => {
    expect(() => requireBranchManager(actor({ branchIds: [] }))).toThrow(
      'exactly one active branch assignment'
    );
    expect(() =>
      requireBranchManager(
        actor({
          branchIds: [BRANCH_ID, '44444444-4444-4444-8444-444444444444'],
        })
      )
    ).toThrow('exactly one active branch assignment');
  });

  it('allows branch staff to use operational scope without granting manager scope', () => {
    const staff = actor({ role: UserRole.STAFF });

    expect(requireBranchOperator(staff)).toEqual({
      actorId: staff.id,
      organizationId: ORG_ID,
      branchId: BRANCH_ID,
    });
    expect(() => requireBranchManager(staff)).toThrow(
      'This action is available only to a branch manager'
    );
  });
});
