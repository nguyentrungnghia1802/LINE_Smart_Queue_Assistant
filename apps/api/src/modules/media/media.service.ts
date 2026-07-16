import { randomUUID } from 'node:crypto';

import sharp from 'sharp';

import type { AuthUser } from '../../types/auth.types';
import { AppError } from '../../utils/AppError';

import { mediaRepository } from './media.repository';
import type { MediaStorage } from './media-storage';

interface MediaRepositoryBoundary {
  create: typeof mediaRepository.create;
  findById: typeof mediaRepository.findById;
  markDeleted: typeof mediaRepository.markDeleted;
}

export class MediaService {
  constructor(
    private readonly storage: MediaStorage,
    private readonly repository: MediaRepositoryBoundary,
    private readonly maxOriginalBytes: number
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
    if (!match) throw AppError.badRequest('PNG、JPEG、WebP画像を選択してください');
    const original = Buffer.from(match[2], 'base64');
    if (original.length === 0 || original.length > this.maxOriginalBytes) {
      throw AppError.badRequest('画像ファイルのサイズが上限を超えています');
    }

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(original, {
        failOn: 'warning',
        limitInputPixels: 40_000_000,
      }).metadata();
    } catch {
      throw AppError.badRequest('画像ファイルを読み込めませんでした');
    }
    if (
      !metadata.format ||
      !['jpeg', 'png', 'webp'].includes(metadata.format) ||
      (metadata.pages ?? 1) > 1
    ) {
      throw AppError.badRequest('対応していない画像形式です');
    }

    let body: Buffer;
    try {
      body = await sharp(original, { failOn: 'warning', limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } catch {
      throw AppError.badRequest('画像ファイルを変換できませんでした');
    }
    const date = new Date().toISOString().slice(0, 10);
    const key = `${input.purpose}/${date}/${randomUUID()}.webp`;
    const stored = await this.storage.put({ key, body, contentType: 'image/webp' });
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
      await this.storage.delete(stored.key).catch(() => undefined);
      throw error;
    }
  }

  async delete(id: string, actor: AuthUser) {
    const asset = await this.repository.findById(id);
    if (!asset) throw AppError.notFound('Media asset');
    if (actor.role !== 'admin' && asset.organization_id !== actor.organizationId) {
      throw AppError.forbidden('別の組織の画像は削除できません');
    }
    if (asset.status === 'deleted') return;
    await this.storage.delete(asset.storage_key);
    await this.repository.markDeleted(asset.id);
  }

  private resolveOrganization(requested: string | null | undefined, actor: AuthUser) {
    if (actor.role === 'admin') return requested ?? null;
    if (!actor.organizationId) throw AppError.forbidden('組織が設定されていません');
    if (requested && requested !== actor.organizationId) {
      throw AppError.forbidden('別の組織には画像を登録できません');
    }
    return actor.organizationId;
  }
}
