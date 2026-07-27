import { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { sendNoContent, sendSuccess } from '../../utils/response';

import { adminService } from './admin.service';
import { UpdateManagerDto } from './admin.validator';

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await adminService.getDashboard());
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

export const updateManager = asyncHandler(async (req: Request, res: Response) => {
  const manager = await adminService.updateManager(
    req.params['orgId'] ?? '',
    req.params['userId'] ?? '',
    req.body as UpdateManagerDto
  );
  sendSuccess(res, manager);
});
