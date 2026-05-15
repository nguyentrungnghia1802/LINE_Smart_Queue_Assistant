import { productsRepository } from '../../db/repositories/products.repository';
import { AppError } from '../../utils/AppError';

import { CreateProductDto, UpdateProductDto } from './products.validator';

export const productsService = {
  async getByOrg(orgId: string) {
    return productsRepository.findByOrg(orgId);
  },

  async getByOrgSlug(slug: string) {
    return productsRepository.findByOrgSlug(slug);
  },

  async getById(id: string) {
    const product = await productsRepository.findById(id);
    if (!product) throw AppError.notFound('Product not found');
    return product;
  },

  async create(orgId: string, dto: CreateProductDto) {
    return productsRepository.create({ organizationId: orgId, ...dto });
  },

  async update(id: string, orgId: string, dto: UpdateProductDto) {
    const product = await productsRepository.findById(id);
    if (!product) throw AppError.notFound('Product not found');
    if (product.organization_id !== orgId) throw AppError.forbidden();
    const updated = await productsRepository.update(id, dto);
    if (!updated) throw AppError.notFound('Product not found');
    return updated;
  },

  async remove(id: string, orgId: string) {
    const product = await productsRepository.findById(id);
    if (!product) throw AppError.notFound('Product not found');
    if (product.organization_id !== orgId) throw AppError.forbidden();
    await productsRepository.softDelete(id);
  },
};
