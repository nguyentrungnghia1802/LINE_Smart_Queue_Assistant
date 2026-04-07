import { usersRepository } from '../../db/repositories/users.repository';
import { AppError } from '../../utils/AppError';

import { CreateUserDto } from './users.validator';

export const usersService = {
  async getUser(id: string) {
    const user = await usersRepository.findById(id);
    if (!user) throw AppError.notFound(`User ${id} not found`);
    return user;
  },

  async createUser(dto: CreateUserDto) {
    const existing = dto.email ? await usersRepository.findByEmail(dto.email) : null;
    if (existing) throw AppError.conflict('A user with this email already exists');

    return usersRepository.create({
      displayName: dto.displayName,
      email: dto.email,
      role: dto.role,
    });
  },

  async deactivateUser(id: string) {
    const existing = await usersRepository.findById(id);
    if (!existing) throw AppError.notFound(`User ${id} not found`);
    await usersRepository.deactivate(id);
  },
};
