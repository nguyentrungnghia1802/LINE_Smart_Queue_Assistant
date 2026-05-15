import { Router } from 'express';

import { getOrgBySlug } from './orgs.controller';

export const orgsRouter = Router();

// Public: get org info + queue status + products for customer QR landing
orgsRouter.get('/:slug', getOrgBySlug);
