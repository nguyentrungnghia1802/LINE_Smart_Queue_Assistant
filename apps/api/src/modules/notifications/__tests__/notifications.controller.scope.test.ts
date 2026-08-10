import type { Request } from 'express';

import { UserRole } from '@line-queue/shared';

import { resolveNotificationOperationScope } from '../notifications.controller';

function request(user: Request['user'], query: Request['query'] = {}): Request {
  return { user, query } as Request;
}

describe('notification operations authorization scope', () => {
  it('rejects admin from accessing tenant notification operations', () => {
    expect(() =>
      resolveNotificationOperationScope(request({ id: 'admin', role: UserRole.ADMIN }))
    ).toThrow('Platform admin cannot access tenant notification operations');
  });

  it('rejects organization owners from accessing notification operations', () => {
    expect(() =>
      resolveNotificationOperationScope(
        request({
          id: 'owner',
          role: UserRole.MANAGER,
          organizationId: 'org-1',
          isOrganizationOwner: true,
        })
      )
    ).toThrow('Organization owner cannot access notification operations');
  });

  it('pins branch managers to exactly their assigned branch, ignoring client branchId queries', () => {
    expect(
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
        ) // Client attempts to query branch-2
      )
    ).toEqual({ organizationId: 'org-1', branchId: 'branch-1' });
  });

  it('allows branch managers to filter by queueId within their branch', () => {
    expect(
      resolveNotificationOperationScope(
        request(
          {
            id: 'manager',
            role: UserRole.MANAGER,
            organizationId: 'org-1',
            isOrganizationOwner: false,
            branchIds: ['branch-1'],
          },
          { queueId: 'queue-1' }
        )
      )
    ).toEqual({ organizationId: 'org-1', branchId: 'branch-1', queueId: 'queue-1' });
  });

  it('pins staff to exactly their assigned branch and queue', () => {
    expect(
      resolveNotificationOperationScope(
        request({
          id: 'staff-1',
          role: UserRole.STAFF,
          organizationId: 'org-1',
          isOrganizationOwner: false,
          branchIds: ['branch-1'],
          assignedQueueId: 'queue-1',
        })
      )
    ).toEqual({ organizationId: 'org-1', branchId: 'branch-1', queueId: 'queue-1' });
  });
});
