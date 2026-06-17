import bcrypt from 'bcryptjs';

import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { AppError } from '../../utils/AppError';

import { CreateUserDto } from './users.validator';

export const usersService = {
  async getUser(id: string) {
    const user = await usersRepository.findById(id);
    if (!user) throw AppError.notFound(`User ${id} not found`);
    return user;
  },

  async listUsersByOrg(orgId: string, role?: string) {
    return usersRepository.findByOrgAndRole(orgId, role);
  },

  async updateMyProfile(userId: string, data: { displayName?: string; email?: string }) {
    const existing = await usersRepository.findById(userId);
    if (!existing) throw AppError.notFound(`User ${userId} not found`);
    const updated = await usersRepository.updateProfile(userId, data);
    if (!updated) throw AppError.notFound('User not found');
    return updated;
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

  /**
   * Create a staff account and add them to the organization.
   * Manager-only action.
   */
  async createStaff(
    orgId: string,
    data: { displayName: string; email: string; password: string }
  ) {
    const existing = await usersRepository.findByEmail(data.email);
    if (existing) throw AppError.conflict('A user with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await usersRepository.createWithPassword({
      displayName: data.displayName,
      email: data.email,
      role: 'staff',
      passwordHash,
    });

    await organizationsRepository.addMember(orgId, user.id, 'staff');

    return user;
  },

  /**
   * Toggle a staff member's active status.
   */
  async updateStaffStatus(orgId: string, userId: string, isActive: boolean) {
    // Verify the user is a member of this org
    const member = await organizationsRepository.findMember(orgId, userId);
    if (!member) throw AppError.notFound('Staff member not found in this organization');

    const user = await usersRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');

    await usersRepository.setActive(userId, isActive);
    return usersRepository.findById(userId);
  },
};
