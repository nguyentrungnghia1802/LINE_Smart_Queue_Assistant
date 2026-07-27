import type { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../../utils/response';

import { organizationApplicationsService } from './organization-applications.service';
import type {
  CreateOrganizationApplicationDto,
  OrganizationApplicationStatusFilter,
  ReviewOrganizationApplicationDto,
  UpdateOrganizationApplicationDto,
} from './organization-applications.validator';

export const submitOrganizationApplication = asyncHandler(async (req: Request, res: Response) => {
  const result = await organizationApplicationsService.submit(
    req.body as CreateOrganizationApplicationDto
  );
  sendCreated(res, result);
});

export const listOrganizationApplications = asyncHandler(async (req: Request, res: Response) => {
  const result = await organizationApplicationsService.list(
    req.query['status'] as OrganizationApplicationStatusFilter
  );
  sendSuccess(res, result);
});

export const updateOrganizationApplication = asyncHandler(async (req: Request, res: Response) => {
  const result = await organizationApplicationsService.update(
    req.params['applicationId'] ?? '',
    req.body as UpdateOrganizationApplicationDto
  );
  sendSuccess(res, result);
});

export const approveOrganizationApplication = asyncHandler(async (req: Request, res: Response) => {
  const result = await organizationApplicationsService.approve(
    req.params['applicationId'] ?? '',
    req.user?.id ?? '',
    req.body as ReviewOrganizationApplicationDto
  );
  sendSuccess(res, result);
});

export const rejectOrganizationApplication = asyncHandler(async (req: Request, res: Response) => {
  const result = await organizationApplicationsService.reject(
    req.params['applicationId'] ?? '',
    req.user?.id ?? '',
    req.body as ReviewOrganizationApplicationDto
  );
  sendSuccess(res, result);
});
