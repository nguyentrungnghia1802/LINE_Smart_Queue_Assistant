import { pool } from '../../db/client';

export interface MediaAssetRow {
  id: string;
  organization_id: string | null;
  owner_user_id: string | null;
  storage_provider: 'local' | 'mock' | 'object';
  storage_key: string;
  public_url: string;
  purpose: 'organization_logo' | 'product_image';
  content_type: string;
  byte_size: number;
  status: 'active' | 'deleted';
  deleted_at: Date | null;
  created_at: Date;
}

export const mediaRepository = {
  async create(data: Omit<MediaAssetRow, 'id' | 'status' | 'deleted_at' | 'created_at'>) {
    const result = await pool.query<MediaAssetRow>(
      `INSERT INTO media_assets
         (organization_id, owner_user_id, storage_provider, storage_key,
          public_url, purpose, content_type, byte_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        data.organization_id,
        data.owner_user_id,
        data.storage_provider,
        data.storage_key,
        data.public_url,
        data.purpose,
        data.content_type,
        data.byte_size,
      ]
    );
    return result.rows[0];
  },

  async findById(id: string) {
    const result = await pool.query<MediaAssetRow>('SELECT * FROM media_assets WHERE id = $1', [
      id,
    ]);
    return result.rows[0] ?? null;
  },

  async markDeleted(id: string) {
    await pool.query(
      `UPDATE media_assets SET status = 'deleted', deleted_at = NOW()
       WHERE id = $1 AND status = 'active'`,
      [id]
    );
  },
};
