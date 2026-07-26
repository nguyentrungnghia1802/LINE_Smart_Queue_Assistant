import type { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../../utils/response';

import { branchesService } from './branches.service';
import type { CreateBranchDto, InviteBranchManagerDto } from './branches.validator';

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
