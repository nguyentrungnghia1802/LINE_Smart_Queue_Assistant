import { PoolClient } from 'pg';

import { BaseRepository } from './base.repository';

// ── Row types ──────────────────────────────────────────────────────────────────

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  line_channel_id: string | null;
  line_oa_basic_id: string | null;
  timezone: string;
  settings: Record<string, unknown>;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  latitude?: string | null;
  longitude?: string | null;
  payment_info: string | null;
  public_qr_token: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface OrgMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  joined_at: Date;
}

// ── Params ─────────────────────────────────────────────────────────────────────

export interface CreateOrganizationParams {
  name: string;
  slug: string;
  publicQrToken: string;
  logoUrl?: string | null;
  phone?: string | null;
  address?: string | null;
  paymentInfo?: string | null;
  timezone?: string;
  lineChannelId?: string;
  lineOaBasicId?: string;
  settings?: Record<string, unknown>;
}

// ── Repository ─────────────────────────────────────────────────────────────────

export class OrganizationsRepository extends BaseRepository {
  async listActive(): Promise<OrganizationRow[]> {
    return this.query<OrganizationRow>(
      `SELECT *
       FROM organizations
       WHERE is_active = TRUE
       ORDER BY created_at DESC`
    );
  }

  async findById(id: string): Promise<OrganizationRow | null> {
    return this.queryOne<OrganizationRow>(
      'SELECT * FROM organizations WHERE id = $1 AND is_active = TRUE',
      [id]
    );
  }

  async findBySlug(slug: string): Promise<OrganizationRow | null> {
    return this.queryOne<OrganizationRow>(
      'SELECT * FROM organizations WHERE slug = $1 AND is_active = TRUE',
      [slug]
    );
  }

  async findByPublicToken(token: string): Promise<OrganizationRow | null> {
    return this.queryOne<OrganizationRow>(
      'SELECT * FROM organizations WHERE public_qr_token = $1 AND is_active = TRUE',
      [token]
    );
  }

  async create(params: CreateOrganizationParams, client?: PoolClient): Promise<OrganizationRow> {
    const sql = `
      INSERT INTO organizations
        (
          name, slug, public_qr_token, logo_url, phone, address, payment_info,
          timezone, line_channel_id, line_oa_basic_id, settings
        )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const args = [
      params.name,
      params.slug,
      params.publicQrToken,
      params.logoUrl ?? null,
      params.phone ?? null,
      params.address ?? null,
      params.paymentInfo ?? null,
      params.timezone ?? 'Asia/Bangkok',
      params.lineChannelId ?? null,
      params.lineOaBasicId ?? null,
      JSON.stringify(params.settings ?? {}),
    ];
    const rows = client
      ? await this.queryTx<OrganizationRow>(client, sql, args)
      : await this.query<OrganizationRow>(sql, args);
    return this.firstOrThrow(rows, 'organizations.create');
  }

  // ── Members ─────────────────────────────────────────────────────────────────

  /**
   * Check whether userId has a given role (or any role) in organizationId.
   * Used by auth middleware on every staff/manager request.
   */
  async findMember(organizationId: string, userId: string): Promise<OrgMemberRow | null> {
    return this.queryOne<OrgMemberRow>(
      `SELECT * FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId]
    );
  }

  async addMember(
    organizationId: string,
    userId: string,
    role: 'manager' | 'staff' = 'staff',
    client?: PoolClient
  ): Promise<OrgMemberRow> {
    const sql = `
      INSERT INTO organization_members (organization_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING *
    `;
    const args = [organizationId, userId, role];
    const rows = client
      ? await this.queryTx<OrgMemberRow>(client, sql, args)
      : await this.query<OrgMemberRow>(sql, args);
    return this.firstOrThrow(rows, 'organizations.addMember');
  }

  async listMembers(organizationId: string): Promise<OrgMemberRow[]> {
    return this.query<OrgMemberRow>(
      `SELECT * FROM organization_members WHERE organization_id = $1 AND is_active = TRUE ORDER BY joined_at`,
      [organizationId]
    );
  }

  async findMembershipByUserId(userId: string): Promise<OrgMemberRow | null> {
    return this.queryOne<OrgMemberRow>(
      `SELECT * FROM organization_members WHERE user_id = $1 AND is_active = TRUE ORDER BY joined_at LIMIT 1`,
      [userId]
    );
  }

  async setMemberActive(organizationId: string, userId: string, isActive: boolean): Promise<void> {
    await this.query(
      `UPDATE organization_members SET is_active = $1 WHERE organization_id = $2 AND user_id = $3`,
      [isActive, organizationId, userId]
    );
  }

  async updateOrg(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      publicQrToken: string | null;
      logoUrl: string | null;
      phone: string | null;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
      paymentInfo: string | null;
      settings: Record<string, unknown>;
    }>
  ): Promise<OrganizationRow | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const map: Record<string, string> = {
      name: 'name',
      slug: 'slug',
      publicQrToken: 'public_qr_token',
      logoUrl: 'logo_url',
      phone: 'phone',
      address: 'address',
      latitude: 'latitude',
      longitude: 'longitude',
      paymentInfo: 'payment_info',
      settings: 'settings',
    };
    for (const [key, col] of Object.entries(map)) {
      if (key in data) {
        fields.push(`${col} = $${i++}`);
        const value = (data as Record<string, unknown>)[key];
        values.push(key === 'settings' ? JSON.stringify(value ?? {}) : value);
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    const rows = await this.query<OrganizationRow>(
      `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return rows[0] ?? null;
  }

  async deactivate(id: string): Promise<void> {
    await this.query(
      'UPDATE organizations SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
      [id]
    );
  }
}

export const organizationsRepository = new OrganizationsRepository();
