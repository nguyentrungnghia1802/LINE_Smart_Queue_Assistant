import { Router } from 'express';

import { strictRateLimiter } from '../../middlewares';
import { requireAuth } from '../../middlewares/requireAuth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  deleteLocationData,
  getLocationConsent,
  updateLocationConsent,
} from '../location/location.controller';
import { UpdateLocationConsentSchema } from '../location/location.validator';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../notifications/notification-preferences.controller';
import { UpdateNotificationPreferencesSchema } from '../notifications/notification-preferences.validator';

import { handleWebhook } from './line.controller';

export const lineRouter = Router();

lineRouter.get('/preferences', requireAuth, getNotificationPreferences);
lineRouter.put(
  '/preferences',
  requireAuth,
  validate(UpdateNotificationPreferencesSchema),
  updateNotificationPreferences
);
lineRouter.get('/location-consent', requireAuth, getLocationConsent);
lineRouter.put(
  '/location-consent',
  requireAuth,
  validate(UpdateLocationConsentSchema),
  updateLocationConsent
);
lineRouter.delete('/location-data', requireAuth, deleteLocationData);

/**
 * POST /api/v1/line/webhook
 *
 * Signature verification is performed inside the controller, not as middleware,
 * so that we can access the parsed JSON body (which express.json() already set).
 *
 * strictRateLimiter: 20 req/min per IP — generously sized for LINE's retry logic.
 */
lineRouter.post('/webhook', strictRateLimiter, handleWebhook);
