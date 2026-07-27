import type { AuthUser } from '../../types/auth.types';
import { AppError } from '../../utils/AppError';

export interface BranchManagerScope {
  organizationId: string;
  branchId: string;
}

export interface BranchOperatorScope extends BranchManagerScope {
  actorId: string;
}

export function requireOrganizationOwner(actor: AuthUser): string {
  if (!actor.organizationId) throw AppError.badRequest('User has no organization');
  if (actor.role !== 'manager' || !actor.isOrganizationOwner) {
    throw AppError.forbidden('Only the organization owner manager can perform this action');
  }
  return actor.organizationId;
}

export function requireBranchManager(actor: AuthUser): BranchManagerScope {
  if (!actor.organizationId) throw AppError.badRequest('User has no organization');
  if (actor.role !== 'manager' || actor.isOrganizationOwner) {
    throw AppError.forbidden('This action is available only to a branch manager');
  }
  const branchIds = actor.branchIds ?? [];
  if (branchIds.length !== 1) {
    throw AppError.forbidden('Branch manager must have exactly one active branch assignment');
  }
  return { organizationId: actor.organizationId, branchId: branchIds[0] };
}

export function requireBranchOperator(actor: AuthUser): BranchOperatorScope {
  if (!actor.organizationId) throw AppError.badRequest('User has no organization');
  if (!['manager', 'staff'].includes(actor.role) || actor.isOrganizationOwner) {
    throw AppError.forbidden('This action is available only to branch operations staff');
  }
  const branchIds = actor.branchIds ?? [];
  if (branchIds.length !== 1) {
    throw AppError.forbidden('Branch operator must have exactly one active branch assignment');
  }
  return {
    actorId: actor.id,
    organizationId: actor.organizationId,
    branchId: branchIds[0],
  };
}

export function assertBranchAccess(actor: AuthUser, branchId: string): void {
  if (actor.isOrganizationOwner) return;
  if (!(actor.branchIds ?? []).includes(branchId)) {
    throw AppError.forbidden('Resource is outside your assigned branch');
  }
}
