import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { AppError } from '../../utils/AppError';

import {
  CreateManagerDto,
  CreateOrganizationDto,
  UpdateManagerDto,
  UpdateOrganizationDto,
} from './admin.validator';

export const adminService = {
  async listOrganizations() {
    return organizationsRepository.listActive();
  },

  async createOrganization(dto: CreateOrganizationDto) {
    const existing = await organizationsRepository.findBySlug(dto.slug);
    if (existing) throw AppError.conflict('An organization with this slug already exists');

    return organizationsRepository.create({
      name: dto.name,
      slug: dto.slug,
      publicQrToken: dto.publicQrToken ?? `org-${randomUUID()}`,
      logoUrl: dto.logoUrl ?? null,
      phone: dto.phone ?? null,
      address: dto.address ?? null,
      paymentInfo: dto.paymentInfo ?? null,
    });
  },

  async updateOrganization(orgId: string, dto: UpdateOrganizationDto) {
    const org = await organizationsRepository.findById(orgId);
    if (!org) throw AppError.notFound('Organization not found');

    if (dto.slug && dto.slug !== org.slug) {
      const existing = await organizationsRepository.findBySlug(dto.slug);
      if (existing && existing.id !== orgId) {
        throw AppError.conflict('An organization with this slug already exists');
      }
    }

    const updated = await organizationsRepository.updateOrg(orgId, dto);
    if (!updated) throw AppError.notFound('Organization not found');
    return updated;
  },

  async removeOrganization(orgId: string) {
    const org = await organizationsRepository.findById(orgId);
    if (!org) throw AppError.notFound('Organization not found');
    await organizationsRepository.deactivate(orgId);
  },

  async listManagers(orgId: string) {
    const org = await organizationsRepository.findById(orgId);
    if (!org) throw AppError.notFound('Organization not found');
    return usersRepository.findByOrgAndRole(orgId, 'manager');
  },

  async createManager(orgId: string, dto: CreateManagerDto) {
    const org = await organizationsRepository.findById(orgId);
    if (!org) throw AppError.notFound('Organization not found');

    const existing = await usersRepository.findByEmail(dto.email);
    if (existing) throw AppError.conflict('A user with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await usersRepository.createWithPassword({
      displayName: dto.displayName,
      email: dto.email,
      role: 'manager',
      passwordHash,
    });

    await organizationsRepository.addMember(orgId, user.id, 'manager');
    return user;
  },

  async updateManager(orgId: string, userId: string, dto: UpdateManagerDto) {
    const member = await organizationsRepository.findMember(orgId, userId);
    if (!member || member.role !== 'manager') {
      throw AppError.notFound('Manager not found in this organization');
    }

    const user = await usersRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');

    if (dto.email && dto.email !== user.email) {
      const duplicate = await usersRepository.findByEmail(dto.email);
      if (duplicate && duplicate.id !== userId) {
        throw AppError.conflict('A user with this email already exists');
      }
    }

    const updated = await usersRepository.updateProfile(userId, {
      displayName: dto.displayName,
      email: dto.email,
    });

    if (dto.password?.trim()) {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      await usersRepository.setPassword(userId, passwordHash);
    }

    if (dto.isActive !== undefined) {
      await usersRepository.setActive(userId, dto.isActive);
      await organizationsRepository.setMemberActive(orgId, userId, dto.isActive);
    }

    return usersRepository.findById(updated?.id ?? userId);
  },

  async removeManager(orgId: string, userId: string) {
    const member = await organizationsRepository.findMember(orgId, userId);
    if (!member || member.role !== 'manager') {
      throw AppError.notFound('Manager not found in this organization');
    }

    await organizationsRepository.setMemberActive(orgId, userId, false);
    await usersRepository.setActive(userId, false);
  },
};
