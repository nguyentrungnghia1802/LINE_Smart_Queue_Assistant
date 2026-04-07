import { Router } from 'express';

import { validate } from '../../middlewares/validate.middleware';
import { UUIDParamSchema } from '../shared/shared.validator';

import { createUser, deactivateUser, getUser } from './users.controller';
import { CreateUserSchema } from './users.validator';

export const usersRouter = Router();

usersRouter.get('/:id', validate(UUIDParamSchema, 'params'), getUser);
usersRouter.post('/', validate(CreateUserSchema), createUser);
usersRouter.delete('/:id', validate(UUIDParamSchema, 'params'), deactivateUser);
