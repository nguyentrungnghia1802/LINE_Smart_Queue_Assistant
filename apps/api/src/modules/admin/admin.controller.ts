import { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { sendNoContent, sendSuccess } from '../../utils/response';

import { adminService } from './admin.service';
import { UpdateOwnerEmailDto } from './admin.validator';
import { operationalHealthService } from './operational-health.service';

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await adminService.getDashboard());
});

export const getOperationalHealth = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await operationalHealthService.getSnapshot());
});

export const listOrganizations = asyncHandler(async (_req: Request, res: Response) => {
  const orgs = await adminService.listOrganizations();
  sendSuccess(res, orgs);
});

export const removeOrganization = asyncHandler(async (req: Request, res: Response) => {
  await adminService.removeOrganization(req.params['orgId'] ?? '', req.user?.id ?? '');
  sendNoContent(res);
});

export const listManagers = asyncHandler(async (req: Request, res: Response) => {
  const managers = await adminService.listManagers(req.params['orgId'] ?? '');
  sendSuccess(res, managers);
});

export const updateOwnerEmail = asyncHandler(async (req: Request, res: Response) => {
  const manager = await adminService.updateOwnerEmail(
    req.params['orgId'] ?? '',
    req.params['userId'] ?? '',
    req.body as UpdateOwnerEmailDto
  );
  sendSuccess(res, manager);
});
