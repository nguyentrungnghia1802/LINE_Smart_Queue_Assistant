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
  timezone?: string;
  lineChannelId?: string;
  lineOaBasicId?: string;
  settings?: Record<string, unknown>;
}

// ── Repository ─────────────────────────────────────────────────────────────────

export class OrganizationsRepository extends BaseRepository {
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

  async create(params: CreateOrganizationParams): Promise<OrganizationRow> {
    const sql = `
      INSERT INTO organizations
        (name, slug, timezone, line_channel_id, line_oa_basic_id, settings)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const rows = await this.query<OrganizationRow>(sql, [
      params.name,
      params.slug,
      params.timezone ?? 'Asia/Bangkok',
      params.lineChannelId ?? null,
      params.lineOaBasicId ?? null,
      JSON.stringify(params.settings ?? {}),
    ]);
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
    role: 'owner' | 'manager' | 'staff' = 'staff'
  ): Promise<OrgMemberRow> {
    const sql = `
      INSERT INTO organization_members (organization_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING *
    `;
    const rows = await this.query<OrgMemberRow>(sql, [organizationId, userId, role]);
    return this.firstOrThrow(rows, 'organizations.addMember');
  }

  async listMembers(organizationId: string): Promise<OrgMemberRow[]> {
    return this.query<OrgMemberRow>(
      `SELECT * FROM organization_members WHERE organization_id = $1 ORDER BY joined_at`,
      [organizationId]
    );
  }
}

export const organizationsRepository = new OrganizationsRepository();
