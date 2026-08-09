import type { Request } from 'express';

import { UserRole } from '@line-queue/shared';

import { resolveNotificationOperationScope } from '../notifications.controller';

function request(user: Request['user'], query: Request['query'] = {}): Request {
  return { user, query } as Request;
}

describe('notification operations authorization scope', () => {
  it('allows admin to select platform organization and branch filters', () => {
    expect(
      resolveNotificationOperationScope(
        request(
          { id: 'admin', role: UserRole.ADMIN },
          { organizationId: 'org-1', branchId: 'branch-1' }
        )
      )
    ).toEqual({ organizationId: 'org-1', branchId: 'branch-1' });
  });

  it('pins organization owners to their own tenant', () => {
    expect(
      resolveNotificationOperationScope(
        request(
          {
            id: 'owner',
            role: UserRole.MANAGER,
            organizationId: 'org-1',
            isOrganizationOwner: true,
          },
          { organizationId: 'other-org', branchId: 'branch-1' }
        )
      )
    ).toEqual({ organizationId: 'org-1', branchId: 'branch-1' });
  });

  it('pins branch managers to exactly their assigned branch', () => {
    expect(
      resolveNotificationOperationScope(
        request({
          id: 'manager',
          role: UserRole.MANAGER,
          organizationId: 'org-1',
          isOrganizationOwner: false,
          branchIds: ['branch-1'],
        })
      )
    ).toEqual({ organizationId: 'org-1', branchId: 'branch-1' });
  });

  it('rejects a branch manager trying to query a different branch', () => {
    expect(() =>
      resolveNotificationOperationScope(
        request(
          {
            id: 'manager',
            role: UserRole.MANAGER,
            organizationId: 'org-1',
            isOrganizationOwner: false,
            branchIds: ['branch-1'],
          },
          { branchId: 'branch-2' }
        )
      )
    ).toThrow('outside your assigned branch');
  });
});
