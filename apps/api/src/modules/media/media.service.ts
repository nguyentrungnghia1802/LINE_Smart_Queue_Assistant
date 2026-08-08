import { randomUUID } from 'node:crypto';

import sharp from 'sharp';

import type { AuthUser } from '../../types/auth.types';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';

import { mediaRepository } from './media.repository';
import type { MediaStorage } from './media-storage';

type SharpMetadata = Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;

interface MediaRepositoryBoundary {
  create: typeof mediaRepository.create;
  findById: typeof mediaRepository.findById;
  markDeleted: typeof mediaRepository.markDeleted;
}

export class MediaService {
  constructor(
    private readonly storage: MediaStorage,
    private readonly repository: MediaRepositoryBoundary,
    private readonly maxOriginalBytes: number,
    private readonly generateKey: () => string = randomUUID
  ) {}

  async upload(
    input: {
      dataUrl: string;
      purpose: 'organization_logo' | 'product_image';
      organizationId?: string | null;
    },
    actor: AuthUser
  ) {
    const organizationId = this.resolveOrganization(input.organizationId, actor);
    const match = /^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i.exec(input.dataUrl);
    if (!match) throw AppError.badRequest('Select a PNG, JPEG, or WebP image');
    const original = Buffer.from(match[2], 'base64');
    if (original.length === 0 || original.length > this.maxOriginalBytes) {
      throw AppError.badRequest('The image exceeds the maximum file size');
    }

    let metadata: SharpMetadata;
    try {
      metadata = await sharp(original, {
        failOn: 'warning',
        limitInputPixels: 40_000_000,
      }).metadata();
    } catch {
      throw AppError.badRequest('The image could not be read');
    }
    if (
      !metadata.format ||
      !['jpeg', 'png', 'webp'].includes(metadata.format) ||
      (metadata.pages ?? 1) > 1
    ) {
      throw AppError.badRequest('The image format is not supported');
    }

    let body: Buffer;
    try {
      body = await sharp(original, { failOn: 'warning', limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } catch {
      throw AppError.badRequest('The image could not be converted');
    }
    const date = new Date().toISOString().slice(0, 10);
    const stored = await this.putWithCollisionRetry(input.purpose, date, body);
    try {
      return await this.repository.create({
        organization_id: organizationId,
        owner_user_id: actor.id,
        storage_provider: this.storage.provider,
        storage_key: stored.key,
        public_url: stored.publicUrl,
        purpose: input.purpose,
        content_type: 'image/webp',
        byte_size: body.length,
      });
    } catch (error) {
      try {
        await this.storage.delete(stored.key);
      } catch {
        logger.error(
          {
            storageProvider: this.storage.provider,
            storageKey: stored.key,
            operation: 'media.upload.cleanup',
          },
          'Media object cleanup failed after database registration failure'
        );
      }
      throw error;
    }
  }

  async delete(id: string, actor: AuthUser) {
    const asset = await this.repository.findById(id);
    if (!asset) throw AppError.notFound('Media asset');
    if (actor.role !== 'admin' && asset.organization_id !== actor.organizationId) {
      throw AppError.forbidden('Images owned by another organization cannot be deleted');
    }
    if (asset.status === 'deleted') return;
    try {
      await this.storage.delete(asset.storage_key);
    } catch (error) {
      if (!isMissingObjectError(error)) {
        logger.warn(
          {
            storageProvider: this.storage.provider,
            storageKey: asset.storage_key,
            operation: 'media.delete',
          },
          'Media object deletion failed; database state remains active for retry'
        );
        throw error;
      }
    }
    try {
      await this.repository.markDeleted(asset.id);
    } catch (error) {
      logger.error(
        {
          storageProvider: this.storage.provider,
          storageKey: asset.storage_key,
          operation: 'media.delete.metadata',
        },
        'Media metadata could not be marked deleted after object deletion'
      );
      throw error;
    }
  }

  private async putWithCollisionRetry(
    purpose: 'organization_logo' | 'product_image',
    date: string,
    body: Buffer
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const key = `${purpose}/${date}/${this.generateKey()}.webp`;
      try {
        return await this.storage.put({ key, body, contentType: 'image/webp' });
      } catch (error) {
        if (!isObjectKeyCollisionError(error) || attempt === 2) throw error;
      }
    }
    throw new Error('Media object key could not be generated');
  }

  private resolveOrganization(requested: string | null | undefined, actor: AuthUser) {
    if (actor.role === 'admin') return requested ?? null;
    if (!actor.organizationId) throw AppError.forbidden('Organization is not configured');
    if (requested && requested !== actor.organizationId) {
      throw AppError.forbidden('Images cannot be registered for another organization');
    }
    return actor.organizationId;
  }
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const value = error as {
    code?: unknown;
    name?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  return String(value.code ?? value.name ?? value.$metadata?.httpStatusCode ?? '');
}

function isObjectKeyCollisionError(error: unknown): boolean {
  const code = errorCode(error);
  return (
    code === 'EEXIST' ||
    code === 'PreconditionFailed' ||
    code === 'ConditionalRequestConflict' ||
    code === '412'
  );
}

function isMissingObjectError(error: unknown): boolean {
  const code = errorCode(error);
  return code === 'NoSuchKey' || code === 'NotFound' || code === '404';
}
