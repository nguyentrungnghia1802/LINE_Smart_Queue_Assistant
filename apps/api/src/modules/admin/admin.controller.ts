import { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/response';

import { adminService } from './admin.service';
import {
  CreateManagerDto,
  CreateOrganizationDto,
  CreateOrganizationRegistrationDto,
  UpdateManagerDto,
  UpdateOrganizationDto,
} from './admin.validator';

export const listOrganizations = asyncHandler(async (_req: Request, res: Response) => {
  const orgs = await adminService.listOrganizations();
  sendSuccess(res, orgs);
});

export const createOrganization = asyncHandler(async (req: Request, res: Response) => {
  const org = await adminService.createOrganization(req.body as CreateOrganizationDto);
  sendCreated(res, org);
});

export const registerOrganization = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.registerOrganization(
    req.body as CreateOrganizationRegistrationDto
  );
  sendCreated(res, result);
});

export const updateOrganization = asyncHandler(async (req: Request, res: Response) => {
  const org = await adminService.updateOrganization(
    req.params['orgId'] ?? '',
    req.body as UpdateOrganizationDto
  );
  sendSuccess(res, org);
});

export const removeOrganization = asyncHandler(async (req: Request, res: Response) => {
  await adminService.removeOrganization(req.params['orgId'] ?? '');
  sendNoContent(res);
});

export const listManagers = asyncHandler(async (req: Request, res: Response) => {
  const managers = await adminService.listManagers(req.params['orgId'] ?? '');
  sendSuccess(res, managers);
});

export const createManager = asyncHandler(async (req: Request, res: Response) => {
  const manager = await adminService.createManager(
    req.params['orgId'] ?? '',
    req.body as CreateManagerDto
  );
  sendCreated(res, manager);
});

export const updateManager = asyncHandler(async (req: Request, res: Response) => {
  const manager = await adminService.updateManager(
    req.params['orgId'] ?? '',
    req.params['userId'] ?? '',
    req.body as UpdateManagerDto
  );
  sendSuccess(res, manager);
});

export const removeManager = asyncHandler(async (req: Request, res: Response) => {
  await adminService.removeManager(req.params['orgId'] ?? '', req.params['userId'] ?? '');
  sendNoContent(res);
});
