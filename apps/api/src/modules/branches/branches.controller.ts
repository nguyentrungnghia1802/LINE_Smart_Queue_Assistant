import type { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../../utils/response';
import type { BusinessCalendarDto } from '../orgs/orgs.validator';

import { branchesService } from './branches.service';
import type {
  CreateBranchDto,
  InviteBranchManagerDto,
  UpdateMyBranchDto,
} from './branches.validator';

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const listBranches = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await branchesService.list(actor(req)));
});

export const createBranch = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(res, await branchesService.create(actor(req), req.body as CreateBranchDto));
});

export const inviteBranchManager = asyncHandler(async (req: Request, res: Response) => {
  sendCreated(
    res,
    await branchesService.inviteManager(
      actor(req),
      req.params['branchId'] ?? '',
      req.body as InviteBranchManagerDto
    )
  );
});

export const removeBranchManager = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    await branchesService.removeManager(
      actor(req),
      req.params['branchId'] ?? '',
      req.params['userId'] ?? ''
    )
  );
});

export const listOrganizationAudit = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await branchesService.audit(actor(req), Number(req.query['limit'] ?? 100)));
});

export const getMyBranch = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await branchesService.getMyBranch(actor(req)));
});

export const updateMyBranch = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    await branchesService.updateMyBranch(actor(req), req.body as UpdateMyBranchDto, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    })
  );
});

export const getMyBranchBusinessCalendar = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await branchesService.getMyBusinessCalendar(actor(req)));
});

export const updateMyBranchBusinessCalendar = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    await branchesService.updateMyBusinessCalendar(actor(req), req.body as BusinessCalendarDto, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    })
  );
});

export const getOrganizationBranchAnalytics = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await branchesService.analytics(actor(req)));
});
