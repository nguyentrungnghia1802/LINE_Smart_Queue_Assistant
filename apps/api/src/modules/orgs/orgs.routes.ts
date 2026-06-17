import { Router } from 'express';

import { requireAuth } from '../../middlewares';

import { getManagerOrg, getOrgBySlug, getOrgByToken } from './orgs.controller';

export const orgsRouter = Router();

// Authenticated: manager's org info with publicQrToken
orgsRouter.get('/my-org', requireAuth, getManagerOrg);

// Public: get org info by QR token (stable token-based routing)
// MUST come before /:slug to avoid collision
orgsRouter.get('/by-token/:token', getOrgByToken);

// Public: get org info + queue status + products for customer QR landing
orgsRouter.get('/:slug', getOrgBySlug);
