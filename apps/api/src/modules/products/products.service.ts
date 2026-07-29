import type { SupportedLocale } from '@line-queue/shared';

import { auditLogRepository } from '../../db/repositories/audit-log.repository';
import { productsRepository } from '../../db/repositories/products.repository';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';

import { CreateProductDto, UpdateBranchStockDto, UpdateProductDto } from './products.validator';

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

  async getByBranch(branchId: string, locale: SupportedLocale = 'ja') {
    return productsRepository.findByBranch(branchId, locale);
  },

  async getCatalogByBranch(branchId: string, locale: SupportedLocale = 'ja') {
    return productsRepository.findCatalogByBranch(branchId, locale);
  },

  async updateBranchStock(
    id: string,
    organizationId: string,
    branchId: string,
    dto: UpdateBranchStockDto,
    audit: AuditContext
  ) {
    const product = await productsRepository.findById(id);
    if (!product || product.organization_id !== organizationId) {
      throw AppError.notFound('Product not found');
    }
    const updated = await productsRepository.updateBranchStock(
      branchId,
      id,
      organizationId,
      product.product_type === 'service' ? null : dto.stockQuantity,
      dto.lowStockThreshold
    );
    if (!updated) throw AppError.notFound('Product not found');
    await auditLogRepository.create({
      actorId: audit.actorUserId,
      actorType: 'user',
      action: 'branch_inventory.update',
      resourceType: 'branch_product_inventory',
      resourceId: id,
      organizationId,
      changes: {
        branchId,
        stockQuantity: updated.stock_quantity,
        lowStockThreshold: updated.low_stock_threshold,
      },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });
    return updated;
  },

  async getById(id: string) {
    const product = await productsRepository.findById(id);
    if (!product) throw AppError.notFound('Product not found');
    return product;
  },

  async create(organizationId: string, dto: CreateProductDto, audit?: AuditContext) {
    const product = await withTransaction(async (client) => {
      await productsRepository.lockCatalogNumbering(organizationId, client);
      return productsRepository.create(
        {
          organizationId,
          name: dto.name,
          description: dto.description,
          imageUrl: dto.imageUrl,
          price: dto.price,
          serviceTimeMinutes: dto.serviceTimeMinutes,
          maxWaitMinutes: dto.maxWaitMinutes,
          requiresPrepayment: dto.requiresPrepayment,
          productType: dto.productType,
        },
        client
      );
    });

    if (audit) {
      await auditLogRepository.create({
        actorId: audit.actorUserId,
        actorType: 'user',
        action: 'product.create',
        resourceType: 'product',
        resourceId: product.id,
        organizationId,
        changes: { new: dto },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
    }

    return product;
  },

  async update(id: string, organizationId: string, dto: UpdateProductDto, audit?: AuditContext) {
    const product = await productsRepository.findById(id);
    if (!product) throw AppError.notFound('Product not found');
    if (product.organization_id !== organizationId) {
      throw AppError.forbidden('Product is outside your organization');
    }
    if (
      (dto.requiresPrepayment ?? product.requires_prepayment) &&
      (dto.price ?? Number(product.price)) <= 0
    ) {
      throw AppError.unprocessable('Prepaid products must have a price greater than zero', {
        fieldErrors: { price: ['Prepaid products must have a price greater than zero'] },
      });
    }
    const nextProductType = dto.productType ?? product.product_type;
    const updated = await withTransaction(async (client) => {
      if (nextProductType !== product.product_type) {
        await productsRepository.lockCatalogNumbering(organizationId, client);
        await productsRepository.assignNextCodeForType(id, organizationId, nextProductType, client);
      }
      const result = await productsRepository.update(id, dto, client);
      if (!result) throw AppError.notFound('Product not found');
      return result;
    });
    if (!updated) throw AppError.notFound('Product not found');

    if (audit) {
      await auditLogRepository.create({
        actorId: audit.actorUserId,
        actorType: 'user',
        action: 'product.update',
        resourceType: 'product',
        resourceId: id,
        organizationId,
        changes: { old: product, new: updated },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
    }

    return updated;
  },

  async remove(id: string, organizationId: string, audit?: AuditContext) {
    const product = await productsRepository.findById(id);
    if (!product) throw AppError.notFound('Product not found');
    if (product.organization_id !== organizationId) {
      throw AppError.forbidden('Product is outside your organization');
    }
    await productsRepository.softDelete(id);

    if (audit) {
      await auditLogRepository.create({
        actorId: audit.actorUserId,
        actorType: 'user',
        action: 'product.delete',
        resourceType: 'product',
        resourceId: id,
        organizationId,
        changes: { old: product, new: { is_active: false } },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
    }
  },
};
