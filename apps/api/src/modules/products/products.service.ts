import type { SupportedLocale } from '@line-queue/shared';

import { auditLogRepository } from '../../db/repositories/audit-log.repository';
import { productsRepository } from '../../db/repositories/products.repository';
import { AppError } from '../../utils/AppError';

import { CreateProductDto, UpdateProductDto } from './products.validator';

interface AuditContext {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

export const productsService = {
  async getByOrg(orgId: string, locale: SupportedLocale = 'ja') {
    return productsRepository.findByOrg(orgId, locale);
  },

  async getByOrgSlug(slug: string, locale: SupportedLocale = 'ja') {
    return productsRepository.findByOrgSlug(slug, locale);
  },

  async getById(id: string) {
    const product = await productsRepository.findById(id);
    if (!product) throw AppError.notFound('Product not found');
    return product;
  },

  async create(orgId: string, dto: CreateProductDto, audit?: AuditContext) {
    const product = await productsRepository.create({ organizationId: orgId, ...dto });

    if (audit) {
      await auditLogRepository.create({
        actorId: audit.actorUserId,
        actorType: 'user',
        action: 'product.create',
        resourceType: 'product',
        resourceId: product.id,
        organizationId: orgId,
        changes: { new: dto },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
    }

    return product;
  },

  async update(id: string, orgId: string, dto: UpdateProductDto, audit?: AuditContext) {
    const product = await productsRepository.findById(id);
    if (!product) throw AppError.notFound('Product not found');
    if (product.organization_id !== orgId) throw AppError.forbidden();
    if (
      (dto.requiresPrepayment ?? product.requires_prepayment) &&
      (dto.price ?? Number(product.price)) <= 0
    ) {
      throw AppError.unprocessable('Prepaid products must have a price greater than zero', {
        fieldErrors: { price: ['Prepaid products must have a price greater than zero'] },
      });
    }
    const nextProductType = dto.productType ?? product.product_type;
    if (nextProductType === 'service' && dto.stockQuantity !== undefined) {
      throw AppError.unprocessable('Services must use unlimited stock', {
        fieldErrors: { stockQuantity: ['Services must use unlimited stock'] },
      });
    }
    const normalizedDto = {
      ...dto,
      ...(nextProductType === 'service' ? { stockQuantity: null } : {}),
    };
    const updated = await productsRepository.update(id, normalizedDto);
    if (!updated) throw AppError.notFound('Product not found');

    if (audit) {
      await auditLogRepository.create({
        actorId: audit.actorUserId,
        actorType: 'user',
        action: 'product.update',
        resourceType: 'product',
        resourceId: id,
        organizationId: orgId,
        changes: { old: product, new: updated },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
    }

    return updated;
  },

  async remove(id: string, orgId: string, audit?: AuditContext) {
    const product = await productsRepository.findById(id);
    if (!product) throw AppError.notFound('Product not found');
    if (product.organization_id !== orgId) throw AppError.forbidden();
    await productsRepository.softDelete(id);

    if (audit) {
      await auditLogRepository.create({
        actorId: audit.actorUserId,
        actorType: 'user',
        action: 'product.delete',
        resourceType: 'product',
        resourceId: id,
        organizationId: orgId,
        changes: { old: product, new: { is_active: false } },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
    }
  },
};
